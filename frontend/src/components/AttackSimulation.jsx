import React, { useState } from 'react';
import { Skull, ShieldAlert, Cpu, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AttackSimulation() {
  const [isdState, setIsdState] = useState('idle'); // idle, running, failed
  const [isdLogs, setIsdLogs] = useState([]);
  
  const [tamperState, setTamperState] = useState('idle'); // idle, running, detected
  const [tamperLogs, setTamperLogs] = useState([]);

  const runISDAttack = async () => {
    if (isdState === 'running') return;
    setIsdState('running');
    setIsdLogs([]);
    
    const logs = [
      "Initializing Information Set Decoding (ISD) attack on HQC-256...",
      "Extracting public key dimensions...",
      "Code length (n): 57,637",
      "Hamming weight (w): 131",
      "Building parity-check matrix representation...",
      "Quantum speedup (Grover's algorithm) engaged.",
      "Estimated work factor: 2^256 classical operations",
      "Quantum adjusted work factor: 2^128 quantum operations",
      "Computing at 10^15 ops/sec...",
      "Time required: >> Age of Universe"
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setIsdLogs(prev => [...prev, logs[i]]);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    setIsdState('failed');
  };

  const runTamperingSimulation = async () => {
    if (tamperState === 'running') return;
    setTamperState('running');
    setTamperLogs([]);

    const logs = [
      "Intercepting payload in transit...",
      "Original label: CONFIDENTIAL (Encrypted data block)",
      "Attacker intercepts metadata header...",
      "Changing classification label to: PUBLIC",
      "Re-packaging payload and forwarding to recipient...",
      "Recipient receives document.",
      "Attempting SLH-DSA signature verification with tampered label...",
      "Calculating SHA-3 fingerprint of tampered document...",
      "SHA-3 fingerprint of tampered doc: z9x1k5p2q7m4...",
      "Extracting original SHA-3 fingerprint from signature block...",
      "SHA-3 fingerprint in signature: a3f9b2c14d8e...",
      "Fingerprint MISMATCH detected ❌",
      "SLH-DSA verification FAILED."
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      setTamperLogs(prev => [...prev, logs[i]]);
    }

    await new Promise(r => setTimeout(r, 800));
    setTamperState('detected');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-10">
        <Skull className="w-8 h-8 text-red-500" />
        <div>
          <h2 className="text-3xl font-bold">Quantum Attack Simulation</h2>
          <p className="text-gray-400 mt-1">Mathematical proof of system resilience against advanced threat vectors</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* CARD 1: ISD Attack */}
        <div className="glass-card rounded-2xl p-6 border border-gray-800 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-full pointer-events-none transition-colors group-hover:bg-red-500/20"></div>
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-red-500" /> Information Set Decoding
              </h3>
              <p className="text-sm text-gray-400">Simulating quantum ISD attack against HQC-256 code-based encryption lattice.</p>
            </div>
          </div>

          <button 
            onClick={runISDAttack}
            disabled={isdState === 'running'}
            className="w-full py-3 rounded-lg border border-red-500/50 text-red-400 font-bold tracking-widest hover:bg-red-500/10 transition-all glow-red disabled:opacity-50 mb-6"
          >
            {isdState === 'running' ? 'ATTACK IN PROGRESS...' : 'RUN ISD ATTACK SIMULATION'}
          </button>

          <div className="flex-1 bg-black/60 rounded-xl border border-gray-800 p-4 font-mono text-xs overflow-hidden flex flex-col">
            <div className="text-red-500 mb-2 border-b border-red-500/30 pb-2">root@quantum-attacker:~# ./run_isd --target hqc-256</div>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar text-gray-300">
              {isdLogs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
              {isdState === 'running' && <span className="typing-cursor"></span>}
            </div>
            
            <AnimatePresence>
              {isdState === 'failed' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-green-500/20 border border-green-500 text-green-400 rounded text-center tracking-wider font-bold"
                >
                  ⚠️ ATTACK STATUS: COMPUTATIONALLY INFEASIBLE ✅<br/>
                  <span className="text-xs font-normal">🔒 HQC-256 WITHSTANDS QUANTUM ISD ATTACK</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isdState === 'failed' && (
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-[10px] text-gray-500 font-mono text-center"
             >
                Classical: 2²⁵⁶ yrs | Quantum: 2¹²⁸ yrs | Universe Age: 1.38×10¹⁰ yrs
             </motion.div>
          )}
        </div>

        {/* CARD 2: Label Tampering */}
        <div className="glass-card rounded-2xl p-6 border border-gray-800 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed]/10 rounded-bl-full pointer-events-none transition-colors group-hover:bg-[#7c3aed]/20"></div>
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#7c3aed]" /> Label Tampering Attack
              </h3>
              <p className="text-sm text-gray-400">Simulating Man-in-the-Middle attempting to downgrade security level by altering classification label.</p>
            </div>
          </div>

          <button 
            onClick={runTamperingSimulation}
            disabled={tamperState === 'running'}
            className="w-full py-3 rounded-lg border border-[#7c3aed]/50 text-[#7c3aed] font-bold tracking-widest hover:bg-[#7c3aed]/10 transition-all glow-purple disabled:opacity-50 mb-6"
          >
            {tamperState === 'running' ? 'TAMPERING...' : 'RUN TAMPERING SIMULATION'}
          </button>

          <div className="flex-1 bg-black/60 rounded-xl border border-gray-800 p-4 font-mono text-xs overflow-hidden flex flex-col relative">
            <div className="text-[#7c3aed] mb-2 border-b border-[#7c3aed]/30 pb-2">root@mitm-proxy:~# intercept --modify label</div>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar text-gray-300">
              {tamperLogs.map((log, i) => {
                 let color = 'text-gray-300';
                 if (log.includes('MISMATCH') || log.includes('FAILED')) color = 'text-red-400 font-bold';
                 if (log.includes('intercepts') || log.includes('Changing')) color = 'text-[#00e5ff]';
                 return <div key={i} className={color}>{log}</div>;
              })}
              {tamperState === 'running' && <span className="typing-cursor"></span>}
            </div>

            <AnimatePresence>
              {tamperState === 'detected' && (
                <motion.div 
                  initial={{ scale: 2, opacity: 0, rotate: -15 }}
                  animate={{ scale: 1, opacity: 1, rotate: -5 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-red-500 text-red-500 font-black text-4xl p-4 rounded-xl shadow-[0_0_50px_rgba(239,68,68,0.5)] z-20 bg-black/50 backdrop-blur-sm pointer-events-none"
                >
                  REJECTED
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {tamperState === 'detected' && (
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 p-2 bg-red-500/20 text-red-300 rounded text-center text-xs tracking-wider"
             >
                🚨 TAMPERING DETECTED — FILE TRANSFER BLOCKED ✅
             </motion.div>
          )}

        </div>

      </div>
    </div>
  );
}
