const os = require('os');

// In-memory relay inbox store
let inbox = [];

// Helper to get local network IP
const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
                return {
                    ip: alias.address,
                    interface: devName,
                    netmask: alias.netmask,
                    mac: alias.mac
                };
            }
        }
    }
    return { ip: '127.0.0.1', interface: 'lo0', netmask: '255.0.0.0', mac: '00:00:00:00:00:00' };
};

// GET /api/network-info
const getNetworkInfo = (req, res) => {
    try {
        const netInfo = getLocalIp();
        const hostname = os.hostname();
        const platform = os.platform();
        const arch = os.arch();
        
        return res.json({
            success: true,
            network: {
                localIp: netInfo.ip,
                interfaceName: netInfo.interface,
                netmask: netInfo.netmask,
                mac: netInfo.mac,
                hostname,
                platform,
                arch,
                port: process.env.PORT || 5000,
                fullAddress: `http://${netInfo.ip}:${process.env.PORT || 5000}`
            }
        });
    } catch (err) {
        console.error("Error retrieving network info:", err);
        return res.status(500).json({ success: false, message: "Failed to read network interfaces." });
    }
};

// POST /api/transmit
const transmitPackage = async (req, res) => {
    try {
        const { targetIp, packageData, mitmTamperEnabled } = req.body;

        if (!packageData) {
            return res.status(400).json({ success: false, message: "Missing packageData payload." });
        }

        const clientIp = req.ip || req.socket.remoteAddress || 'Unknown IP';
        const senderIp = clientIp.replace('::ffff:', '');
        const netInfo = getLocalIp();
        const isForwarded = req.headers['x-qs-forwarded'];

        let finalPackage = { ...packageData };
        let tamperDetails = null;

        // If Live LAN MITM Intercept is active, corrupt the payload bitstream or classification tag
        if (mitmTamperEnabled) {
            const originalLabel = finalPackage.classification?.label || 'CONFIDENTIAL';
            const originalFingerprint = finalPackage.fingerprint || '';
            const originalCiphertext = finalPackage.ciphertextHex || '';

            // Corrupt ciphertext by flipping bytes and alter classification label
            const corruptedCiphertext = originalCiphertext.substring(0, 10) + 'BAD9999' + originalCiphertext.substring(17);
            const corruptedFingerprint = 'ff9999deadbeef' + originalFingerprint.substring(14);
            const tamperedLabel = originalLabel === 'PII' ? 'PUBLIC' : (originalLabel === 'FINANCIAL' ? 'PUBLIC' : 'UNCLASSIFIED');

            finalPackage = {
                ...finalPackage,
                ciphertextHex: corruptedCiphertext,
                fingerprint: corruptedFingerprint,
                classification: {
                    ...finalPackage.classification,
                    label: tamperedLabel
                },
                tamperedByMitm: true
            };

            tamperDetails = {
                mitmAction: "Man-In-The-Middle Intercept Executed",
                alteredLabelFrom: originalLabel,
                alteredLabelTo: tamperedLabel,
                corruptedBytesCount: 8,
                timestamp: new Date().toISOString()
            };
        }

        const entry = {
            id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            receivedAt: new Date().toISOString(),
            senderIp: senderIp === '::1' || senderIp === '127.0.0.1' ? netInfo.ip : senderIp,
            targetIp: targetIp || netInfo.ip,
            package: finalPackage,
            tamperDetails,
            acknowledged: false
        };

        const isLocalTarget = !targetIp || targetIp === netInfo.ip || targetIp === '127.0.0.1' || targetIp === 'localhost';

        // CASE 1: Incoming package forwarded from another node OR targeted to this node
        if (isLocalTarget || isForwarded) {
            inbox.unshift(entry);
            if (inbox.length > 50) inbox = inbox.slice(0, 50);

            return res.json({
                success: true,
                message: mitmTamperEnabled 
                    ? "🚨 Package intercepted & corrupted by Live MITM overlay before delivery!"
                    : "✅ Post-Quantum Encrypted Envelope delivered to local Receiver Inbox.",
                id: entry.id,
                tampered: !!mitmTamperEnabled,
                tamperDetails
            });
        }

        // CASE 2: Remote Target specified (e.g. Laptop 2 at 10.0.8.110) -> Relay directly across LAN
        try {
            const targetUrl = `http://${targetIp}:${process.env.PORT || 5000}/api/transmit`;
            console.log(`[LAN Relay] Transmitting package ${entry.id} over Wi-Fi to remote target: ${targetUrl}`);
            
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-qs-forwarded': 'true'
                },
                body: JSON.stringify({
                    targetIp,
                    packageData: finalPackage,
                    mitmTamperEnabled: false // Already tampered if mitm was active
                }),
                signal: AbortSignal.timeout(5000)
            });

            const remoteResData = await response.json();
            if (remoteResData && remoteResData.success) {
                console.log(`[LAN Relay] ✅ Successfully delivered package to Remote Receiver ${targetIp}`);
                return res.json({
                    success: true,
                    message: `✅ Post-Quantum Document Envelope delivered over Wi-Fi to Receiver Node (${targetIp}).`,
                    id: entry.id,
                    deliveredRemote: true
                });
            } else {
                throw new Error(remoteResData.message || 'Remote node error');
            }

        } catch (relayErr) {
            console.log(`[LAN Relay Notice] Target node ${targetIp} unreachable or offline (${relayErr.message}). Saving to local inbox fallback.`);
            
            // Fallback: Save to local inbox if remote node is offline
            inbox.unshift(entry);
            if (inbox.length > 50) inbox = inbox.slice(0, 50);

            return res.json({
                success: true,
                message: `⚠️ Remote Target (${targetIp}) offline/unreachable. Saved to local inbox fallback.`,
                id: entry.id,
                fallbackLocal: true
            });
        }

    } catch (err) {
        console.error("Transmission Error:", err);
        return res.status(500).json({ success: false, message: "LAN transmission failed." });
    }
};

// GET /api/inbox
const getInbox = (req, res) => {
    const netInfo = getLocalIp();
    // Return all items in local inbox
    return res.json({
        success: true,
        count: inbox.length,
        inbox
    });
};

// POST /api/inbox/:id/ack
const acknowledgePackage = (req, res) => {
    const { id } = req.params;
    inbox = inbox.filter(item => item.id !== id);
    return res.json({ success: true, message: `Package ${id} acknowledged and removed.` });
};

// DELETE /api/inbox/clear
const clearInbox = (req, res) => {
    inbox = [];
    return res.json({ success: true, message: "LAN Relay Inbox cleared." });
};

module.exports = {
    getNetworkInfo,
    transmitPackage,
    getInbox,
    acknowledgePackage,
    clearInbox
};
