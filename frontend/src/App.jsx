import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import HeroSection from './components/HeroSection';
import NLPClassifier from './components/NLPClassifier';
import AISelector from './components/AISelector';
import PipelineVisualizer from './components/PipelineVisualizer';
import EncryptionOutput from './components/EncryptionOutput';
import AttackSimulation from './components/AttackSimulation';
import AlgorithmCards from './components/AlgorithmCards';
import AuditLog from './components/AuditLog';

export default function App() {
  const [documentText, setDocumentText] = useState('');
  const [classification, setClassification] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(78);
  const [pluggedIn, setPluggedIn] = useState(false);
  const [networkType, setNetworkType] = useState('Enterprise Network');
  const [pipelineStatus, setPipelineStatus] = useState('idle'); // idle, running, completed
  const [pipelineLogs, setPipelineLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([
    { id: 1, timestamp: new Date(Date.now() - 3600000).toISOString(), filename: 'invoice_march.pdf', classification: 'FINANCIAL', securityLevel: 'HIGH', algorithm: 'HQC-256 + SLH-DSA-128s', signature: '7k2p9x4m1q8...', status: 'SUCCESS' },
    { id: 2, timestamp: new Date(Date.now() - 7200000).toISOString(), filename: 'employee_data.csv', classification: 'PII', securityLevel: 'MAXIMUM', algorithm: 'HQC-256 + Classic McEliece', signature: 'a4b8c2d9e1f...', status: 'SUCCESS' },
    { id: 3, timestamp: new Date(Date.now() - 10800000).toISOString(), filename: 'product_announcement.docx', classification: 'PUBLIC', securityLevel: 'HIGH', algorithm: 'HQC-256 + SLH-DSA-128s', signature: 'c1d2e3f4g5h...', status: 'SUCCESS' },
    { id: 4, timestamp: new Date(Date.now() - 14400000).toISOString(), filename: 'q3_revenue.xlsx', classification: 'FINANCIAL', securityLevel: 'VERY HIGH', algorithm: 'HQC-256 + SLH-DSA-256s', signature: 'f5g6h7i8j9k...', status: 'SUCCESS' },
    { id: 5, timestamp: new Date(Date.now() - 18000000).toISOString(), filename: 'passport_scan.jpg', classification: 'PII', securityLevel: 'MAXIMUM', algorithm: 'HQC-256 + Classic McEliece', signature: 'k9j8i7h6g5f...', status: 'SUCCESS' }
  ]);
  const [encryptedPackage, setEncryptedPackage] = useState(null);

  // Derive security decision based on rules
  const getSecurityDecision = () => {
    // 1. Document Sensitivity (NLP Engine)
    let docSensitivity = 0; // 0 to 3
    const label = classification?.label || 'PUBLIC';
    
    if (label === 'PII' || label === 'GOVERNMENT_ID') docSensitivity = 3;
    else if (label === 'BIOGRAPHIC') docSensitivity = 2;
    else if (label !== 'PUBLIC') docSensitivity = 1;

    // 2. Network Risk Assessment (AI Profiler)
    const isPublicWifi = networkType === 'Public WiFi';

    // 3. Hardware Resource Constraints (Battery API)
    const isCriticalBattery = batteryLevel < 15 && !pluggedIn;
    const isLowBattery = batteryLevel < 40 && !pluggedIn;
    const isInfinitePower = pluggedIn;

    // --- QUANTUM DECISION MATRIX ---

    // Scenario A: High Risk + High Sensitivity
    if (docSensitivity >= 2 && isPublicWifi) {
        // Force Maximum Security. Security > Battery.
        return { level: 'MAXIMUM (HIGH RISK ENVIRONMENT)', algorithms: 'HQC-256 + Classic McEliece' };
    }

    // Scenario B: Critical Battery
    if (isCriticalBattery) {
        if (docSensitivity >= 2) {
            // Compromise: Sensitive doc, dying battery. Fast signatures, strong encryption.
            return { level: 'HIGH (BATTERY SAVER)', algorithms: 'HQC-192 + SLH-DSA-128f' };
        }
        // Public doc, dying battery: Use lowest overhead PQC
        return { level: 'LOW (CRITICAL BATTERY)', algorithms: 'HQC-128 + SLH-DSA-128f' };
    }

    // Scenario C: Unrestricted Power + Sensitive
    if (isInfinitePower && docSensitivity >= 2) {
        return { level: 'MAXIMUM (UNRESTRICTED POWER)', algorithms: 'HQC-256 + SLH-DSA-256s' };
    }

    // Scenario D: Public WiFi + Non-Sensitive
    if (isPublicWifi && docSensitivity < 2) {
        // Even public docs need decent protection on untrusted networks
        return { level: 'VERY HIGH (UNTRUSTED NET)', algorithms: 'HQC-192 + SLH-DSA-256f' };
    }

    // Scenario E: Moderate Battery + Moderate Sensitivity
    if (isLowBattery && docSensitivity > 0) {
        return { level: 'MEDIUM (BALANCED)', algorithms: 'HQC-192 + SLH-DSA-128s' };
    }

    // Scenario F: Default Safe State (Enterprise Net, Decent Battery)
    return { level: 'HIGH (STANDARD)', algorithms: 'HQC-256 + SLH-DSA-128s' };
  };

  const securityDecision = getSecurityDecision();

  const handleRunPipeline = () => {
    setPipelineStatus('running');
    setPipelineLogs([]);
    setEncryptedPackage(null);
    // PipelineVisualizer will manage the step-by-step state internally and call onComplete
  };

  const handlePipelineComplete = (output) => {
    setPipelineStatus('completed');
    setEncryptedPackage(output);
    
    // Add to audit log
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      filename: 'uploaded_document.txt',
      classification: classification?.label || 'UNKNOWN',
      securityLevel: securityDecision.level,
      algorithm: securityDecision.algorithms,
      signature: output.signature.substring(0, 15) + '...',
      status: 'SUCCESS'
    };
    setAuditLogs([newLog, ...auditLogs]);
  };

  return (
    <div className="min-h-screen pb-20 relative pt-16 bg-[#0a0f1e]">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-gray-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              <Shield className="w-6 h-6 text-[#00e5ff]" />
              <span className="font-bold text-white text-xl tracking-wider">QuantumShield</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#nlp-classifier" className="text-xs uppercase tracking-widest font-bold text-gray-400 hover:text-[#00e5ff] transition-colors">NLP Engine</a>
              <a href="#ai-selector" className="text-xs uppercase tracking-widest font-bold text-gray-400 hover:text-[#00e5ff] transition-colors">AI Logic</a>
              <a href="#pipeline" className="text-xs uppercase tracking-widest font-bold text-gray-400 hover:text-[#00e5ff] transition-colors">Pipeline</a>
              <a href="#attack-simulation" className="text-xs uppercase tracking-widest font-bold text-gray-400 hover:text-[#00e5ff] transition-colors">Attack Sim</a>
              <a href="#audit-log" className="text-xs uppercase tracking-widest font-bold text-gray-400 hover:text-[#00e5ff] transition-colors">Audit Log</a>
            </div>
          </div>
        </div>
      </nav>

      <HeroSection />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 mt-12">
        <section id="nlp-classifier">
          <NLPClassifier 
            documentText={documentText} 
            setDocumentText={setDocumentText}
            classification={classification}
            setClassification={setClassification}
          />
        </section>

        <section id="ai-selector">
          <AISelector 
            batteryLevel={batteryLevel}
            setBatteryLevel={setBatteryLevel}
            pluggedIn={pluggedIn}
            setPluggedIn={setPluggedIn}
            networkType={networkType}
            setNetworkType={setNetworkType}
            securityDecision={securityDecision}
            classification={classification}
          />
        </section>

        <section id="pipeline">
          <PipelineVisualizer 
            status={pipelineStatus}
            onRun={handleRunPipeline}
            onComplete={handlePipelineComplete}
            classification={classification}
            securityDecision={securityDecision}
            logs={pipelineLogs}
            setLogs={setPipelineLogs}
            documentText={documentText}
          />
        </section>

        {pipelineStatus === 'completed' && encryptedPackage && (
          <section id="encryption-output" className="animate-in fade-in slide-in-from-bottom-10 duration-700">
            <EncryptionOutput 
              originalText={documentText}
              encryptedPackage={encryptedPackage}
            />
          </section>
        )}

        <section id="attack-simulation">
          <AttackSimulation />
        </section>

        <section id="algorithms">
          <AlgorithmCards />
        </section>

        <section id="audit-log">
          <AuditLog logs={auditLogs} />
        </section>
      </div>
    </div>
  );
}
