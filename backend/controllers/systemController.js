const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const getSystemBattery = async (req, res) => {
    try {
        let batteryLevel = 80;
        let pluggedIn = false;
        let source = 'fallback';

        const platform = process.platform;

        if (platform === 'darwin') {
            // macOS telemetry via pmset
            const { stdout } = await execPromise('pmset -g batt');
            const isAC = stdout.includes("AC Power");
            const match = stdout.match(/(\d+)%/);
            if (match) {
                batteryLevel = parseInt(match[1], 10);
            }
            const isCharging = stdout.includes('charging') || stdout.includes('charged') || isAC;
            pluggedIn = isCharging;
            source = 'macOS pmset OS Telemetry';
        } else if (platform === 'win32') {
            // Windows telemetry — 3-method fallback chain
            // BatteryStatus key: 1=Discharging, 2=AC Power, 3=Fully Charged,
            // 6=Charging, 7=Charging+High, 8=Charging+Low, 9=Charging+Critical
            const PLUGGED_IN_STATUSES = new Set([2, 3, 6, 7, 8, 9]);

            // Method 1: PowerShell Get-CimInstance (preferred — works on Windows 10/11,
            // WMIC is deprecated/removed on Windows 11 22H2+)
            let winSuccess = false;
            try {
                const psCmd = 'powershell -NoProfile -NonInteractive -Command "' +
                    'Get-CimInstance -ClassName Win32_Battery | ' +
                    'Select-Object EstimatedChargeRemaining, BatteryStatus | ' +
                    'ConvertTo-Json -Compress"';
                const { stdout: psOut } = await execPromise(psCmd, { timeout: 5000 });
                const trimmed = psOut.trim();
                if (trimmed && trimmed !== 'null' && trimmed.length > 2) {
                    // Output can be a single object {} or an array [{}] if multiple batteries
                    const parsed = JSON.parse(trimmed);
                    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
                    if (obj && obj.EstimatedChargeRemaining != null) {
                        batteryLevel = parseInt(obj.EstimatedChargeRemaining, 10);
                        if (obj.BatteryStatus != null) {
                            pluggedIn = PLUGGED_IN_STATUSES.has(parseInt(obj.BatteryStatus, 10));
                        }
                        source = 'Windows PowerShell CIM Telemetry';
                        winSuccess = true;
                    }
                }
            } catch (psErr) {
                // PowerShell unavailable or blocked by policy — fall through to WMIC
            }

            // Method 2: WMIC (legacy — Windows 7/8/10 early builds)
            if (!winSuccess) {
                try {
                    const { stdout: wmicOut } = await execPromise(
                        'WMIC Path Win32_Battery Get EstimatedChargeRemaining,BatteryStatus /Format:List',
                        { timeout: 5000 }
                    );
                    const levelMatch = wmicOut.match(/EstimatedChargeRemaining=(\d+)/i);
                    const statusMatch = wmicOut.match(/BatteryStatus=(\d+)/i);
                    if (levelMatch) {
                        batteryLevel = parseInt(levelMatch[1], 10);
                        winSuccess = true;
                    }
                    if (statusMatch) {
                        pluggedIn = PLUGGED_IN_STATUSES.has(parseInt(statusMatch[1], 10));
                    }
                    source = 'Windows WMIC OS Telemetry';
                } catch (wmicErr) {
                    // WMIC not available — fall through to last resort
                }
            }

            // Method 3: PowerShell Get-WmiObject (last resort for older Win10 where CIM may fail)
            if (!winSuccess) {
                try {
                    const psCmd2 = 'powershell -NoProfile -NonInteractive -Command "' +
                        'Get-WmiObject -Class Win32_Battery | ' +
                        'Select-Object EstimatedChargeRemaining, BatteryStatus | ' +
                        'ConvertTo-Json -Compress"';
                    const { stdout: wmiOut } = await execPromise(psCmd2, { timeout: 5000 });
                    const trimmed2 = wmiOut.trim();
                    if (trimmed2 && trimmed2 !== 'null' && trimmed2.length > 2) {
                        const parsed2 = JSON.parse(trimmed2);
                        const obj2 = Array.isArray(parsed2) ? parsed2[0] : parsed2;
                        if (obj2 && obj2.EstimatedChargeRemaining != null) {
                            batteryLevel = parseInt(obj2.EstimatedChargeRemaining, 10);
                            if (obj2.BatteryStatus != null) {
                                pluggedIn = PLUGGED_IN_STATUSES.has(parseInt(obj2.BatteryStatus, 10));
                            }
                            source = 'Windows PowerShell WMI Telemetry';
                            winSuccess = true;
                        }
                    }
                } catch (wmiErr) {
                    source = 'Windows Heuristic Telemetry (No Battery Detected)';
                }
            }
        } else if (platform === 'linux') {
            // Linux telemetry via upower / sysfs
            try {
                const { stdout } = await execPromise('upower -i $(upower -e | grep battery) | grep -E "percentage|state"');
                const levelMatch = stdout.match(/percentage:\s*(\d+)%/);
                if (levelMatch) {
                    batteryLevel = parseInt(levelMatch[1], 10);
                }
                pluggedIn = stdout.includes('charging') || stdout.includes('fully-charged');
                source = 'Linux UPower OS Telemetry';
            } catch (linErr) {
                source = 'Linux Heuristic Telemetry';
            }
        }

        return res.json({
            success: true,
            batteryLevel,
            pluggedIn,
            source,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error("Error reading OS battery telemetry:", err);
        return res.json({
            success: true,
            batteryLevel: 75,
            pluggedIn: true,
            source: 'Default System Fallback',
            error: err.message
        });
    }
};

module.exports = { getSystemBattery };
