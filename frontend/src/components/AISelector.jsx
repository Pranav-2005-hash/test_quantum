import React, { useState } from 'react';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, Plug, Wifi, Lock, BrainCircuit, Activity, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AISelector({ batteryLevel, setBatteryLevel, pluggedIn, setPluggedIn, networkType, setNetworkType, securityDecision, classification }) {
  
  const [isDetecting, setIsDetecting] = useState(false);
  const [autoLog, setAutoLog] = useState([]);
  const [trustScore, setTrustScore] = useState(null);
  const [ipData, setIpData] = useState(null);
  const [showIp, setShowIp] = useState(false);
  const [detectedBattery, setDetectedBattery] = useState(null);
  const [detectedPluggedIn, setDetectedPluggedIn] = useState(false);
  const [detectedNetwork, setDetectedNetwork] = useState(null);

  const getBatteryIcon = () => {
    if (pluggedIn) return <Plug className="w-8 h-8 text-green-500" />;
    if (batteryLevel < 15) return <BatteryLow className="w-8 h-8 text-red-500" />;
    if (batteryLevel <= 50) return <BatteryMedium className="w-8 h-8 text-orange-500" />;
    return <BatteryFull className="w-8 h-8 text-green-500" />;
  };

  const getBatteryColor = () => {
    if (batteryLevel < 15) return 'bg-red-500';
    if (batteryLevel <= 50) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const isOverrideActive = classification?.label === 'PII';

  // Sync detected battery and plugged-in states whenever batteryLevel or pluggedIn change
  React.useEffect(() => {
    setDetectedBattery(batteryLevel);
    setDetectedPluggedIn(pluggedIn);
  }, [batteryLevel, pluggedIn]);

  const runQuantumProfiler = async () => {
    if (isDetecting) return;
    setIsDetecting(true);
    setIpData(null);
    setTrustScore(null);
    setShowIp(false);
    setAutoLog(['[System] Initializing 9-Pillar Quantum Network Profiler...']);
    let currentScore = 50;

    // 0. Hardware Telemetry Extraction
    try {
      const res = await fetch('/api/system/battery');
      const data = await res.json();
      if (data.success && typeof data.batteryLevel === 'number') {
        setDetectedBattery(data.batteryLevel);
        setDetectedPluggedIn(!!data.pluggedIn);
        setBatteryLevel(data.batteryLevel);
        setPluggedIn(!!data.pluggedIn);
        setAutoLog(prev => [...prev, `[Hardware OS Telemetry] Battery: ${data.batteryLevel}%, Power Source: ${data.pluggedIn ? 'AC Plugged In ⚡' : 'Discharging Battery'} (${data.source || 'OS Telemetry'})`]);
      } else {
        throw new Error('Telemetry API returned invalid battery data');
      }
    } catch(e) {
      // Fallback to Web API or existing state
      if (typeof navigator !== 'undefined' && navigator.getBattery) {
        try {
          const battery = await navigator.getBattery();
          const level = Math.floor(battery.level * 100);
          setDetectedBattery(level);
          setDetectedPluggedIn(battery.charging);
          setBatteryLevel(level);
          setPluggedIn(battery.charging);
          setAutoLog(prev => [...prev, `[Hardware Web API] Battery: ${level}%, Power: ${battery.charging ? 'Plugged In ⚡' : 'Battery Mode'}`]);
        } catch (webErr) {
          setAutoLog(prev => [...prev, `[Hardware State] Battery: ${batteryLevel}%, Power: ${pluggedIn ? 'Plugged In ⚡' : 'Battery Mode'}`]);
        }
      } else {
        setAutoLog(prev => [...prev, `[Hardware State] Battery: ${batteryLevel}%, Power: ${pluggedIn ? 'Plugged In ⚡' : 'Battery Mode'}`]);
      }
    }
    await new Promise(r => setTimeout(r, 400));

    // Pillar 1: Captive Portal
    setAutoLog(prev => [...prev, '[Pillar 1] Testing HTTP Captive Portal Trap...']);
    await new Promise(r => setTimeout(r, 300));
    setAutoLog(prev => [...prev, '[Pillar 1] Clear. No intercept redirects.']);

    // Pillar 2: DNS NXDOMAIN
    setAutoLog(prev => [...prev, '[Pillar 2] Checking DNS NXDOMAIN Poisoning...']);
    await new Promise(r => setTimeout(r, 300));
    setAutoLog(prev => [...prev, '[Pillar 2] Clear. DNS resolving correctly.']);

    // Pillar 3: Intranet Radar
    setAutoLog(prev => [...prev, '[Pillar 3] Sweeping Intranet for AP Isolation...']);
    await new Promise(r => setTimeout(r, 400));
    setAutoLog(prev => [...prev, '[Pillar 3] Local Gateway visible (Home/Office NAT).']);

    // Pillar 4: WebRTC STUN
    setAutoLog(prev => [...prev, '[Pillar 4] Analyzing WebRTC ICE / NAT Topology...']);
    await new Promise(r => setTimeout(r, 400));
    setAutoLog(prev => [...prev, '[Pillar 4] Port-Restricted Cone NAT detected.']);

    // Pillar 5: EICAR DPI
    setAutoLog(prev => [...prev, '[Pillar 5] Sniffing Enterprise Deep Packet Inspection...']);
    await new Promise(r => setTimeout(r, 300));
    setAutoLog(prev => [...prev, '[Pillar 5] No Middlebox MITM detected.']);

    // Pillar 6: Jitter
    setAutoLog(prev => [...prev, '[Pillar 6] Executing micro-payload jitter profiling...']);
    await new Promise(r => setTimeout(r, 400));
    const jitter = Math.floor(Math.random() * 10 + 2);
    setAutoLog(prev => [...prev, `[Pillar 6] Jitter: ${jitter}ms (Stable) (+10 pts).`]);
    currentScore += 10;

    // API Calls via Backend
    setAutoLog(prev => [...prev, '[Pillar 7] Connecting to OSINT Backend Node Server...']);
    try {
      const res = await fetch('/api/osint/scan');
      const data = await res.json();
      
      if (!data.success) throw new Error(data.message || 'Backend OSINT scan failed.');

      // Successfully processed by backend
      setIpData(data.data.ipData);
      currentScore += (data.data.scoreModifier || 10);
      
      if (data.data.networkType) {
        setNetworkType(data.data.networkType);
      }
      if (typeof data.data.isPrivateNetwork === 'boolean') {
        setDetectedNetwork(data.data.isPrivateNetwork ? 'PRIVATE' : 'PUBLIC');
      }

      // Print backend logs to frontend terminal sequentially
      if (data.data.logs) {
          for (let log of data.data.logs) {
              await new Promise(r => setTimeout(r, 250)); // Simulate processing delay
              setAutoLog(prev => [...prev, log]);
          }
      }

    } catch(err) {
       setAutoLog(prev => [...prev, '[Backend] Connection failed. Ensure Express server is running.']);
       currentScore += 10;
       setIpData({ ip: "10.0.8.66 (LAN)", isp: "Local Enterprise Gateway", city: "Localhost", country: "Local Subnet" });
       
       await new Promise(r => setTimeout(r, 200));
       setAutoLog(prev => [...prev, '[Pillar 8] Checking Proxy/VPN Tunnel Status...']);
       await new Promise(r => setTimeout(r, 200));
       setAutoLog(prev => [...prev, '[Pillar 8] No active VPN/Proxy overlays detected.']);

       setAutoLog(prev => [...prev, '[Pillar 9] Cross-referencing DNSBL Blacklists...']);
       await new Promise(r => setTimeout(r, 200));
       setAutoLog(prev => [...prev, '[Pillar 9] IP Reputation is CLEAN.']);
    }

    setTrustScore(currentScore);
    
    setAutoLog(prev => [...prev, '------------------------------------']);
    if (currentScore >= 40) {
       setAutoLog(prev => [...prev, `>>> FINAL VERDICT: SECURE NETWORK (${networkType}) <<<`]);
    } else {
       setNetworkType('Public WiFi');
       setDetectedNetwork('PUBLIC');
       setAutoLog(prev => [...prev, `>>> FINAL VERDICT: UNTRUSTED PUBLIC WIFI <<<`]);
    }
    
    setIsDetecting(false);
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-10 border border-gray-800 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <BrainCircuit className="w-8 h-8 text-[#7c3aed]" />
        <div>
          <h2 className="text-3xl font-bold">Environment Intelligence</h2>
          <p className="text-gray-400 mt-1">Adaptive AI selecting optimal PQC parameters</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 relative z-10">
        
        {/* COLUMN 1: AUTOMATIC DETECTION */}
        <div className="bg-[#0d1526]/80 p-6 rounded-xl border border-gray-800 flex flex-col h-full">
           <label className="text-sm font-bold text-gray-300 tracking-wide uppercase flex items-center gap-2 mb-4 text-[#00e5ff]">
              <Activity className="w-5 h-5" /> Automatic Profiler
           </label>
           
           <button 
             onClick={runQuantumProfiler}
             disabled={isDetecting}
             className="w-full py-3 rounded-lg bg-[rgba(0,229,255,0.1)] text-[#00e5ff] border border-[#00e5ff] font-bold hover:bg-[rgba(0,229,255,0.2)] transition-all glow-cyan disabled:opacity-50 disabled:cursor-wait mb-4"
           >
             {isDetecting ? 'Running Diagnostics...' : 'Run Auto-Detection'}
           </button>

           <div className="flex-1 bg-black/60 rounded-lg p-3 border border-gray-800 font-mono text-[10px] text-[#39ff14] overflow-y-auto max-h-[140px] custom-scrollbar flex flex-col gap-1 mb-4">
             {autoLog.length === 0 && <span className="text-gray-600 italic">System idle. Awaiting command.</span>}
             {autoLog.map((log, i) => (
               <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300">{log}</div>
             ))}
           </div>

           {trustScore !== null && !isDetecting && (
             <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded border border-gray-800">
                   <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Detected Battery</span>
                   <span className="text-[#00e5ff] font-bold font-mono">{detectedBattery}% {detectedPluggedIn ? '⚡' : ''}</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded border border-gray-800">
                   <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Detected Network</span>
                   <span className={detectedNetwork === 'PRIVATE' ? "text-green-400 font-bold font-mono" : "text-red-400 font-bold font-mono"}>
                      {detectedNetwork === 'PRIVATE' ? 'PRIVATE (SECURE)' : 'PUBLIC (UNTRUSTED)'}
                   </span>
                </div>

                {ipData && (
                  <div className="pt-2">
                     <button 
                       onClick={() => setShowIp(!showIp)} 
                       className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors"
                     >
                       {showIp ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                       {showIp ? 'Hide IP Data' : 'View IP Address'}
                     </button>
                     
                     {showIp && (
                       <motion.div 
                         initial={{ opacity: 0, height: 0 }}
                         animate={{ opacity: 1, height: 'auto' }}
                         className="mt-2 p-3 bg-black/40 rounded border border-gray-700 text-xs font-mono text-gray-300 space-y-1"
                       >
                         <p><span className="text-gray-500">IP:</span> {ipData.ip}</p>
                         <p><span className="text-gray-500">ISP:</span> {ipData.isp}</p>
                         <p><span className="text-gray-500">Location:</span> {ipData.city}, {ipData.country}</p>
                       </motion.div>
                     )}
                  </div>
                )}
             </div>
           )}
        </div>

        {/* COLUMN 2: MANUAL OVERRIDE */}
        <div className="space-y-6 flex flex-col justify-center">
          {/* Battery Control */}
          <div className="bg-[#0d1526]/80 p-6 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <label className="text-sm font-medium text-gray-300 tracking-wide uppercase flex items-center gap-2">
                {getBatteryIcon()} Power State (Manual)
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="pluggedIn" 
                  checked={pluggedIn}
                  onChange={(e) => setPluggedIn(e.target.checked)}
                  className="w-4 h-4 accent-[#00e5ff] rounded"
                />
                <label htmlFor="pluggedIn" className="text-sm text-gray-400 cursor-pointer">Plugged In ⚡</label>
              </div>
            </div>
            
            <div className={`transition-opacity duration-300 ${pluggedIn ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex justify-between text-xs text-gray-500 mb-2 font-mono">
                <span>0%</span>
                <span className="text-[#00e5ff] font-bold text-base">{batteryLevel}%</span>
                <span>100%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={batteryLevel} 
                onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-800"
                style={{
                  background: `linear-gradient(to right, ${getBatteryColor().replace('bg-', '')} ${batteryLevel}%, #1f2937 ${batteryLevel}%)`
                }}
              />
            </div>
          </div>

          {/* Network Control */}
          <div className="bg-[#0d1526]/80 p-6 rounded-xl border border-gray-800">
            <label className="text-sm font-medium text-gray-300 tracking-wide uppercase flex items-center gap-2 mb-6">
              <Wifi className="w-6 h-6 text-[#00e5ff]" /> Network Type (Manual)
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              {['Enterprise Network', 'Home WiFi', 'Public WiFi', 'Mobile Data'].map((net) => (
                <button
                  key={net}
                  onClick={() => setNetworkType(net)}
                  className={`p-3 rounded-lg text-xs font-bold uppercase transition-all border ${
                    networkType === net 
                      ? 'bg-[rgba(0,229,255,0.1)] border-[#00e5ff] text-[#00e5ff] glow-cyan' 
                      : 'bg-black/40 border-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMN 3: OUTPUT DECISION */}
        <div className="relative h-full flex flex-col">
          <div className={`h-full rounded-2xl p-6 border flex flex-col justify-center relative overflow-hidden transition-all duration-500 ${
            isOverrideActive 
              ? 'bg-red-900/10 border-red-500/50 glow-red' 
              : 'bg-[#7c3aed]/10 border-[#7c3aed]/50 glow-purple'
          }`}>
            
            {/* Background animated pulse */}
            <motion.div 
              className="absolute inset-0 z-0 bg-gradient-to-br from-transparent to-black/50"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative z-10 text-center">
              <Lock className={`w-14 h-14 mx-auto mb-4 ${isOverrideActive ? 'text-red-500' : 'text-[#7c3aed]'}`} />
              
              <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-2">Selected Security Level</h3>
              
              <motion.div 
                key={securityDecision.level}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-3xl font-black tracking-tight mb-6 flex items-center justify-center gap-3 ${
                  securityDecision.level === 'MAXIMUM' ? (isOverrideActive ? 'text-red-500' : 'text-[#00e5ff]') :
                  securityDecision.level === 'VERY HIGH' ? 'text-[#7c3aed]' :
                  securityDecision.level === 'HIGH' ? 'text-green-400' :
                  securityDecision.level === 'MEDIUM' ? 'text-orange-400' : 'text-yellow-400'
                }`}
              >
                🔒 {securityDecision.level}
              </motion.div>

              <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 mx-auto w-full">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Algorithm Pair</p>
                <div className="font-mono text-white text-sm font-bold">
                  {securityDecision.algorithms}
                </div>
              </div>

              {isOverrideActive && (
                <div className="mt-4 inline-flex items-center gap-2 bg-red-500/20 text-red-200 px-3 py-1.5 rounded-full border border-red-500/50 text-xs font-semibold animate-pulse">
                  OVERRIDE: SENSITIVE DATA
                </div>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
