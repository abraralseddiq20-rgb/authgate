<div align="center">

# 🛡️ AuthGate - V0 Prototype

**Zero-Trust Governance for AI-Assisted Code**
**حوكمة صفرية الثقة لأكواد الذكاء الاصطناعي**

🔗 **[Live Demo (Vercel)](https://authgate-d4bo-rho.vercel.app)**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 📌 Overview (نظرة عامة)
This repository contains the **V0 Prototype** of AuthGate. It is a Full-Stack web application (Next.js + Supabase) designed to demonstrate how to govern AI-generated code at the pull request level. The current implementation focuses strictly on building the core security loop: **L2 (Deterministic Scanner)** and **L3 (Deterministic Cryptographic Gate)**.

يحتوي هذا المستودع على **النسخة الأولية (V0)** من نظام AuthGate. وهو تطبيق ويب متكامل (Next.js + Supabase) يهدف إلى إثبات كيفية حوكمة الأكواد المولدة بالذكاء الاصطناعي. يركز هذا الإصدار بشكل صارم على بناء الحلقة الأمنية الأساسية: **الطبقة الثانية (الفاحص الحتمي)** و**الطبقة الثالثة (البوابة التشفيرية الحتمية)**.

---

## 🏗️ Core Architecture (المعمارية الأساسية)

### 1. L2: Deterministic Scanner (`src/app/api/scan/route.ts`)
*   **Domain Routing (التوجيه بحساسية المجال):** The system checks the file path. If it contains (`auth`, `db`, `infra`), it forces a `CRITICAL` risk score (100) and blocks it immediately.
    *   يفحص النظام مسار الملف. إذا كان يحتوي على (`auth`، `db`، `infra`)، يتم فرض درجة خطورة `CRITICAL` (100) وحظره فوراً.
*   **Regex Scanning (الفحص بالنمط النصي):** Scans for SQL Injection (`f"SELECT`), Hardcoded Secrets (`api_key=`), and Prompt Injections (`ignore previous instructions`).
    *   يفحص ثغرات حقن SQL، الأسرار المضمنة، وحقن الأوامر.
*   **Decision Engine (محرك القرار):** Returns `APPROVE` (Risk < 40), `REVIEW` (40-75), or `BLOCK` (> 75).
    *   يعيد قرار الموافقة، المراجعة، أو الحظر بناءً على درجة الخطورة.

### 2. L3: The Deterministic Gate (`src/app/api/execute/route.ts`)
This is the core security feature. It is written in pure deterministic code (No AI/LLM is used for execution).
هذه هي ميزة الأمان الأساسية. مكتوبة بكود حتمي بحت (لا يتم استخدام الذكاء الاصطناعي في التنفيذ).

*   **JWT Generation (توليد التوكن):** Uses the `jose` library to sign a token (HMAC-SHA256) containing the approver's ID and a unique ID (`jti`).
*   **SHA-256 Hash Binding (الربط ببصمة الكود):** The token is cryptographically bound to the exact `SHA-256` hash of the submitted code. If a single character changes, the execution is rejected.
    *   يرتبط التوكن تشفيرياً ببصمة `SHA-256` للكود المرفوع. إذا تغير حرف واحد، يتم رفض التنفيذ.
*   **Replay Attack Prevention (منع هجمات إعادة الاستخدام):** Every generated `jti` (UUID) is stored in the Supabase `tokens` table. Once executed, it is marked as `used = true`. Reusing it triggers a block.
    *   يتم تخزين معرف فريد (`jti`) لكل توكن في قاعدة البيانات. بمجرد التنفيذ، يتم وضع علامة "مستخدم". أي محاولة إعادة استخدام تؤدي إلى الحظر الفوري.

### 3. Immutable Audit Log (`src/app/api/audit/route.ts`)
*   Every scan, approval, execution, and blocked attack is logged in the Supabase `audit_logs` table.
*   **Hash Chain (سلسلة التجزئة):** Each log entry contains the `prev_hash` and `current_hash`, creating a tamper-evident chain.
    *   كل سطر جديد يرتبط ببصمة السطر السابق، مما يضمن عدم القدرة على التلاعب بالسجلات.

---

## 🗄️ Database Schema (هيكل قاعدة البيانات)

To run this project locally, execute the following SQL in your Supabase SQL Editor:

```sql
-- 1. Tokens Table (For Single-Use enforcement)
CREATE TABLE tokens (
  jti UUID PRIMARY KEY,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Submissions Table
CREATE TABLE submissions (
  id SERIAL PRIMARY KEY,
  path TEXT,
  code TEXT,
  code_hash TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Audit Logs Table (For Immutable Hash Chain)
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT,
  decision TEXT,
  prev_hash TEXT,
  current_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
🔌 API Endpoints (واجهات برمجة التطبيقات)
Endpoint	Method	Description (EN)	الوصف (AR)
/api/scan	POST	Accepts { path, code, action }. If SUBMIT, it scans. If APPROVE, it signs a JWT (requires pin).	يستقبل الكود. إذا كان SUBMIT يفحصه. وإذا كان APPROVE يولد توكن (يتطلب pin).
/api/execute	POST	Accepts { token, code }. Verifies signature, hash, and single-use DB check.	يستقبل التوكن والكود. يتحقق من التوقيع، البصمة، ومنع إعادة الاستخدام.
/api/audit	GET	Fetches all logs from the audit_logs table.	جلب جميع السجلات من قاعدة البيانات.
💻 Local Setup (التشغيل المحلي)
Clone the repository:

bash
git clone https://github.com/abraralseddiq20-rgb/authgate.git
Install dependencies:

bash
npm install
Create a .env.local file in the root directory:

env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_key_here
SENIOR_PIN=1234
Run the development server:

bash
npm run dev
⚠️ Current Limitations (V0) - الحدود الحالية
We believe in engineering transparency. The current V0 has the following boundaries:
نحن نؤمن بالشفافية الهندسية. النسخة الحالية (V0) لديها الحدود التالية:

Hardware Key Simulation: The UI uses a PIN (1234) to simulate a YubiKey signature. (يستخدم الواجهة رمز PIN لمحاكاة مفتاح العتاد).

Scanner: The L2 scanner uses Regex for rapid demonstration. Production will integrate Semgrep. (يستخدم الفاحص Regex للعرض السريع، وسيتم دمج Semgrep لاحقاً).

Memory: The system does not yet include the RAG (pgvector) institutional memory layer. (لا يتضمن النظام الحالي طبقة الذاكرة المؤسسية RAG).
