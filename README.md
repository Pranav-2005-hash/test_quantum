# QuantumShield

QuantumShield is a production-grade, environment-aware security orchestration engine. It actively monitors hardware telemetry, network routing logic, and OSINT databases to build a real-time security profile, which then automatically selects the most appropriate Post-Quantum Cryptography (PQC) algorithm for data protection.

## Features

- **9-Pillar Quantum Network Profiler**: An asynchronous diagnostic engine evaluating battery state, captive portals, network topologies, DNS routing, and ISP intelligence.
- **Dynamic 3D Security Matrix**: Orchestrates encryption selection by cross-referencing:
  1. *Document Sensitivity* (via NLP categorization)
  2. *Network Trust* (Enterprise vs. Public Guest Networks)
  3. *Power State* (Critical Battery vs. Plugged In)
- **Advanced ISP Heuristic Classifier**: Determines if you are on a Cellular, Enterprise, Public, or Residential network using backend OSINT scanning.
- **Simulated PQC Algorithms**: Integrates concepts of HQC and Classic McEliece based on security scoring.
- **Man-in-the-Middle Tampering Demo**: A fully interactive pipeline that calculates real `SubtleCrypto` SHA-256 hashes to detect tampered payloads instantly.

## Architecture

This project is a Monorepo featuring:

### `/frontend`
A React/Vite web application that serves as the visual orchestration dashboard and "Thin Client."
- Built with **React** & **TailwindCSS**.
- Handles real-time pipeline animations, interactive tampering simulations, and NLP Regex parsing.
- Uses Vite's proxy capabilities to securely communicate with the backend.

### `/backend`
A secure Node.js/Express server that acts as the OSINT intelligence brain.
- Safely stores external API keys (WhatIsMyIP).
- Executes the heavy heuristic network data scraping securely out of the browser.
- Exposes a clean `/api/osint/scan` endpoint for the frontend.

## Quick Start

### 1. Backend Setup
1. Open a terminal and navigate to `/backend`.
2. Run `npm install` (if not already done).
3. Create a `.env` file containing:
   ```env
   PORT=5000
   WHATISMYIP_API_KEY=your_api_key_here
   ```
4. Start the server: `node server.js`

### 2. Frontend Setup
1. Open a separate terminal and navigate to `/frontend`.
2. Run `npm install`.
3. Start the development server: `npm run dev`
4. Access the dashboard at `http://localhost:5173`.

## Environment Variable Notice
The `.env` file containing the API key is strictly excluded via `.gitignore` to prevent secret leakage into the repository. You must provide your own key to restore API functionality upon cloning.
