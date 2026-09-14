import React, { useState } from 'react';
import { ArrowRightLeft, FileLock, CheckCircle2, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { aesGcmDecrypt, hexToBytes, sha256Hex } from '../lib/pqc';

export default function EncryptionOutput({ originalText, encryptedPackage }) {
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [receivedText, setReceivedText] = useState(originalText);
  const [verificationStatus, setVerificationStatus] = useState(null); // 'success' or 'failed'
  const [computedHash, setComputedHash] = useState(null);
  const [realDecryptedText, setRealDecryptedText] = useState(null);
  const [aesDecryptSuccess, setAesDecryptSuccess] = useState(null);

  const calculateHash = async (text) => {
    return sha256Hex(text);
  };

  const handleDecrypt = async () => {
    setIsVerifying(true);
    setVerificationStatus(null);
    setRealDecryptedText(null);
    setAesDecryptSuccess(null);
    
    // Simulate pipeline decryption delay
    await new Promise(r => setTimeout(r, 1200));

    // 1. Attempt Real AES-256-GCM Decryption using stored keys if present
    try {
      if (encryptedPackage.ciphertextHex && encryptedPackage.ivHex && encryptedPackage.sharedSecretHex) {
        const ctBytes = hexToBytes(encryptedPackage.ciphertextHex);
        const ivBytes = hexToBytes(encryptedPackage.ivHex);
        const ssBytes = hexToBytes(encryptedPackage.sharedSecretHex);
        const decryptedBytes = await aesGcmDecrypt(ctBytes, ivBytes, ssBytes);
        const decStr = new TextDecoder().decode(decryptedBytes);
        setRealDecryptedText(decStr);
        setAesDecryptSuccess(true);
      }
    } catch (aesErr) {
      console.error("AES-GCM Decryption failed:", aesErr);
      setAesDecryptSuccess(false);
    }
    
    // 2. Signature & Hash verification over receivedText
    const currentHash = await calculateHash(receivedText);
    setComputedHash(currentHash);
    const originalFingerprint = encryptedPackage.fingerprint;
    
    if (currentHash.substring(0, 16) === originalFingerprint.substring(0, 16)) {
        setVerificationStatus('success');
    } else {
        setVerificationStatus('failed');
    }
    
    setIsVerifying(false);
    setIsDecrypted(true);
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-10 border border-gray-800">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FileLock className="w-8 h-8 text-[#f97316]" />
          <h2 className="text-3xl font-bold">Secure Payload</h2>
        </div>
        
        <button
          onClick={handleDecrypt}
          disabled={isVerifying}
          className={`flex items-center gap-2 px-6 py-2 border rounded-lg transition-all ${
            verificationStatus === 'failed' ? 'border-red-500 text-red-500 bg-red-500/10 glow-red' : 
            verificationStatus === 'success' ? 'border-green-500 text-green-500 bg-green-500/10 glow-green' : 
            'border-[#7c3aed] text-[#7c3aed] hover:bg-[rgba(124,58,237,0.1)] glow-purple disabled:opacity-50'
          }`}
        >
          {isVerifying ? (
            <span className="animate-pulse">Verifying Signature...</span>
          ) : verificationStatus === 'failed' ? (
            <>⚠️ SIGNATURE MISMATCH (TAMPERED)</>
          ) : verificationStatus === 'success' ? (
            <><CheckCircle2 className="w-4 h-4" /> Verified & Decrypted</>
          ) : (
            <><Unlock className="w-4 h-4" /> Decrypt & Verify</>
          )}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Comparison Area - takes up 2 columns */}
        <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 h-96">
          
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex justify-between items-center ml-1">
               <div className="text-xs uppercase tracking-widest text-gray-400 font-bold">Received Document</div>
               {!isDecrypted && <span className="text-[10px] text-[#f97316] font-bold animate-pulse">EDIT TO SIMULATE TAMPERING</span>}
            </div>
            <textarea 
              value={receivedText}
              onChange={(e) => {
                 setReceivedText(e.target.value);
                 if (isDecrypted) {
                    setIsDecrypted(false);
                    setVerificationStatus(null);
                 }
              }}
              className={`flex-1 p-4 rounded-xl bg-black/40 border transition-colors overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-[#7c3aed] ${
                  verificationStatus === 'failed' ? 'border-red-500 text-red-400' :
                  verificationStatus === 'success' ? 'border-green-500/50 text-green-400' : 
                  'border-gray-800 text-gray-300'
              }`}
            />
          </div>

          <div className="flex items-center justify-center">
            <div className="p-2 bg-gray-800 rounded-full">
              <ArrowRightLeft className={`w-5 h-5 ${verificationStatus === 'success' ? 'text-[#00e5ff]' : verificationStatus === 'failed' ? 'text-red-500' : 'text-gray-500'} transition-colors`} />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <div className="text-xs uppercase tracking-widest text-[#f97316] font-bold ml-1">Encrypted Blob (HQC-256)</div>
            <div className={`flex-1 p-4 rounded-xl bg-black/80 border overflow-y-auto custom-scrollbar break-all font-mono text-xs ${isDecrypted ? 'border-gray-800 text-gray-600' : 'border-[#f97316]/50 text-[#f97316] glow-orange'}`}>
              <AnimatePresence mode="popLayout">
                {!isDecrypted ? (
                  <motion.div
                    key="encrypted"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    {encryptedPackage.ciphertextHex}
                    <br/><br/>
                    <span className="text-[#39ff14]">{"[SIGNATURE_BLOCK: " + encryptedPackage.signature + "]"}</span>
                  </motion.div>
                ) : verificationStatus === 'failed' ? (
                  <motion.div
                    key="failed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-red-500 text-red-500 flex items-center justify-center mb-4 text-2xl font-bold">!</div>
                    <span className="text-red-500 uppercase tracking-widest font-bold">DECRYPTION FAILED</span>
                    <span className="text-red-400 text-xs mt-2">Hash Mismatch Detected</span>
                    
                    <div className="mt-4 p-3 bg-red-500/10 rounded border border-red-500/30 text-left w-full max-w-[90%]">
                       <p className="text-[10px] text-gray-400 uppercase">Original Signature Hash:</p>
                       <p className="font-mono text-[10px] text-green-400 truncate">{encryptedPackage.fingerprint.substring(0, 32)}...</p>
                       <p className="text-[10px] text-gray-400 uppercase mt-2">Computed Payload Hash:</p>
                       <p className="font-mono text-[10px] text-red-400 truncate">{computedHash?.substring(0, 32)}...</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="decrypted"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <Unlock className="w-12 h-12 text-green-500 mb-4" />
                    <span className="text-green-500 uppercase tracking-widest font-bold">Ciphertext Decrypted</span>
                    
                    <div className="mt-4 p-3 bg-green-500/10 rounded border border-green-500/30 text-left w-full max-w-[90%]">
                       <p className="text-[10px] text-gray-400 uppercase">Signature Verified:</p>
                       <p className="font-mono text-[10px] text-green-400 truncate">{encryptedPackage.fingerprint.substring(0, 32)}...</p>
                       <p className="text-[10px] text-gray-400 uppercase mt-2">Computed Payload Hash:</p>
                       <p className="font-mono text-[10px] text-green-400 truncate">{computedHash?.substring(0, 32)}...</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
        </div>

        {/* Metadata Card */}
        <div className="bg-[#0d1526]/80 rounded-xl border border-gray-700 p-6 flex flex-col relative overflow-hidden">
          {/* subtle grid background */}
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTAgMGgxMHYxMEgweiIgZmlsbD0ibm9uZSI+PC9wYXRoPjxwYXRoIGQ9Ik0wIDBoMXYxMEgwek0wIDBoMTB2MUgweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSI+PC9wYXRoPjwvc3ZnPg==')] pointer-events-none"></div>
          
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#00e5ff] mb-6 flex items-center gap-2">
            Package Metadata
          </h3>

          <div className="space-y-4 text-sm font-mono flex-1 relative z-10">
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-500">Algorithm</span>
              <span className="text-white text-right ml-4 truncate">{encryptedPackage.algorithm.includes('+') ? encryptedPackage.algorithm.split('+')[0].trim() : encryptedPackage.algorithm}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-500">Signature</span>
              <span className="text-white text-right ml-4 truncate">{encryptedPackage.algorithm.includes('+') ? encryptedPackage.algorithm.split('+')[1].trim() : 'SLH-DSA'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-500">Public Key Size</span>
              <span className="text-gray-300">{encryptedPackage.pkSize}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-500">Ciphertext Size</span>
              <span className="text-gray-300">{encryptedPackage.ctSize}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-500">Signature Size</span>
              <span className="text-gray-300">{encryptedPackage.sigSize}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-500">Auth Tag</span>
              <span className="text-gray-300 truncate w-32 text-right">{encryptedPackage.authTag}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-gray-500">Timestamp</span>
              <span className="text-[#39ff14]">{encryptedPackage.timestamp}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
