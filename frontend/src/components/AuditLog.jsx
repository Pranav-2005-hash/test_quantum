import React, { useState } from 'react';
import { Database, Filter, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuditLog({ logs }) {
  const [filter, setFilter] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.classification === filter;
  });

  const getLabelColor = (label) => {
    if (label === 'PII') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (label === 'FINANCIAL') return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    if (label === 'PUBLIC') return 'text-green-400 bg-green-500/10 border-green-500/30';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-10 border border-gray-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-gray-400" />
          <div>
            <h2 className="text-3xl font-bold">System Audit Log</h2>
            <p className="text-gray-400 mt-1">Immutable record of pipeline executions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm bg-[#0d1526]/80 p-1.5 rounded-lg border border-gray-800">
          <Filter className="w-4 h-4 text-gray-500 ml-2" />
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-md transition-colors ${filter === 'ALL' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('PII')}
            className={`px-3 py-1 rounded-md transition-colors ${filter === 'PII' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
          >
            PII
          </button>
          <button 
            onClick={() => setFilter('FINANCIAL')}
            className={`px-3 py-1 rounded-md transition-colors ${filter === 'FINANCIAL' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white'}`}
          >
            Financial
          </button>
          <button 
            onClick={() => setFilter('PUBLIC')}
            className={`px-3 py-1 rounded-md transition-colors ${filter === 'PUBLIC' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'}`}
          >
            Public
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0a0f1e]/80">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#1f2937]/50 text-gray-400 uppercase tracking-widest text-xs border-b border-gray-800">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Filename</th>
              <th className="px-6 py-4">Classification</th>
              <th className="px-6 py-4">Security Level</th>
              <th className="px-6 py-4">Algorithm Pair</th>
              <th className="px-6 py-4">Signature Start</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 font-mono text-xs">
            <AnimatePresence>
              {filteredLogs.map((log) => (
                <motion.tr 
                  key={log.id}
                  initial={{ opacity: 0, y: -20, backgroundColor: 'rgba(0, 229, 255, 0.2)' }}
                  animate={{ opacity: 1, y: 0, backgroundColor: 'transparent' }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-white">
                    {log.filename}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${getLabelColor(log.classification)}`}>
                      {log.classification}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {log.securityLevel}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {log.algorithm}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {log.signature}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      SUCCESS
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500 italic">
                  No records found matching the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
