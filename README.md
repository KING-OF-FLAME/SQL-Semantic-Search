<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
</div>

<div align="center">
  <h1>🚀 SQL Semantic Search Engine (ADYPU Chat)</h1>
  <p><strong>A Next-Generation AI Chatbot and Grounded Answer Engine with RAG Pipeline</strong></p>
</div>

<hr/>

## 🌟 Overview

The **ADYPU Chat** is a highly advanced, pnpm workspace monorepo powered by TypeScript. It features a public chat interface with citation cards, confidence badges, a multi-page admin dashboard, and a supercharged RAG (Retrieval-Augmented Generation) semantic search engine utilizing MySQL and advanced crawler integrations. 

With built-in **Web Enhanced Search** utilizing live HTML scraping and dynamic AI intents, this project represents an end-to-end industry-level solution for grounded answering mechanisms.

---

## 🔥 Core Features

*   **🎙️ Smart Chat Interface**: Public-facing React + Vite frontend with Shadcn UI, showing confidence scores and dynamic RAG citations.
*   **🛠️ Admin Dashboard**: Secure JWT-authenticated portal to view activity statistics, control indexing rules, manage queries, and configure crawler sources.
*   **🧠 Semantic RAG Pipeline**: Uses state-of-the-art Embeddings to search database vectors efficiently.
*   **🕸️ Built-In Web Crawler**: Automatically scrapes, chunks, and injects pages into the semantic index.
*   **🪄 Web Enhanced Search**: Dynamically enhances database knowledge with live internet queries seamlessly integrated via DDG HTML.

---

## 🏗️ Architecture & Tech Stack

This project strictly utilizes a bleeding-edge modern web stack:

*   **Frontend**: React, Vite, Tailwind CSS, Shadcn UI
*   **Backend**: Node.js, Express 5, TypeScript
*   **Database**: MySQL & Drizzle ORM
*   **AI Integration**: OpenAI (text-embedding-3-small, GPT-4o-mini)
*   **Validation**: Zod (OpenAPI generated definitions via Orval)

---

## 🛠️ Installation & Setup Guide

To ensure a seamless launch of this project, carefully follow these local deployment steps:

### 1. Prerequisites 
- Ensure you have **Node.js** (v24 or later) installed.
- Install **pnpm** globally: `npm install -g pnpm`.
- Setup **XAMPP** (or any other MySQL server instance).

### 2. Database Setup (MySQL)
1. Launch **XAMPP Control Panel** and start **Apache** and **MySQL**.
2. Click on **Admin** next to MySQL to open `phpMyAdmin`.
3. Create a new database OR simply navigate to the **Import** tab.
4. Select the `sql/schema.sql` file located in this project.
5. Click **Import**. This will automatically create the `adypu_chat` database and all 12 required tables (users, documents, chunks, query_logs, etc.).

### 3. Environment Configuration
Create a `.env` file in the root directory based on `.env.example`:
```env
DATABASE_URL="mysql://root:@localhost/adypu_chat"
OPENAI_API_KEY="your-openai-api-key"
```
> **Note**: Modify the `DATABASE_URL` if you have set a custom password for your MySQL `root` user.

### 4. Install Dependencies
Run the following at the root of the project to install all monorepo scopes:
```bash
pnpm install
```

### 5. Running the Application
Spin up both the Frontend API server and the React UI simultaneously by running:
```bash
pnpm run dev
```

> **Admin Access Credentials** 
> *Username:* `admin`
> *Password:* `adypu-admin-2024`
> (Seeded automatically upon first boot)

---

## 👨‍💻 Meet the Developer

Crafted with excellence by **Yash**. 
Connect with me for collaborations, inquiries, or more awesome projects!

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/yash-developer/) 
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/yash.developer)

---
*An industry-grade showcase of modern software engineering.*
