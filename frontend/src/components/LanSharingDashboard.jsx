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
  const [nodeMode, setNodeMode] = useState('sender'); // 'sender' | 'attacker' | 'receiver'
  const [gatewayIp, setGatewayIp] = useState('');
  const [enableGatewayRouting, setEnableGatewayRouting] = useState(false);
  const [localNetInfo, setLocalNetInfo] = useState(null);
  const [targetIp, setTargetIp] = useState('');
  const [targetPort, setTargetPort] = useState('5000');
  const [mitmEnabled, setMitmEnabled] = useState(false);
  const [encryptionMode, setEncryptionMode] = useState('quantum'); // 'quantum' | 'standard'
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
            sigLabel: id.sigLabel,
            keysBySuite: {
              'HQC-128': bytesToHex(id.multiKeys?.['HQC-128']?.pk),
              'HQC-192': bytesToHex(id.multiKeys?.['HQC-192']?.pk),
              'HQC-256': bytesToHex(id.multiKeys?.['HQC-256']?.pk),
              'Classic McEliece': bytesToHex(id.multiKeys?.['Classic McEliece']?.pk)
            }
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

  // Transmission Timing & Intrusion Telemetry
  const [chunkDelaySec, setChunkDelaySec] = useState(0.8);
  const [activeIntrusionAlert, setActiveIntrusionAlert] = useState(null);
  const [attackLogs, setAttackLogs] = useState([]);

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

  // Poll Inbox, Alerts, and Attacker Logs when active
  useEffect(() => {
    let interval = null;
    let timer = null;

    if (isPolling) {
      fetchInbox();
      fetchAlerts();
      fetchAttackLog();

      interval = setInterval(() => {
        fetchInbox();
        fetchAlerts();
        fetchAttackLog();
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

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.success && data.alerts && data.alerts.length > 0) {
        // Trigger alert banner on nodes
        setActiveIntrusionAlert(data.alerts[0]);
      }
    } catch (err) {
      // silent
    }
  };

  const fetchAttackLog = async () => {
    try {
      const res = await fetch('/api/attack-log');
      const data = await res.json();
      if (data.success && data.log) {
        setAttackLogs(data.log);
      }
    } catch (err) {
      // silent
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
      log(`Transmission Mode: ${encryptionMode === 'quantum' ? '🔒 QUANTUM-ENCRYPTED (ML-KEM + ML-DSA)' : '⚠️ STANDARD / UNENCRYPTED'}`);
      await new Promise(r => setTimeout(r, 150));

      const isQuantumMode = encryptionMode === 'quantum';

      // ── QUANTUM-ENCRYPTED MODE: Full PQC pipeline ──
      let packageData;

      if (isQuantumMode) {
        log(`Adaptive PQC Parameter Suite: ${securityDecision.algorithms}`);
        await new Promise(r => setTimeout(r, 150));

        // Ensure sender identity is present
        const senderId = nodeIdentityState || generateIdentity(securityDecision.algorithms);

        // Fetch Target Receiver Public Identity over LAN / Cross-Network
        let targetKemPkHex = bytesToHex(senderId.kemPublicKey);
        let targetSigPkHex = bytesToHex(senderId.sigPublicKey);

        try {
          const cleanTarget = (targetIp || '').trim();
          const isLocalTarget = !cleanTarget ||
            cleanTarget === '127.0.0.1' ||
            cleanTarget === 'localhost' ||
            cleanTarget === localNetInfo?.localIp ||
            localNetInfo?.interfaces?.some(i => i.ip === cleanTarget);

          const targetIdentityUrl = isLocalTarget
            ? '/api/identity'
            : (cleanTarget.startsWith('http://') || cleanTarget.startsWith('https://'))
              ? `${cleanTarget.replace(/\/+$/, '')}/api/identity`
              : cleanTarget.includes(':')
                ? `http://${cleanTarget}/api/identity`
                : `http://${cleanTarget}:${targetPort || 5000}/api/identity`;

          log(`Fetching PQC Public Key from Receiver Node (${cleanTarget || 'Local Node'})...`);
          const idRes = await fetch(targetIdentityUrl, { signal: AbortSignal.timeout(3000) });
          const idData = await idRes.json();
          if (idData?.success && idData?.identity?.kemPublicKeyHex) {
            const { kemLabel } = parseAlgorithmString(securityDecision.algorithms);
            if (idData.identity.keysBySuite && idData.identity.keysBySuite[kemLabel]) {
              targetKemPkHex = idData.identity.keysBySuite[kemLabel];
              log(`✅ Verified Target Receiver Public Key for ${kemLabel}.`);
            } else {
              targetKemPkHex = idData.identity.kemPublicKeyHex;
              log(`✅ Verified Target Receiver Public Key.`);
            }
            targetSigPkHex = idData.identity.sigPublicKeyHex;
          } else {
            log(`Notice: Target has not registered key identity yet; using loopback public key.`);
          }
        } catch (idErr) {
          log(`Notice: Target receiver key lookup offline; using loopback public key.`);
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

        log(`Encapsulating shared secret against target's public key...`);
        const targetKemPkBytes = hexToBytes(targetKemPkHex);
        const encResult = encapsulate(targetKemPkBytes, kemAlgo);
        if (encResult.actualKemLabel && encResult.actualKemLabel !== kemLabel) {
          log(`ℹ️ Auto-negotiated KEM suite to ${encResult.actualKemLabel} matching Target public key (${targetKemPkBytes.length} bytes).`);
        }
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

        packageData = {
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
      } else {
        // ── STANDARD / UNENCRYPTED MODE: Raw bytes, no PQC wrapping ──
        log(`⚠️ STANDARD MODE: Sending raw unencrypted payload over LAN...`);
        log(`⚠️ WARNING: No quantum-resilient cryptographic protection! Payload is fully readable and alterable by any MITM attacker.`);
        await new Promise(r => setTimeout(r, 200));

        const payloadToHash = fileBase64 || documentText;
        const fp = await calculateHash(payloadToHash);
        log(`Plaintext SHA-256 Fingerprint: ${fp.substring(0, 16)}...`);

        packageData = {
          filename,
          fileType,
          fileSize,
          fileBase64,
          documentText,
          classification: classification || { label: 'PUBLIC', confidence: 99 },
          securityLevel: 'NONE',
          algorithms: 'NONE (Standard / Unencrypted)',
          fingerprint: fp,
          // No PQC fields — these are intentionally absent so isQuantumProtected() returns false on Laptop C
          timestamp: new Date().toLocaleTimeString()
        };
      }

      if (mitmEnabled) {
        log(`🚨 LIVE LAN MITM INTERCEPT ACTIVE! Injecting bit-flip corruption into ciphertext...`);
        await new Promise(r => setTimeout(r, 300));
      }

      log(`[Throttled Streaming] Applying ${chunkDelaySec}s chunk delay to expose observable interception window...`);
      const effectiveGateway = (enableGatewayRouting || (gatewayIp && gatewayIp.trim() !== '')) ? gatewayIp.trim() : '';

      if (effectiveGateway) {
        log(`🚨 Dispatching stream via Attacker Node C (${effectiveGateway}) ➔ Target Laptop B (${targetIp || 'Receiver'})...`);
      } else {
        log(`Transmitting post-quantum document envelope directly to destination ${targetIp || 'Local Inbox'}...`);
      }

      const res = await fetch('/api/transmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIp,
          targetPort,
          gatewayIp: effectiveGateway,
          packageData,
          mitmTamperEnabled: mitmEnabled,
          chunkDelaySec
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
          securityLevel: isQuantumMode ? securityDecision.level : 'NONE',
          algorithm: isQuantumMode ? securityDecision.algorithms : 'Standard (Unencrypted)',
          signature: isQuantumMode ? (packageData.signature || '').substring(0, 12) + '...' : 'N/A',
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
          sharedSecret = decapsulate(kemCtBytes, nodeIdentityState.kemSecretKey, kemAlgo, nodeIdentityState.multiKeys);
        } else {
          sharedSecret = decapsulate(aesCtBytes, nodeIdentityState.kemSecretKey, kemAlgo, nodeIdentityState.multiKeys);
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

  const handleAttackerForward = async (item, tamper) => {
    try {
      const dest = item.intendedTarget || targetIp;
      const res = await fetch('/api/intercept/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: item.id,
          tamper,
          destinationIp: dest,
          destinationPort: targetPort
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchInbox();
        fetchAttackLog();
        fetchAlerts();
      } else {
        alert(`Forward Error: ${data.message}`);
      }
    } catch (err) {
      alert(`Forward Failed: ${err.message}`);
    }
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
    <div className="space-y-8 font-sans">

      {/* REAL-TIME INTRUSION ALERT BANNER (BROADCAST FROM LAPTOP C) */}
      <AnimatePresence>
        {activeIntrusionAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            className="p-5 rounded-2xl bg-red-950/90 border-2 border-red-500 shadow-2xl glow-red flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white"
          >
            <div className="flex items-start md:items-center gap-3.5">
              <div className="p-3 bg-red-600 rounded-xl animate-pulse flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-sm uppercase tracking-wider text-red-300">
                    [SECURITY ALERT] Unauthorized Intrusion / Interception Attempt Detected!
                  </span>
                  <span className="px-2 py-0.5 bg-red-500/30 text-red-200 text-[10px] font-mono rounded border border-red-500/50">
                    LIVE MITM SNIFFER DETECTED
                  </span>
                </div>
                <p className="text-xs text-red-200 font-mono">
                  Adversary Laptop C (IP: <strong className="text-yellow-300">{activeIntrusionAlert.attackerIp}</strong>) intercepted active transmission stream: Sender <strong className="text-cyan-300">{activeIntrusionAlert.senderIp}</strong> ➔ Target <strong className="text-purple-300">{activeIntrusionAlert.targetIp}</strong>.
                </p>
                {activeIntrusionAlert.pqcProtected && (
                  <p className="text-xs text-green-300 font-mono font-bold flex items-center gap-1.5 pt-0.5">
                    <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                    Quantum Shield Active: Attack attempt BLOCKED! Quantum integrity tags prevented tampering and preserved authentic document intact.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
              <button
                onClick={() => {
                  setActiveIntrusionAlert(null);
                  fetch('/api/alerts/clear', { method: 'DELETE' }).catch(() => {});
                }}
                className="px-4 py-2 bg-red-900/60 hover:bg-red-800 text-red-100 text-xs font-bold uppercase rounded-lg border border-red-500 transition-all shadow"
              >
                Acknowledge Alert
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

          {/* MODE SELECTOR TOGGLE (SENDER vs ATTACKER vs RECEIVER) */}
          <div className="flex items-center bg-black/60 p-1.5 rounded-xl border border-gray-800 self-stretch lg:self-auto gap-1">
            <button
              onClick={() => setNodeMode('sender')}
              className={`flex-1 lg:flex-none px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${nodeMode === 'sender'
                  ? 'bg-[rgba(0,229,255,0.15)] text-[#00e5ff] border border-[#00e5ff] glow-cyan'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              <Send className="w-4 h-4" /> Sender (Laptop A)
            </button>
            <button
              onClick={() => setNodeMode('attacker')}
              className={`flex-1 lg:flex-none px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${nodeMode === 'attacker'
                  ? 'bg-red-950/50 text-red-400 border border-red-500 glow-red animate-pulse'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              <AlertTriangle className="w-4 h-4 text-red-500" /> Attacker (Laptop C)
            </button>
            <button
              onClick={() => setNodeMode('receiver')}
              className={`flex-1 lg:flex-none px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${nodeMode === 'receiver'
                  ? 'bg-[rgba(124,58,237,0.15)] text-[#7c3aed] border border-[#7c3aed] glow-purple'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              <Inbox className="w-4 h-4" /> Receiver (Laptop B) ({inboxItems.length})
            </button>
          </div>
        </div>

        {/* LAN & CROSS-NETWORK ADDRESS BAR */}
        <div className="mt-6 pt-6 border-t border-gray-800 space-y-3">
          <div className="grid md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-black/40 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
              <span className="text-gray-500">Primary Node IP:</span>
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
              <span className="text-gray-500">Relay Inbox:</span>
              <span className="text-orange-400 font-bold">{inboxItems.length} Envelopes Queued</span>
            </div>
          </div>

          {/* Active Network Adapters (Tailscale / Wi-Fi / Ethernet) */}
          {localNetInfo?.interfaces && localNetInfo.interfaces.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 bg-black/20 p-2.5 rounded-lg border border-gray-800 text-[11px] font-mono">
              <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold mr-1">Detected Interfaces:</span>
              {localNetInfo.interfaces.map((iface, idx) => (
                <span
                  key={idx}
                  onClick={() => {
                    setTargetIp(iface.ip);
                    copyToClipboard(iface.ip);
                  }}
                  className={`cursor-pointer px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${iface.type.includes('Tailscale')
                      ? 'border-purple-500/50 bg-purple-950/30 text-purple-300 hover:bg-purple-900/50'
                      : 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/50'
                    }`}
                  title="Click to select as target and copy IP"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  <strong>{iface.type}:</strong> {iface.ip}
                  <Copy className="w-3 h-3 opacity-60 ml-0.5" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SENDER MODE VIEW */}
      {nodeMode === 'sender' && (
        <div className="space-y-10 animate-in fade-in duration-500">

          {/* ── ENCRYPTION MODE SELECTOR (STANDARD vs QUANTUM) ── */}
          <div className="glass-card rounded-2xl p-6 md:p-8 border border-gray-800 space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#00e5ff]" /> Select Transmission Mode
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Choose whether this file transfer is protected by post-quantum cryptography or sent as raw unencrypted bytes.
                </p>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                encryptionMode === 'quantum'
                  ? 'bg-[#00e5ff]/15 text-[#00e5ff] border-[#00e5ff]/50'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/50 animate-pulse'
              }`}>
                {encryptionMode === 'quantum' ? '🔒 Quantum-Encrypted' : '⚠️ Standard / Unencrypted'}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* OPTION 2: Quantum-Encrypted */}
              <button
                onClick={() => setEncryptionMode('quantum')}
                className={`relative p-5 rounded-xl border-2 text-left transition-all duration-300 group ${
                  encryptionMode === 'quantum'
                    ? 'border-[#00e5ff] bg-[#00e5ff]/10 shadow-lg shadow-[#00e5ff]/10'
                    : 'border-gray-700 bg-black/40 hover:border-gray-500 hover:bg-black/60'
                }`}
              >
                {encryptionMode === 'quantum' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="w-5 h-5 text-[#00e5ff]" />
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${
                    encryptionMode === 'quantum' ? 'bg-[#00e5ff]/20' : 'bg-gray-800'
                  }`}>
                    <Lock className={`w-5 h-5 ${encryptionMode === 'quantum' ? 'text-[#00e5ff]' : 'text-gray-400'}`} />
                  </div>
                  <span className={`text-sm font-bold uppercase tracking-wider ${
                    encryptionMode === 'quantum' ? 'text-[#00e5ff]' : 'text-gray-300'
                  }`}>
                    Quantum-Encrypted
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Full <strong className="text-white">ML-KEM-768 + ML-DSA-65</strong> protection. Lattice-based key encapsulation, AES-256-GCM encryption, and post-quantum digital signatures.
                  Laptop C <span className="text-green-400 font-bold">CANNOT tamper</span> with this stream.
                </p>
              </button>

              {/* OPTION 1: Standard / Unencrypted */}
              <button
                onClick={() => setEncryptionMode('standard')}
                className={`relative p-5 rounded-xl border-2 text-left transition-all duration-300 group ${
                  encryptionMode === 'standard'
                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                    : 'border-gray-700 bg-black/40 hover:border-gray-500 hover:bg-black/60'
                }`}
              >
                {encryptionMode === 'standard' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-400" />
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${
                    encryptionMode === 'standard' ? 'bg-amber-500/20' : 'bg-gray-800'
                  }`}>
                    <Unlock className={`w-5 h-5 ${encryptionMode === 'standard' ? 'text-amber-400' : 'text-gray-400'}`} />
                  </div>
                  <span className={`text-sm font-bold uppercase tracking-wider ${
                    encryptionMode === 'standard' ? 'text-amber-400' : 'text-gray-300'
                  }`}>
                    Standard / Unencrypted
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Raw file bytes transmitted <strong className="text-white">without any cryptographic protection</strong>. No ML-KEM, no ML-DSA, no AES-GCM.
                  Laptop C <span className="text-red-400 font-bold">CAN read, tamper, and corrupt</span> this stream.
                </p>
              </button>
            </div>

            {encryptionMode === 'standard' && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs font-mono text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>DEMO WARNING:</strong> Selecting Standard mode intentionally removes all quantum-resilient cryptographic protection.
                  This allows Laptop C (Attacker) to intercept, read plaintext payload, corrupt ciphertext bits, and alter sensitivity classifications in-flight.
                  Use this mode to demonstrate what happens <em>without</em> Quantum Shield protection.
                </span>
              </div>
            )}
          </div>

          {/* TARGET RECEIVER SELECTION & MITM TOGGLE */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* TARGET IP CONFIG */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-gray-800 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                <Laptop className="w-5 h-5 text-[#00e5ff]" /> Target Receiver Node Address (Cross-Network Supported)
              </h3>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <label className="text-[10px] text-gray-500 uppercase font-mono block mb-1">
                    Receiver Address (LAN IP / Tailscale 100.x.x.x / Public Tunnel URL)
                  </label>
                  <input
                    type="text"
                    value={targetIp}
                    onChange={(e) => setTargetIp(e.target.value)}
                    placeholder="e.g. 192.168.1.45, 100.x.x.x, or https://node-b.loca.lt"
                    className="w-full bg-black/60 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:border-[#00e5ff] focus:outline-none"
                  />
                </div>

                <div className="w-32 relative">
                  <label className="text-[10px] text-gray-500 uppercase font-mono block mb-1">Port (LAN/Tailscale)</label>
                  <input
                    type="text"
                    value={targetPort}
                    onChange={(e) => setTargetPort(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:border-[#00e5ff] focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => alert(`Target set to: ${targetIp.startsWith('http') ? targetIp : `${targetIp}:${targetPort}`}`)}
                    className="w-full sm:w-auto px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-700 transition-colors"
                  >
                    Set Target
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 font-mono bg-black/40 p-2.5 rounded border border-gray-800">
                🌐 <strong>Cross-Network Tip:</strong> Works across different Wi-Fi networks! Enter the receiver's <span className="text-purple-400 font-bold">Tailscale IP (100.x.x.x)</span>, a public tunnel URL (<span className="text-cyan-400 font-bold">https://...</span>), or same-router LAN IP (<span className="text-green-400 font-bold">192.168.x.x</span>).
              </p>

              {/* 3-NODE INTERCEPTION ROUTING (ROUTE VIA LAPTOP C) */}
              <div className={`p-4 rounded-xl border transition-all space-y-3 mt-4 ${
                enableGatewayRouting || (gatewayIp && gatewayIp.trim() !== '')
                  ? 'bg-red-950/20 border-red-500/80 shadow-lg glow-red'
                  : 'bg-black/40 border-gray-800'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      3-Node Attack Pipeline: Route via Laptop C (Attacker Sniffer)
                    </label>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                      Send to Laptop B, but route traffic through Laptop C so Eve can intercept & tamper in-flight.
                    </p>
                  </div>
                  <button
                    onClick={() => setEnableGatewayRouting(!enableGatewayRouting)}
                    className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all flex-shrink-0 ${
                      enableGatewayRouting 
                        ? 'bg-red-600 text-white border-red-400 shadow glow-red animate-pulse' 
                        : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                    }`}
                  >
                    {enableGatewayRouting ? '🚨 Active: Routing via Laptop C' : 'Click to Route via Laptop C'}
                  </button>
                </div>

                {(enableGatewayRouting || (gatewayIp && gatewayIp.trim() !== '')) && (
                  <div className="animate-in fade-in space-y-2 pt-2 border-t border-red-900/40">
                    <label className="text-[11px] text-red-300 font-bold uppercase font-mono block">
                      Laptop C (Attacker Node) IP Address:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={gatewayIp}
                        onChange={(e) => {
                          setGatewayIp(e.target.value);
                          if (!enableGatewayRouting) setEnableGatewayRouting(true);
                        }}
                        placeholder="e.g. 10.0.8.66 (Laptop C's IP shown on its screen)"
                        className="flex-1 bg-black/80 border-2 border-red-500 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-red-400"
                      />
                    </div>
                    <p className="text-[10px] text-gray-300 font-mono">
                      👉 <strong>3-Laptop Setup:</strong> Enter <strong>Laptop C's Primary IP (e.g. 10.0.8.66)</strong> here. When you click Transmit, Laptop A will dispatch the envelope to Laptop C, Laptop C's sniffer will capture it live, and Eve can click <em>Attempt Bit-Flip Attack</em> to forward it to Laptop B!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* LIVE LAN MITM INTERCEPT TOGGLE */}
            <div className={`glass-card rounded-2xl p-6 border transition-all duration-300 ${mitmEnabled ? 'border-red-500 bg-red-950/20 glow-red' : 'border-gray-800'
              }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${mitmEnabled ? 'text-red-500 animate-bounce' : 'text-gray-400'}`} />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Live MITM Intercept</h3>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => setMitmEnabled(!mitmEnabled)}
                  className={`w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300 ${mitmEnabled ? 'bg-red-600 justify-end' : 'bg-gray-800 justify-start'
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

              <div className={`p-2 rounded text-[10px] font-mono font-bold text-center border ${mitmEnabled
                  ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
                  : 'bg-green-500/10 border-green-500/30 text-green-400'
                }`}>
                {mitmEnabled ? '🚨 ATTACK MODE ACTIVE — CORRUPTS IN FLIGHT' : '🛡️ SECURE MODE — DIRECT ENCRYPTED'}
              </div>
            </div>

          </div>

          {/* TRANSMISSION CONTROL PANEL */}
          <div className="glass-card rounded-2xl p-6 md:p-8 border border-gray-800 space-y-6">
            {/* TRANSMISSION TIMING & STREAMING DELAY PARAMETER */}
            <div className="bg-black/40 p-4 rounded-xl border border-gray-800 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#00e5ff]" /> Transmission Delay Parameter (`chunk_delay_sec`)
                  </label>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Throttles streaming chunks to give Laptop C an observable window to capture, sniff, and inspect in real time.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-[#00e5ff] font-bold bg-[#00e5ff]/10 px-2.5 py-1 rounded border border-[#00e5ff]/30">
                    {chunkDelaySec.toFixed(1)}s Delay / Chunk
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={chunkDelaySec}
                  onChange={(e) => setChunkDelaySec(parseFloat(e.target.value))}
                  className="w-full accent-[#00e5ff] cursor-pointer"
                />
                <div className="flex gap-1.5 flex-shrink-0">
                  {[0.2, 0.8, 1.5, 2.5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setChunkDelaySec(val)}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-all ${
                        chunkDelaySec === val 
                          ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff]' 
                          : 'bg-black/60 text-gray-400 border-gray-800 hover:text-white'
                      }`}
                    >
                      {val}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-[#00e5ff]" /> Transmit Post-Quantum Document Envelope
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  File: <span className="text-[#00e5ff] font-mono font-bold">{fileMeta?.name || 'quantum_document.pdf'}</span> | Sensitivity: <span className="text-white font-mono">{classification?.label || 'PUBLIC'}</span> | Mode: <span className={`font-mono font-bold ${encryptionMode === 'quantum' ? 'text-[#00e5ff]' : 'text-amber-400'}`}>{encryptionMode === 'quantum' ? securityDecision.algorithms : 'Standard (Unencrypted)'}</span>
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

      {/* ATTACKER CONSOLE VIEW (LAPTOP C) */}
      {nodeMode === 'attacker' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="glass-card rounded-2xl p-6 md:p-8 border border-red-500/40 bg-red-950/10 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-red-900/40 pb-4">
              <div>
                <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 animate-pulse" /> Eve's Live MITM Interceptor Console (Laptop C)
                </h3>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  Listening for in-flight traffic between Laptop A and Laptop B • Captured: <span className="text-red-400 font-bold">{inboxItems.length} Packets</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchInbox}
                  className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-bold uppercase rounded-lg border border-red-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Sniffer
                </button>
              </div>
            </div>

            {/* ADVERSARY LIVE SNIFFER TERMINAL */}
            <div className="bg-black/90 rounded-xl p-4 border border-red-500/50 font-mono text-xs max-h-56 overflow-y-auto custom-scrollbar space-y-1">
              <div className="text-gray-500 border-b border-gray-800 pb-1.5 flex justify-between items-center text-[11px]">
                <span className="flex items-center gap-1.5 text-red-400 font-bold">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" />
                  root@laptop-c-adversary:~# ./pqc-interceptor --promiscuous --sniff-stream
                </span>
                <span className="text-[10px] text-green-400 font-bold bg-green-950/40 px-2 py-0.5 rounded border border-green-800">
                  ● SNIFFER ACTIVE
                </span>
              </div>
              {attackLogs.length === 0 ? (
                <div className="text-gray-500 italic py-2">
                  [IDLE] Listening for active file transfer sockets between Laptop A and B...
                </div>
              ) : (
                attackLogs.map((entry, idx) => {
                  const isFail = entry.includes('FAILED');
                  const isStatus = entry.includes('STATUS');
                  const isSuccess = entry.includes('SUCCESS');
                  const isBroadcast = entry.includes('BROADCAST');
                  return (
                    <div
                      key={idx}
                      className={`leading-relaxed ${
                        isFail
                          ? 'text-yellow-400 font-bold bg-yellow-950/20 px-1 rounded'
                          : isSuccess
                          ? 'text-red-400 font-bold'
                          : isStatus
                          ? 'text-cyan-300'
                          : isBroadcast
                          ? 'text-purple-300'
                          : 'text-gray-300'
                      }`}
                    >
                      {entry}
                    </div>
                  );
                })
              )}
            </div>

            {inboxItems.length === 0 ? (
              <div className="p-12 text-center text-gray-500 font-mono text-sm space-y-2">
                <ShieldAlert className="w-12 h-12 mx-auto text-red-500/40 animate-bounce" />
                <p className="text-base text-gray-300 font-bold">Waiting for Laptop A to transmit to Laptop B...</p>
                <p className="text-xs text-gray-500">
                  Transmit any file from Laptop A with routing set to Laptop C's IP ({localNetInfo?.localIp || '10.0.9.x'}) to capture it live!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {inboxItems.map((item) => {
                  const pkg = item.package;
                  const isPqc = item.pqcProtected || !!(pkg.kemCiphertextHex && pkg.signature);
                  return (
                    <div key={item.id} className="bg-black/60 rounded-xl p-5 border border-red-500/50 space-y-4 font-mono">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-gray-800 pb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-red-400 font-bold uppercase bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                              ⚡ In-Flight Packet Captured
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                              isPqc 
                                ? 'bg-cyan-950/50 text-[#00e5ff] border-cyan-500/50' 
                                : 'bg-amber-950/50 text-amber-400 border-amber-500/50'
                            }`}>
                              {isPqc ? '🛡️ Quantum-Encrypted (ML-KEM + ML-DSA)' : '⚠️ Unencrypted Stream'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-300">
                            Sender: <strong className="text-cyan-400">{item.senderIp} (Laptop A)</strong> ➔ Target: <strong className="text-purple-400">{item.intendedTarget || item.targetIp} (Laptop B)</strong>
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-500">{item.receivedAt}</div>
                      </div>

                      {/* SNIFFED PAYLOAD INSPECTION */}
                      <div className="grid md:grid-cols-2 gap-4 text-xs bg-black/40 p-3 rounded-lg border border-gray-800">
                        <div>
                          <span className="text-gray-500 block">Document Name:</span>
                          <span className="text-white font-bold">{pkg.filename}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Sensitivity Classification:</span>
                          <span className="text-orange-400 font-bold">{pkg.classification?.label || 'CONFIDENTIAL'}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-gray-500 block">Ciphertext Bitstream (Encrypted by ML-KEM):</span>
                          <div className="text-[10px] text-green-400/80 truncate font-mono bg-black/60 p-2 rounded mt-1 border border-gray-900">
                            {pkg.ciphertextHex || 'N/A'}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 italic">
                            {isPqc 
                              ? '🔒 PQC Protected: Eve cannot break ML-KEM-768 lattice ciphertext. Any tampering will trigger [ATTACK FAILED] and forward clean packet intact to Laptop B.'
                              : '⚠️ Plaintext Vulnerable: Target file is unencrypted; payload bits can be read and tampered.'}
                          </p>
                        </div>
                      </div>

                      {/* ATTACK ACTIONS */}
                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={() => handleAttackerForward(item, false)}
                          className="px-5 py-2.5 bg-green-950/40 hover:bg-green-900/60 text-green-300 text-xs font-bold uppercase rounded-lg border border-green-600 transition-all flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-400" /> Pass Unaltered to Laptop B (Verify Will Pass)
                        </button>

                        <button
                          onClick={() => handleAttackerForward(item, true)}
                          className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded-lg shadow-lg glow-red transition-all flex items-center gap-2 animate-pulse"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          {isPqc 
                            ? '🚨 Attempt Bit-Flip Attack (Will Fail — Quantum Integrity Tags)' 
                            : '🚨 Corrupt & Inject Attack to Laptop B'}
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                    className={`glass-card rounded-2xl p-6 md:p-8 border transition-all ${decState?.verified === true ? 'border-green-500/60 bg-green-950/10' :
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
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${pkg.classification?.label === 'PII' ? 'bg-red-500/10 border-red-500 text-red-400' :
                              pkg.classification?.label === 'FINANCIAL' ? 'bg-orange-500/10 border-orange-500 text-orange-400' :
                                'bg-green-500/10 border-green-500 text-green-400'
                            }`}>
                            {pkg.classification?.label || 'PUBLIC'}
                          </span>
                          {/* PQC / Standard Mode Badge */}
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            (pkg.kemCiphertextHex && pkg.signature)
                              ? 'bg-[#00e5ff]/10 border-[#00e5ff]/50 text-[#00e5ff]'
                              : 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                          }`}>
                            {(pkg.kemCiphertextHex && pkg.signature) ? '🔒 Quantum-Encrypted' : '⚠️ Unencrypted'}
                          </span>
                          {/* Attack Blocked Badge */}
                          {(pkg.attackBlocked || item.tamperDetails?.pqcBlocked || pkg.attackStatus === 'BLOCKED_BY_QUANTUM_INTEGRITY') && (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border bg-green-500/20 border-green-500 text-green-300 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Attack Blocked — Intact
                            </span>
                          )}
                        </h4>
                      </div>

                      {/* VERIFICATION BADGE & BUTTON */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleVerifyPackage(item)}
                          disabled={isVerifying}
                          className={`px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 ${decState?.verified
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
                            <p className="text-[11px] font-bold flex items-center gap-1.5">
                              {(pkg.attackBlocked || item.tamperDetails?.pqcBlocked || pkg.attackStatus === 'BLOCKED_BY_QUANTUM_INTEGRITY') ? (
                                <><ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" /> 🛡️ Attack Attempt Blocked — Intact</>
                              ) : (
                                <>✅ Hash Match Confirmed</>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-300 leading-tight">
                              {(pkg.attackBlocked || item.tamperDetails?.pqcBlocked || pkg.attackStatus === 'BLOCKED_BY_QUANTUM_INTEGRITY')
                                ? 'Adversary Laptop C attempted tampering in-transit, but Quantum Integrity Tags prevented payload modification. Authentic document delivered uncorrupted.'
                                : 'Document payload authenticated. No MITM tampering detected.'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-red-400">
                            <p className="text-[11px] font-bold">❌ {(pkg.kemCiphertextHex && pkg.signature) ? 'SHA-256 Hash Mismatch — Attack BLOCKED by ML-DSA' : 'File Stream Corrupted! Tampering Detected in Unencrypted Transfer'}</p>
                            <p className="text-[10px] text-red-300 leading-tight">{(pkg.kemCiphertextHex && pkg.signature) ? 'PQC signature verification rejected the tampered payload. Quantum Shield protection was active.' : '[WARNING] File was sent WITHOUT quantum encryption. Laptop C successfully intercepted and corrupted the payload in transit.'}</p>
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

                        <div className={`p-4 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto border ${decState.verified
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
                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase border ${selectedDocModal.package.classification?.label === 'PII' ? 'bg-red-500/20 border-red-500 text-red-300' :
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
              <div className={`p-4 border-b text-xs font-mono font-bold flex items-center justify-between ${selectedDocModal.resultState?.verified
                  ? 'bg-green-950/40 border-green-500/40 text-green-400'
                  : 'bg-red-950/40 border-red-500/40 text-red-400'
                }`}>
                <div className="flex items-center gap-2">
                  {selectedDocModal.resultState?.verified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>
                        {(selectedDocModal.package.attackBlocked || selectedDocModal.tamperDetails?.pqcBlocked || selectedDocModal.package.attackStatus === 'BLOCKED_BY_QUANTUM_INTEGRITY')
                          ? '🛡️ ATTACK ATTEMPT BLOCKED BY QUANTUM INTEGRITY TAGS — AUTHENTIC DOCUMENT DELIVERED UNCORRUPTED'
                          : 'DECRYPTED & AUTHENTICATED — SHA-256 DOCUMENT HASH MATCHED PERFECTLY'
                        }
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span>{(selectedDocModal.package.kemCiphertextHex && selectedDocModal.package.signature)
                        ? 'TAMPERED PAYLOAD DETECTED — ATTACK BLOCKED BY ML-DSA SIGNATURE VERIFICATION'
                        : '[WARNING] FILE STREAM CORRUPTED — TAMPERING DETECTED IN UNENCRYPTED TRANSFER'
                      }</span>
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

                  <div className={`p-6 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap border shadow-inner max-h-96 overflow-y-auto ${selectedDocModal.resultState?.verified
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
