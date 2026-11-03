# JobCopilot AI — 1-Click ATS Auto-Filler & Multi-Portal Job Search

[![Direct Download](https://img.shields.io/badge/Download_Extension_v1.0.0-ZIP-10B981?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/anshul-20/AI-Job-Search/raw/main/dist/ai-job-copilot-extension.zip)
[![Release](https://img.shields.io/badge/GitHub_Release-v1.0.0-06B6D4?style=for-the-badge&logo=github&logoColor=white)](https://github.com/anshul-20/AI-Job-Search/releases/tag/v1.0.0)
[![Edge Add-ons](https://img.shields.io/badge/Microsoft_Edge-Ready-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://partner.microsoft.com/en-us/dashboard/microsoftedge)
[![Zero Fees](https://img.shields.io/badge/Cost-100%25_Free_Alternative-success?style=for-the-badge)](https://github.com/anshul-20/AI-Job-Search)

An intelligent, production-ready job search and application copilot built for high scale. Automates resume tailoring, intelligent form pre-filling across all major career portals (LinkedIn, Greenhouse, Lever, Workday, Ashby, SmartRecruiters), logs all applications into a unified Excel tracker sheet, and enforces deterministic anti-hallucination verification.

---

## 💡 Architecture & Key Highlights

```
                                [ Candidate Profile ]
                                  data/resume.json
                                         │
                                         ▼
                             [ Deterministic Guard ]
                         (Strict verification against facts)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     [ Chrome Extension Engine ]                     [ Autonomous Auto-Discovery ]
   (Obsidian Cyber Chrome Design)                   (3x Daily Scheduled Execution)
   - 1-Click Multi-Portal Pre-Fill                  - Searches Direct ATS Portals
   - Screening Question Reasoning                   - Keyword Fit Scoring
   - 1-Click Master Excel Tracker                   - Tailored PDF Compilation
   - 20 Free Applies/Day Quota Meter                - Deduplication Tracking
```

| Feature | Legacy Scraping / Bot Frameworks | **JobCopilot AI Hybrid Engine** |
| :--- | :--- | :--- |
| **Execution Model** | Datacenter headless browsers (blocked by Cloudflare/LinkedIn) | **Client-Side Chrome Extension** (runs in user's browser, residential IP, pre-authenticated) |
| **Cost per Application** | $0.50 – $1.50+ (or heavy $20/mo subscriptions) | **<$0.005** with DeepSeek-V3 / OpenRouter |
| **Hallucination Protection** | Prompts only (LLMs often hallucinate metrics/dates) | **Deterministic Guard** (`src/guard.js` strictly validates every bullet and metric) |
| **Resume Formatting** | Brittle LaTeX dependencies | **Puppeteer Single-Column ATS Template** (100% parseable by Workday, Greenhouse, Taleo) |
| **Application Tracking** | Manual spreadsheet entry | **Unified Master Excel / CSV Export** (single source of truth across all portals) |
| **Multi-Portal Support** | Single platform (e.g. only LinkedIn) | **LinkedIn, Greenhouse, Lever, Workday, Ashby, SmartRecruiters, Indeed, Naukri** |
| **Rate Limiting & Safety** | Unlimited unmonitored API calls | **Per-User Quota Engine** (20 free daily applies + Pro / credit recharges) |

---

## ⚡ Core Components

### 1. Chrome Extension (Obsidian Cyber Chrome UI)
- **Compact & High-Utility**: Zero raw server configuration clutter in the primary interface.
- **Active Portal Detection**: Automatically detects active job postings on LinkedIn, Greenhouse, Lever, Workday, Ashby, etc.
- **Dynamic Quota Meter**: Displays remaining daily applications (`14 / 20 Applications Left Today`) with an instant upgrade/recharge action.
- **Candidate Profile Switcher**: 1-click master resume upload and activation from `.pdf`, `.json`, or `.txt`.
- **Ultra-Lean Package**: Production zip is only **28 KB** ([`dist/ai-job-copilot-extension.zip`](file:///d:/AI-Job-Search/dist/ai-job-copilot-extension.zip)).

### 2. Unified Master Excel / CSV Tracker
- Every job applied from **any** portal is automatically recorded in one unified sheet: [`job_search_tracker.csv`](file:///d:/AI-Job-Search/job_search_tracker.csv).
- **In-Place Updates (Zero Duplicate Rows)**: Re-applying or updating an application updates the existing entry rather than duplicating rows.
- **1-Click Export**: Click **"📥 Download Applications (Excel / CSV)"** in the extension popup or web dashboard to open your complete search history in Excel, Google Sheets, or Apple Numbers.

### 3. Deterministic Anti-Hallucination Guard
- [src/guard.js](file:///d:/AI-Job-Search/src/guard.js) strictly compares LLM-generated resume bullets against your master profile.
- Reverts any fabricated metrics, unapproved dates, or unverified technologies before any PDF is rendered or attached.

### 4. Transparent Quota & Subscription Engine
- [src/quota.js](file:///d:/AI-Job-Search/src/quota.js) provides out-of-the-box rate limiting:
  - **Free Tier**: 20 applications/day (auto-resets at midnight).
  - **Pro Unlimited / Credit Recharges**: Extensible for subscription billing and pay-as-you-go top-ups.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20 or higher
- **Google Chrome** (or Edge, Brave)

### 2. Installation
```bash
git clone https://github.com/anshul-20/AI-Job-Search.git
cd AI-Job-Search
npm install
cp .env.example .env
```

### 3. Configure Your Model (.env)
Add your [OpenRouter API key](https://openrouter.ai/keys) to `.env`:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=deepseek/deepseek-chat
PORT=3000
```

### 4. Start Backend Server
```bash
npm start
```
The server runs on `http://localhost:3000` with cloud readiness on `0.0.0.0`.

---

## 🧩 Installing the Extension (100% Free Options)

### Option 1: 1-Click Direct Download (Chrome / Edge / Brave)
1. **Download**: Click [[Download Extension ZIP (v1.0.0)]](https://github.com/anshul-20/AI-Job-Search/raw/main/dist/ai-job-copilot-extension.zip) or grab it from [GitHub Releases](https://github.com/anshul-20/AI-Job-Search/releases/tag/v1.0.0).
2. **Windows Quick Install**: Double-click [`install_extension.bat`](file:///d:/AI-Job-Search/install_extension.bat) — it opens your browser's extensions page automatically.
3. **Or Manual Install**:
   - Go to `chrome://extensions/` (or `edge://extensions/`).
   - Turn **ON** Developer mode (top-right).
   - Click **Load unpacked** (top-left) and select the unzipped `extension/` folder.
4. Pin the **JobCopilot AI** (⚡) icon to your toolbar!

### Option 2: Microsoft Edge Add-ons Store (100% Free Store Listing)
Microsoft provides a 100% free developer program with **$0 registration fee**:
1. Open the [Microsoft Edge Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge).
2. Sign in with any free Microsoft account and click **Create new extension**.
3. Upload [`dist/ai-job-copilot-extension.zip`](file:///d:/AI-Job-Search/dist/ai-job-copilot-extension.zip).
4. Copy description & metadata from [`extension/STORE_LISTING.md`](file:///d:/AI-Job-Search/extension/STORE_LISTING.md) and upload screenshots from [`extension/screenshots/`](file:///d:/AI-Job-Search/extension/screenshots/).
5. Submit for free certification. Once published, both Edge and Chrome users can install directly from your Edge store page!

---

## ☁️ Cloud Deployment (Render.com 1-Click)

To let users or yourself access the AI engine without keeping your computer running:
1. Push this repo to your GitHub account.
2. In [Render.com](https://render.com), click **New + -> Blueprint** and connect this repository.
3. Render automatically provisions the service via [`render.yaml`](file:///d:/AI-Job-Search/render.yaml).
4. Enter your `OPENROUTER_API_KEY`.
5. Enter your Render live URL (e.g. `https://jobcopilot-api.onrender.com`) in the extension settings (`⚙️`).

See [`DEPLOYMENT.md`](file:///d:/AI-Job-Search/DEPLOYMENT.md) for full deployment instructions.

---

## 🛠️ CLI & Automated Pipelines

In addition to the Chrome Extension, the engine supports fully autonomous CLI workflows:

```bash
# Zero-config job discovery (derives keywords & location from resume)
npm run search

# Targeted search across direct ATS career portals
npm run search -- --source careers -n 10

# Tailor resume and cover letter for any JD URL or text file
npm run tailor -- --url "https://jobs.lever.co/company/job-id"
npm run tailor -- --jd-file sample-jd.txt

# Run 1 autonomous discovery, tailoring & tracking cycle
npm run auto:now

# Start background 3x daily scheduler (9 AM, 2 PM, 8 PM)
npm run auto

# View current application tracker
npm run tracker

# Run all 27 automated unit tests
npm test

# Rebuild lightweight production extension package
npm run extension:pack
```

---

## 📁 Repository Structure

```
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest
│   ├── background.js              # Service worker & multi-tenant auth
│   ├── content.js & content.css   # On-page floating widget & form autofill
│   ├── popup.html & popup.css     # Obsidian Cyber Chrome popup interface
│   ├── popup.js                   # Extension state, quota meter & export
│   ├── icons/                     # Extension icons (16, 48, 128)
│   ├── screenshots/               # 1280x800 px Chrome Web Store screenshots
│   └── STORE_LISTING.md           # Chrome Web Store submission package
├── src/                           # Backend Engine
│   ├── server.js                  # Production Express API & CORS
│   ├── guard.js                   # Deterministic Anti-Hallucination Guard
│   ├── quota.js                   # Rate limiting & subscription quotas
│   ├── tracker.js                 # Unified Excel tracker & deduplication
│   ├── formFiller.js              # Intelligent form field reasoning
│   ├── pipeline.js                # ATS Tailoring orchestrator
│   ├── renderer.js                # Puppeteer single-column PDF compiler
│   └── jobSearch.js               # Multi-platform job search scraper
├── data/
│   ├── resume.json                # Master candidate profile (single source of truth)
│   └── seen_jobs.json             # Deduplication cache
├── dist/
│   └── ai-job-copilot-extension.zip # Optimized production extension package (28 KB)
├── tests/                         # Vitest automated test suite (27 passing)
├── render.yaml                    # Cloud deployment blueprint
├── DEPLOYMENT.md                  # Chrome Web Store & cloud deployment guide
└── job_search_tracker.csv         # Live master application tracking sheet
```

---

## 🔒 Privacy & Security

- **Zero Secret Key Exposure**: Your OpenRouter / DeepSeek API keys are stored only in server environment variables and are **never** bundled into the client extension.
- **Client-Side Auth**: Job applications execute in your personal browser session, ensuring personal cookies and passwords never touch third-party servers.
- **Single-Purpose Compliance**: Data is strictly used to pre-fill application fields on employer portals and log your application progress.
