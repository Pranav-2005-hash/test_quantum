// NOTE: HQC and Classic McEliece have no mature audited JS implementation.
// We use ML-KEM (FIPS 203) as the real KEM underneath these UI labels, sized
// to match the intended NIST security category. This is documented here so
// the mismatch between displayed label and actual primitive is never hidden.

import { ml_kem512, ml_kem768, ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import {
  slh_dsa_sha2_128s, slh_dsa_sha2_128f,
  slh_dsa_sha2_256s, slh_dsa_sha2_256f,
} from '@noble/post-quantum/slh-dsa.js';
import { randomBytes } from '@noble/post-quantum/utils.js';
import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha2.js';

const KEM_MAP = {
  'HQC-128': ml_kem512,   // Category 1 (128-bit)
  'HQC-192': ml_kem768,   // Category 3 (192-bit)
  'HQC-256': ml_kem1024,  // Category 5 (256-bit)
  'Classic McEliece': ml_kem1024, // Category 5 (McEliece is always paired with HQC-256 in this app)
};

const SIG_MAP = {
  'SLH-DSA-128s': slh_dsa_sha2_128s,
  'SLH-DSA-128f': slh_dsa_sha2_128f,
  'SLH-DSA-256s': slh_dsa_sha2_256s,
  'SLH-DSA-256f': slh_dsa_sha2_256f,
};

// NIST Security Bits category metadata for explainable brute-force infeasibility calculations
export const NIST_SECURITY_BITS = {
  'HQC-128': 128,
  'HQC-192': 192,
  'HQC-256': 256,
  'Classic McEliece': 256,
  'ml_kem512': 128,
  'ml_kem768': 192,
  'ml_kem1024': 256
};

export function parseAlgorithmString(algorithms) {
  const str = algorithms || 'HQC-256 + SLH-DSA-128s';
  const parts = str.split(' + ').map(s => s.trim());
  const kemLabel = parts[0] || 'HQC-256';
  const sigLabel = parts[1] || 'SLH-DSA-128s';

  const kemAlgo = KEM_MAP[kemLabel];
  const sigAlgo = SIG_MAP[sigLabel];

  if (!kemAlgo) {
    throw new Error(`KEM algorithm map miss for label '${kemLabel}' (parsed from '${algorithms}')`);
  }
  if (!sigAlgo) {
    throw new Error(`Signature algorithm map miss for label '${sigLabel}' (parsed from '${algorithms}')`);
  }

  return { kemAlgo, sigAlgo, kemLabel, sigLabel };
}

export function generateIdentity(algorithms) {
  const { kemAlgo, sigAlgo, kemLabel, sigLabel } = parseAlgorithmString(algorithms);
  
  const kemKeys = kemAlgo.keygen();
  const sigKeys = sigAlgo.keygen();

  return {
    kemPublicKey: kemKeys.publicKey,
    kemSecretKey: kemKeys.secretKey,
    sigPublicKey: sigKeys.publicKey,
    sigSecretKey: sigKeys.secretKey,
    kemLabel,
    sigLabel
  };
}

export function encapsulate(kemPublicKeyBytes, kemAlgo) {
  if (!kemPublicKeyBytes || !(kemPublicKeyBytes instanceof Uint8Array)) {
    throw new Error("encapsulate requires a valid Uint8Array KEM public key");
  }
  const result = kemAlgo.encapsulate(kemPublicKeyBytes);
  return {
    ciphertext: result.cipherText,
    sharedSecret: result.sharedSecret
  };
}

export function decapsulate(ciphertextBytes, kemSecretKeyBytes, kemAlgo) {
  if (!ciphertextBytes || !(ciphertextBytes instanceof Uint8Array)) {
    throw new Error("decapsulate requires a valid Uint8Array ciphertext");
  }
  if (!kemSecretKeyBytes || !(kemSecretKeyBytes instanceof Uint8Array)) {
    throw new Error("decapsulate requires a valid Uint8Array KEM secret key");
  }
  return kemAlgo.decapsulate(ciphertextBytes, kemSecretKeyBytes);
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
