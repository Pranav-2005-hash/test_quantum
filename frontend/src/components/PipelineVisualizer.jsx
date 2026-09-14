import React, { useState, useEffect } from 'react';
import { FileText, Search, BrainCircuit, Key, Lock, CheckCircle2, Play } from 'lucide-react';
import { motion } from 'framer-motion';

import { parseAlgorithmString, generateIdentity, encapsulate, aesGcmEncrypt, sign, bytesToHex, sha256Hex } from '../lib/pqc';

const NODES = [
  { id: 'doc', label: 'Document Input', icon: FileText, color: 'text-gray-400', border: 'border-gray-600' },
  { id: 'nlp', label: 'NLP Classifier', icon: Search, color: 'text-[#00e5ff]', border: 'border-[#00e5ff] glow-cyan' },
  { id: 'ai', label: 'AI Selector', icon: BrainCircuit, color: 'text-[#7c3aed]', border: 'border-[#7c3aed] glow-purple' },
  { id: 'sign', label: 'SLH-DSA Sign', icon: CheckCircle2, color: 'text-[#39ff14]', border: 'border-[#39ff14] glow-green' },
  { id: 'enc', label: 'HQC Encrypt', icon: Key, color: 'text-[#f97316]', border: 'border-[#f97316] glow-orange' },
  { id: 'out', label: 'Secure Output', icon: Lock, color: 'text-white', border: 'border-white' }
];

export default function PipelineVisualizer({ status, onRun, onComplete, classification, securityDecision, logs, setLogs, documentText }) {
  const [activeStep, setActiveStep] = useState(-1);
  const [terminalText, setTerminalText] = useState("");

  const calculateHash = async (text) => {
    return sha256Hex(text);
  };

  useEffect(() => {
    if (status === 'running') {
      runAnimationSequence();
    } else if (status === 'idle') {
      setActiveStep(-1);
      setTerminalText("");
    }
  }, [status]);

  const addLog = (msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`]);
  };

  const runAnimationSequence = async () => {
    setActiveStep(0);
    setTerminalText("SYSTEM: Initializing QuantumShield pipeline...\n");
    addLog("Ingesting document...");
    await new Promise(r => setTimeout(r, 800));

    // NLP Step
    setActiveStep(1);
    setTerminalText(prev => prev + `NLP: Scanning document...\n`);
    await new Promise(r => setTimeout(r, 600));
    const label = classification?.label || 'PUBLIC';
    setTerminalText(prev => prev + `NLP: Classified as ${label}\n`);
    addLog(`NLP classification completed: ${label}`);
    await new Promise(r => setTimeout(r, 800));

    // AI Step
    setActiveStep(2);
    setTerminalText(prev => prev + `AI: Analyzing environment telemetry...\n`);
    await new Promise(r => setTimeout(r, 600));
    setTerminalText(prev => prev + `AI: Selected ${securityDecision.level} level\n`);
    addLog(`AI adaptive selection: ${securityDecision.algorithms}`);
    await new Promise(r => setTimeout(r, 800));

    // Parse real algorithms & generate key identity
    const { kemAlgo, sigAlgo, kemLabel, sigLabel } = parseAlgorithmString(securityDecision.algorithms);
    const identity = generateIdentity(securityDecision.algorithms);

    // Sign Step
    setActiveStep(3);
    const fp = await calculateHash(documentText);
    setTerminalText(prev => prev + `SIGN: SHA-256 fingerprint generated: ${fp.substring(0, 16)}...\n`);
    await new Promise(r => setTimeout(r, 500));
    
    // Real PQC Signing
    const fpBytes = new TextEncoder().encode(fp);
    const sigBytes = sign(fpBytes, identity.sigSecretKey, sigAlgo);
    const sigHex = bytesToHex(sigBytes);

    setTerminalText(prev => prev + `SIGN: ${sigLabel} signing (${sigBytes.length} bytes)... Signature: ${sigHex.substring(0, 16)}...\n`);
    addLog(`Document signed with ${sigLabel} (${sigBytes.length}B signature).`);
    await new Promise(r => setTimeout(r, 800));

    // Encrypt Step
    setActiveStep(4);
    setTerminalText(prev => prev + `ENC: ${kemLabel} key encapsulation running...\n`);
    await new Promise(r => setTimeout(r, 500));

    // Real KEM Encapsulation + AES-256-GCM Encryption
    const encResult = encapsulate(identity.kemPublicKey, kemAlgo);
    const docBytes = new TextEncoder().encode(documentText || ' ');
    const aesResult = await aesGcmEncrypt(docBytes, encResult.sharedSecret);
    const ciphertextHex = bytesToHex(aesResult.ciphertext);
    const ivHex = bytesToHex(aesResult.iv);
    const authTagHex = bytesToHex(aesResult.ciphertext.slice(-16)).toUpperCase();

    setTerminalText(prev => prev + `ENC: AES-256-GCM encrypting payload (${aesResult.ciphertext.length} bytes)... Done.\n`);
    addLog(`Payload encrypted using ${kemLabel} encapsulated shared secret.`);
    await new Promise(r => setTimeout(r, 800));

    // Output Step
    setActiveStep(5);
    setTerminalText(prev => prev + `OUT: Packaging secure envelope.\n`);
    addLog(`Pipeline complete. Secure output generated successfully.`);
    await new Promise(r => setTimeout(r, 800));
    
    const outputData = {
      ciphertextHex, 
      signature: sigHex,
      fingerprint: fp,
      timestamp: new Date().toLocaleTimeString(),
      algorithm: securityDecision.algorithms,
      pkSize: identity.kemPublicKey.length.toLocaleString() + ' Bytes',
      ctSize: aesResult.ciphertext.length.toLocaleString() + ' Bytes',
      sigSize: sigBytes.length.toLocaleString() + ' Bytes',
      authTag: authTagHex,
      ivHex,
      sharedSecretHex: bytesToHex(encResult.sharedSecret),
      kemSecretKeyHex: bytesToHex(identity.kemSecretKey),
      sigPublicKeyHex: bytesToHex(identity.sigPublicKey),
      receivedText: documentText
    };
    onComplete(outputData);
  };

  return (
    <div className="bg-[#0a0f1e] rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>

      <div className="relative z-10 flex items-center justify-between mb-12">
        <div>
          <h2 className="text-4xl font-bold mb-2">Security Pipeline</h2>
          <p className="text-gray-400">Live visualization of payload transformation</p>
        </div>
        <button 
          onClick={onRun}
          disabled={status === 'running' || !classification}
          className="flex items-center gap-2 px-6 py-3 bg-[#39ff14] text-black font-bold rounded-lg hover:bg-white transition-all glow-green disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
        >
          <Play className="w-5 h-5" />
          {status === 'running' ? 'Pipeline Running...' : 'Run Full Pipeline'}
        </button>
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row gap-8">
        
        {/* Horizontal Flow Diagram */}
        <div className="flex-1 overflow-x-auto pb-8 custom-scrollbar">
          <div className="flex items-center min-w-[800px] h-40 px-4">
            {NODES.map((node, index) => {
              const isActive = activeStep === index;
              const isPast = activeStep > index;
              const Icon = node.icon;
              
              return (
                <React.Fragment key={node.id}>
                  <div className="flex flex-col items-center relative group">
                    <motion.div 
                      className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 bg-[#0d1526] z-10
                        ${isActive ? node.border : (isPast ? 'border-gray-500' : 'border-gray-800')} border-2
                      `}
                      animate={{ scale: isActive ? 1.15 : 1 }}
                    >
                      <Icon className={`w-8 h-8 ${isActive || isPast ? node.color : 'text-gray-600'} transition-colors duration-500`} />
                    </motion.div>
                    
                    <div className={`mt-4 font-mono text-sm tracking-tighter w-24 text-center transition-colors duration-500 ${isActive ? 'text-white font-bold' : 'text-gray-500'}`}>
                      {node.label}
                    </div>

                    {isActive && (
                      <motion.div 
                        className={`absolute -inset-4 rounded-3xl opacity-20 ${node.border.replace('border-', 'bg-').split(' ')[0]}`}
                        style={{ borderColor: 'inherit' }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {index < NODES.length - 1 && (
                    <div className="flex-1 h-1 bg-gray-800 relative overflow-hidden mx-2">
                       {(isActive || isPast) && (
                         <motion.div 
                           className={`absolute inset-0 shadow-[0_0_10px_#fff] ${NODES[index+1].color.replace('text-', 'bg-')}`}
                           initial={{ x: '-100%' }}
                           animate={{ x: isPast ? '0%' : '100%' }}
                           transition={{ duration: isPast ? 0 : 0.8, ease: "linear", repeat: isActive ? Infinity : 0 }}
                         />
                       )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Inline Terminal below nodes */}
          <div className="mt-8 bg-black/60 rounded-xl p-6 border border-gray-800 h-48 overflow-y-auto font-mono text-sm text-green-400 custom-scrollbar shadow-inner">
            <span className="text-gray-500">pipeline@quantumshield:~$</span>
            <pre className="whitespace-pre-wrap mt-2 leading-relaxed">
              {terminalText}
              {status === 'running' && <span className="typing-cursor"></span>}
            </pre>
          </div>
        </div>

        {/* Side Log Panel */}
        <div className="w-full lg:w-80 bg-[#0d1526]/80 rounded-xl border border-gray-800 p-5 flex flex-col h-[400px]">
          <h3 className="font-bold text-gray-300 mb-4 uppercase tracking-widest text-xs border-b border-gray-700 pb-2">Active Execution Log</h3>
          <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs custom-scrollbar pr-2">
            {logs.length === 0 && (
              <div className="text-gray-600 italic">Waiting to run pipeline...</div>
            )}
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-gray-300 bg-black/40 p-2 rounded border-l-2 border-[#00e5ff]"
              >
                {log}
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
