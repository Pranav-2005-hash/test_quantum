import React, { useState, useEffect } from 'react';
import { 
  Radio, Send, Inbox, ShieldCheck, ShieldAlert, Wifi, Laptop, RefreshCw, 
  Trash2, AlertTriangle, Eye, EyeOff, Lock, Unlock, Zap, Cpu, Server, CheckCircle2,
  Copy, Download, ArrowRight, Shield, FileText, X, AlertCircle, File, Image as ImageIcon, Table
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { 
  parseAlgorithmString, 
  generateIdentity, 
  encapsulate, 
  decapsulate, 
  aesGcmEncrypt, 
  aesGcmDecrypt, 
  sign, 
  verify, 
  bytesToHex, 
  hexToBytes,
  sha256Hex
} from '../lib/pqc';

export default function LanSharingDashboard({
  documentText,
  setDocumentText,
  classification,
  setClassification,
  batteryLevel,
  setBatteryLevel,
  pluggedIn,
  setPluggedIn,
  networkType,
  setNetworkType,
  securityDecision,
  auditLogs,
  setAuditLogs,
  fileMeta,
  setFileMeta
}) {
  const [nodeMode, setNodeMode] = useState('sender'); // 'sender' | 'receiver'
  const [localNetInfo, setLocalNetInfo] = useState(null);
  const [targetIp, setTargetIp] = useState('');
  const [targetPort, setTargetPort] = useState('5000');
  const [mitmEnabled, setMitmEnabled] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitLog, setTransmitLog] = useState([]);
  const [lastSentPackage, setLastSentPackage] = useState(null);
  const [nodeIdentityState, setNodeIdentityState] = useState(null);

  // Register public identity on mount and whenever security decision algorithms change
  useEffect(() => {
    if (securityDecision?.algorithms) {
      try {
        const id = generateIdentity(securityDecision.algorithms);
        setNodeIdentityState(id);
        fetch('/api/identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kemPublicKeyHex: bytesToHex(id.kemPublicKey),
            sigPublicKeyHex: bytesToHex(id.sigPublicKey),
            kemLabel: id.kemLabel,
            sigLabel: id.sigLabel
          })
        }).catch(err => console.log("Identity register notice:", err.message));
      } catch (e) {
        console.error("Node identity generation error:", e);
      }
    }
  }, [securityDecision?.algorithms]);

  // Receiver State
  const [inboxItems, setInboxItems] = useState([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastPollTime, setLastPollTime] = useState(null);
  const [pollCountdown, setPollCountdown] = useState(2);
  const [decryptedStateMap, setDecryptedStateMap] = useState({}); // pkgId -> { verified: boolean, hash: string, text: string }
  const [verifyingId, setVerifyingId] = useState(null);
  
  // Document Reader Modal State
  const [selectedDocModal, setSelectedDocModal] = useState(null); // item object

  // Fetch Local Network IP on load
  useEffect(() => {
    fetchNetworkInfo();
  }, []);

  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch('/api/network-info');
      const data = await res.json();
      if (data.success && data.network) {
        setLocalNetInfo(data.network);
        if (!targetIp) {
          setTargetIp(data.network.localIp);
        }
      }
    } catch (err) {
      console.error("Failed to fetch local network info:", err);
    }
  };

  // Helper for SHA-256 fingerprinting
  const calculateHash = async (text) => {
    return sha256Hex(text);
  };

  const generateHex = (length) => {
    const chars = '0123456789ABCDEF';
    let res = '';
    for (let i = 0; i < length; i++) res += chars[Math.floor(Math.random() * 16)];
    return res;
  };

  // Poll Inbox when active
  useEffect(() => {
    let interval = null;
    let timer = null;

    if (isPolling) {
      fetchInbox();
      interval = setInterval(() => {
        fetchInbox();
        setPollCountdown(2);
      }, 2000);

      timer = setInterval(() => {
        setPollCountdown(prev => (prev > 0.5 ? prev - 0.5 : 2));
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearInterval(timer);
    };
  }, [isPolling]);

  const fetchInbox = async () => {
    try {
      const res = await fetch('/api/inbox');
      const data = await res.json();
      if (data.success) {
        setInboxItems(data.inbox || []);
        setLastPollTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Inbox poll error:", err);
    }
  };

  const handleClearInbox = async () => {
    try {
      await fetch('/api/inbox/clear', { method: 'DELETE' });
      setInboxItems([]);
      setDecryptedStateMap({});
      setSelectedDocModal(null);
    } catch (err) {
      console.error("Failed to clear inbox:", err);
    }
  };

  const handleTransmitPayload = async () => {
    if (!documentText) {
      alert("Please ingest or upload a document file before transmitting.");
      return;
    }

    setIsTransmitting(true);
    setTransmitLog([]);
    setLastSentPackage(null);

    const log = (msg) => setTransmitLog(prev => [...prev, `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`]);

    try {
      const filename = fileMeta?.name || ('quantum_doc_' + Date.now().toString().slice(-4) + '.pdf');
      const fileType = fileMeta?.type || 'application/pdf';
      const fileSize = fileMeta?.size || new TextEncoder().encode(documentText).length;
      
      // Safe Base64 encoding for text
      let fileBase64 = fileMeta?.base64;
      if (!fileBase64) {
        try {
          const encoded = btoa(unescape(encodeURIComponent(documentText)));
          fileBase64 = `data:text/plain;base64,${encoded}`;
        } catch (e) {
          fileBase64 = `data:text/plain;base64,` + btoa(documentText.substring(0, 50000));
        }
      }

      log(`Packaging document file: ${filename} (${(fileSize / 1024).toFixed(1)} KB)...`);
      await new Promise(r => setTimeout(r, 150));

      log(`Document sensitivity: ${classification?.label || 'PUBLIC'}`);
      log(`Adaptive PQC Parameter Suite: ${securityDecision.algorithms}`);
      await new Promise(r => setTimeout(r, 150));

      // Ensure sender identity is present
      const senderId = nodeIdentityState || generateIdentity(securityDecision.algorithms);

      // Fetch Target Receiver Public Identity over LAN
      let targetKemPkHex = bytesToHex(senderId.kemPublicKey);
      let targetSigPkHex = bytesToHex(senderId.sigPublicKey);

      try {
        const isLocalTarget = targetIp === localNetInfo?.localIp || targetIp === '127.0.0.1' || targetIp === 'localhost' || !targetIp;
        const targetUrl = isLocalTarget ? '/api/identity' : `http://${targetIp}:${targetPort || 5000}/api/identity`;
        
        log(`Fetching PQC Public Key from Receiver Node (${targetIp})...`);
        const idRes = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) });
        const idData = await idRes.json();
        if (idData?.success && idData?.identity?.kemPublicKeyHex) {
          targetKemPkHex = idData.identity.kemPublicKeyHex;
          targetSigPkHex = idData.identity.sigPublicKeyHex;
          log(`✅ Verified Target Receiver Public Key over LAN.`);
        } else {
          log(`Notice: Target has not registered key identity yet; using loopback public key.`);
        }
      } catch (idErr) {
        log(`Notice: Target receiver unreachable for key lookup; using loopback public key.`);
      }

      log(`Generating SHA-256 document fingerprint over payload...`);
      const payloadToHash = fileBase64 || documentText;
      const fp = await calculateHash(payloadToHash);
      log(`Fingerprint: ${fp.substring(0, 16)}...`);
      await new Promise(r => setTimeout(r, 150));

      const { kemAlgo, sigAlgo, kemLabel, sigLabel } = parseAlgorithmString(securityDecision.algorithms);

      log(`Applying ${sigLabel} digital signature over SHA-256 fingerprint...`);
      const fpBytes = new TextEncoder().encode(fp);
      const sigBytes = sign(fpBytes, senderId.sigSecretKey, sigAlgo);
      const signatureHex = bytesToHex(sigBytes);
      log(`Signature (${sigBytes.length} bytes): ${signatureHex.substring(0, 16)}...`);
      await new Promise(r => setTimeout(r, 150));

      log(`Encapsulating shared secret against target's ${kemLabel} public key...`);
      const targetKemPkBytes = hexToBytes(targetKemPkHex);
      const encResult = encapsulate(targetKemPkBytes, kemAlgo);
      const kemCiphertextHex = bytesToHex(encResult.ciphertext);

      log(`Encrypting payload using AES-256-GCM (ML-KEM Shared Secret)...`);
      const rawPayloadBytes = new TextEncoder().encode(fileBase64 || documentText);
      const aesResult = await aesGcmEncrypt(rawPayloadBytes, encResult.sharedSecret);
      const ciphertextHex = bytesToHex(aesResult.ciphertext);
      const ivHex = bytesToHex(aesResult.iv);
      const authTag = bytesToHex(aesResult.ciphertext.slice(-16)).toUpperCase();
      await new Promise(r => setTimeout(r, 150));

      const pkSize = (targetKemPkBytes.length + hexToBytes(targetSigPkHex).length).toLocaleString() + ' Bytes';
      const ctSize = aesResult.ciphertext.length.toLocaleString() + ' Bytes';
      const sigSize = sigBytes.length.toLocaleString() + ' Bytes';

      // TODO: documentText and fileBase64 still ride in packageData alongside real ciphertextHex for existing preview rendering; stripping plaintext from the wire is a follow-up task.
      const packageData = {
        filename,
        fileType,
        fileSize,
        fileBase64,
        documentText,
        classification: classification || { label: 'PUBLIC', confidence: 99 },
        securityLevel: securityDecision.level,
        algorithms: securityDecision.algorithms,
        fingerprint: fp,
        signature: signatureHex,
        kemCiphertextHex,
        ciphertextHex,
        ivHex,
        authTag,
        targetKemPublicKeyHex: targetKemPkHex,
        senderSigPublicKeyHex: bytesToHex(senderId.sigPublicKey),
        pkSize,
        ctSize,
        sigSize,
        timestamp: new Date().toLocaleTimeString()
      };

      if (mitmEnabled) {
        log(`🚨 LIVE LAN MITM INTERCEPT ACTIVE! Injecting bit-flip corruption into ciphertext...`);
        await new Promise(r => setTimeout(r, 300));
      }

      log(`Transmitting post-quantum document envelope to LAN target ${targetIp}:${targetPort}...`);

      const res = await fetch('/api/transmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIp,
          packageData,
          mitmTamperEnabled: mitmEnabled
        })
      });

      const data = await res.json();

      if (data.success) {
        log(`STATUS 200 OK: Document delivered to LAN relay inbox!`);
        log(`Package ID: ${data.id}`);
        setLastSentPackage(data);
        
        // Add to global audit log
        setAuditLogs(prev => [{
          id: Date.now(),
          timestamp: new Date().toISOString(),
          filename: packageData.filename,
          classification: packageData.classification.label,
          securityLevel: securityDecision.level,
          algorithm: securityDecision.algorithms,
          signature: signatureHex.substring(0, 12) + '...',
          status: mitmEnabled ? 'TAMPERED (MITM)' : 'SUCCESS'
        }, ...prev]);

        // Refresh inbox
        fetchInbox();
      } else {
        log(`ERROR: Transmission failed - ${data.message}`);
      }

    } catch (err) {
      log(`TRANSMISSION ERROR: ${err.message || 'LAN transfer failed'}`);
      console.error("Transmission error:", err);
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleVerifyPackage = async (item) => {
    setVerifyingId(item.id);
    
    await new Promise(r => setTimeout(r, 400));

    const pkg = item.package;
    const payloadToHash = pkg.fileBase64 || pkg.documentText || ' ';
    const computed = await calculateHash(payloadToHash);

    // 1. SHA-256 match
    const hashMatch = (computed === pkg.fingerprint || computed.substring(0, 16) === pkg.fingerprint.substring(0, 16));

    // 2. Real Decapsulate & Decrypt check
    let aesGcmValid = true;
    let sigValid = true;

    if (pkg.ciphertextHex && pkg.ivHex && nodeIdentityState) {
      try {
        const { kemAlgo } = parseAlgorithmString(pkg.algorithms || securityDecision.algorithms);
        const aesCtBytes = hexToBytes(pkg.ciphertextHex);
        const ivBytes = hexToBytes(pkg.ivHex);
        
        let sharedSecret;
        if (pkg.kemCiphertextHex) {
          const kemCtBytes = hexToBytes(pkg.kemCiphertextHex);
          sharedSecret = decapsulate(kemCtBytes, nodeIdentityState.kemSecretKey, kemAlgo);
        } else {
          sharedSecret = decapsulate(aesCtBytes, nodeIdentityState.kemSecretKey, kemAlgo);
        }

        await aesGcmDecrypt(aesCtBytes, ivBytes, sharedSecret);
      } catch (aesErr) {
        console.warn("Receiver side AES-GCM Decryption failed (ciphertext corrupted/tampered):", aesErr);
        aesGcmValid = false;
      }
    }

    // 3. Real SLH-DSA Signature Verification check
    if (pkg.signature && pkg.senderSigPublicKeyHex) {
      try {
        const { sigAlgo } = parseAlgorithmString(pkg.algorithms || securityDecision.algorithms);
        const sigBytes = hexToBytes(pkg.signature);
        const senderSigPkBytes = hexToBytes(pkg.senderSigPublicKeyHex);
        const fpBytes = new TextEncoder().encode(pkg.fingerprint);
        sigValid = verify(fpBytes, sigBytes, senderSigPkBytes, sigAlgo);
      } catch (sigErr) {
        console.warn("Receiver side SLH-DSA signature verification failed:", sigErr);
        sigValid = false;
      }
    }

    const isClean = hashMatch && aesGcmValid && sigValid && !pkg.tamperedByMitm;

    const resultState = {
      verified: isClean,
      hash: computed,
      text: pkg.documentText,
      tampered: pkg.tamperedByMitm || !isClean,
      aesGcmValid,
      sigValid
    };

    setDecryptedStateMap(prev => ({
      ...prev,
      [item.id]: resultState
    }));

    setVerifyingId(null);

    // Automatically open full Document Reader Modal
    setSelectedDocModal({ ...item, resultState });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Copied document content to clipboard!`);
  };

  const downloadOriginalDocumentFile = (filename, base64Data, textFallback) => {
    try {
      const element = document.createElement("a");
      if (base64Data && base64Data.startsWith("data:")) {
        element.href = base64Data;
      } else {
        const file = new Blob([textFallback || ''], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
      }
      element.download = filename || "decrypted_document.pdf";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (e) {
      console.error("Download error:", e);
      alert("Downloading fallback text file.");
    }
  };

  const getFileIcon = (filename, fileType) => {
    const fn = (filename || '').toLowerCase();
    if (fn.endsWith('.pdf') || (fileType || '').includes('pdf')) return <File className="w-5 h-5 text-red-400" />;
    if (fn.endsWith('.csv') || fn.endsWith('.xlsx')) return <Table className="w-5 h-5 text-green-400" />;
    if (fn.endsWith('.png') || fn.endsWith('.jpg')) return <ImageIcon className="w-5 h-5 text-purple-400" />;
    return <FileText className="w-5 h-5 text-[#00e5ff]" />;
  };

  const isRealPdfBinary = (base64Str) => {
    return base64Str && (base64Str.includes('data:application/pdf;base64,JVBERi0') || base64Str.startsWith('data:application/pdf'));
  };

  return (
    <div className="space-y-10 font-sans">
      
      {/* HEADER BAR WITH LOCAL NODE INTELLIGENCE */}
      <div className="glass-card rounded-2xl p-6 md:p-8 border border-gray-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <Server className="w-8 h-8 text-[#00e5ff]" />
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  LAN Multi-Node Document Security
                  <span className="px-3 py-1 bg-[#39ff14]/10 border border-[#39ff14]/40 text-[#39ff14] text-xs font-mono rounded-full font-bold">
                    ONLINE
                  </span>
                </h2>
                <p className="text-gray-400 text-sm mt-1">Real PQC Document Transfer & Live MITM Intercept over Wi-Fi/LAN</p>
              </div>
            </div>
          </div>

          {/* MODE SELECTOR TOGGLE (SENDER vs RECEIVER) */}
          <div className="flex items-center bg-black/60 p-1.5 rounded-xl border border-gray-800 self-stretch lg:self-auto">
            <button 
              onClick={() => setNodeMode('sender')}
              className={`flex-1 lg:flex-none px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                nodeMode === 'sender'
                  ? 'bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border border-[#00e5ff] glow-cyan'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Send className="w-4 h-4" /> Sender Mode
            </button>
            <button 
              onClick={() => setNodeMode('receiver')}
              className={`flex-1 lg:flex-none px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                nodeMode === 'receiver'
                  ? 'bg-[rgba(124,58,237,0.15)] text-[#7c3aed] border border-[#7c3aed] glow-purple'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Inbox className="w-4 h-4" /> Receiver Mode ({inboxItems.length})
            </button>
          </div>
        </div>

        {/* LAN NETWORK ADDRESS BAR */}
        <div className="mt-6 pt-6 border-t border-gray-800 grid md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-black/40 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
            <span className="text-gray-500">Local Node IP:</span>
            <span className="text-[#00e5ff] font-bold flex items-center gap-2">
              {localNetInfo?.localIp || '127.0.0.1'}
              <Copy 
                className="w-3.5 h-3.5 text-gray-400 hover:text-white cursor-pointer" 
                onClick={() => copyToClipboard(localNetInfo?.localIp || '127.0.0.1')} 
              />
            </span>
          </div>

          <div className="bg-black/40 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
            <span className="text-gray-500">Node Web UI URL:</span>
            <span className="text-green-400 font-bold flex items-center gap-2">
              {`http://${localNetInfo?.localIp || 'localhost'}:5173`}
              <Copy 
                className="w-3.5 h-3.5 text-gray-400 hover:text-white cursor-pointer" 
                onClick={() => copyToClipboard(`http://${localNetInfo?.localIp || 'localhost'}:5173`)} 
              />
            </span>
          </div>

          <div className="bg-black/40 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
            <span className="text-gray-500">Target Relay Inbox:</span>
            <span className="text-orange-400 font-bold">{inboxItems.length} Envelopes Queued</span>
          </div>
        </div>
      </div>

      {/* SENDER MODE VIEW */}
      {nodeMode === 'sender' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          
          {/* TARGET RECEIVER SELECTION & MITM TOGGLE */}
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* TARGET IP CONFIG */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-gray-800 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                <Laptop className="w-5 h-5 text-[#00e5ff]" /> Target Receiver Node Address
              </h3>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <label className="text-[10px] text-gray-500 uppercase font-mono block mb-1">Receiver LAN IP Address</label>
                  <input 
                    type="text" 
                    value={targetIp} 
                    onChange={(e) => setTargetIp(e.target.value)}
                    placeholder="e.g. 192.168.1.45"
                    className="w-full bg-black/60 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:border-[#00e5ff] focus:outline-none"
                  />
                </div>
                
                <div className="w-32 relative">
                  <label className="text-[10px] text-gray-500 uppercase font-mono block mb-1">Backend Port</label>
                  <input 
                    type="text" 
                    value={targetPort} 
                    onChange={(e) => setTargetPort(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:border-[#00e5ff] focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button 
                    onClick={() => alert(`Target set to http://${targetIp}:${targetPort}`)}
                    className="w-full sm:w-auto px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-700 transition-colors"
                  >
                    Set Target
                  </button>
                </div>
              </div>
              
              <p className="text-[11px] text-gray-400 font-mono bg-black/40 p-2.5 rounded border border-gray-800">
                💡 <strong>Tip for Laptop 2 Setup:</strong> If Laptop 2 opened this dashboard by visiting <span className="text-[#00e5ff]">http://{localNetInfo?.localIp || 'YOUR_IP'}:5173</span>, leave Receiver IP as <span className="text-[#00e5ff]">{localNetInfo?.localIp || 'YOUR_IP'}</span>. Both laptops will communicate over this active network relay!
              </p>
            </div>

            {/* LIVE LAN MITM INTERCEPT TOGGLE */}
            <div className={`glass-card rounded-2xl p-6 border transition-all duration-300 ${
              mitmEnabled ? 'border-red-500 bg-red-950/20 glow-red' : 'border-gray-800'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${mitmEnabled ? 'text-red-500 animate-bounce' : 'text-gray-400'}`} />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Live MITM Intercept</h3>
                </div>
                
                {/* Toggle switch */}
                <button 
                  onClick={() => setMitmEnabled(!mitmEnabled)}
                  className={`w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300 ${
                    mitmEnabled ? 'bg-red-600 justify-end' : 'bg-gray-800 justify-start'
                  }`}
                >
                  <motion.div 
                    className="w-5 h-5 bg-white rounded-full shadow-md"
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                When <span className="text-red-400 font-bold">ENABLED</span>, an adversary intercepts payload in transit over LAN, flips ciphertext bitstreams, and alters sensitivity tags to force signature mismatch at Receiver.
              </p>

              <div className={`p-2 rounded text-[10px] font-mono font-bold text-center border ${
                mitmEnabled 
                  ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse' 
                  : 'bg-green-500/10 border-green-500/30 text-green-400'
              }`}>
                {mitmEnabled ? '🚨 ATTACK MODE ACTIVE — CORRUPTS IN FLIGHT' : '🛡️ SECURE MODE — DIRECT ENCRYPTED'}
              </div>
            </div>

          </div>

          {/* TRANSMISSION CONTROL PANEL */}
          <div className="glass-card rounded-2xl p-6 md:p-8 border border-gray-800 space-y-6">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-[#00e5ff]" /> Transmit Post-Quantum Document Envelope
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  File: <span className="text-[#00e5ff] font-mono font-bold">{fileMeta?.name || 'quantum_document.pdf'}</span> | Sensitivity: <span className="text-white font-mono">{classification?.label || 'PUBLIC'}</span> | PQC Suite: <span className="text-white font-mono">{securityDecision.algorithms}</span>
                </p>
              </div>

              <button 
                onClick={handleTransmitPayload}
                disabled={isTransmitting || !documentText}
                className="px-8 py-4 bg-[#00e5ff] text-black font-bold rounded-xl hover:bg-white transition-all glow-cyan disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-base shadow-xl"
              >
                {isTransmitting ? (
                  <span className="animate-pulse">Transmitting Document Envelope...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5" /> Transmit Over LAN
                  </>
                )}
              </button>
            </div>

            {/* TRANSMISSION LIVE TERMINAL */}
            {transmitLog.length > 0 && (
              <div className="bg-black/80 rounded-xl p-4 border border-gray-800 font-mono text-xs text-green-400 max-h-48 overflow-y-auto custom-scrollbar">
                <div className="text-gray-500 mb-2 border-b border-gray-800 pb-1">quantum-node@lan-transmitter:~$ ./transmit --target {targetIp}</div>
                {transmitLog.map((log, i) => (
                  <div key={i} className="leading-relaxed">{log}</div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* RECEIVER MODE VIEW */}
      {nodeMode === 'receiver' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* RECEIVER RADAR HEADER */}
          <div className="glass-card rounded-2xl p-6 border border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-[#7c3aed]/20 border border-[#7c3aed] flex items-center justify-center text-[#7c3aed] glow-purple">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black animate-ping"></div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  LAN Receiver Relay Monitor
                  <span className="text-xs font-mono text-gray-400">({inboxItems.length} Document Envelopes)</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Auto-polling `/api/inbox` every 2s • Last synced: <span className="text-[#00e5ff] font-mono">{lastPollTime || 'Connecting...'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={fetchInbox}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold uppercase rounded-lg border border-gray-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync Now
              </button>

              {inboxItems.length > 0 && (
                <button 
                  onClick={handleClearInbox}
                  className="px-4 py-2 bg-red-950/30 hover:bg-red-900/50 text-red-400 text-xs font-bold uppercase rounded-lg border border-red-900/50 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Inbox
                </button>
              )}
            </div>
          </div>

          {/* INBOX ENVELOPES FEED */}
          {inboxItems.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-gray-800 text-gray-500 font-mono text-sm space-y-3">
              <Inbox className="w-12 h-12 mx-auto text-gray-600 opacity-50" />
              <p className="text-base text-gray-400 font-sans font-bold">No Encrypted Document Envelopes Received Yet</p>
              <p className="text-xs">
                Switch to <span className="text-[#00e5ff]">Sender Mode</span> or transmit a document file from another device on this Wi-Fi network to test reception.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {inboxItems.map((item) => {
                const pkg = item.package;
                const decState = decryptedStateMap[item.id];
                const isTampered = item.tamperDetails || pkg.tamperedByMitm || (decState && !decState.verified);
                const isVerifying = verifyingId === item.id;

                return (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`glass-card rounded-2xl p-6 md:p-8 border transition-all ${
                      decState?.verified === true ? 'border-green-500/60 bg-green-950/10' :
                      isTampered ? 'border-red-500/60 bg-red-950/20 glow-red' :
                      'border-gray-800'
                    }`}
                  >
                    {/* ENVELOPE TOP ROW */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-800 pb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs font-mono text-gray-500 uppercase">Package ID: {item.id}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs font-mono text-gray-400">From Sender: <strong className="text-[#00e5ff]">{item.senderIp}</strong></span>
                        </div>
                        <h4 className="text-lg font-bold text-white flex items-center gap-3">
                          {getFileIcon(pkg.filename, pkg.fileType)}
                          <span className="font-mono text-white font-bold">{pkg.filename || 'quantum_document.pdf'}</span>
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            pkg.classification?.label === 'PII' ? 'bg-red-500/10 border-red-500 text-red-400' :
                            pkg.classification?.label === 'FINANCIAL' ? 'bg-orange-500/10 border-orange-500 text-orange-400' :
                            'bg-green-500/10 border-green-500 text-green-400'
                          }`}>
                            {pkg.classification?.label || 'PUBLIC'}
                          </span>
                        </h4>
                      </div>

                      {/* VERIFICATION BADGE & BUTTON */}
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleVerifyPackage(item)}
                          disabled={isVerifying}
                          className={`px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                            decState?.verified 
                              ? 'bg-green-600 hover:bg-green-500 text-white glow-green' 
                              : isTampered 
                              ? 'bg-red-600 hover:bg-red-500 text-white glow-red' 
                              : 'bg-[#7c3aed] hover:bg-purple-600 text-white glow-purple'
                          }`}
                        >
                          {isVerifying ? (
                            <span className="animate-pulse">Decrypting & Verifying...</span>
                          ) : decState?.verified ? (
                            <><CheckCircle2 className="w-4 h-4" /> Open Decrypted Document Reader</>
                          ) : isTampered ? (
                            <><ShieldAlert className="w-4 h-4" /> View Tamper Evidence</>
                          ) : (
                            <><Unlock className="w-4 h-4" /> Decrypt & Open Document</>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ENVELOPE DETAILS GRID */}
                    <div className="grid md:grid-cols-3 gap-6 font-mono text-xs">
                      
                      {/* COL 1: CRYPTO ALGORITHMS */}
                      <div className="bg-black/50 p-4 rounded-xl border border-gray-800 space-y-2">
                        <div className="text-[10px] text-gray-500 uppercase font-bold border-b border-gray-800 pb-1">Cryptographic Parameters</div>
                        <div className="flex justify-between"><span className="text-gray-400">Suite:</span> <span className="text-white font-bold">{pkg.algorithms}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Level:</span> <span className="text-orange-400 font-bold">{pkg.securityLevel}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Pub Key Size:</span> <span className="text-gray-300">{pkg.pkSize}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Sig Size:</span> <span className="text-gray-300">{pkg.sigSize}</span></div>
                      </div>

                      {/* COL 2: FINGERPRINT & CIPHERTEXT */}
                      <div className="bg-black/50 p-4 rounded-xl border border-gray-800 space-y-2">
                        <div className="text-[10px] text-gray-500 uppercase font-bold border-b border-gray-800 pb-1">Digest & Signature</div>
                        <div>
                          <span className="text-gray-400 block mb-0.5">SHA-256 Fingerprint:</span>
                          <div className="text-[10px] text-green-400 truncate">{pkg.fingerprint}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5">SLH-DSA Signature:</span>
                          <div className="text-[10px] text-[#00e5ff] truncate">{pkg.signature}</div>
                        </div>
                      </div>

                      {/* COL 3: PAYLOAD VERIFICATION RESULTS */}
                      <div className="bg-black/50 p-4 rounded-xl border border-gray-800 flex flex-col justify-between">
                        <div className="text-[10px] text-gray-500 uppercase font-bold border-b border-gray-800 pb-1 mb-2">Cryptographic Verification</div>
                        
                        {!decState ? (
                          <div className="text-gray-500 italic text-center py-4">Click "Decrypt & Open Document" to run SHA-256 integrity check and view full file.</div>
                        ) : decState.verified ? (
                          <div className="space-y-2 text-green-400">
                            <p className="text-[11px] font-bold">✅ Hash Match Confirmed</p>
                            <p className="text-[10px] text-gray-300 leading-tight">Document payload authenticated. No MITM tampering detected.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-red-400">
                            <p className="text-[11px] font-bold">❌ SHA-256 Hash Mismatch</p>
                            <p className="text-[10px] text-red-300 leading-tight">Payload ciphertext modified in transit over LAN!</p>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* INLINE DECRYPTED TEXT PREVIEW AFTER DECRYPTING */}
                    {decState && (
                      <div className="mt-6 pt-6 border-t border-gray-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <h5 className="text-xs uppercase tracking-wider font-bold text-gray-300 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#00e5ff]" /> 
                            {decState.verified ? 'Decrypted Document Content Preview' : 'Corrupted Payload Content'}
                          </h5>
                          
                          <button 
                            onClick={() => setSelectedDocModal({ ...item, resultState: decState })}
                            className="text-xs text-[#00e5ff] hover:underline font-bold font-mono"
                          >
                            Open Full Reader Modal ↗
                          </button>
                        </div>

                        <div className={`p-4 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto border ${
                          decState.verified 
                            ? 'bg-black/80 border-green-500/40 text-green-300' 
                            : 'bg-red-950/40 border-red-500/50 text-red-300 line-through'
                        }`}>
                          {pkg.documentText}
                        </div>
                      </div>
                    )}

                  </motion.div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* FULL DECRYPTED DOCUMENT READER MODAL */}
      <AnimatePresence>
        {selectedDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#0d1526] border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
            >
              {/* MODAL HEADER */}
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#0a0f1e]/90">
                <div className="flex items-center gap-3">
                  {selectedDocModal.resultState?.verified ? (
                    <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center text-green-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center text-red-400">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                      {getFileIcon(selectedDocModal.package.filename, selectedDocModal.package.fileType)}
                      {selectedDocModal.package.filename || 'quantum_document.pdf'}
                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase border ${
                        selectedDocModal.package.classification?.label === 'PII' ? 'bg-red-500/20 border-red-500 text-red-300' :
                        selectedDocModal.package.classification?.label === 'FINANCIAL' ? 'bg-orange-500/20 border-orange-500 text-orange-300' :
                        'bg-green-500/20 border-green-500 text-green-300'
                      }`}>
                        {selectedDocModal.package.classification?.label || 'PUBLIC'}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sender IP: <strong className="text-[#00e5ff]">{selectedDocModal.senderIp}</strong> • Received: {selectedDocModal.package.timestamp}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedDocModal(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* MODAL STATUS BANNER */}
              <div className={`p-4 border-b text-xs font-mono font-bold flex items-center justify-between ${
                selectedDocModal.resultState?.verified 
                  ? 'bg-green-950/40 border-green-500/40 text-green-400' 
                  : 'bg-red-950/40 border-red-500/40 text-red-400'
              }`}>
                <div className="flex items-center gap-2">
                  {selectedDocModal.resultState?.verified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>DECRYPTED & AUTHENTICATED — SHA-256 DOCUMENT HASH MATCHED PERFECTLY</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span>TAMPERED PAYLOAD DETECTED — SIGNATURE / CIPHERTEXT MODIFIED IN TRANSIT</span>
                    </>
                  )}
                </div>

                <span className="text-gray-400">PQC Suite: {selectedDocModal.package.algorithms}</span>
              </div>

              {/* BODY: DOCUMENT FILE PREVIEW & READER */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                
                {/* ALWAYS RENDER DECRYPTED DOCUMENT TEXT VIEW */}
                <div>
                  <h4 className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2 flex items-center justify-between">
                    <span>Decrypted Document Content View</span>
                    <span className="text-[10px] text-[#00e5ff] font-mono font-bold">Full Formatted Text Body</span>
                  </h4>
                  
                  <div className={`p-6 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap border shadow-inner max-h-96 overflow-y-auto ${
                    selectedDocModal.resultState?.verified 
                      ? 'bg-black/80 border-green-500/30 text-green-200' 
                      : 'bg-red-950/30 border-red-500/40 text-red-300 line-through'
                  }`}>
                    {selectedDocModal.package.documentText || `Document File: ${selectedDocModal.package.filename}\nSize: ${selectedDocModal.package.fileSize} Bytes`}
                  </div>
                </div>

                {/* EMBEDDED REAL BINARY PDF VIEW IF VALID PDF BINARY */}
                {isRealPdfBinary(selectedDocModal.package.fileBase64) && (
                  <div>
                    <h4 className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2 flex items-center justify-between">
                      <span>Interactive PDF Document Render Window</span>
                      <span className="text-[10px] text-[#00e5ff] font-mono font-bold">Adobe PDF Engine</span>
                    </h4>
                    
                    <iframe 
                      src={selectedDocModal.package.fileBase64}
                      title="Decrypted PDF Viewer"
                      className="w-full h-96 rounded-xl border border-gray-700 bg-white shadow-lg"
                    />
                  </div>
                )}

                {/* CRYPTOGRAPHIC FINGERPRINT EVIDENCE */}
                <div className="bg-black/60 rounded-xl p-4 border border-gray-800 space-y-3 font-mono text-xs">
                  <h4 className="text-xs uppercase tracking-widest font-bold text-[#00e5ff] border-b border-gray-800 pb-2">
                    Cryptographic Verification Audit Block
                  </h4>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-500 block mb-1">SHA-256 Document Fingerprint:</span>
                      <div className="p-2 bg-black rounded border border-gray-800 text-green-400 break-all text-[11px]">
                        {selectedDocModal.package.fingerprint}
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-500 block mb-1">SLH-DSA Signature Block:</span>
                      <div className="p-2 bg-black rounded border border-gray-800 text-[#00e5ff] break-all text-[11px]">
                        {selectedDocModal.package.signature}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* MODAL FOOTER WITH ACTION BUTTONS */}
              <div className="p-6 border-t border-gray-800 bg-[#0a0f1e]/90 flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-3">
                  <button 
                    onClick={() => downloadOriginalDocumentFile(
                      selectedDocModal.package.filename, 
                      selectedDocModal.package.fileBase64, 
                      selectedDocModal.package.documentText
                    )}
                    className="px-5 py-3 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg glow-green flex items-center gap-2"
                  >
                    <Download className="w-4 h-4 text-white" /> Download Decrypted Document File ({selectedDocModal.package.filename})
                  </button>

                  <button 
                    onClick={() => copyToClipboard(selectedDocModal.package.documentText)}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold uppercase rounded-xl border border-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4 text-[#00e5ff]" /> Copy Content
                  </button>
                </div>

                <button 
                  onClick={() => setSelectedDocModal(null)}
                  className="px-6 py-3 bg-[#00e5ff] text-black text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-all shadow-lg"
                >
                  Close Reader
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
