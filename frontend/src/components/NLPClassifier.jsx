import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, ShieldAlert, FileUp } from 'lucide-react';
import { motion } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Use Vite's asset URL import to guarantee local worker loads with correct MIME type
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

const PII_KEYWORDS_HIGH = [
  "aadhaar", "uidai", "virtual id", "vid", "pan", "permanent account number", "passport number", "passport id", "driving license", "dl", "ddl", "rto number", "voter id", "epic", "election card", "ration card", "national id", "social security number", "ssn", "date of birth", "dob", "biometric id", "iris scan", "fingerprint hash", "digital signature", "imei", "mac id", "hardware address", "device id", "serial number", "sim number", "token id", "patient uid", "medical record", "itin", "taxpayer identification number", "ein", "employer identification number", "medicare number", "medicaid number", "hicn", "dea number", "npi", "national provider identifier", "state id", "driver license number", "vin", "bvn", "prn", "green card number", "visa number", "alien registration number", "military id", "dod id", "retina scan", "voice print", "dna profile", "facial recognition data", "tfn", "ni number", "national insurance number", "sin", "social insurance number", "pps number"
];

const PII_KEYWORDS_LOW = [
  "name", "full name", "first name", "last name", "middle name", "surname", "given name", "aliases", "maiden name", "age", "gender", "sex", "nationality", "marital status", "blood group", "father's name", "mother's name", "spouse name", "guardian name", "witness name", "employee id", "staff id", "usn", "university seat number", "roll number", "registration number", "student id", "primary mobile", "secondary mobile", "phone number", "landline", "home phone", "personal email", "official email", "correspondence address", "permanent address", "residential address", "house no", "flat no", "street", "landmark", "city", "district", "state", "pin code", "postal code", "zip code", "emergency contact", "ip address", "github username", "linkedin url", "social media handle", "login id", "password placeholder", "hospital id", "admission number", "bed number", "room number", "prescription rx", "lab report id", "scan id", "mri reference", "clinical history", "diagnosis", "pharmacy receipt", "insurance policy number", "claim id", "tpa id", "vaccine certificate id", "university id", "college code", "department name", "semester", "year of passing", "aggregate", "cgpa", "scholarship id", "hostel block", "room allotment", "library card id", "lab access token", "work phone", "extension", "fax number", "skype id", "discord tag", "telegram id", "whatsapp number", "wechat id", "ipv4", "ipv6", "subnet mask", "router mac", "bssid", "ssid", "gps coordinates", "latitude", "longitude", "altitude", "home town", "place of birth", "vehicle registration", "license plate", "car make", "policy holder", "beneficiary", "next of kin", "caste", "religion", "ethnicity", "race", "political affiliation", "sexual orientation", "criminal record", "conviction", "parole number", "prison id", "probation officer", "high school", "graduation year", "degree obtained", "frequent flyer number"
];

const FINANCIAL_KEYWORDS_HIGH = [
  "bank account number", "savings account", "current account", "ifsc code", "micr code", "swift code", "iban", "upi id", "vpa", "wallet id", "invoice number", "gross salary", "net salary", "take-home pay", "basic salary", "pan", "tan", "gstin", "gst number", "gstr-1", "gstr-3b", "form 16", "form 16a", "tds", "tax deducted at source", "demat id", "bo id", "client id", "trading id", "dp id", "cdsl", "nsdl", "isin", "loan account number", "mortgage", "emi", "equated monthly installment", "cibil", "credit score", "credit card", "debit card", "bank statement", "routing transit number", "rtn", "aba routing number", "sort code", "bsb number", "transit number", "cvv", "cvc", "cid", "card verification value", "expiration date", "expiry date", "cardholder name", "pin number", "personal identification number", "magnetic stripe data", "emv chip data", "apple pay token", "google pay token", "paypal account", "venmo handle", "cash app cashtag", "stripe account id", "bitcoin address", "ethereum address", "wallet seed phrase", "private key", "mnemonic phrase", "w-2 form", "1099 form", "w-9 form", "tax bracket", "adjusted gross income", "agi", "tax liability", "tax refund amount", "tax lien", "bankruptcy filing", "chapter 7", "chapter 11", "chapter 13", "wage garnishment", "alimony payments", "child support payments", "wire transfer instructions", "sepa mandate", "ach routing"
];

const FINANCIAL_KEYWORDS_LOW = [
  "fixed deposit", "recurring deposit", "branch name", "branch code", "bank name", "beneficiary name", "account holder", "trans_id", "transaction id", "utr number", "rbi reference", "reference number", "challan number", "receipt number", "order id", "billing id", "payment date", "credit", "debit", "balance", "available balance", "minimum balance", "overdraft", "remittance", "hra", "house rent allowance", "lta", "leave travel allowance", "special allowance", "conveyance", "medical reimbursement", "internet stipend", "variable pay", "performance bonus", "quarterly bonus", "joining bonus", "retention bonus", "arrears", "gratuity", "pension", "pf", "epf", "provident fund", "uan", "esic number", "itc", "input tax credit", "output tax", "taxable value", "tax rate", "igst", "cgst", "sgst", "80c", "80d", "section 24b", "standard deduction", "investment declaration", "tax audit", "auditor name", "membership number", "fiscal year", "assessment year", "capital gains", "stcg", "ltcg", "scrip name", "equity", "stocks", "mutual funds", "folio number", "units", "nav", "average price", "unrealized p&l", "realized profit", "sgb", "sovereign gold bond", "sip", "systematic investment plan", "dividend payout", "bonus issue", "rights issue", "stock split", "portfolio valuation", "collateral", "market value", "ltv ratio", "interest rate", "roi", "tenure", "processing fee", "sanctioned amount", "disbursement", "tranche", "foreclosure", "prepayment", "nach mandate", "ecs", "liability", "outstanding", "accounts payable", "accounts receivable", "general ledger", "trial balance", "chart of accounts", "depreciation", "amortization", "ebitda", "operating income", "net income", "gross margin", "return on assets", "return on equity", "earnings per share", "eps", "p/e ratio", "dividend yield", "market capitalization", "market cap", "book value", "enterprise value", "liquidity ratio", "current ratio", "quick ratio", "debt-to-equity ratio", "inventory turnover", "cash flow statement", "free cash flow", "capital expenditure", "capex", "operating expenditure", "opex", "cogs", "sales revenue", "arr", "mrr", "churn rate", "cac", "lifetime value", "burn rate", "runway", "seed funding", "series a", "series b", "ipo", "initial public offering", "merger", "acquisition", "venture capital", "private equity", "hedge fund", "etf", "exchange-traded fund", "index fund", "treasury bill", "commercial paper", "certificate of deposit", "money market account", "derivatives", "margin call", "short selling", "bull market", "bear market", "inflation rate", "quantitative easing", "fiscal stimulus"
];

const PUBLIC_KEYWORDS = [
  "internet", "world wide web", "global connectivity", "broadband", "fiber optics", "5g", "6g", "satellite internet", "leo", "low earth orbit", "wi-fi", "public hotspot", "network penetration", "smart city", "digital literacy", "open access", "information era", "web 2.0", "web 3.0", "decentralization", "blockchain", "peer-to-peer", "renewable energy", "clean energy", "solar power", "wind energy", "hydroelectric", "geothermal", "green hydrogen", "decarbonization", "net-zero", "carbon footprint", "greenhouse gases", "co2 emissions", "climate change", "global warming", "photovoltaic", "solar park", "wind farm", "offshore wind", "turbine", "smart grid", "energy storage", "battery technology", "lithium-ion", "solid-state", "agrivoltaics", "circular economy", "recycling", "holistic wellness", "mental health", "physical fitness", "ergonomics", "work-from-home", "digital eye strain", "text neck", "rsi", "mindfulness", "meditation", "stress management", "technostress", "information overload", "sleep hygiene", "circadian rhythm", "melatonin", "blue light", "digital detox", "fomo", "physical activity", "community health", "public resource", "healthy living", "whitepaper", "general report", "community guide", "public domain", "open source", "linux", "public education", "literacy rate", "knowledge sharing", "global trend", "statistics", "census", "public health initiative", "public record", "transparency", "accountability", "sustainable development", "sdgs", "global digital alliance", "consensus", "community notes", "fact-checking", "misinformation", "disinformation", "biodiversity", "ecosystem", "soil moisture", "air quality", "water safety", "reforestation", "direct air capture", "dac", "sequestration", "urban planning", "green space", "sustainable architecture", "modular design", "right to repair", "waste management", "pollution control", "terms of service", "privacy policy", "disclaimer", "cookie policy", "general data", "public information", "non-sensitive", "blog post", "newsletter", "faq", "about us", "mission statement", "vision 2030", "global roadmap", "public archive", "reference id", "version history", "press release", "media briefing", "journalism", "editorial", "op-ed", "broadcast", "podcast", "vlog", "documentary", "reportage", "press conference", "bulletin", "gazette", "magazine", "newspaper", "periodical", "publication", "catalog", "brochure", "pamphlet", "flyer", "leaflet", "handout", "poster", "banner", "billboard", "advertisement", "commercial", "infomercial", "sponsorship", "endorsement", "partnership", "collaboration", "joint venture", "memorandum of understanding", "mou", "letter of intent", "loi", "framework agreement", "treaty", "convention", "protocol", "accord", "pact", "resolution", "declaration", "charter", "constitution", "bylaws", "statute", "ordinance", "regulation", "directive", "guideline", "standard", "iso", "ansi", "ieee", "w3c", "ietf", "rfcs", "best practices", "code of conduct", "ethics policy", "compliance manual", "employee handbook", "user manual", "instruction guide", "getting started", "frequently asked questions", "knowledge base", "wiki", "forum", "message board", "bulletin board", "community platform", "social network", "microblog", "timeline", "dashboard", "portal", "gateway", "hub", "directory", "index", "registry", "repository", "archive", "library", "museum", "gallery", "exhibition", "fair", "expo", "trade show", "conference", "symposium", "seminar", "workshop", "webinar", "masterclass", "course", "curriculum", "syllabus", "lecture", "presentation", "slide deck", "pitch deck", "case study", "research paper", "thesis", "dissertation", "monograph", "anthology", "encyclopedia", "dictionary", "glossary", "thesaurus", "almanac", "atlas", "infographic", "diagram", "flowchart", "schematic", "blueprint", "mockup", "prototype", "wireframe", "storyboard", "screenplay", "manuscript", "trademark", "copyright", "patent", "intellectual property", "creative commons", "freeware", "shareware", "cybersecurity", "information security", "infosec", "data protection", "gdpr", "ccpa", "hipaa", "pci dss", "soc 2", "iso 27001", "evaluation", "rating", "ranking", "metric", "kpi", "key performance indicator", "okr", "objective and key result", "milestone", "deliverable", "deadline", "schedule", "calendar", "agenda", "itinerary", "voyage", "expedition", "safari", "cruise", "reservation", "ticket", "voucher", "coupon", "discount", "promotion", "clearance", "auction", "tender", "proposal", "estimate", "complaint", "suggestion", "recommendation", "testimonial", "survey", "poll", "questionnaire", "subscription", "membership", "enrollment", "admission", "authorization", "authentication", "verification", "validation", "certification", "accreditation", "licensing", "permit"
];

const SAMPLES = {
  PII: "Patient Registration Form\nName: John Doe\nDate of Birth: 05/12/1985\nSSN: 000-00-0000\nAddress: 123 Fake St, Springfield\nPhone Number: 555-0198",
  FINANCIAL: "Q3 Earnings Report\nTotal Revenue: $1,450,000\nNet Profit: $320,000\nPlease wire the payment to Account Number: 8493-2938-11\nInvoice #9923 attached for review.",
  PUBLIC: "Company Announcement\nWe are excited to announce our new product launch coming next month. Stay tuned for more updates on our website and social media channels! No sensitive data here."
};

export default function NLPClassifier({ documentText, setDocumentText, classification, setClassification }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsExtractingFile(true);
    try {
      if (file.type === 'text/plain') {
        const text = await file.text();
        setDocumentText(text);
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        
        // Pass data as an object to getDocument
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        setDocumentText(fullText.trim());
      } else {
        alert("Unsupported file type. Please upload a .txt or .pdf file.");
      }
    } catch (err) {
      console.error("Error reading file:", err);
      alert("Failed to read the file. See console for details.");
    } finally {
      setIsExtractingFile(false);
      // Reset input so the same file could be selected again if needed
      e.target.value = null;
    }
  };

  const simulateClassification = () => {
    if (!documentText) return;
    setIsScanning(true);
    setScanProgress(0);
    setClassification(null);
    setShowDetails(false);

    const textLower = documentText.toLowerCase();
    
    // Simulate thinking/scanning
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        
        // --- NEW WEIGHTED SCORING ALGORITHM ---
        const getMatches = (keywords) => keywords.filter(k => {
            const escaped = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Safe word boundary to avoid substring matching (e.g. 'age' inside 'page')
            const regex = new RegExp(`(^|\\W)(${escaped})($|\\W)`, 'i');
            return regex.test(textLower);
        });
        
        const piiHighMatches = getMatches(PII_KEYWORDS_HIGH);
        const piiLowMatches = getMatches(PII_KEYWORDS_LOW);
        const finHighMatches = getMatches(FINANCIAL_KEYWORDS_HIGH);
        const finLowMatches = getMatches(FINANCIAL_KEYWORDS_LOW);
        const pubMatches = getMatches(PUBLIC_KEYWORDS);

        const piiScore = (piiHighMatches.length * 3) + (piiLowMatches.length * 1);
        const finScore = (finHighMatches.length * 3) + (finLowMatches.length * 1);
        const pubScore = (pubMatches.length * 2);

        const categories = {
          PII: { score: piiScore, matches: [...piiHighMatches, ...piiLowMatches] },
          FINANCIAL: { score: finScore, matches: [...finHighMatches, ...finLowMatches] },
          PUBLIC: { score: pubScore, matches: pubMatches }
        };

        let winner = 'PUBLIC';
        
        if (piiScore === 0 && finScore === 0 && pubScore === 0) {
          winner = 'PUBLIC';
        } else {
          // Find the maximum score accurately across all three
          const maxScore = Math.max(piiScore, finScore, pubScore);
          
          if (maxScore === piiScore) {
            winner = 'PII'; // PII wins ties for safety
          } else if (maxScore === finScore) {
            winner = 'FINANCIAL'; 
          } else {
            winner = 'PUBLIC';
          }
        }

        const winnerScore = categories[winner].score;
        let secondHighestScore = 0;
        Object.keys(categories).forEach(cat => {
            if (cat !== winner && categories[cat].score > secondHighestScore) {
                secondHighestScore = categories[cat].score;
            }
        });

        let confidence = 98;
        if (winnerScore > 0 && secondHighestScore > 0) {
             // Calculate actual dynamic confidence based on point spread
             confidence = (winnerScore / (winnerScore + secondHighestScore)) * 100;
        } else if (winnerScore === 0) {
             confidence = 99; // Defaults to public safely
        } else if (winnerScore > 0 && secondHighestScore === 0) {
             confidence = 98; // High confidence if zero competing scores
        }
        
        // Allow confidence to drop to 50% for close ties, instead of capping at 82%
        confidence = Math.floor(Math.max(50, Math.min(99, confidence)));

        const formatReasoning = () => {
             if (winner === 'PUBLIC' && winnerScore === 0) return "No sensitive keywords detected → Category: PUBLIC";
             const matchStrings = [];
             if (categories.PII.score > 0) matchStrings.push(`PII(${categories.PII.score})`);
             if (categories.FINANCIAL.score > 0) matchStrings.push(`FINANCIAL(${categories.FINANCIAL.score})`);
             if (categories.PUBLIC.score > 0) matchStrings.push(`PUBLIC(${categories.PUBLIC.score})`);
             return `Score evaluation: ${matchStrings.join(' vs ')} → Winner: ${winner} ✅`;
        }

        setClassification({
          label: winner,
          confidence: confidence,
          winningMatches: categories[winner].matches,
          otherMatches: Object.keys(categories)
              .filter(cat => cat !== winner)
              .flatMap(cat => categories[cat].matches),
          reasoning: formatReasoning()
        });
        setIsScanning(false);
      }
    }, 150);
  };

  const getBadgeColors = (label) => {
    switch(label) {
      case 'PII': return 'text-red-500 bg-red-500/10 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
      case 'FINANCIAL': return 'text-orange-500 bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]';
      case 'PUBLIC': return 'text-green-500 bg-green-500/10 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]';
      default: return 'text-gray-400 border-gray-600';
    }
  };

  const renderHighlightedText = () => {
    if (!classification) return <p className="whitespace-pre-wrap">{documentText}</p>;
    
    // Sort matches by length descending so longer phrases get replaced first
    const processMatches = (matches) => [...matches].sort((a, b) => b.length - a.length);
    
    let highlightedHTML = documentText;

    // Secondary matches (lighter shade)
    processMatches(classification.otherMatches).forEach(match => {
        const regex = new RegExp(`(${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedHTML = highlightedHTML.replace(regex, `<mark class="bg-gray-400/30 text-gray-300 px-1 rounded border border-gray-600/50" title="Detected context ($1)">$1</mark>`);
    });

    // Primary matches (accent color)
    const highlightColor = classification.label === 'PII' ? 'bg-red-500/30 text-red-200 border border-red-500/50' 
        : classification.label === 'FINANCIAL' ? 'bg-orange-500/30 text-orange-200 border border-orange-500/50' 
        : 'bg-green-500/30 text-green-200 border border-green-500/50';

    processMatches(classification.winningMatches).forEach(match => {
      const regex = new RegExp(`(${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedHTML = highlightedHTML.replace(regex, `<mark class="${highlightColor} px-1 rounded font-bold shadow-[0_0_8px_currentColor]">$1</mark>`);
    });

    return (
        <div className="flex flex-col h-full">
           <div className="whitespace-pre-wrap leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: highlightedHTML }} />
           
           {classification.otherMatches.length > 0 && (
             <div className="mt-4 pt-3 border-t border-gray-800 text-gray-400 text-xs italic">
               Also detected (lower score): {classification.otherMatches.join(', ')} &rarr; did not override {classification.label} classification.
             </div>
           )}
        </div>
    );
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-10 border border-gray-800">
      <div className="flex items-center gap-3 mb-8">
        <FileText className="w-8 h-8 text-[#00e5ff]" />
        <h2 className="text-3xl font-bold">Document Ingestion & NLP Classifier</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* LEFT PANEL */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => { setDocumentText(SAMPLES.PII); setClassification(null); setShowDetails(false); }} className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700">Load PII Sample</button>
            <button onClick={() => { setDocumentText(SAMPLES.FINANCIAL); setClassification(null); setShowDetails(false); }} className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700">Load Financial Sample</button>
            <button onClick={() => { setDocumentText(SAMPLES.PUBLIC); setClassification(null); setShowDetails(false); }} className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700">Load Public Sample</button>
          </div>

          <div className="relative group">
            <textarea 
              className="w-full h-64 bg-[#0d1526]/80 text-gray-200 p-4 rounded-xl border border-gray-700 focus:border-[#00e5ff] focus:outline-none focus:ring-1 focus:ring-[#00e5ff] transition-all resize-none font-mono text-sm"
              placeholder="Paste document text here or upload a file..."
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
            />
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".txt,.pdf" 
              className="hidden" 
            />

            {!documentText && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto opacity-40 hover:opacity-100 bg-gray-900/50 hover:bg-gray-800/80 rounded-xl transition-all border-2 border-dashed border-transparent hover:border-[#00e5ff]"
              >
                <FileUp className="w-10 h-10 mb-2 text-[#00e5ff]" />
                <span className="text-[#00e5ff] font-bold">Upload PDF or TXT</span>
              </div>
            )}

            {isExtractingFile && (
              <div className="absolute inset-0 bg-[#0a0f1e]/80 flex flex-col items-center justify-center rounded-xl z-10 backdrop-blur-sm">
                 <div className="font-mono text-orange-400 text-sm animate-pulse">Extracting text from file...</div>
              </div>
            )}
            
            {isScanning && (
              <div className="absolute inset-0 bg-[#0a0f1e]/80 flex flex-col items-center justify-center rounded-xl z-10 backdrop-blur-sm">
                <div className="w-3/4 h-1 bg-gray-800 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    className="h-full bg-[#00e5ff]"
                    initial={{ width: 0 }}
                    animate={{ width: `${scanProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <div className="font-mono text-[#00e5ff] text-sm animate-pulse">Scanning document text...</div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={simulateClassification}
              disabled={!documentText || isScanning}
              className="flex-1 py-4 rounded-xl bg-[rgba(0,229,255,0.1)] text-[#00e5ff] border border-[#00e5ff] font-bold text-lg hover:bg-[rgba(0,229,255,0.2)] transition-all glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Classify Document
            </button>
            {documentText && (
              <button 
                onClick={() => { setDocumentText(''); setClassification(null); setShowDetails(false); }} 
                className="px-6 py-4 rounded-xl bg-red-900/20 text-red-400 border border-red-900/50 font-bold text-lg hover:bg-red-900/40 transition-all flex items-center justify-center whitespace-nowrap"
              >
                Clear Text
              </button>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - RESULT */}
        <div className="relative bg-[#0d1526]/50 rounded-xl border border-gray-800 p-6 flex flex-col min-h-[400px]">
          <h3 className="text-gray-400 font-medium mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
            NLP Classification Result
            {classification && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </h3>

          {!classification && !isScanning && (
            <div className="flex-1 flex items-center justify-center text-gray-600 font-mono text-sm text-center">
              Awaiting document input.<br/>Click "Classify Document" to analyze.
            </div>
          )}

          {classification && !isScanning && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col space-y-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Sensitivity Level</p>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-lg font-bold tracking-wide ${getBadgeColors(classification.label)}`}>
                    {classification.label === 'PII' && <AlertTriangle className="w-5 h-5" />}
                    {classification.label === 'FINANCIAL' && <ShieldAlert className="w-5 h-5" />}
                    {classification.label === 'PUBLIC' && <CheckCircle2 className="w-5 h-5" />}
                    {classification.label}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">Confidence</p>
                  <div className="text-2xl font-mono font-bold text-white tracking-widest">{classification.confidence}%</div>
                </div>
              </div>

              <div className="p-4 bg-black/40 rounded-lg border border-gray-800 font-mono text-sm text-gray-300">
                <span className="text-gray-500">&gt; NLP Analysis Output</span>
                <br/>
                <span className="text-[#39ff14]">{classification.reasoning}</span>
              </div>

              <div className="flex justify-center pt-2 pb-4 border-t border-gray-800/50">
                <button 
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full py-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-[#00e5ff] transition-all border border-gray-700/80 uppercase tracking-widest font-bold text-sm shadow-lg shadow-black/20"
                >
                  {showDetails ? '▲ Hide Detailed Context' : '▼ View Detailed Classification Context'}
                </button>
              </div>

              {showDetails && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex-1 overflow-y-auto pr-2 custom-scrollbar"
                >
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Document Context (Matches Highlighted)</p>
                  <div className="p-4 bg-[#0a0f1e] rounded-lg border border-gray-800 font-mono text-xs text-gray-400 leading-relaxed">
                    {renderHighlightedText()}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
