# 🛡️ Anti-Counterfeit Meds Tracker

Welcome to a revolutionary blockchain-based system designed to combat counterfeit over-the-counter (OTC) medications! This Web3 project uses the Stacks blockchain and Clarity smart contracts to provide verifiable provenance for meds through unique serialization and QR codes. By tracking the entire supply chain on-chain, it ensures authenticity, reduces fraud, and protects public health—solving the real-world problem of counterfeit drugs that cause thousands of deaths and billions in losses annually.

## ✨ Features

🔒 Unique serialization for each med package  
📱 QR code scanning for instant on-chain verification  
⛓️ Immutable provenance tracking from manufacturer to consumer  
🚨 Recall alerts and counterfeit reporting  
🏭 Role-based access for manufacturers, distributors, retailers, and regulators  
📊 Analytics for supply chain transparency  
✅ Consumer-friendly verification without needing blockchain expertise  
🛑 Prevention of duplicate or tampered serials  

## 🛠 How It Works

This system leverages 8 Clarity smart contracts to manage the lifecycle of OTC meds. Each package gets a unique serial number hashed and stored on-chain, linked to a QR code that users scan to query provenance data via a simple web/app interface.

**For Manufacturers**  
- Register your company and products.  
- Create a batch with details like production date, ingredients, and expiration.  
- Generate serialized packages with unique IDs.  
- Mint QR codes linking to on-chain records.  

Example Clarity call (in a manufacturer dashboard):  
Call `create-batch` with batch ID, product details, and quantity. Then, `serialize-packages` to assign unique hashes.

**For Distributors and Retailers**  
- Receive transfers of batches or packages.  
- Update custody on-chain to maintain the provenance trail.  
- Verify incoming shipments against blockchain records to detect fakes early.  

Example: Call `transfer-custody` with package serial, from/to addresses, and timestamp.

**For Consumers**  
- Scan the QR code on the package using a mobile app.  
- Instantly view the full provenance: manufacturer, batch info, supply chain steps, and authenticity status.  
- Report suspected counterfeits, triggering on-chain flags.  

Boom! If it's legit, you get a green check; if not, alerts notify regulators.

**For Regulators**  
- Monitor batches for recalls.  
- Query analytics on counterfeit reports or supply chain anomalies.  
- Enforce compliance with immutable audit trails.

## 📜 Smart Contracts Overview

This project involves 8 interconnected Clarity smart contracts for robustness and modularity:

1. **RoleRegistry.clar**: Manages user roles (e.g., manufacturer, distributor, retailer, regulator). Handles registration, verification, and access control using principal-based permissions.  
2. **ProductRegistry.clar**: Stores product templates (e.g., med name, dosage, manufacturer specs). Prevents unauthorized product additions.  
3. **BatchManager.clar**: Creates and tracks batches, including metadata like production date, lot number, and expiration. Links to product registry.  
4. **SerializationEngine.clar**: Generates unique serial numbers (using hashes) for individual packages within a batch. Ensures no duplicates via on-chain checks.  
5. **CustodyTransfer.clar**: Records transfers along the supply chain. Each step adds an immutable entry with timestamps and signatures.  
6. **VerificationOracle.clar**: Provides read-only queries for provenance. Consumers call this via QR to check authenticity without writing to the chain.  
7. **RecallHandler.clar**: Allows manufacturers/regulators to flag batches for recalls. Automatically notifies downstream holders via events.  
8. **ReportSystem.clar**: Enables users to report counterfeits, storing flags and evidence on-chain for investigation.

These contracts interact seamlessly—e.g., `SerializationEngine` calls `BatchManager` to validate batch existence before minting serials. Deploy them on Stacks for Bitcoin-secured immutability.

## 🚀 Getting Started

- Set up a Stacks wallet and Clarity dev environment.  
- Deploy the contracts in order (start with RoleRegistry).  
- Build a frontend (e.g., React app) for QR generation/scanning and contract interactions.  
- Integrate with real-world QR printers for packaging.  

This project not only fights counterfeits but could expand to prescription drugs or other serialized goods like electronics!