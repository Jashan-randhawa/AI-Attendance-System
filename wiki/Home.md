# 🎓 Welcome to the SmartAttend Engineering Wiki

Welcome to the official technical wiki and engineering handbook for **SmartAttend**, an enterprise-grade AI biometric facial recognition attendance and surveillance system.

This knowledge base covers the underlying architectural paradigms, computer vision neural networks, security models, database schemas, frontend design systems, and DevOps deployment patterns.

---

## 🧭 Wiki Directory

| Wiki Page | Focus Area | Description |
|---|---|---|
| **[🏗️ System Architecture](System-Architecture)** | Architecture | Microservices vs monolith design, compute flow, thread pools, and data streaming. |
| **[🔐 Authentication & RBAC](Authentication-and-RBAC)** | Security | Per-user JWT issuance, salted `scrypt` key derivation, role boundaries, and audit identity tracking. |
| **[👁️ Biometric Vision Pipeline](Biometric-Vision-Pipeline)** | AI & Vision | InsightFace `buffalo_sc`, CLAHE normalization, 512-d embeddings, quality filters, and compensating rollback. |
| **[🎨 Frontend & Design System](Frontend-and-Design-System)** | UI / UX | FitTrack-inspired typography, 60-30-10 organic palette, 68px/280px collapsible rail, and dark mode. |
| **[📡 Complete API Reference](API-Reference)** | REST API | Detailed request/response payloads, authentication requirements, rate limits, and error semantics. |
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
2. **Zero Orphaned Vectors**: Guarantee biometric data integrity using compensating transactional rollbacks upon enrollment failure.
3. **Engine-Level Idempotency**: Guarantee that repeated scans or camera blinks cannot produce duplicate records using compound unique indexes `(person_id, session_id)`.
4. **Editorial Apple-Grade Design**: Provide a modern, distraction-free user interface utilizing the **FitTrack** editorial design system (`Playfair Display` serif + `Inter` sans-serif).
