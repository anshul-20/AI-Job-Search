# Setup Guide — JobCopilot AI

Get up and running in less than 3 minutes.

---

## 1. Prerequisites

* **Node.js**: Version 20.0 or higher.
* **Google Chrome, Microsoft Edge, or Brave**: Automatically detected.

---

## 2. Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Add your OpenRouter API key into .env
```

---

## 3. Configuration (.env)

| Variable | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | *(required)* | Your OpenRouter API key (from https://openrouter.ai/keys) |
| `OPENROUTER_MODEL` | `deepseek/deepseek-chat` | Model ID (DeepSeek-V3, Gemini Flash, or Nemotron) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Base URL (set to `http://localhost:11434/v1` for 100% free local Ollama) |
| `RESUME_PATH` | `data/resume.json` | Path to your master candidate profile |
| `OUTPUT_DIR` | `output` | Folder where generated PDFs and reports are written |
| `PORT` | `3000` | Port for the local/cloud API engine |
| `AUTO_SEARCH_KEYWORDS` | `React Native` | Target role or skills for autonomous searching |
| `AUTO_SEARCH_LOCATION` | `India and Remote` | Target location (searches Indian tech hubs and Global Remote) |
| `AUTO_SEARCH_SOURCE` | `all` | `careers` (only direct company ATS: Greenhouse, Lever, Ashby) or `all` (ATS + LinkedIn/Indeed/Naukri) |
| `AUTO_MIN_MATCH_PCT` | `70` | Minimum % of required skills matched before generating PDFs |
| `AUTO_MAX_JOBS_PER_RUN`| `5` | Maximum number of new jobs to tailor per cycle |

---

## 4. Chrome Extension Setup (1-Click Auto-Fill)

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the [`extension/`](file:///d:/AI-Job-Search/extension) folder.
4. Pin the ⚡ **JobCopilot AI** icon to your toolbar.
5. On any job application page (Greenhouse, Lever, LinkedIn, Workday), click **"⚡ Auto-Fill This Job Tab"** to auto-fill the form with green highlights!

---

## 5. Upload / Import Any Resume

Anyone can upload their resume in PDF, Word, or plain text:

* **Via Chrome Extension**: Click the popup icon -> click **"Switch Resume"** -> pick any PDF.
* **Via Web UI**: Run `npm start`, visit `http://localhost:3000`, and upload your resume in the **"1. Upload Resume"** tab.
* **Via CLI**: Run `npm run import -- path/to/your_resume.pdf`.
* **Direct JSON**: Or edit [`data/resume.json`](file:///d:/AI-Job-Search/data/resume.json) directly.

---

## 6. Verify Everything Works

```bash
# 1. Render your base resume without LLM
npm run render

# 2. Search jobs automatically using your resume profile
npm run search

# 3. Tailor against a sample job description (generates Resume PDF + Cover Letter PDF)
npm run tailor -- --jd-file sample-jd.txt

# 4. Check your application tracker
npm run tracker

# 5. Run the complete test suite
npm test
```

---

## 7. Automate to Run 3 Times a Day (Windows)

To have Windows automatically search, filter, tailor, and log jobs at **9:00 AM, 2:00 PM, and 8:00 PM**:

Open PowerShell in this directory and run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\schedule_3x_daily.ps1
```
*(To cancel, run `schtasks /delete /tn AI_Job_Apply_9AM /f`, `AI_Job_Apply_2PM`, `AI_Job_Apply_8PM`).*
