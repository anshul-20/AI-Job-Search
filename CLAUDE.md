# JobCopilot AI — Developer Cheatsheet

This workspace manages autonomous job search activities, Chrome extension client-side auto-apply, multi-platform scraping tools, ATS single-column resumes, targeted cover letters, and unified Excel application tracking.

## Architecture & Single Source of Truth
- **Master Resume Profile**: `data/resume.json` (canonical source of truth).
- **Chrome Extension (Client-Side)**: `extension/` (Manifest V3, 1-click apply, Obsidian Cyber Chrome theme, unified Excel export, daily quota meter).
- **Production Package**: `dist/ai-job-copilot-extension.zip` (ultra-lean 28 KB build).
- **Deterministic Anti-Hallucination Guard**: `src/guard.js` strictly validates all generated text against the candidate profile. No LLM output that invents metrics, dates, or technologies may pass into the final document.
- **ATS Document Templates & Rendering**:
  - Resume: `templates/resume.hbs`
  - Cover Letter: `templates/cover_letter.hbs`
  - PDF Compiler: `src/renderer.js` via Puppeteer with Chrome/Edge detection.
- **Rate Limiting & Quotas**: `src/quota.js` (20 free applies/day + Pro/recharge support).
- **Unified Master Application Tracker**: `src/tracker.js` logs all applications across LinkedIn, Greenhouse, Lever, Workday to `job_search_tracker.csv`. Supports in-place status updates and 1-click Excel export.
- **Job Search & Scraping**: `src/jobSearch.js` (searches direct ATS career portals and job boards).

## Common Commands
- Start Backend Engine: `npm start`
- Pack Production Extension: `npm run extension:pack`
- Run Complete Test Suite: `npm test`
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
