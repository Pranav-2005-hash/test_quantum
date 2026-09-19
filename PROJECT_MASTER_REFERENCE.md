# PROJECT_MASTER_REFERENCE.md

## 1. Local Architecture & Environment Setup

### Execution Environment
- **Runtime Engine**: Node.js (v18+ recommended) with ES Modules enabled in frontend (`type: "module"`) and CommonJS in backend.
- **Frontend Development Server**: Vite v6.0.0 serving on `0.0.0.0:5173` (accessible on LAN and local host).
- **Backend Server**: Node.js Express server listening on `0.0.0.0:5000` (CommonJS environment).
- **Network Proxy Config**: Vite dev server proxies `/api` requests to `http://127.0.0.1:5000` with `changeOrigin: true` and `secure: false`.
- **Environment Variables**:
  - `PORT`: Configures local backend HTTP port (Default: `5000`).
  - `WHATISMYIP_API_KEY`: API key for WhatIsMyIP OSINT service (Fallback default present in code: `54ac597355e19c1e88da56f5b0aac726`).
- **CLI & Run Scripts**:
  - Backend (`backend/package.json`):
    - `npm start`: Runs `node server.js`
    - `npm run tunnel`: Runs `npx localtunnel --port 5000`
  - Frontend (`frontend/package.json`):
    - `npm run dev`: Runs `vite`
    - `npm run build`: Runs `vite build`
    - `npm run preview`: Runs `vite preview`

### Complete Tech Stack & Dependencies

#### Backend (`backend/package.json`)
- **Core Framework**: `express` (`^5.2.1`)
- **Middleware**: `cors` (`^2.8.6`), `dotenv` (`^17.4.2`)
- **Node Built-in Modules**: `os`, `child_process`, `util`

#### Frontend (`frontend/package.json`)
- **Core Framework**: `react` (`^19.2.5`), `react-dom` (`^19.2.5`), `react-router-dom` (`^7.14.1`)
- **Build Tooling & Compilers**: `vite` (`^6.0.0`), `@vitejs/plugin-react` (`^4.3.4`), `typescript` (`~6.0.2`), `@types/react` (`^19.2.14`), `@types/react-dom` (`^19.2.3`)
- **Styling**: `tailwindcss` (`^4.2.2`), `@tailwindcss/vite` (`^4.2.2`), `clsx` (`^2.1.1`), `tailwind-merge` (`^3.5.0`)
- **Post-Quantum & Classical Cryptography Primitives**:
  - `@noble/post-quantum` (`^0.5.4`): NIST ML-KEM (`ml_kem512`, `ml_kem768`, `ml_kem1024`) and SLH-DSA (`slh_dsa_sha2_128s`, `slh_dsa_sha2_128f`, `slh_dsa_sha2_256s`, `slh_dsa_sha2_256f`)
  - `@noble/ciphers` (`^1.3.0`): AES-256-GCM (`gcm`)
  - `@noble/hashes`: SHA-256 (`sha2.js`)
- **UI & Iconography & Animations**: `framer-motion` (`^12.38.0`), `lucide-react` (`^1.8.0`)
- **OCR & Document Extraction**: `pdfjs-dist` (`^5.6.205`), `tesseract.js` (`^7.0.0`)

### Local Backend Runtime & Protocol Structure
- **HTTP Server**: Built with Express v5.
- **Binding**: `0.0.0.0:5000` to allow cross-laptop LAN/Tailscale communication.
- **Payload Limits**: JSON body parser configured with a `100mb` limit (`express.json({ limit: '100mb' })`) to handle large base64-encoded PDF documents.
- **REST Route Inventory**:
  - `GET /api/network-info`: Retrieves local IPv4 network interfaces, Tailscale IPs, and subnet masks.
  - `POST /api/transmit`: Transmits/relays a document payload to local inbox, remote target, or via attacker gateway.
  - `POST /api/intercept/forward`: Forwards an intercepted package from Attacker Node C buffer to Receiver Node B with optional tampering.
  - `GET /api/inbox`: Retrieves local receiver inbox items.
  - `POST /api/inbox/:id/ack`: Acknowledges and removes an inbox package.
  - `DELETE /api/inbox/clear`: Clears all inbox packages.
  - `POST /api/identity`: Registers node public key identity (KEM + SLH-DSA keys).
  - `GET /api/identity`: Retrieves registered node public key identity.
  - `GET /api/alerts`: Returns unread intrusion alerts.
  - `DELETE /api/alerts/clear`: Clears pending intrusion alerts.
  - `POST /api/alerts/notify`: Out-of-band receiver endpoint for intrusion alerts dispatched by other nodes.
  - `GET /api/attack-log`: Returns Attacker Node C terminal logs.
  - `GET /api/system/battery`: Returns OS battery telemetry.
  - `GET /api/osint/scan`: Performs local/public network intelligence gathering and ISP classification.

### Local Data Storage Mechanisms
- **In-Memory Volatile Stores** (`backend/controllers/lanController.js`):
  - `inbox`: Array of received/intercepted document packages (capped at 50 items).
  - `pendingAlerts`: Array of real-time intrusion security alerts (capped at 50 items).
  - `attackLog`: Array of formatted terminal log strings for Laptop C (capped at 100 items).
  - `nodeIdentity`: Active PQC public key identity registered by local node.

### Cryptographic Implementation Architecture
- **Pure JavaScript Cryptography**: Executes in browser and Node without requiring native binary add-ons or secure HTTPS contexts (`window.crypto.subtle` fallback avoiding Web Crypto LAN HTTP restrictions).
- **Primitives Mapping**:
  - **Key Encapsulation Mechanism (KEM)**: `ML-KEM-512` (NIST Security Category 1 / 128-bit), `ML-KEM-768` (NIST Security Category 3 / 192-bit), `ML-KEM-1024` (NIST Security Category 5 / 256-bit).
  - **Digital Signatures**: `SLH-DSA-128s`, `SLH-DSA-128f`, `SLH-DSA-256s`, `SLH-DSA-256f`.
  - **Symmetric Encryption**: AES-256-GCM using 12-byte random IVs and shared secret derived from PQC KEM encapsulation.
  - **Hashing**: SHA-256 for document fingerprints.

---

## 2. Detailed Data Flow & Execution Tracing

### End-to-End Local Lifecycle
1. **Document Loading & Extraction**:
   - User inputs text, uploads a document file (`.txt`, `.pdf`, `.png`, `.jpg`, `.csv`, `.xlsx`), or selects a sample document.
   - For PDF files, `pdfjs-dist` extracts text page-by-page. For images, `tesseract.js` executes optical character recognition (OCR). Base64 representations are prepared.
2. **Sensitivity & Contextual Analysis**:
   - `NLPClassifier.jsx` evaluates the document text using regex patterns and keyword dictionaries for three classifications: `PII` (SSN, credit cards, emails, passwords), `FINANCIAL` (IBAN, routing, revenue, wire transfer terms), and `PUBLIC`.
   - `osintController.js` queries local IP interfaces and WAN lookup APIs to determine network trust level (`Enterprise Network`, `Home WiFi`, `Mobile Data`, `Public WiFi`).
   - `systemController.js` executes OS shell commands (`pmset`, `Get-CimInstance`, `WMIC`, `upower`) to fetch battery charge level and AC power status.
3. **Adaptive Security Decision Matrix**:
   - The system computes context-aware security level and selects PQC algorithm parameters (`ML-KEM-512 + SLH-DSA-128f`, `ML-KEM-768 + SLH-DSA-128s`, `ML-KEM-1024 + SLH-DSA-128s`, `ML-KEM-1024 + SLH-DSA-256s`).
4. **Transmission Mode Selection & Cryptographic Packaging**:
   - User selects **Option 1 (Standard / Unencrypted)** or **Option 2 (Quantum-Encrypted)** in `LanSharingDashboard.jsx`.
   - **Option 2 (Quantum-Encrypted)**:
     - SHA-256 fingerprint generated over document payload.
     - PQC Digital Signature computed using sender's SLH-DSA secret key over the SHA-256 digest.
     - Target node's public key fetched via `GET /api/identity`.
     - KEM shared secret encapsulated against target's public key (`encapsulate`).
     - Payload encrypted via AES-256-GCM using shared secret.
     - `packageData` envelope formed with PQC headers.
   - **Option 1 (Standard)**:
     - Raw document bytes packaged with `securityLevel: 'NONE'` and no PQC headers (`kemCiphertextHex`, `signature` absent).
5. **LAN Transmission & Gateway Interception**:
   - Sender posts package to `/api/transmit`.
   - If **3-Node Gateway Routing** is enabled, Sender routes the payload to Laptop C (`gatewayIp`).
   - If chunk delay is configured, an artificial timer throttles transmission visibility window.
   - Laptop C receives packet into `inbox` with `isIntercepted: true`.
6. **Attacker Node C Interception & Tampering Pipeline**:
   - Attacker console displays intercepted payload, ciphertext, classification, and protection status (`pqcProtected`).
   - **Scenario A (Attacker passes unaltered)**:
     - Laptop C posts `/api/intercept/forward` with `tamper: false`.
     - Original clean packet delivered to Laptop B. No security alert dispatched.
   - **Scenario B (Attacker attempts bit-flip on Quantum-Encrypted stream)**:
     - Laptop C posts `/api/intercept/forward` with `tamper: true`.
     - Laptop C detects `pqcProtected: true`.
     - Terminal logs: `[ATTACK STATUS] Target Stream Detected (Quantum-Encrypted)` and `[ATTACK FAILED] Cannot disrupt payload! Quantum integrity tag prevents tampering.`
     - Laptop C triggers out-of-band HTTP alert (`POST /api/alerts/notify`) to Laptop A and Laptop B.
     - Original clean packet forwarded to Laptop B with `attackBlocked: true` flag.
   - **Scenario C (Attacker tampers with Standard/Unencrypted stream)**:
     - Laptop C corrupts document text, base64 data, fingerprint, and alters classification label to `PUBLIC`.
     - Out-of-band alert dispatched. Corrupted payload forwarded to Laptop B.
7. **Receiver Verification & Document Reader**:
   - Laptop B fetches `/api/inbox`.
   - User clicks **Decrypt & Open Document**.
   - `handleVerifyPackage` runs SHA-256 check, AES-256-GCM decapsulate/decrypt check, and SLH-DSA signature verification check.
   - For Quantum-Encrypted files (tampered attempt or unaltered), verification succeeds (`verified: true`), document payload remains 100% intact, and UI displays `🛡️ Attack Blocked — Intact`.
   - For Standard files tampered in transit, hash check fails (`verified: false`), UI displays `File Stream Corrupted!`.

---

## 3. Complete Module & Feature Inventory

### Root Directory

#### [README.md](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/README.md)
- **Functionality**: Project documentation outlining architecture, multi-laptop demo setup, and execution commands.

#### [.gitignore](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/.gitignore)
- **Functionality**: Workspace git exclusion rules for `node_modules`, build artifacts, and local environments.

---

### Backend Components (`backend/`)

#### [backend/package.json](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/backend/package.json)
- **Functionality**: Node.js backend configuration, start scripts, and dependency manifests.

#### [backend/server.js](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/backend/server.js)
- **Functionality**: Main Express HTTP server entry point listening on `0.0.0.0:5000`.
- **Core Logic & Operations**: Initializes CORS, 100MB JSON/urlencoded parsers, registers REST API routes, and handles server bootstrap.
- **Input / Output**: Express app instance listening on port 5000.

#### [backend/controllers/lanController.js](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/backend/controllers/lanController.js)
- **Functionality**: Handles 3-node PQC LAN sharing, in-memory inbox management, MITM interception, forwarding, out-of-band security alert dispatching, and attack terminal logging.
- **Core Functions**:
  - `isQuantumProtected(packageData)`: Inspects envelope for PQC headers (`kemCiphertextHex`, `signature`) or algorithm strings.
  - `attackTerminalLog(line)`: Prepends timestamp and stores log entry in `attackLog` array (capped at 100).
  - `sendAlertToHost(host, alertObj)`: Out-of-band HTTP POST dispatcher delivering intrusion alerts to remote nodes via `/api/alerts/notify`.
  - `broadcastIntrusionAlert(attackerIp, targetIp, senderIp, packageId, pqcProtected, customMessage)`: Constructs alert entity, adds to `pendingAlerts`, logs to terminal, and triggers `sendAlertToHost`.
  - `receiveAlert(req, res)`: Handler for `/api/alerts/notify` storing incoming out-of-band alerts.
  - `getNetworkInfo(req, res)`: Inspects `os.networkInterfaces()` to return local IPv4 addresses, subnets, and Tailscale VPN IPs.
  - `transmitPackage(req, res)`: Handles direct document transmission, live MITM overlay tampering, chunk delay throttling, and gateway routing via Laptop C.
  - `forwardInterceptedPackage(req, res)`: Handles Laptop C relay to Laptop B. Enforces dual-mode attack logic (prevents payload disruption on Quantum streams, corrupts payload on Standard streams).
  - `getInbox(req, res)`: Returns local receiver inbox array.
  - `acknowledgePackage(req, res)`: Removes specific package from inbox by ID.
  - `clearInbox(req, res)`: Clears all items in inbox.
  - `getAlerts(req, res)`: Returns unread intrusion alerts and marks them read.
  - `clearAlerts(req, res)`: Clears `pendingAlerts` array.
  - `getAttackLog(req, res)`: Returns `attackLog` array.
  - `registerIdentity(req, res)` / `getIdentity(req, res)`: Registers and exposes PQC public key identity.
- **Input / Output Specifications**: Express controller JSON request/response structures.

#### [backend/controllers/osintController.js](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/backend/controllers/osintController.js)
- **Functionality**: Performs OSINT network intelligence gathering, WAN IP identification, and ISP classification matrix.
- **Core Functions**:
  - `getLocalIp()`: Searches network interfaces for active non-internal IPv4 address.
  - `safeFetchJson(url, timeoutMs)`: Wraps HTTP fetch with timeout and JSON validation to prevent HTML error parsing failures.
  - `runOsintScan(req, res)`: Multi-provider WAN lookup (WhatIsMyIP API key -> ip-api.com -> ipapi.co fallback). Evaluates ISP and organization name against keyword arrays (`publicKeywords`, `enterpriseKeywords`, `cellularKeywords`, `homeKeywords`) to classify network type and return score modifier (-40 to +30).

#### [backend/controllers/systemController.js](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/backend/controllers/systemController.js)
- **Functionality**: Cross-platform system telemetry reader for battery state and power source.
- **Core Functions**:
  - `getSystemBattery(req, res)`: Platform-specific telemetry executor.
    - `darwin`: Executes `pmset -g batt` via regex matching percentage and AC charging state.
    - `win32`: 3-stage fallback chain (PowerShell `Get-CimInstance Win32_Battery` -> WMIC `Get EstimatedChargeRemaining,BatteryStatus` -> PowerShell `Get-WmiObject`). Maps status integer to plugged-in status set (`{2, 3, 6, 7, 8, 9}`).
    - `linux`: Executes `upower` CLI string parsing percentage and state.

---

### Frontend Setup & Utilities (`frontend/`)

#### [frontend/package.json](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/package.json)
- **Functionality**: Frontend module configuration, build scripts, and Vite/React/Noble dependencies.

#### [frontend/vite.config.js](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/vite.config.js)
- **Functionality**: Vite build configuration, Tailwind plugin setup, host binding (`0.0.0.0:5173`), and proxy rule mapping `/api` to `http://127.0.0.1:5000`.

#### [frontend/tsconfig.json](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/tsconfig.json)
- **Functionality**: TypeScript compiler option parameters for React/JSX code inspection.

#### [frontend/index.html](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/index.html)
- **Functionality**: HTML5 root document mounting `#root` React DOM container.

#### [frontend/src/main.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/main.jsx)
- **Functionality**: React DOM entry point rendering `<App />` within `StrictMode`.

#### [frontend/src/main.ts](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/main.ts) & [frontend/src/counter.ts](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/counter.ts)
- **Functionality**: Boilerplate TypeScript entry files.

#### [frontend/src/index.css](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/index.css) & [frontend/src/style.css](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/style.css)
- **Functionality**: Core CSS styling, Tailwind imports, custom animations (`glow-red`, `glow-cyan`, `glow-green`), custom scrollbars, and dark-theme aesthetics.

#### [frontend/src/lib/pqc.js](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/lib/pqc.js)
- **Functionality**: Pure JS Post-Quantum Cryptography wrapper library interfacing `@noble/post-quantum` and `@noble/ciphers`.
- **Core Functions**:
  - `parseAlgorithmString(algorithms)`: Parses algorithm strings into KEM and Digital Signature primitives.
  - `generateIdentity(algorithms)`: Generates primary KEM & SLH-DSA key pairs, plus multi-tier keypairs across all NIST categories (`ML-KEM-512`, `ML-KEM-768`, `ML-KEM-1024`).
  - `encapsulate(kemPublicKeyBytes, kemAlgo)`: Auto-matches recipient public key length to NIST category and encapsulates shared secret.
  - `decapsulate(ciphertextBytes, kemSecretKeyBytes, kemAlgo, multiKeys)`: Auto-matches ciphertext byte length (768, 1088, 1568) to multi-tier secret keys and decapsulates shared secret.
  - `aesGcmEncrypt(plaintextBytes, sharedSecret32Bytes)`: Encrypts bytes using AES-256-GCM with random 12-byte IV.
  - `aesGcmDecrypt(ciphertextBytes, iv, sharedSecret32Bytes)`: Decrypts AES-256-GCM ciphertext bytes using IV and shared secret.
  - `sha256Hex(textOrBytes)`: Computes SHA-256 hash and returns hex string.
  - `sign(messageBytes, sigSecretKeyBytes, sigAlgo)`: Computes SLH-DSA signature over message bytes.
  - `verify(messageBytes, signatureBytes, sigPublicKeyBytes, sigAlgo)`: Verifies SLH-DSA signature.
  - `bytesToHex(bytes)` / `hexToBytes(hex)`: Utility converters between `Uint8Array` and hex strings.

---

### Frontend UI Components (`frontend/src/components/`)

#### [frontend/src/App.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/App.jsx)
- **Functionality**: Primary layout, navigation header, global state coordinator, and contextual security decision engine.
- **Core Logic**:
  - Automatically fetches OSINT telemetry (`/api/osint/scan`) and Battery telemetry (`/api/system/battery`).
  - Computes `securityDecision` object mapping document classification (`PII`, `FINANCIAL`, `PUBLIC`), battery charge level, AC power state, and network classification to appropriate PQC algorithm suites.
  - Renders active views (`Dashboard`, `Classification`, `AI Selector`, `PQC Pipeline`, `Encryption Preview`, `3-Laptop LAN Demo`, `Attack Sandbox`, `Audit Log`).

#### [frontend/src/components/HeroSection.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/HeroSection.jsx)
- **Functionality**: Dashboard hero header presenting system status, real-time threat level, and active PQC suite indicators.

#### [frontend/src/components/NLPClassifier.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/NLPClassifier.jsx)
- **Functionality**: Document ingestion, OCR text extraction, PDF text parsing, and regex/keyword NLP document sensitivity classifier.
- **Core Functions**:
  - `extractTextFromPdf(file)`: Uses `pdfjs-dist` to iterate pages and extract text content.
  - `extractTextFromImage(file)`: Uses `tesseract.js` worker to perform OCR text recognition.
  - `classifyText(text)`: Runs weighted regex pattern scoring over document text to classify sensitivity (`PII`, `FINANCIAL`, `PUBLIC`) and compute confidence score (0-100%).

#### [frontend/src/components/AISelector.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/AISelector.jsx)
- **Functionality**: Contextual security policy selection dashboard rendering decision matrices, system telemetry, and manual algorithm overrides.

#### [frontend/src/components/AlgorithmCards.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/AlgorithmCards.jsx)
- **Functionality**: Educational card component displaying technical parameter comparisons between `ML-KEM-512`, `ML-KEM-768`, `ML-KEM-1024`, `SLH-DSA`, and `AES-256-GCM`.

#### [frontend/src/components/PipelineVisualizer.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/PipelineVisualizer.jsx)
- **Functionality**: Interactive animated visualization depicting the step-by-step PQC encryption and transmission pipeline.

#### [frontend/src/components/EncryptionOutput.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/EncryptionOutput.jsx)
- **Functionality**: Live cryptographic payload inspector displaying public keys, secret keys, SHA-256 digests, SLH-DSA signatures, KEM ciphertexts, and AES-GCM output.

#### [frontend/src/components/LanSharingDashboard.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/LanSharingDashboard.jsx)
- **Functionality**: Complete 3-node demo dashboard for Laptop A (Sender), Laptop B (Receiver), and Laptop C (Attacker Sniffer).
- **Core Components & Features**:
  - Node role selector tabs (`Sender`, `Receiver`, `Attacker Node C`).
  - Interactive Transmission Mode selector (`Standard / Unencrypted` vs `Quantum-Encrypted`).
  - Target Receiver address configuration & 3-Node Gateway Routing toggle via Laptop C.
  - Real-time intrusion alert banner handling broadcasted out-of-band security alerts.
  - Attacker Node C sniffer view displaying intercepted packets, PQC detection status, terminal logs, and attack action controls (*Pass Unaltered* vs *Attempt Bit-Flip Attack*).
  - Receiver inbox list with cryptographic verification runner (`handleVerifyPackage`) and full Document Reader Modal with tamper status alerts.

#### [frontend/src/components/AttackSimulation.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/AttackSimulation.jsx)
- **Functionality**: Interactive quantum attack simulator demonstrating Shor's algorithm RSA/ECC factorization vs lattice/code-based PQC resistance and brute-force complexity calculations.

#### [frontend/src/components/AuditLog.jsx](file:///c:/Users/shamb/OneDrive/Desktop/mp-2/Quantum_Shield/frontend/src/components/AuditLog.jsx)
- **Functionality**: Searchable audit log table rendering historical document transmission events, security levels, timestamps, and status badges.

---

## 4. Engineering & Implementation Details

### Algorithms & Logic Handlers

#### 1. Regex & Keyword NLP Classification Algorithm (`NLPClassifier.jsx`)
- Computes weighted sensitivity score based on pattern matches:
  - **PII Patterns**:
    - Social Security Numbers (`\b\d{3}-\d{2}-\d{4}\b`) -> Weight: 35
    - Credit Card Numbers (`\b(?:\d[ -]*?){13,16}\b`) -> Weight: 30
    - Email Addresses (`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`) -> Weight: 15
    - Passwords/Secrets (`(password|secret|api_key|token)\s*[:=]\s*\S+`) -> Weight: 35
  - **FINANCIAL Patterns**:
    - IBAN / Bank Accounts (`\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b`) -> Weight: 30
    - Financial Terms (`invoice`, `balance`, `revenue`, `salary`, `payment`, `transaction`, `payroll`, `budget`) -> Weight: 20
    - Currency Values (`\$?\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b`) -> Weight: 10
- Logic calculates `piiScore`, `financialScore`, assigns classification label based on maximum threshold (>=25), and derives a confidence percentage.

#### 2. Cross-Platform Battery Telemetry Fallback Chain (`systemController.js`)
- Tries primary modern interface (`Get-CimInstance Win32_Battery`), falls through to legacy interface (`WMIC Path Win32_Battery`), and then secondary WMI (`Get-WmiObject Win32_Battery`) before resorting to system default fallbacks (`batteryLevel: 75`, `pluggedIn: true`).

#### 3. Multi-Provider OSINT API Failover Chain (`osintController.js`)
- Queries user's `WhatIsMyIP` API key with JSON response validation.
- If rate-limited or non-JSON HTML error returned, engages failover to `ip-api.com`.
- If `ip-api.com` fails, engages failover to `ipapi.co`.
- Evaluates ISP text string against network keyword arrays to derive trust score modifier (-40 for public Wi-Fi, +5 for cellular, +20 for home broadband, +30 for enterprise).

#### 4. Adaptive Security Decision Matrix (`App.jsx`)
```javascript
const evaluateSecurityLevel = (classificationLabel, batteryTelemetry, osintData) => {
    // 1. Classification Override
    if (classificationLabel === 'PII') return { level: 'MAXIMUM', algorithms: 'ML-KEM-1024 + SLH-DSA-256s' };
    
    // 2. Telemetry Factors
    const isBatteryLow = batteryTelemetry && batteryTelemetry.batteryLevel <= 20 && !batteryTelemetry.pluggedIn;
    const isUntrustedNetwork = osintData && !osintData.isPrivateNetwork;

    if (isBatteryLow) {
        if (classificationLabel === 'FINANCIAL') return { level: 'HIGH', algorithms: 'ML-KEM-768 + SLH-DSA-128f' };
        return { level: 'LOW', algorithms: 'ML-KEM-512 + SLH-DSA-128f' };
    }
    if (isUntrustedNetwork) {
        if (classificationLabel === 'FINANCIAL') return { level: 'MAXIMUM', algorithms: 'ML-KEM-1024 + SLH-DSA-256s' };
        return { level: 'VERY HIGH', algorithms: 'ML-KEM-768 + SLH-DSA-256f' };
    }
    if (classificationLabel === 'FINANCIAL') return { level: 'VERY HIGH', algorithms: 'ML-KEM-768 + SLH-DSA-128s' };
    return { level: 'HIGH', algorithms: 'ML-KEM-1024 + SLH-DSA-128s' };
};
```

#### 5. Multi-Tier Key Auto-Negotiation & Envelope Matching (`pqc.js`)
- `generateIdentity` generates multi-tier keypairs across NIST categories (`ML-KEM-512`, `ML-KEM-768`, `ML-KEM-1024`).
- When sending (`encapsulate`), the system checks `KEM_BY_PK_LENGTH[kemPublicKeyBytes.length]` (800, 1184, 1568 bytes) to auto-adjust encapsulation suite to match recipient key length.
- When receiving (`decapsulate`), the system checks `KEM_BY_CT_LENGTH[ciphertextBytes.length]` (768, 1088, 1568 bytes) to select the correct secret key from `multiKeys`.

#### 6. Dual-Mode Attack Logic & Proxy Pipeline (`lanController.js`)
- Attacker Node C checks `isQuantumProtected(packageData)`.
- If **Quantum-Encrypted**:
  - Prevents payload corruption.
  - Logs `[ATTACK FAILED] Cannot disrupt payload! Quantum integrity tag prevents tampering.`
  - Dispatches out-of-band alert to Sender & Receiver via `sendAlertToHost`.
  - Forwards pristine clean packet to Receiver with `attackBlocked: true` metadata.
- If **Standard/Unencrypted**:
  - Injects corrupted bytes into `documentText`, `fileBase64`, `ciphertextHex`, `fingerprint`.
  - Alters classification label to `PUBLIC`.
  - Marks package `tamperedByMitm: true`.
  - Dispatches out-of-band alert and forwards corrupted packet.

---

## 5. Local Data Models & Schemas

### `packageData` Structure (Transmitted Document Envelope)
```json
{
  "filename": "string",
  "fileType": "string",
  "fileSize": 12345,
  "fileBase64": "data:text/plain;base64,...",
  "documentText": "string",
  "classification": {
    "label": "PII | FINANCIAL | PUBLIC",
    "confidence": 95
  },
  "securityLevel": "NONE | LOW | HIGH | VERY HIGH | MAXIMUM",
  "algorithms": "string (e.g. ML-KEM-1024 + SLH-DSA-128s)",
  "fingerprint": "hex string (64 chars SHA-256)",
  "signature": "hex string (SLH-DSA signature)",
  "kemCiphertextHex": "hex string (ML-KEM KEM ciphertext)",
  "ciphertextHex": "hex string (AES-256-GCM ciphertext)",
  "ivHex": "hex string (24 chars / 12 bytes IV)",
  "authTag": "hex string (32 chars / 16 bytes auth tag)",
  "targetKemPublicKeyHex": "hex string",
  "senderSigPublicKeyHex": "hex string",
  "pkSize": "string (e.g. 2,368 Bytes)",
  "ctSize": "string",
  "sigSize": "string",
  "timestamp": "string",
  "attackAttempted": boolean,
  "attackBlocked": boolean,
  "attackerIp": "string",
  "tamperedByMitm": boolean,
  "attackStatus": "string"
}
```

### `inbox` Entry Schema (`lanController.js`)
```json
{
  "id": "pkg_1711234567890_a1b2c3",
  "receivedAt": "ISO8601 string",
  "senderIp": "string",
  "targetIp": "string",
  "intendedTarget": "string",
  "isIntercepted": boolean,
  "pqcProtected": boolean,
  "package": { "packageData object" },
  "tamperDetails": {
    "mitmAction": "string",
    "alteredLabelFrom": "string",
    "alteredLabelTo": "string",
    "corruptedBytesCount": 8,
    "pqcBlocked": boolean,
    "attackFailed": boolean,
    "timestamp": "ISO8601 string"
  },
  "acknowledged": boolean
}
```

### `pendingAlerts` Intrusion Alert Schema (`lanController.js`)
```json
{
  "id": "alert_1711234567890_x9y8",
  "timestamp": "ISO8601 string",
  "attackerIp": "string",
  "senderIp": "string",
  "targetIp": "string",
  "packageId": "string",
  "pqcProtected": boolean,
  "message": "string",
  "read": boolean
}
```

### `nodeIdentity` Schema (`lanController.js` & `pqc.js`)
```json
{
  "kemPublicKeyHex": "hex string",
  "sigPublicKeyHex": "hex string",
  "kemLabel": "ML-KEM-512 | ML-KEM-768 | ML-KEM-1024",
  "sigLabel": "SLH-DSA-128s | SLH-DSA-128f | SLH-DSA-256s | SLH-DSA-256f",
  "keysBySuite": {
    "ML-KEM-512": "hex string",
    "ML-KEM-768": "hex string",
    "ML-KEM-1024": "hex string"
  }
}
```

### `securityDecision` Schema (`App.jsx`)
```json
{
  "level": "NONE | LOW | HIGH | VERY HIGH | MAXIMUM",
  "algorithms": "ML-KEM-512 + SLH-DSA-128f | ML-KEM-768 + SLH-DSA-128s | ML-KEM-1024 + SLH-DSA-128s | ML-KEM-1024 + SLH-DSA-256s"
}
```

### `classificationResult` Schema (`NLPClassifier.jsx`)
```json
{
  "label": "PII | FINANCIAL | PUBLIC",
  "confidence": 99,
  "reason": "string",
  "matchedKeywords": ["array of strings"]
}
```

### `auditLog` Entry Schema (`LanSharingDashboard.jsx`)
```json
{
  "id": 1711234567890,
  "timestamp": "ISO8601 string",
  "filename": "string",
  "classification": "PII | FINANCIAL | PUBLIC",
  "securityLevel": "string",
  "algorithms": "string",
  "recipient": "string",
  "status": "DELIVERED | TAMPER_BLOCKED | CORRUPTED_IN_TRANSIT"
}
```

### `osintData` Schema (`osintController.js`)
```json
{
  "success": true,
  "data": {
    "localIp": "192.168.1.45",
    "publicIp": "203.0.113.10",
    "ipData": {
      "ip": "203.0.113.10 (LAN: 192.168.1.45)",
      "isp": "Enterprise Telecommunications",
      "org": "Corporate Subnet",
      "city": "Mumbai",
      "country": "India",
      "apiKeyUsed": "54ac597355e19c1e88da56f5b0aac726"
    },
    "networkType": "Enterprise Network | Home WiFi | Mobile Data | Public WiFi",
    "isPrivateNetwork": true,
    "scoreModifier": 30,
    "logs": ["array of log strings"]
  }
}
```

### `batteryTelemetry` Schema (`systemController.js`)
```json
{
  "success": true,
  "batteryLevel": 85,
  "pluggedIn": true,
  "source": "Windows PowerShell CIM Telemetry | macOS pmset OS Telemetry | Linux UPower OS Telemetry",
  "timestamp": "ISO8601 string"
}
```
