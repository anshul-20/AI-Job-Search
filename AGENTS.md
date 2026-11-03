---
framework_version: 1.1.0
---

# Agent Guidelines: JobCopilot AI

This workspace manages autonomous job search activities, Chrome extension client-side auto-apply, multi-platform scraping tools, ATS single-column resumes, targeted cover letters, and unified Excel application tracking.

## Architecture & Single Source of Truth

1. **Candidate Profile**:
   - Master profile: [data/resume.json](file:///d:/AI-Job-Search/data/resume.json).
   - Extra bullets and skills are welcomed in this file; the system selects, reorders, and tightens them based on the JD.
2. **Deterministic Anti-Hallucination Guard**:
   - [src/guard.js](file:///d:/AI-Job-Search/src/guard.js) strictly validates all generated text against the candidate profile. No LLM output that invents metrics, dates, or technologies may pass into the final document.
3. **Chrome Extension (Client-Side Apply Engine)**:
   - Manifest V3 extension in [extension/](file:///d:/AI-Job-Search/extension).
   - Injects on-page 1-click apply widget across LinkedIn, Greenhouse, Lever, Workday, Ashby, and SmartRecruiters.
   - Obsidian Cyber Chrome popup with daily quota progress meter, resume switcher, and 1-click Excel download.
   - Ultra-lean production build in [dist/ai-job-copilot-extension.zip](file:///d:/AI-Job-Search/dist/ai-job-copilot-extension.zip) (28 KB).
4. **Document Templates & Rendering**:
   - Resume: [templates/resume.hbs](file:///d:/AI-Job-Search/templates/resume.hbs)
   - Cover Letter: [templates/cover_letter.hbs](file:///d:/AI-Job-Search/templates/cover_letter.hbs)
   - PDF Compiler: [src/renderer.js](file:///d:/AI-Job-Search/src/renderer.js) via Puppeteer (with Chrome/Edge system detection).
5. **Rate Limiting & Quota Management**:
   - [src/quota.js](file:///d:/AI-Job-Search/src/quota.js): 20 free daily auto-applies with daily reset, stackable recharge credits, and Pro tier support.
6. **Unified Master Excel Tracker**:
   - [src/tracker.js](file:///d:/AI-Job-Search/src/tracker.js) and [job_search_tracker.csv](file:///d:/AI-Job-Search/job_search_tracker.csv).
   - Handles multi-portal logging with in-place deduplication and 1-click CSV/Excel export.
7. **Job Search & Scraping**:
   - [src/jobSearch.js](file:///d:/AI-Job-Search/src/jobSearch.js): Searches direct company ATS portals and job boards.
   - Dual-location targeting: India and Remote Worldwide.

## Autonomous End-to-End Pipeline (Upload -> Search -> Tailor -> Apply)
- Uploading a resume (PDF/TXT/JSON) via Extension, Web UI, or `npm run import -- <path>` engages the autonomous loop:
  1. Profile is structured into `data/resume.json`.
  2. Search terms & locations (India + Remote Worldwide) are derived.
  3. Jobs are fetched from ATS portals and job boards.
  4. Matching jobs are filtered and tailored into ATS single-column Resume PDFs and targeted Cover Letter PDFs.
  5. The form-filler engine attaches the tailored resume PDF, and reasons over form fields to auto-fill them.
  6. Results are tracked in `job_search_tracker.csv` and live on the Web UI.

## Common Commands
- Start Web UI & API Engine: `npm start`
- Pack Extension: `npm run extension:pack`
- Run Tests: `npm test`
- Build & Verify Deployment: `npm run deploy:check`
- Import / Upload any resume: `npm run import -- <path-to-file> [--auto]`
- Zero-config search: `npm run search`
- Targeted search: `npm run search -- -k "<keywords>" -l "<location>" --source <all|careers|linkedin|indeed|naukri|remoteok>`
- Tailor resume & cover letter: `npm run tailor -- --jd-file <path>` or `--url <url>`
- Auto-fill application on external portal: `npm run apply -- --url <url>`
- Run 1 autonomous discovery cycle: `npm run auto:now`
- Start 3x daily scheduler: `npm run auto`
- View application tracker: `npm run tracker`
- Render base resume (no LLM): `npm run render`
