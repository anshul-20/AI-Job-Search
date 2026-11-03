# Chrome Web Store Submission Kit: JobCopilot AI

This document contains everything required to submit **JobCopilot AI** to the **Google Chrome Web Store Developer Dashboard** for review.

---

## 1. Store Metadata & Core Details

| Field | Value | Character Limit |
|---|---|---|
| **Extension Name** | `JobCopilot AI - 1-Click ATS Job Auto-Filler` | Max 45 chars |
| **Short Description** | `Auto-fill job applications on LinkedIn, Greenhouse, Lever & Workday. Generates tailored ATS resumes & tracks all jobs in Excel.` | Max 132 chars |
| **Category** | `Productivity` / `Workflow & Planning` | Selected in Console |
| **Language** | `English` | |
| **Price** | Free (with optional Pro upgrade / credit recharge) | |
| **Privacy Policy URL** | `https://yourdomain.com/privacy` (or GitHub raw link) | |
| **Support URL** | `https://github.com/your-username/ai-job-search/issues` | |

---

## 2. Detailed Store Description (Copy-Paste into Store Console)

```markdown
🚀 Land your dream role 10x faster with JobCopilot AI — the intelligent, client-side job application assistant that tailors ATS-optimized resumes and pre-fills applications in 1 click across every major career portal.

Tired of typing your contact info, pasting your work history, and answering repetitive screening questions on hundreds of company portals? JobCopilot AI automates the tedious work while ensuring your applications remain 100% truthful, personalized, and ATS-compliant.

==================================================
⚡ KEY FEATURES
==================================================

🎯 1-CLICK MULTI-PORTAL AUTO-FILL
- Works seamlessly on LinkedIn, Greenhouse, Lever, Workday, Ashby, SmartRecruiters, Indeed, and direct company career sites.
- An intelligent floating widget appears directly on active job pages.
- 1 click reads the job description, matches your profile, and pre-fills every field in green for your final review.

📄 DYNAMIC ATS RESUME & COVER LETTER TAILORING
- Generates tailored, single-column ATS resume PDFs matched specifically to the target role's keywords.
- Automatically attaches the tailored resume PDF into the file upload inputs of the career site.
- Built-in Deterministic Anti-Hallucination Guard: Guarantees zero invented metrics, dates, or false skills. Every word is strictly verified against your master resume profile.

🧠 INTELLIGENT SCREENING QUESTION REASONING
- Solves complex custom application questions: years of experience, work authorization, salary expectations, preferred programming languages, and "Why do you want to work here?" answers based on your background.

📊 UNIFIED EXCEL APPLICATION TRACKER
- Automatically records every application across every portal into one central Excel/CSV master tracker.
- Track Company, Job Title, Portal (LinkedIn, Greenhouse, Lever, Workday), Match Score %, Application Status, and PDF links.
- 1-Click "Download Applications (Excel / CSV)" right from the extension popup. Never lose track of where and when you applied!
- Smart Deduplication: Applying again or updating status updates the existing entry without creating duplicate rows.

⚡ TRANSPARENT RATE LIMITING & QUOTAS
- Generous Daily Free Allowance: 20 free auto-applies every single day (resets automatically).
- Optional Pro Unlimited or Pay-As-You-Go Credit Recharges for high-volume job hunts.

🔒 100% PRIVATE & CLIENT-SIDE SECURE
- Runs in your own browser session. Your master resume and DeepSeek API keys remain securely on your local engine.
- No personal passwords, session tokens, or private browsing history are ever sold, transmitted to third-party ad brokers, or shared.

==================================================
🛠️ HOW TO USE IN 3 STEPS
==================================================
1. Click the JobCopilot extension icon to review your candidate profile or upload a new resume.
2. Navigate to any job application on LinkedIn, Greenhouse, Lever, Workday, etc.
3. Click "⚡ 1-Click Apply" on the floating widget or in the popup. Review the green pre-filled fields, click submit, and track everything in your unified Excel sheet!

==================================================
📋 SUPPORTED CAREER PORTALS
==================================================
- LinkedIn (Jobs & Feed Auto-Hunt)
- Greenhouse.io
- Lever.co
- Workday (myworkdayjobs.com)
- AshbyHQ.com
- SmartRecruiters.com
- Indeed & Direct Career Sites
```

---

## 3. Single Purpose Statement & Permissions Justification

Google requires developers to declare a **Single Purpose** and justify every requested permission:

### Single Purpose Statement:
> *"JobCopilot AI automates the pre-filling of job application forms on employer career portals using the candidate's verified resume profile, and maintains a unified Excel application tracking sheet."*

### Permissions Justification:

| Permission | Technical Justification for Reviewer |
|---|---|
| `activeTab` | Required to detect the active job application portal URL (e.g. Greenhouse, LinkedIn, Lever) and inject the pre-fill helper button into the current tab only when requested by the user. |
| `scripting` | Required to programmatically populate form inputs (name, email, experience, screening questions) with verified resume data and highlight filled fields in green for candidate verification. |
| `storage` | Required to persist user UI preferences (e.g. backend endpoint, dark theme mode, local cached profile) securely in the browser. |
| `downloads` | Required to provide the user with a 1-click export of their unified application tracker spreadsheet (`Job_Applications_Tracker.csv`) directly to their computer. |

### Host Permissions:
- `http://127.0.0.1:3000/*` & `http://localhost:3000/*`: Connects to the user's local deterministic AI engine and resume parser.
- `https://*/*`: Enables the content script to run on company career sites (Greenhouse, Lever, Workday, LinkedIn, etc.) to detect application inputs.

---

## 4. Privacy & Data Handling Declarations

In the **Chrome Web Store Developer Dashboard -> Privacy tab**, select the following answers:

1. **Do you collect personal data?**
   - Select: `Personally identifiable information` (Name, Email, Professional Experience).
   - Usage: `Functionality` (Used exclusively to fill the candidate's application fields on employer job forms).
   - Data is stored locally or processed via the user's engine. **It is never transferred to third parties or data brokers.**
2. **Do you sell user data?**
   - `No, I do not sell user data.`
3. **Do you use or transfer user data for purposes unrelated to the extension's core functionality?**
   - `No.`
4. **Do you use or transfer user data to determine creditworthiness or for lending purposes?**
   - `No.`

---

## 5. Promotional Screenshots Package

All screenshots are pre-rendered at Google's official specification (**1280 x 800 pixels**, 24-bit PNG, 2x Retina):

1. `extension/screenshots/screenshot1_autofill_demo.png`
   - *Caption:* 1-Click Auto-Fill on Greenhouse & LinkedIn with verified ATS tailored resumes and green highlighted fields.
2. `extension/screenshots/screenshot2_extension_popup.png`
   - *Caption:* Obsidian Cyber Chrome Extension Popup featuring daily quota meters, profile switcher, and 1-click apply.
3. `extension/screenshots/screenshot3_unified_excel_tracker.png`
   - *Caption:* Unified Master Excel Tracker Sheet automatically logging all applications across LinkedIn, Greenhouse, Lever, and Workday.
4. `extension/screenshots/screenshot4_quota_and_pro_plans.png`
   - *Caption:* Transparent rate limiting with 20 free daily applications and flexible Pro / Recharge plans.

---

## 6. Reviewer Testing Instructions (For Google Review Team)

To test the extension during review:
1. Load unpacked extension from the `extension/` directory in Chrome (`chrome://extensions` with Developer Mode enabled).
2. Start the local backend engine (`npm start`) on `http://127.0.0.1:3000`.
3. Open any public job posting (e.g., on Greenhouse or Lever).
4. Click the JobCopilot AI extension icon or the floating widget on the page.
5. Click **"⚡ Auto-Fill This Job Tab"**: Observe the form fields populate with verified candidate profile info.
6. Click **"📥 Download Applications (Excel / CSV)"**: Verify the downloaded `.csv` file contains the logged application details.
