import React from 'react';
import { Key, ShieldCheck, Zap, Hash } from 'lucide-react';

const ALGORITHMS = [
  {
    id: 'hqc',
    name: 'HQC (Hamming Quasi-Cyclic)',
    subtitle: 'The Quantum-Safe Lock',
    description: 'A code-based Key Encapsulation Mechanism (KEM) providing post-quantum secure key exchange. Uses structured error-correcting codes to hide the shared secret.',
    icon: Key,
    color: 'text-[#f97316]',
    border: 'border-[#f97316]',
    bg: 'bg-[#f97316]/10',
    tags: ['Code-Based', 'NIST Round 4', 'KEM']
  },
  {
    id: 'slhdsa',
    name: 'SLH-DSA (SPHINCS+)',
    subtitle: 'The Tamper-Proof Seal',
    description: 'A stateless hash-based digital signature scheme. Provides highly conservative, mathematically proven security against both classical and quantum forgery.',
    icon: ShieldCheck,
    color: 'text-[#39ff14]',
    border: 'border-[#39ff14]',
    bg: 'bg-[#39ff14]/10',
    tags: ['Hash-Based', 'FIPS 205', 'Signature']
  },
  {
    id: 'aes',
    name: 'AES-256-GCM',
    subtitle: 'The Fast Safe',
    description: 'Advanced Encryption Standard in Galois/Counter Mode. Provides high-speed symmetric encryption and authenticated data integrity for the actual document payload.',
    icon: Zap,
    color: 'text-[#00e5ff]',
    border: 'border-[#00e5ff]',
    bg: 'bg-[#00e5ff]/10',
    tags: ['Symmetric', 'Authenticated', '256-bit']
  },
  {
    id: 'sha3',
    name: 'SHA-3',
    subtitle: 'The Digital Fingerprint Machine',
    description: 'The latest Cryptographic Hash Algorithm standard. Used internally by SLH-DSA to generate unique, irreversible document fingerprints.',
    icon: Hash,
    color: 'text-[#7c3aed]',
    border: 'border-[#7c3aed]',
    bg: 'bg-[#7c3aed]/10',
    tags: ['Hash Algorithm', 'Keccak', 'FIPS 202']
  }
];

export default function AlgorithmCards() {
  return (
    <div>
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold">Cryptographic Primitives</h2>
        <p className="text-gray-400 mt-2">The underlying algorithms powering QuantumShield's security guarantees</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {ALGORITHMS.map(algo => {
          const Icon = algo.icon;
          return (
            <div key={algo.id} className="glass-card rounded-2xl p-6 border border-gray-800 hover:border-gray-600 transition-all hover:-translate-y-2 group">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${algo.bg} ${algo.border} gap-2`}>
                <Icon className={`w-7 h-7 ${algo.color}`} />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1">{algo.name}</h3>
              <p className={`text-sm font-semibold mb-3 ${algo.color}`}>{algo.subtitle}</p>
              
              <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
                {algo.description}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-auto">
                {algo.tags.map(tag => (
                  <span key={tag} className="text-[10px] uppercase tracking-wider px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
