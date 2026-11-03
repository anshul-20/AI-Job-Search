# JobCopilot AI — Production Deployment & Launch Guide

This guide covers everything required to deploy the **AI Backend** to the cloud and release the **Chrome Extension** live to users worldwide.

---

## Architecture Overview

```
[ Chrome Web Store ]  --->  User Installs Extension (28 KB)
                                  │
                                  ▼
                     [ Job Application Portals ]
               (LinkedIn, Greenhouse, Lever, Workday)
                                  │
                                  ▼
                [ JobCopilot Cloud AI Backend API ]
             (Render / Railway / Fly.io / Custom VPS)
                     ├── Deterministic Guard
                     ├── Quota & Rate Limiting Engine
                     ├── Multi-Tenant Resume Storage
                     └── DeepSeek LLM Reasoning
```

---

## Step 1: Deploy AI Backend to the Cloud (Free / Cheap)

To allow 1,000+ users to use the extension without having to run Node on their own computers, host the backend API on the cloud.

### Option 1: Render.com (Recommended — 1-Click Blueprint)
1. Push this repository to GitHub or GitLab.
2. Log in to [Render.com](https://render.com) and click **New + -> Blueprint**.
3. Select your repository. Render automatically reads [`render.yaml`](file:///d:/AI-Job-Search/render.yaml).
4. Set the environment variable:
   - `OPENROUTER_API_KEY`: Your DeepSeek / OpenRouter API Key.
5. Click **Apply**.
6. Render deploys your API and gives you a free HTTPS URL:
   `https://jobcopilot-api.onrender.com`
7. Test the health check endpoint:
   `https://jobcopilot-api.onrender.com/health` -> returns `{"status":"healthy"}`.

### Option 2: Railway or VPS
Run:
```bash
npm install
npm run start
```
Environment variables to set:
- `PORT`: (provided by host, e.g. `8080` or `3000`)
- `HOST`: `0.0.0.0`
- `OPENROUTER_API_KEY`: Your API Key
- `OPENROUTER_MODEL`: `deepseek/deepseek-chat`

---

## Step 2: Deploy Extension to Chrome Web Store

The extension package has been compiled and optimized to **28.2 KB** (excluding unnecessary assets and OS files).

### 1. Developer Dashboard
1. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devcenter).
2. Click **Add new item**.
3. Drag & drop the production zip file:
   [`dist/ai-job-copilot-extension.zip`](file:///d:/AI-Job-Search/dist/ai-job-copilot-extension.zip)

### 2. Store Listing Details
Copy-paste directly from [`extension/STORE_LISTING.md`](file:///d:/AI-Job-Search/extension/STORE_LISTING.md):
- **Extension Name**: `JobCopilot AI - 1-Click ATS Job Auto-Filler`
- **Summary**: `Auto-fill job applications on LinkedIn, Greenhouse, Lever & Workday. Generates tailored ATS resumes & tracks all jobs in Excel.`
- **Description**: Paste the complete formatted text from Section 2 of `STORE_LISTING.md`.
- **Category**: `Productivity`.

### 3. Upload Store Screenshots
Upload the 4 Retina screenshots located in [`extension/screenshots/`](file:///d:/AI-Job-Search/extension/screenshots/):
1. `screenshot1_autofill_demo.png` (1280x800)
2. `screenshot2_extension_popup.png` (1280x800)
3. `screenshot3_unified_excel_tracker.png` (1280x800)
4. `screenshot4_quota_and_pro_plans.png` (1280x800)

### 4. Privacy & Permissions Tab
Copy answers from Section 4 of `STORE_LISTING.md`:
- **Single Purpose**: *"JobCopilot AI automates the pre-filling of job application forms on employer career portals using the candidate's verified resume profile, and maintains a unified Excel application tracking sheet."*
- **Permissions Rationale**:
  - `activeTab`: Detect active job URL and inject form-fill widget on user request.
  - `scripting`: Highlight pre-filled fields in green.
  - `storage`: Cache user settings and profile locally.
  - `downloads`: 1-Click Excel application tracker export.
- **Data Usage**: State that candidate info is used exclusively for application auto-filling and is **never sold or transferred to third parties**.

### 5. Submit for Review
Click **Submit for Review**. Google usually approves within 24 to 48 hours.

---

## Step 3: Immediate Testing in Chrome (Unpacked Mode)

You and beta testers can use the extension immediately without waiting for Web Store review:
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top-right switch).
3. Click **Load unpacked** (top-left).
4. Select the `extension/` directory:
   `D:\AI-Job-Search\extension`
5. Pin the ⚡ **JobCopilot AI** icon to your toolbar.
6. Open any job posting on Greenhouse, Lever, or LinkedIn:
   - Click the on-page floating widget or the extension popup.
   - Click **"⚡ Auto-Fill This Job Tab"**.
   - Click **"📥 Download Applications (Excel / CSV)"** to export the live tracker.
