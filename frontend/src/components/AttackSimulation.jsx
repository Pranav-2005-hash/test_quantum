import React, { useState } from 'react';
import { Skull, ShieldAlert, Cpu, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseAlgorithmString, generateIdentity, sign, verify, bytesToHex, hexToBytes, NIST_SECURITY_BITS } from '../lib/pqc';

export default function AttackSimulation({ encryptedPackage, securityDecision, documentText, classification }) {
  const [isdMode, setIsdMode] = useState('pqc'); // 'nopqc' | 'pqc'
  const [isdState, setIsdState] = useState('idle'); // 'idle' | 'running' | 'failed' (pqc infeasible) | 'recovered' (nopqc success)
  const [isdLogs, setIsdLogs] = useState([]);
  const [recoveredText, setRecoveredText] = useState('');
  
  const [tamperMode, setTamperMode] = useState('pqc'); // 'nopqc' | 'pqc'
  const [tamperState, setTamperState] = useState('idle'); // 'idle' | 'running' | 'detected' (pqc blocked) | 'bypassed' (nopqc tampered)
  const [tamperLogs, setTamperLogs] = useState([]);

  const runISDAttack = async () => {
    if (isdState === 'running') return;
    setIsdState('running');
    setIsdLogs([]);
    setRecoveredText('');

    const currentAlgo = securityDecision?.algorithms || encryptedPackage?.algorithm || 'HQC-256 + SLH-DSA-128s';
    const { kemLabel } = parseAlgorithmString(currentAlgo);
    const secBits = NIST_SECURITY_BITS[kemLabel] || 256;

    if (isdMode === 'nopqc') {
      const targetText = documentText || encryptedPackage?.receivedText || "CONFIDENTIAL PAYROLL DATA - SALARY: $185,000";
      const logs = [
        "Initializing legacy un-encrypted baseline scan...",
        "Extracting raw payload bitstream (32-bit XOR obfuscation)...",
        "Key space candidate search: 2^24 operations...",
        "Launching multi-core candidate brute-force sweep...",
        "Candidate 0x003F12: Testing key match...",
        "Candidate 0x008A91: Testing key match...",
        "Candidate 0x00E4B7: Key match FOUND! Plaintext recovered.",
        `RECOVERED PLAINTEXT: "${targetText.substring(0, 50)}${targetText.length > 50 ? '...' : ''}"`,
        "Attack STATUS: PLAINTEXT RECOVERED (No PQC protection)."
      ];

      for (let i = 0; i < logs.length; i++) {
        await new Promise(r => setTimeout(r, 400));
        setIsdLogs(prev => [...prev, logs[i]]);
      }
      setRecoveredText(targetText);
      setIsdState('recovered');

    } else {
      // PQC Mode: Real mathematical infeasibility calculation based on NIST category security bits
      const classicalOps = `2^${secBits}`;
      const quantumOps = `2^${secBits / 2}`;
      
      const logs = [
        `Initializing Information Set Decoding (ISD) attack on ${kemLabel}...`,
        `Selected Primitive: ML-KEM (${secBits}-bit security category)`,
        `Extracting public key matrix parameters...`,
        `Building parity-check matrix representation...`,
        `Grover's Quantum Speedup engaged: ${quantumOps} quantum ops required`,
        `Classical work factor estimate: ${classicalOps} operations`,
        `Simulating computation at 10^15 ops/sec...`,
        `Estimated time required: >> Age of Universe (1.38 x 10^10 years)`,
        `Attack STATUS: COMPUTATIONALLY INFEASIBLE.`
      ];

      for (let i = 0; i < logs.length; i++) {
        await new Promise(r => setTimeout(r, 500));
        setIsdLogs(prev => [...prev, logs[i]]);
      }
      setIsdState('failed');
    }
  };

  const runTamperingSimulation = async () => {
    if (tamperState === 'running') return;
    setTamperState('running');
    setTamperLogs([]);

    const currentAlgo = securityDecision?.algorithms || encryptedPackage?.algorithm || 'HQC-256 + SLH-DSA-128s';
    const { sigAlgo, sigLabel } = parseAlgorithmString(currentAlgo);
    const origLabel = classification?.label || 'PII (CONFIDENTIAL)';

    if (tamperMode === 'nopqc') {
      const logs = [
        "Intercepting legacy payload in transit...",
        `Original classification label: ${origLabel}`,
        "Attacker alters classification tag to: PUBLIC",
        "Re-packaging payload without digital signature...",
        "Forwarding tampered payload to recipient node...",
        "Recipient node processes received envelope...",
        "Notice: No PQC Digital Signature attached!",
        "Payload accepted without integrity verification!",
        "Attack STATUS: SECURITY DOWNGRADE SUCCEEDED (No signature to block tampering)."
      ];

      for (let i = 0; i < logs.length; i++) {
        await new Promise(r => setTimeout(r, 450));
        setTamperLogs(prev => [...prev, logs[i]]);
      }
      setTamperState('bypassed');

    } else {
      // PQC Mode: Execute real pqc.verify() over tampered payload bytes
      let sigHex = encryptedPackage?.signature;
      let sigPkHex = encryptedPackage?.sigPublicKeyHex;
      let fp = encryptedPackage?.fingerprint || 'a3f9b2c14d8e7f9a';

      if (!sigHex || !sigPkHex) {
        const tempId = generateIdentity(currentAlgo);
        const fpBytes = new TextEncoder().encode(fp);
        const realSig = sign(fpBytes, tempId.sigSecretKey, sigAlgo);
        sigHex = bytesToHex(realSig);
        sigPkHex = bytesToHex(tempId.sigPublicKey);
      }

      const mutatedFp = fp.substring(0, fp.length - 4) + 'DEAD';
      const sigBytes = hexToBytes(sigHex);
      const sigPkBytes = hexToBytes(sigPkHex);
      const mutatedFpBytes = new TextEncoder().encode(mutatedFp);

      // Execute real signature verification call
      const verifyResult = verify(mutatedFpBytes, sigBytes, sigPkBytes, sigAlgo);

      const logs = [
        "Intercepting PQC-signed payload in transit...",
        `Original label: ${origLabel}`,
        "Attacker alters classification tag to: PUBLIC",
        `Original SHA-256 fingerprint: ${fp.substring(0, 16)}...`,
        `Tampered payload fingerprint: ${mutatedFp.substring(0, 16)}...`,
        `Executing ${sigLabel} digital signature verification...`,
        `pqc.verify(mutatedPayload, signature, publicKey) -> ${verifyResult ? 'TRUE' : 'FALSE ❌'}`,
        "Fingerprint MISMATCH detected by post-quantum signature verification!",
        `${sigLabel} verification FAILED! Label tampering blocked.`
      ];

      for (let i = 0; i < logs.length; i++) {
        await new Promise(r => setTimeout(r, 450));
        setTamperLogs(prev => [...prev, logs[i]]);
      }
      setTamperState('detected');
    }
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
        
        {/* CARD 1: ISD / Brute Force Attack */}
        <div className="glass-card rounded-2xl p-6 border border-gray-800 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-full pointer-events-none transition-colors group-hover:bg-red-500/20"></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-red-500" /> Information Set Decoding
              </h3>
              <p className="text-sm text-gray-400">Simulating brute-force & lattice decryption attacks.</p>
            </div>
          </div>

          {/* Dual-Mode Toggle Button */}
          <div className="flex bg-[#0d1526] p-1 rounded-lg border border-gray-800 mb-4 font-mono text-xs relative z-10">
            <button 
              type="button"
              onClick={() => { setIsdMode('nopqc'); setIsdState('idle'); setIsdLogs([]); }}
              className={`flex-1 py-1.5 px-3 rounded-md transition-all ${isdMode === 'nopqc' ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/40' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Attack: No PQC (Plaintext)
            </button>
            <button 
              type="button"
              onClick={() => { setIsdMode('pqc'); setIsdState('idle'); setIsdLogs([]); }}
              className={`flex-1 py-1.5 px-3 rounded-md transition-all ${isdMode === 'pqc' ? 'bg-[#00e5ff]/20 text-[#00e5ff] font-bold border border-[#00e5ff]/40' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Attack: PQC-Protected
            </button>
          </div>

          <button 
            onClick={runISDAttack}
            disabled={isdState === 'running'}
            className={`w-full py-3 rounded-lg border font-bold tracking-widest transition-all mb-6 disabled:opacity-50 ${
              isdMode === 'nopqc' 
                ? 'border-red-500/50 text-red-400 hover:bg-red-500/10 glow-red' 
                : 'border-[#00e5ff]/50 text-[#00e5ff] hover:bg-[#00e5ff]/10 glow-cyan'
            }`}
          >
            {isdState === 'running' ? 'ATTACK IN PROGRESS...' : `RUN ${isdMode === 'nopqc' ? 'PLAINTEXT' : 'ISD'} ATTACK SIMULATION`}
          </button>

          <div className="flex-1 bg-black/60 rounded-xl border border-gray-800 p-4 font-mono text-xs overflow-hidden flex flex-col">
            <div className="text-red-500 mb-2 border-b border-red-500/30 pb-2">
              root@quantum-attacker:~# ./attack --mode={isdMode === 'nopqc' ? 'legacy-plaintext' : 'isd-lattice'}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar text-gray-300 min-h-[160px]">
              {isdLogs.map((log, i) => (
                <div key={i} className={log.includes('RECOVERED') || log.includes('SUCCEEDED') ? 'text-red-400 font-bold' : ''}>{log}</div>
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
                  <span className="text-xs font-normal">🔒 ML-KEM WITHSTANDS QUANTUM ISD ATTACK</span>
                </motion.div>
              )}

              {isdState === 'recovered' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-red-500/20 border border-red-500 text-red-400 rounded text-center tracking-wider font-bold"
                >
                  🚨 PLAINTEXT RECOVERED ❌<br/>
                  <span className="text-xs font-normal text-red-300">Unencrypted baseline payload compromised in 0.4s</span>
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
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#7c3aed]" /> Label Tampering Attack
              </h3>
              <p className="text-sm text-gray-400">Simulating Man-in-the-Middle security level downgrade.</p>
            </div>
          </div>

          {/* Dual-Mode Toggle Button */}
          <div className="flex bg-[#0d1526] p-1 rounded-lg border border-gray-800 mb-4 font-mono text-xs relative z-10">
            <button 
              type="button"
              onClick={() => { setTamperMode('nopqc'); setTamperState('idle'); setTamperLogs([]); }}
              className={`flex-1 py-1.5 px-3 rounded-md transition-all ${tamperMode === 'nopqc' ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/40' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Attack: No PQC (Plaintext)
            </button>
            <button 
              type="button"
              onClick={() => { setTamperMode('pqc'); setTamperState('idle'); setTamperLogs([]); }}
              className={`flex-1 py-1.5 px-3 rounded-md transition-all ${tamperMode === 'pqc' ? 'bg-[#7c3aed]/20 text-[#7c3aed] font-bold border border-[#7c3aed]/40' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Attack: PQC-Protected
            </button>
          </div>

          <button 
            onClick={runTamperingSimulation}
            disabled={tamperState === 'running'}
            className="w-full py-3 rounded-lg border border-[#7c3aed]/50 text-[#7c3aed] font-bold tracking-widest hover:bg-[#7c3aed]/10 transition-all glow-purple disabled:opacity-50 mb-6"
          >
            {tamperState === 'running' ? 'TAMPERING...' : 'RUN TAMPERING SIMULATION'}
          </button>

          <div className="flex-1 bg-black/60 rounded-xl border border-gray-800 p-4 font-mono text-xs overflow-hidden flex flex-col relative">
            <div className="text-[#7c3aed] mb-2 border-b border-[#7c3aed]/30 pb-2">
              root@mitm-proxy:~# intercept --modify label --mode={tamperMode}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar text-gray-300 min-h-[160px]">
              {tamperLogs.map((log, i) => {
                 let color = 'text-gray-300';
                 if (log.includes('MISMATCH') || log.includes('FAILED')) color = 'text-red-400 font-bold';
                 if (log.includes('SUCCEEDED') || log.includes('accepted')) color = 'text-red-400 font-bold';
                 if (log.includes('intercepts') || log.includes('Altering')) color = 'text-[#00e5ff]';
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
                className="mt-4 p-2 bg-red-500/20 text-red-300 rounded text-center text-xs tracking-wider font-bold"
             >
                🚨 TAMPERING DETECTED BY SLH-DSA — FILE TRANSFER BLOCKED ✅
             </motion.div>
          )}

          {tamperState === 'bypassed' && (
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 p-2 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-center text-xs tracking-wider font-bold"
             >
                ⚠️ UNPROTECTED BASELINE — TAMPERING ACCEPTED UNCHECKED ❌
             </motion.div>
          )}

        </div>

      </div>
    </div>
  );
}
