

const runOsintScan = async (req, res) => {
    try {
        const apiKey = process.env.WHATISMYIP_API_KEY;
        const baseUrl = 'https://api.whatismyip.com';
        
        let scoreModifier = 0;
        let logs = [];
        
        // Step 1: Get IP
        const ipRes = await fetch(`${baseUrl}/ip.php?key=${apiKey}&output=json`);
        const ipDataRaw = await ipRes.json();
        const userIp = ipDataRaw.ip_address;

        if (!userIp) throw new Error('Could not fetch IP from provider.');
        logs.push(`[Backend] IP Identified: ${userIp}`);

        // Step 2: Lookup ISP/Geo
        const lookupRes = await fetch(`${baseUrl}/ip-address-lookup.php?key=${apiKey}&input=${userIp}&output=json`);
        const lookupData = await lookupRes.json();
        const info = lookupData.ip_address_lookup ? lookupData.ip_address_lookup[0] : null;

        let ipData = { ip: userIp };
        let networkClassification = 'Standard ISP';

        if (info && info.status === 'ok') {
            ipData = {
                ip: userIp,
                isp: info.isp,
                city: info.city,
                country: info.country,
                region: info.region
            };

            const isp = (info.isp || '').toLowerCase();
            const publicKeywords = ['hotel', 'guest', 'free', 'airport', 'library', 'cafe', 'public', 'boingo', 'hospitality', 'starbucks', 'transit', 'mcdonalds', 'mall'];
            const enterpriseKeywords = ['corporate', 'enterprise', 'technologies', 'ibm', 'bank', 'hospital', 'university', 'college', 'institute', 'private limited', 'pvt ltd', 'inc', 'llc', 'aviation', 'defense', 'solutions'];
            const cellularKeywords = ['jio', 'airtel mobile', 'vodafone', 't-mobile', 'verizon wireless', 'at&t mobility', 'cellular'];
            const residentialKeywords = ['broadband', 'fibernet', 'act ', 'hathway', 'excitel', 'comcast', 'spectrum', 'xfinity', 'telecom', 'communications', 'network', 'isp'];

            if (publicKeywords.some(kw => isp.includes(kw))) {
                scoreModifier -= 40;
                networkClassification = 'Public/Guest ISP';
                logs.push(`[Backend] WARNING: Public/Guest ISP Detected -> ${info.isp} (-40 pts)`);
            } else if (enterpriseKeywords.some(kw => isp.includes(kw))) {
                scoreModifier += 30;
                networkClassification = 'Enterprise Infrastructure';
                logs.push(`[Backend] Enterprise Infrastructure Detected -> ${info.isp} (+30 pts)`);
            } else if (cellularKeywords.some(kw => isp.includes(kw))) {
                scoreModifier += 5;
                networkClassification = 'Cellular/Mobile Carrier';
                logs.push(`[Backend] Cellular/Mobile Carrier Detected -> ${info.isp} (+5 pts)`);
            } else if (residentialKeywords.some(kw => isp.includes(kw))) {
                scoreModifier += 20;
                networkClassification = 'Residential Broadband';
                logs.push(`[Backend] Residential Broadband Detected -> ${info.isp} (+20 pts)`);
            } else {
                scoreModifier += 10;
                logs.push(`[Backend] Unclassified ISP Detected -> ${info.isp} (+10 pts)`);
            }
        }

        // Step 3: Proxy/VPN Tunnel Status
        const proxyRes = await fetch(`${baseUrl}/proxy.php?key=${apiKey}&input=${userIp}&output=json`);
        const proxyData = await proxyRes.json();
        const proxyInfo = proxyData['proxy-check'] ? proxyData['proxy-check'][1] : null;
        
        let proxyDetected = false;
        if (proxyInfo && proxyInfo.is_proxy === 'yes') {
            proxyDetected = true;
            scoreModifier += 50;
            logs.push(`[Backend] ${proxyInfo.proxy_type} overlay detected! SECURE TUNNEL ESTABLISHED.`);
        } else {
            logs.push(`[Backend] No active VPN/Proxy overlays detected.`);
        }

        // Step 4: DNSBL Blacklist
        const blRes = await fetch(`${baseUrl}/domain-black-list.php?key=${apiKey}&input=${userIp}&output=json`);
        const blData = await blRes.json();
        
        const blInfo = blData.domain_blacklist ? blData.domain_blacklist[0] : {};
        const isBlacklisted = Object.values(blInfo).some(val => val === true);
        
        if (isBlacklisted) {
            scoreModifier -= 30;
            logs.push(`[Backend] WARNING: IP Reputation is BLACKLISTED. (-30 pts)`);
        } else {
            logs.push(`[Backend] IP Reputation is CLEAN.`);
        }

        return res.json({
            success: true,
            data: {
                ipData,
                scoreModifier,
                networkClassification,
                proxyDetected,
                isBlacklisted,
                logs
            }
        });

    } catch (error) {
        console.error("OSINT API Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "OSINT API Connection failed. Applying heuristic fallback matrix...",
            fallback: {
                ipData: { ip: "192.168.1.100 (Fallback)", isp: "Local Mock ISP", city: "Localhost", country: "Local" },
                scoreModifier: 10,
                logs: [
                    '[Backend] API Connection failed. Applying heuristic fallback matrix...',
                    '[Backend] No active VPN/Proxy overlays detected (Simulated).',
                    '[Backend] IP Reputation is CLEAN (Simulated).'
                ]
            }
        });
    }
};

module.exports = { runOsintScan };
