const os = require('os');

// In-memory relay inbox store
let inbox = [];
let nodeIdentity = null;

// Active transfer log for terminal-style output on Laptop C
let attackLog = [];

// Intrusion alerts for Laptop A & B (polled via /api/alerts)
let pendingAlerts = [];

// Configurable transmission chunk delay (ms) — Laptop A slowdown for live demo visibility
const CHUNK_DELAY_MS = 600;

// ── PQC SIGNATURE DETECTION ──────────────────────────────────────────────────
const PQC_ALGORITHM_SIGNATURES = [
    'ML-KEM', 'ML-DSA', 'SLH-DSA', 'HQC', 'BIKE', 'CRYSTALS', 'KYBER', 'DILITHIUM', 'SPHINCS', 'FALCON'
];

const isQuantumProtected = (packageData) => {
    if (!packageData) return false;
    const hasPqcHeader = !!(packageData.kemCiphertextHex && packageData.ciphertextHex && packageData.signature);
    const hasPqcAlgo = PQC_ALGORITHM_SIGNATURES.some(sig =>
        (packageData.algorithms || '').toUpperCase().includes(sig)
    );
    return hasPqcHeader || hasPqcAlgo;
};

// ── ATTACK TERMINAL LOGGER ───────────────────────────────────────────────────
const attackTerminalLog = (line) => {
    const entry = `[${new Date().toISOString()}] ${line}`;
    attackLog.unshift(entry);
    if (attackLog.length > 100) attackLog = attackLog.slice(0, 100);
    console.log(entry);
};

// ── INTRUSION ALERT BROADCAST ────────────────────────────────────────────────
const broadcastIntrusionAlert = (attackerIp, targetIp, senderIp, packageId, pqcProtected) => {
    const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        attackerIp,
        senderIp,
        targetIp,
        packageId,
        pqcProtected,
        message: `[SECURITY ALERT] Unauthorized Intrusion / Interception Attempt Detected from Laptop C (IP: ${attackerIp})!`,
        read: false
    };
    pendingAlerts.unshift(alert);
    if (pendingAlerts.length > 50) pendingAlerts = pendingAlerts.slice(0, 50);
    attackTerminalLog(`[INTRUSION BROADCAST] Alert dispatched — Sender:${senderIp}, Target:${targetIp}`);
    return alert;
};

// Helper to get all active non-internal IPv4 network interfaces
const getAllNetworkInterfaces = () => {
    const interfaces = os.networkInterfaces();
    const results = [];
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
                const lowerName = devName.toLowerCase();
                const isTailscale = lowerName.includes('tailscale') || alias.address.startsWith('100.');
                const isWifi = lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('wireless');
                const isEth = lowerName.includes('ethernet') || lowerName.includes('eth');

                let type = 'Local LAN';
                if (isTailscale) type = 'Tailscale (Mesh VPN)';
                else if (isWifi) type = 'Wi-Fi (LAN)';
                else if (isEth) type = 'Ethernet';

                results.push({
                    ip: alias.address,
                    interface: devName,
                    type,
                    netmask: alias.netmask,
                    mac: alias.mac
                });
            }
        }
    }
    return results;
};

// Helper to get primary local network IP
const getLocalIp = () => {
    const all = getAllNetworkInterfaces();
    if (all.length > 0) {
        // Prioritize Wi-Fi or Tailscale if present
        const preferred = all.find(i => i.type.includes('Wi-Fi') || i.type.includes('Tailscale')) || all[0];
        return preferred;
    }
    return { ip: '127.0.0.1', interface: 'lo0', type: 'Loopback', netmask: '255.0.0.0', mac: '00:00:00:00:00:00' };
};

// Helper to resolve any target address/IP/tunnel into a full destination endpoint
const resolveTargetUrl = (target, defaultPort = 5000) => {
    if (!target) return null;
    let clean = String(target).trim();
    if (!clean) return null;

    // If protocol is missing (plain IP, hostname, or IP:port)
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        if (clean.includes(':')) {
            clean = `http://${clean}`;
        } else {
            clean = `http://${clean}:${defaultPort}`;
        }
    }

    try {
        const parsed = new URL(clean);
        if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
            parsed.pathname = '/api/transmit';
        } else if (!parsed.pathname.endsWith('/api/transmit')) {
            parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/api/transmit`;
        }
        return parsed.toString();
    } catch (e) {
        return clean.endsWith('/api/transmit') ? clean : `${clean.replace(/\/+$/, '')}/api/transmit`;
    }
};

// GET /api/network-info
const getNetworkInfo = (req, res) => {
    try {
        const netInfo = getLocalIp();
        const allInterfaces = getAllNetworkInterfaces();
        const hostname = os.hostname();
        const platform = os.platform();
        const arch = os.arch();
        const port = process.env.PORT || 5000;
        
        return res.json({
            success: true,
            network: {
                localIp: netInfo.ip,
                interfaceName: netInfo.interface,
                interfaceType: netInfo.type,
                netmask: netInfo.netmask,
                mac: netInfo.mac,
                hostname,
                platform,
                arch,
                port,
                chunkDelayMs: CHUNK_DELAY_MS,
                fullAddress: `http://${netInfo.ip}:${port}`,
                interfaces: allInterfaces.map(i => ({
                    ip: i.ip,
                    name: i.interface,
                    type: i.type,
                    address: `http://${i.ip}:${port}`,
                    uiUrl: `http://${i.ip}:5173`
                }))
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
        const { targetIp, targetPort, gatewayIp, packageData, mitmTamperEnabled, chunkDelaySec } = req.body;

        if (!packageData) {
            return res.status(400).json({ success: false, message: "Missing packageData payload." });
        }

        // ── ARTIFICIAL CHUNK DELAY (demo visibility window for Laptop C detection) ──
        const delayMs = (chunkDelaySec !== undefined && chunkDelaySec !== null) ? Math.max(100, Number(chunkDelaySec) * 1000) : CHUNK_DELAY_MS;
        await new Promise(r => setTimeout(r, delayMs));

        // ── DETECT QUANTUM ENCRYPTION STATE ──────────────────────────────────────
        const pqcProtected = isQuantumProtected(packageData);

        const clientIp = req.ip || req.socket.remoteAddress || 'Unknown IP';
        const senderIp = clientIp.replace('::ffff:', '');
        const realSenderIp = req.headers['x-qs-sender'] || (senderIp === '::1' || senderIp === '127.0.0.1' ? getLocalIp().ip : senderIp);
        const netInfo = getLocalIp();
        const allInterfaces = getAllNetworkInterfaces();
        const isForwarded = req.headers['x-qs-forwarded'];
        const isGatewayIntercept = req.headers['x-qs-gateway-intercept'];
        const originalDestination = req.headers['x-qs-destination'] || req.body.intendedRecipient;

        let finalPackage = { ...packageData };
        let tamperDetails = null;

        // ── MITM TAMPER — respects PQC protection state ──────────────────────────
        if (mitmTamperEnabled) {
            if (pqcProtected) {
                attackTerminalLog(`[ATTACK STATUS] Active File Transfer Detected (${realSenderIp} -> ${targetIp || 'local'})`);
                attackTerminalLog(`[ATTACK FAILED] Target file is Quantum-Encrypted. Cannot disrupt payload.`);
                attackTerminalLog(`[ATTACK FAILED] ML-KEM-768 lattice ciphertext is computationally infeasible to break.`);
                attackTerminalLog(`[ATTACK FAILED] ML-DSA signature will detect any byte modification at receiver.`);
            } else {
                attackTerminalLog(`[ATTACK STATUS] Active File Transfer Detected (${realSenderIp} -> ${targetIp || 'local'})`);
                attackTerminalLog(`[ATTACK STATUS] Target file is UNENCRYPTED. Proceeding with payload corruption...`);

                const originalLabel = finalPackage.classification?.label || 'CONFIDENTIAL';
                const originalFingerprint = finalPackage.fingerprint || '';
                const originalCiphertext = finalPackage.ciphertextHex || '';
                const corruptedCiphertext = originalCiphertext.substring(0, 10) + 'BAD9999' + originalCiphertext.substring(17);
                const corruptedFingerprint = 'ff9999deadbeef' + originalFingerprint.substring(14);
                const tamperedLabel = originalLabel === 'PII' ? 'PUBLIC' : (originalLabel === 'FINANCIAL' ? 'PUBLIC' : 'UNCLASSIFIED');

                finalPackage = {
                    ...finalPackage,
                    ciphertextHex: corruptedCiphertext,
                    fingerprint: corruptedFingerprint,
                    classification: { ...finalPackage.classification, label: tamperedLabel },
                    tamperedByMitm: true
                };

                tamperDetails = {
                    mitmAction: "Man-In-The-Middle Intercept Executed",
                    alteredLabelFrom: originalLabel,
                    alteredLabelTo: tamperedLabel,
                    corruptedBytesCount: 8,
                    timestamp: new Date().toISOString()
                };

                attackTerminalLog(`[ATTACK SUCCESS] Payload corrupted: label -> ${tamperedLabel}, ciphertext bit-flipped.`);
            }
        }

        // Determine if target points to this local host (any local interface or localhost)
        const localIps = ['127.0.0.1', 'localhost', netInfo.ip, ...allInterfaces.map(i => i.ip)];
        let targetHost = (targetIp || '').trim();
        try {
            if (targetHost.startsWith('http://') || targetHost.startsWith('https://')) {
                targetHost = new URL(targetHost).hostname;
            } else if (targetHost.includes(':')) {
                targetHost = targetHost.split(':')[0];
            }
        } catch (e) {
            // Keep targetHost as is
        }

        const isLocalTarget = !targetIp || localIps.includes(targetHost) || targetHost === 'localhost' || targetHost === '';

        // Check if this node is acting as an intermediary (intercepting traffic intended for another destination)
        const isInterceptedTraffic = !!isGatewayIntercept || (!!originalDestination && !localIps.includes(originalDestination.split(':')[0]) && originalDestination !== '127.0.0.1');

        const entry = {
            id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            receivedAt: new Date().toISOString(),
            senderIp: realSenderIp,
            targetIp: targetIp || netInfo.ip,
            intendedTarget: originalDestination || targetIp,
            isIntercepted: isInterceptedTraffic,
            pqcProtected,
            package: finalPackage,
            tamperDetails,
            acknowledged: false
        };

        // IF GATEWAY IP (Laptop C) is set by Sender (Laptop A), route packet via Laptop C!
        if (gatewayIp && !localIps.includes(gatewayIp.trim()) && gatewayIp.trim() !== '') {
            try {
                const gatewayUrl = resolveTargetUrl(gatewayIp, targetPort || 5000);
                console.log(`[Adversary Gateway] Routing package ${entry.id} via Intermediary Node C (${gatewayUrl}) intended for ${targetIp}`);
                
                const response = await fetch(gatewayUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-qs-destination': targetIp,
                        'x-qs-gateway-intercept': 'true',
                        'x-qs-sender': netInfo.ip
                    },
                    body: JSON.stringify({
                        targetIp: gatewayIp,
                        intendedRecipient: targetIp,
                        packageData: finalPackage,
                        mitmTamperEnabled: false
                    }),
                    signal: AbortSignal.timeout(8000)
                });

                const remoteResData = await response.json();
                if (remoteResData && remoteResData.success) {
                    console.log(`[Adversary Gateway] ✅ Successfully routed package to Attacker Node C (${gatewayIp})`);
                    return res.json({
                        success: true,
                        message: `🚨 Package dispatched to Attacker Gateway (${gatewayIp}) intended for Laptop B (${targetIp}).`,
                        id: entry.id,
                        routedViaGateway: true,
                        gatewayIp,
                        targetIp
                    });
                } else {
                    throw new Error(remoteResData.message || 'Gateway node error');
                }
            } catch (gwErr) {
                console.log(`[Gateway Error] Attacker Gateway (${gatewayIp}) unreachable: ${gwErr.message}.`);
            }
        }

        // CASE 1: Incoming package forwarded to this node, targeted to this node, OR intercepted at this node
        if (isLocalTarget || isForwarded || isInterceptedTraffic) {
            inbox.unshift(entry);
            if (inbox.length > 50) inbox = inbox.slice(0, 50);

            // Active stream detection & intrusion alert logging
            const displayTarget = entry.intendedTarget || entry.targetIp || 'Local Inbox';
            attackTerminalLog(`[ATTACK STATUS] Active File Transfer Detected (${entry.senderIp} -> ${displayTarget})`);
            if (pqcProtected) {
                attackTerminalLog(`[ATTACK FAILED] Target file is Quantum-Encrypted. Cannot disrupt payload.`);
                attackTerminalLog(`[ATTACK FAILED] PQC Suite: ${packageData.algorithms || 'ML-KEM + ML-DSA'}`);
                attackTerminalLog(`[ATTACK FAILED] ML-DSA signature will detect any modification. Forwarding intact.`);
            } else {
                attackTerminalLog(`[ATTACK STATUS] Target file is UNENCRYPTED — payload is readable and alterable.`);
            }
            broadcastIntrusionAlert(netInfo.ip, displayTarget, entry.senderIp, entry.id, pqcProtected);

            return res.json({
                success: true,
                message: isInterceptedTraffic
                    ? `🚨 IN-FLIGHT TRAFFIC CAPTURED: Sender ${entry.senderIp} ➔ Target ${entry.intendedTarget}!`
                    : mitmTamperEnabled
                    ? "🚨 Package intercepted & corrupted by Live MITM overlay before delivery!"
                    : "✅ Post-Quantum Encrypted Envelope delivered to local Receiver Inbox.",
                id: entry.id,
                isIntercepted: isInterceptedTraffic,
                intendedTarget: entry.intendedTarget,
                pqcProtected,
                tampered: !!tamperDetails,
                tamperDetails
            });
        }

        // CASE 2: Remote Target specified (LAN IP, Tailscale IP, or Public Tunnel URL) -> Relay directly
        try {
            const portToUse = targetPort || process.env.PORT || 5000;
            const targetUrl = resolveTargetUrl(targetIp, portToUse);
            console.log(`[Cross-Network Relay] Transmitting package ${entry.id} to destination: ${targetUrl}`);
            
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-qs-forwarded': 'true',
                    'x-qs-sender': netInfo.ip
                },
                body: JSON.stringify({
                    targetIp,
                    packageData: finalPackage,
                    mitmTamperEnabled: false // Already tampered if mitm was active
                }),
                signal: AbortSignal.timeout(8000)
            });

            const remoteResData = await response.json();
            if (remoteResData && remoteResData.success) {
                console.log(`[Cross-Network Relay] ✅ Successfully delivered package to Remote Receiver: ${targetUrl}`);
                return res.json({
                    success: true,
                    message: `✅ Post-Quantum Document Envelope delivered to Receiver Node (${targetIp}).`,
                    id: entry.id,
                    deliveredRemote: true,
                    targetUrl
                });
            } else {
                throw new Error(remoteResData.message || 'Remote node error');
            }

        } catch (relayErr) {
            console.log(`[Cross-Network Relay Notice] Target node ${targetIp} unreachable (${relayErr.message}). Saving to local inbox fallback.`);
            
            // Fallback: Save to local inbox if remote node is offline
            inbox.unshift(entry);
            if (inbox.length > 50) inbox = inbox.slice(0, 50);

            return res.json({
                success: true,
                message: `⚠️ Remote Target (${targetIp}) unreachable (${relayErr.message}). Saved to local inbox fallback.`,
                id: entry.id,
                fallbackLocal: true
            });
        }

    } catch (err) {
        console.error("Transmission Error:", err);
        return res.status(500).json({ success: false, message: "Transmission failed." });
    }
};

// POST /api/intercept/forward (Used by Laptop C to relay intercepted package to Laptop B)
const forwardInterceptedPackage = async (req, res) => {
    try {
        const { packageId, tamper, destinationIp, destinationPort } = req.body;
        const entry = inbox.find(p => p.id === packageId);
        if (!entry) {
            return res.status(404).json({ success: false, message: "Package not found in intercept buffer." });
        }

        const dest = destinationIp || entry.intendedTarget || entry.targetIp;
        const pqcProtected = entry.pqcProtected || isQuantumProtected(entry.package);
        let pkgToSend = { ...entry.package };
        let tamperDetails = null;

        attackTerminalLog(`[ATTACK STATUS] Active File Transfer Detected (${entry.senderIp} -> ${dest})`);

        if (tamper) {
            if (pqcProtected) {
                // PQC mode: attack is attempted but will be rejected by ML-DSA at Laptop B
                attackTerminalLog(`[ATTACK FAILED] Target file is Quantum-Encrypted. Cannot disrupt payload.`);
                attackTerminalLog(`[ATTACK FAILED] PQC Suite: ${entry.package.algorithms || 'ML-KEM + ML-DSA'}`);
                attackTerminalLog(`[ATTACK FAILED] Any ciphertext modification will trigger ML-DSA signature mismatch at Laptop B.`);

                const originalCiphertext = pkgToSend.ciphertextHex || '';
                const originalFingerprint = pkgToSend.fingerprint || '';
                pkgToSend = {
                    ...pkgToSend,
                    ciphertextHex: originalCiphertext.substring(0, 10) + 'BAD9999' + originalCiphertext.substring(17),
                    fingerprint: 'ff9999deadbeef' + originalFingerprint.substring(14),
                    tamperedByMitm: true
                };
                tamperDetails = {
                    mitmAction: "Adversary Node C ATTEMPTED corruption on PQC-Protected file — BLOCKED by ML-DSA",
                    pqcBlocked: true,
                    corruptedBytesCount: 8,
                    timestamp: new Date().toISOString()
                };
            } else {
                // Non-PQC mode: full corruption succeeds
                attackTerminalLog(`[ATTACK STATUS] Target file is UNENCRYPTED — corrupting payload bytes...`);

                const originalLabel = pkgToSend.classification?.label || 'CONFIDENTIAL';
                const originalFingerprint = pkgToSend.fingerprint || '';
                const originalCiphertext = pkgToSend.ciphertextHex || '';
                const tamperedLabel = originalLabel === 'PII' ? 'PUBLIC' : (originalLabel === 'FINANCIAL' ? 'PUBLIC' : 'UNCLASSIFIED');

                pkgToSend = {
                    ...pkgToSend,
                    ciphertextHex: originalCiphertext.substring(0, 10) + 'BAD9999' + originalCiphertext.substring(17),
                    fingerprint: 'ff9999deadbeef' + originalFingerprint.substring(14),
                    classification: { ...pkgToSend.classification, label: tamperedLabel },
                    tamperedByMitm: true
                };
                tamperDetails = {
                    mitmAction: "Adversary Node C Intercepted & Corrupted Bits In-Flight (NO PQC PROTECTION)",
                    alteredLabelFrom: originalLabel,
                    alteredLabelTo: tamperedLabel,
                    corruptedBytesCount: 8,
                    timestamp: new Date().toISOString()
                };

                attackTerminalLog(`[ATTACK SUCCESS] Payload corrupted: label -> ${tamperDetails.alteredLabelTo}, ciphertext bit-flipped.`);
            }
        } else {
            attackTerminalLog(`[ATTACK STATUS] Passing packet unaltered to Laptop B (${dest}). No attack applied.`);
        }

        // Broadcast intrusion alert to Laptop A & B
        const attackerIp = getLocalIp().ip;
        broadcastIntrusionAlert(attackerIp, dest, entry.senderIp, entry.id, pqcProtected);

        const portToUse = destinationPort || process.env.PORT || 5000;
        const targetUrl = resolveTargetUrl(dest, portToUse);
        console.log(`[Attacker C Forward] Relaying ${entry.id} to Laptop B (${targetUrl}) | Tampered: ${!!tamper} | PQC: ${pqcProtected}`);

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-qs-forwarded': 'true',
                'x-qs-intercepted-by': attackerIp,
                'x-qs-sender': entry.senderIp
            },
            body: JSON.stringify({
                targetIp: dest,
                packageData: pkgToSend,
                mitmTamperEnabled: !!tamper,
                tamperDetails
            }),
            signal: AbortSignal.timeout(8000)
        });

        const remoteResData = await response.json();
        if (remoteResData && remoteResData.success) {
            entry.relayedAt = new Date().toISOString();
            entry.relayedTo = dest;
            entry.tampered = !!tamper;
            return res.json({
                success: true,
                pqcProtected,
                attackBlocked: tamper && pqcProtected,
                message: tamper
                    ? pqcProtected
                        ? `🔒 ATTACK ATTEMPTED on PQC file — ML-DSA will REJECT at Laptop B!`
                        : `🚨 Tampered payload injected and delivered to Laptop B (${dest})!`
                    : `✅ Clean payload forwarded to Laptop B (${dest}).`,
                targetUrl
            });
        } else {
            throw new Error(remoteResData.message || "Failed to deliver to destination node");
        }
    } catch (err) {
        console.error("Intercept forward error:", err);
        return res.status(500).json({ success: false, message: `Forward failed: ${err.message}` });
    }
};

// GET /api/inbox
const getInbox = (req, res) => {
    return res.json({
        success: true,
        count: inbox.length,
        inbox
    });
};

// GET /api/alerts — Laptop A & B poll this to receive real-time intrusion alerts
const getAlerts = (req, res) => {
    const unread = pendingAlerts.filter(a => !a.read);
    pendingAlerts = pendingAlerts.map(a => ({ ...a, read: true }));
    return res.json({
        success: true,
        count: unread.length,
        alerts: unread
    });
};

// GET /api/attack-log — Returns Laptop C's attacker terminal log
const getAttackLog = (req, res) => {
    return res.json({
        success: true,
        count: attackLog.length,
        log: attackLog
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

// POST /api/identity
const registerIdentity = (req, res) => {
    try {
        const { kemPublicKeyHex, sigPublicKeyHex, kemLabel, sigLabel, keysBySuite } = req.body;
        if (!kemPublicKeyHex || !sigPublicKeyHex) {
            return res.status(400).json({ success: false, message: "Missing public keys in identity payload." });
        }
        nodeIdentity = {
            kemPublicKeyHex,
            sigPublicKeyHex,
            kemLabel,
            sigLabel,
            keysBySuite: keysBySuite || {},
            registeredAt: new Date().toISOString()
        };
        console.log(`[PQC Identity] Registered node public identity (${kemLabel} / ${sigLabel}) with multi-tier suites:`, Object.keys(nodeIdentity.keysBySuite));
        return res.json({ success: true, message: "Node PQC identity registered successfully.", identity: nodeIdentity });
    } catch (err) {
        console.error("Identity Registration Error:", err);
        return res.status(500).json({ success: false, message: "Failed to register node identity." });
    }
};

// GET /api/identity
const getIdentity = (req, res) => {
    if (!nodeIdentity) {
        return res.status(404).json({ success: false, message: "No node identity registered yet." });
    }
    return res.json({ success: true, identity: nodeIdentity });
};

module.exports = {
    getNetworkInfo,
    transmitPackage,
    forwardInterceptedPackage,
    getInbox,
    acknowledgePackage,
    clearInbox,
    registerIdentity,
    getIdentity,
    getAlerts,
    getAttackLog
};
