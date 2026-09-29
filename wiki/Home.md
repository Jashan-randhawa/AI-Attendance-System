# 🎓 Welcome to the SmartAttend Engineering Wiki

Welcome to the official technical wiki and engineering handbook for **SmartAttend**, an enterprise-grade AI biometric facial recognition attendance and surveillance system with a decoupled modular package ecosystem.

This knowledge base covers the underlying architectural paradigms, computer vision neural networks, security models, database schemas, frontend design systems, standalone packages, and DevOps deployment patterns.

---

## 🧭 Wiki Directory

| Wiki Page | Focus Area | Description |
|---|---|---|
| **[🏠 Home](Home)** | Overview | Engineering overview, quick credentials, system philosophy, and wiki directory. |
| **[🚀 Getting Started](Getting-Started)** | Onboarding | Prerequisites, monorepo setup, environment variables, local run guide, and demo accounts. |
| **[📦 Modular Packages & Monorepo](Modular-Packages-and-Monorepo)** | Reusable Libraries | Deep dive into `@jashan-randhawa/*` packages (matching core, contracts, client SDK, quality gates, domain core). |
| **[🏗️ System Architecture](System-Architecture)** | Architecture | Microservices vs monolith design, compute flow, thread pools, client SDK layer, and data streaming. |
| **[🔐 Authentication & RBAC](Authentication-and-RBAC)** | Security | Per-user JWT issuance, salted `scrypt` key derivation, role boundaries, and audit identity tracking. |
| **[👁️ Biometric Vision Pipeline](Biometric-Vision-Pipeline)** | AI & Vision | InsightFace `buffalo_sc`, CLAHE normalization, 512-d embeddings, quality filters, non-reversibility, and compensating rollback. |
| **[🎨 Frontend & Design System](Frontend-and-Design-System)** | UI / UX | FitTrack typography, 60-30-10 palette, dual navigation (collapsible rail + mobile bottom bar), camera controls, and Vercel telemetry. |
| **[📡 Complete API Reference](API-Reference)** | REST API | Detailed request/response payloads, authentication requirements, rate limits, and client SDK equivalents. |
| **[🗄️ Database & Schemas](Database-and-Data-Models)** | Persistence | MongoDB Atlas collections, compound unique idempotency indexes, and native `ObjectId` standard. |
| **[🚀 Deployment & DevOps](Deployment-and-DevOps)** | Operations | Docker multi-stage build, Render/Vercel/Azure hosting, health probes, and CI/CD pipelines. |

---

## ⚡ Default Test Credentials

For local development and testing, use the following pre-configured credentials:

| Role | Username | Password | Key Permissions |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full access: Biometric enrollment, people directory, analytics & heatmaps, user provisioning, system diagnostics, and CSV exports. |
| **Operator** | `operator` | `operator123` | Operational access: Live camera surveillance, instant attendance scanning, session lifecycle management, and record lookups. |

---

## 🎯 System Mission & Philosophy

1. **Sub-Second Biometric Inference**: Eliminate physical contact, RFID cards, and manual roll-calls with simultaneous multi-face recognition processing in under 500ms.
2. **Modular Open-Source Ecosystem**: Publish decoupled, provider-neutral packages (`@jashan-randhawa/*`) for vector matching, contract validation, and quality assessment.
3. **Biometric Privacy by Design**: 512-d mathematical vector encodings cannot be inverted to reconstruct facial images; camera feeds are processed in volatile RAM with zero persistent raw photo retention.
4. **Engine-Level Idempotency**: Guarantee that repeated scans or camera blinks cannot produce duplicate records using compound unique indexes `(person_id, session_id)` and domain cooldown classification.
5. **Dual Navigation & Mobile-First UX**: Deliver seamless responsive operation from 68px/280px collapsible desktop rails down to handheld smartphone camera controls and full-screen kiosks.
