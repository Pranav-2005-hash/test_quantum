// NIST FIPS 203 ML-KEM (Module-Lattice-Based Key-Encapsulation Mechanism)
// and NIST FIPS 205 SLH-DSA (Stateless Hash-Based Digital Signatures)

import { ml_kem512, ml_kem768, ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import {
  slh_dsa_sha2_128s, slh_dsa_sha2_128f,
  slh_dsa_sha2_256s, slh_dsa_sha2_256f,
} from '@noble/post-quantum/slh-dsa.js';
import { randomBytes } from '@noble/post-quantum/utils.js';
import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha2.js';

const KEM_MAP = {
  'ML-KEM-512': ml_kem512,   // Category 1 (128-bit)
  'ML-KEM-768': ml_kem768,   // Category 3 (192-bit)
  'ML-KEM-1024': ml_kem1024, // Category 5 (256-bit)
  'HQC-128': ml_kem512,      // Backward compatibility alias
  'HQC-192': ml_kem768,
  'HQC-256': ml_kem1024,
  'Classic McEliece': ml_kem1024,
};

const SIG_MAP = {
  'SLH-DSA-128s': slh_dsa_sha2_128s,
  'SLH-DSA-128f': slh_dsa_sha2_128f,
  'SLH-DSA-256s': slh_dsa_sha2_256s,
  'SLH-DSA-256f': slh_dsa_sha2_256f,
};

// NIST Security Bits category metadata for explainable brute-force infeasibility calculations
export const NIST_SECURITY_BITS = {
  'ML-KEM-512': 128,
  'ML-KEM-768': 192,
  'ML-KEM-1024': 256,
  'HQC-128': 128,
  'HQC-192': 192,
  'HQC-256': 256,
  'Classic McEliece': 256,
  'ml_kem512': 128,
  'ml_kem768': 192,
  'ml_kem1024': 256
};

// NIST ML-KEM Category mappings by key / ciphertext length
export const KEM_BY_PK_LENGTH = {
  800: { algo: ml_kem512, label: 'ML-KEM-512', cipherLen: 768 },
  1184: { algo: ml_kem768, label: 'ML-KEM-768', cipherLen: 1088 },
  1568: { algo: ml_kem1024, label: 'ML-KEM-1024', cipherLen: 1568 }
};

export const KEM_BY_CT_LENGTH = {
  768: { algo: ml_kem512, label: 'ML-KEM-512', skLen: 1632 },
  1088: { algo: ml_kem768, label: 'ML-KEM-768', skLen: 2400 },
  1568: { algo: ml_kem1024, label: 'ML-KEM-1024', skLen: 3168 }
};

export function parseAlgorithmString(algorithms) {
  const str = algorithms || 'ML-KEM-1024 + SLH-DSA-128s';
  const parts = str.split(' + ').map(s => s.trim());
  const kemLabel = parts[0] || 'ML-KEM-1024';
  const sigLabel = parts[1] || 'SLH-DSA-128s';

  const kemAlgo = KEM_MAP[kemLabel] || ml_kem1024;
  const sigAlgo = SIG_MAP[sigLabel] || slh_dsa_sha2_128s;

  return { kemAlgo, sigAlgo, kemLabel, sigLabel };
}

export function generateIdentity(algorithms) {
  const { kemAlgo, sigAlgo, kemLabel, sigLabel } = parseAlgorithmString(algorithms);
  
  const kemKeys = kemAlgo.keygen();
  const sigKeys = sigAlgo.keygen();

  // Generate multi-tier keys across all NIST categories so this node can
  // seamlessly receive envelopes encrypted under ML-KEM-512, ML-KEM-768, or ML-KEM-1024
  const k512 = ml_kem512.keygen();
  const k768 = ml_kem768.keygen();
  const k1024 = ml_kem1024.keygen();

  return {
    kemPublicKey: kemKeys.publicKey,
    kemSecretKey: kemKeys.secretKey,
    sigPublicKey: sigKeys.publicKey,
    sigSecretKey: sigKeys.secretKey,
    kemLabel,
    sigLabel,
    multiKeys: {
      'ML-KEM-512': { pk: k512.publicKey, sk: k512.secretKey, algo: ml_kem512, len: 800 },
      'ML-KEM-768': { pk: k768.publicKey, sk: k768.secretKey, algo: ml_kem768, len: 1184 },
      'ML-KEM-1024': { pk: k1024.publicKey, sk: k1024.secretKey, algo: ml_kem1024, len: 1568 },
      'HQC-128': { pk: k512.publicKey, sk: k512.secretKey, algo: ml_kem512, len: 800 },
      'HQC-192': { pk: k768.publicKey, sk: k768.secretKey, algo: ml_kem768, len: 1184 },
      'HQC-256': { pk: k1024.publicKey, sk: k1024.secretKey, algo: ml_kem1024, len: 1568 },
      'Classic McEliece': { pk: k1024.publicKey, sk: k1024.secretKey, algo: ml_kem1024, len: 1568 },
      768: { sk: k512.secretKey, algo: ml_kem512 },
      1088: { sk: k768.secretKey, algo: ml_kem768 },
      1568: { sk: k1024.secretKey, algo: ml_kem1024 }
    }
  };
}

export function encapsulate(kemPublicKeyBytes, kemAlgo) {
  if (!kemPublicKeyBytes || !(kemPublicKeyBytes instanceof Uint8Array)) {
    throw new Error("encapsulate requires a valid Uint8Array KEM public key");
  }

  // Auto-resolve algorithm if the recipient's public key length corresponds to a specific category
  let algoToUse = kemAlgo;
  const matched = KEM_BY_PK_LENGTH[kemPublicKeyBytes.length];
  if (matched) {
    algoToUse = matched.algo;
  }

  const result = algoToUse.encapsulate(kemPublicKeyBytes);
  return {
    ciphertext: result.cipherText,
    sharedSecret: result.sharedSecret,
    actualKemLabel: matched?.label
  };
}

export function decapsulate(ciphertextBytes, kemSecretKeyBytes, kemAlgo, multiKeys) {
  if (!ciphertextBytes || !(ciphertextBytes instanceof Uint8Array)) {
    throw new Error("decapsulate requires a valid Uint8Array ciphertext");
  }

  // Automatically match the right secret key by ciphertext length (768, 1088, 1568)
  const matched = KEM_BY_CT_LENGTH[ciphertextBytes.length];
  let sk = kemSecretKeyBytes;
  let algo = matched ? matched.algo : kemAlgo;

  if (multiKeys && matched && multiKeys[ciphertextBytes.length]?.sk) {
    sk = multiKeys[ciphertextBytes.length].sk;
    algo = multiKeys[ciphertextBytes.length].algo;
  }

  if (!sk || !(sk instanceof Uint8Array)) {
    throw new Error("decapsulate requires a valid Uint8Array KEM secret key");
  }
  return algo.decapsulate(ciphertextBytes, sk);
}

// Pure JS AES-256-GCM (works in ALL environments including unsecure HTTP over LAN IP where window.crypto.subtle is undefined)
export async function aesGcmEncrypt(plaintextBytes, sharedSecret32Bytes) {
  if (!plaintextBytes || !(plaintextBytes instanceof Uint8Array)) {
    throw new Error("aesGcmEncrypt requires Uint8Array plaintext");
  }
  if (!sharedSecret32Bytes || !(sharedSecret32Bytes instanceof Uint8Array)) {
    throw new Error("aesGcmEncrypt requires Uint8Array sharedSecret32Bytes");
  }

  const iv = randomBytes(12);
  const cipher = gcm(sharedSecret32Bytes, iv);
  const ciphertext = cipher.encrypt(plaintextBytes);

  return {
    ciphertext,
    iv
  };
}

export async function aesGcmDecrypt(ciphertextBytes, iv, sharedSecret32Bytes) {
  if (!ciphertextBytes || !(ciphertextBytes instanceof Uint8Array)) {
    throw new Error("aesGcmDecrypt requires Uint8Array ciphertextBytes");
  }
  if (!iv || !(iv instanceof Uint8Array)) {
    throw new Error("aesGcmDecrypt requires Uint8Array iv");
  }
  if (!sharedSecret32Bytes || !(sharedSecret32Bytes instanceof Uint8Array)) {
    throw new Error("aesGcmDecrypt requires Uint8Array sharedSecret32Bytes");
  }

  const cipher = gcm(sharedSecret32Bytes, iv);
  return cipher.decrypt(ciphertextBytes);
}

export function sha256Hex(textOrBytes) {
  const bytes = typeof textOrBytes === 'string'
    ? new TextEncoder().encode(textOrBytes || ' ')
    : (textOrBytes || new Uint8Array(0));
  const hash = sha256(bytes);
  return bytesToHex(hash);
}

export function sign(messageBytes, sigSecretKeyBytes, sigAlgo) {
  if (!messageBytes || !(messageBytes instanceof Uint8Array)) {
    throw new Error("sign requires Uint8Array messageBytes");
  }
  if (!sigSecretKeyBytes || !(sigSecretKeyBytes instanceof Uint8Array)) {
    throw new Error("sign requires Uint8Array sigSecretKeyBytes");
  }
  return sigAlgo.sign(messageBytes, sigSecretKeyBytes);
}

export function verify(messageBytes, signatureBytes, sigPublicKeyBytes, sigAlgo) {
  if (!messageBytes || !(messageBytes instanceof Uint8Array)) {
    return false;
  }
  if (!signatureBytes || !(signatureBytes instanceof Uint8Array)) {
    return false;
  }
  if (!sigPublicKeyBytes || !(sigPublicKeyBytes instanceof Uint8Array)) {
    return false;
  }
  try {
    return sigAlgo.verify(signatureBytes, messageBytes, sigPublicKeyBytes);
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

export function bytesToHex(bytes) {
  if (!bytes) return '';
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  if (!hex || typeof hex !== 'string') return new Uint8Array(0);
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor(len / 2));
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16) || 0;
  }
  return bytes;
}
