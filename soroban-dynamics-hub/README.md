# SoroDynamics Research Hub

A high-fidelity research sandbox designed to simulate **dynamic (elastic) token supply** models on the Stellar Soroban blockchain. This project facilitates the measurement of **timing-based Miner Extractable Value (tMEV)** by monitoring state transitions and supply-shift events in real-time.

## 🚀 Overview

The SoroDynamics Research Hub provides an end-to-end environment to study how elastic supply mechanisms interact with network latency and block production. By combining on-chain smart contracts with a robust indexing and visualization layer, researchers can detect patterns indicative of tMEV and analyze the efficiency of algorithmic supply adjustments.

## 🏗️ System Architecture

The platform is divided into three primary components:

1.  **Soroban Smart Contracts (`/contracts`)**: 
    *   Developed in Rust.
    *   Implements a state-dynamics pool with a global price multiplier.
    *   Handles elastic supply logic (rebase mechanisms) directly on-chain.
2.  **Backend Indexer (`/backend`)**: 
    *   Node.js/Express application.
    *   Uses `@stellar/stellar-sdk` to monitor contract events and ledger state.
    *   Provides a REST API for the dashboard to consume processed blockchain data.
3.  **Frontend Dashboard (`/frontend`)**: 
    *   Next.js 14+ application with TypeScript.
    *   Provides live visualization of contract state, price multipliers, and detected supply-shift events.

## 🛠️ Technology Stack

-   **Blockchain**: Stellar Soroban (Rust SDK)
-   **Frontend**: Next.js, TypeScript, Tailwind CSS
-   **Backend**: Node.js, Express, Axios
-   **SDKs**: `@stellar/stellar-sdk` (v12.x), `soroban-sdk` (v21.x)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
-   Rust & Cargo (Target: `wasm32-unknown-unknown`)
-   Stellar CLI
-   Node.js (v18 or higher)
-   npm or yarn

## 🔧 Getting Started

### 1. Smart Contract Setup
Navigate to the contracts directory and build the WASM binaries:
```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

### 2. Backend Configuration
Install dependencies and configure your environment:
```bash
cd backend
npm install
```
Create a `.env` file in the backend folder with your RPC provider and contract IDs.
```bash
npm run dev
```

### 3. Frontend Dashboard
Install dependencies and start the development server:
```bash
cd frontend
npm install
npm run dev
```
The dashboard will be available at `http://localhost:3000`.

## 📊 Research Focus: tMEV

Timing-based Miner Extractable Value (tMEV) in this sandbox is measured by analyzing the delta between the global price multiplier update and the subsequent rebase execution. The indexer flags transactions that appear to front-run or exploit the deterministic nature of the supply-shift events.

## 🤝 Contributing

Contributions to the research sandbox are welcome. Please ensure that any changes to the core contract logic are accompanied by appropriate Soroban tests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
*Disclaimer: This is a research project intended for simulation purposes only. Use in production environments should be preceded by thorough security audits.*
