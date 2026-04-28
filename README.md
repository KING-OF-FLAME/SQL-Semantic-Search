<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
</div>

<div align="center">
  <h1>🚀 SQL Semantic Search Engine (ADYPU Chat)</h1>
  <p><strong>A Next-Generation AI Chatbot and Grounded Answer Engine with RAG Pipeline</strong></p>
</div>

<hr/>

## 🌟 Overview

The **ADYPU Chat** is a highly advanced, pnpm workspace monorepo powered by TypeScript. It features a public chat interface with citation cards, confidence badges, a multi-page admin dashboard, and a supercharged RAG (Retrieval-Augmented Generation) semantic search engine utilizing PostgreSQL (with `pgvector`) and advanced crawler integrations. 

<div align="center">
  <a href="assets/chat_interface.png"><img src="assets/chat_interface.png" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 15px;" alt="ADYPU Chat Interface"/></a>
  <a href="assets/admin_dashboard.png"><img src="assets/admin_dashboard.png" style="max-width: 100%; height: auto; border-radius: 8px;" alt="ADYPU Admin Dashboard"/></a>
</div>

This project represents an end-to-end industry-level solution for grounded answering mechanisms, complete with web search enhancements and JWT-secured administrative routes.

---

## 🔥 Core Features

*   **🎙️ Smart Chat Interface**: Public-facing React + Vite frontend showing confidence scores, citation cards, and fallback queries. 
*   **🧠 Semantic RAG Pipeline**: Uses state-of-the-art Embeddings (`text-embedding-3-small`) to search PostgreSQL `pgvector` databases efficiently. Applies Full-Text Search (FTS) pre-filtering and cosine similarity re-ranking.
*   **🕸️ Built-In Web Crawler**: Automatically scrapes (`cheerio`), chunks, and injects pages into the semantic index via a sophisticated job queue tracking failure/success states.
*   **🪄 Web Enhanced Search (DuckDuckGo)**: Dynamically enhances database knowledge with live internet queries seamlessly integrated via HTML scraping (No API Key Required). Can be toggled from the settings!
*   **🛠️ Admin Dashboard**: Secure JWT-authenticated portal to view activity statistics, control indexing rules, and manage crawler sources.

---

## 🏗️ Monorepo Architecture 

The project uses `pnpm workspaces` consisting of multiple robustly isolated packages:

- **`@workspace/api-server`**: Express 5 backend APIs, RAG algorithms, crawler logic.
- **`@workspace/adypu-chat`**: Frontend UI built on React, Vite, and Shadcn.
- **`@workspace/db`**: Database configuration utilizing **Drizzle ORM** and PostgreSQL.
- **`@workspace/api-spec`**: OpenAPI 3 specs powering auto-generated React Query hooks (`@workspace/api-client-react`) and Zod schemas (`@workspace/api-zod`).

---

## 🗄️ Database Schema & Entities

The PostgreSQL schema is fully typed and version-controlled via Drizzle. Notable core tables include:
- `users` & `roles` — Secure authentication and access control logic.
- `sources`, `crawl_jobs`, & `documents` — Intelligent web crawler definitions tracking crawling tasks and raw HTML extraction.
- `document_chunks` & `document_entities` — Indexed pgvector chunks and NLP-extracted intent entities.
- `query_logs` & `answer_logs` — Advanced audit trails recording search query confidence scores and AI intent resolutions.

---

## 🛠️ Installation & Setup Guide

### 1. Prerequisites 
- Ensure you have **Node.js** (v24 or later) installed.
- Install **pnpm** globally: `npm install -g pnpm`.
- Setup **PostgreSQL** (version 15+ recommended) and ensure the `pgvector` extension is installed.

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Point this to your PostgreSQL instance
DATABASE_URL="postgresql://postgres:password@localhost:5432/adypu_chat"

# Set your OpenAI configuration for Embeddings and NLP intent generation.
OPENAI_API_KEY="your-openai-api-key"
```

### 3. Install Dependencies
Run the following at the root of the project to install all monorepo scopes:
```bash
pnpm install
```

### 4. Database Setup (Drizzle Schema Push)
Initialize the PostgreSQL database and safely push the schema using Drizzle:
```bash
# Push schema from the root directory:
pnpm --filter @workspace/db run push-force
```

### 5. Running the Application
Spin up both the Frontend API server and the React UI simultaneously:
```bash
pnpm run dev
```

> **🔑 Admin Access Credentials** 
> *Username:* `admin`
> *Password:* `adypu-admin-2024`
> 
> *Note: Credentials and JWT secrets are seeded automatically upon the first successful boot in `src/lib/startup.ts`.*

---

## 👨‍💻 Meet the Developer

Crafted with excellence by **Yash**. 
Connect with me for collaborations, inquiries, or more awesome projects!

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/yash-developer/) 
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/yash.developer)

---
*An industry-grade showcase of modern software engineering.*
