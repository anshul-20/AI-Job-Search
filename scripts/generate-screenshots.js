import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

async function generateScreenshots() {
  const screenshotsDir = path.resolve("extension/screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const SYSTEM_CHROME = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const exe = SYSTEM_CHROME.find((p) => fs.existsSync(p));
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: exe,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

  // -------------------------------------------------------------
  // SCREENSHOT 1: 1-Click Auto-Fill on Job Portals (LinkedIn/Greenhouse)
  // -------------------------------------------------------------
  console.log("Rendering Screenshot 1: 1-Click Auto-Fill...");
  const html1 = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
        body { width: 1280px; height: 800px; background: #0b0f17; color: #f1f5f9; overflow: hidden; display: flex; flex-direction: column; position: relative; }
        
        /* Background Glows */
        .bg-glow-1 { position: absolute; top: -100px; left: -100px; width: 500px; height: 500px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; filter: blur(100px); }
        .bg-glow-2 { position: absolute; bottom: -100px; right: -100px; width: 600px; height: 600px; background: rgba(6, 182, 212, 0.15); border-radius: 50%; filter: blur(120px); }

        /* Banner Header */
        .banner-header { height: 90px; padding: 20px 48px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10; }
        .logo-group { display: flex; align-items: center; gap: 14px; }
        .logo-box { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #06b6d4); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; color: #090d12; box-shadow: 0 0 20px rgba(16,185,129,0.5); }
        .logo-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
        .logo-title span { color: #10b981; }
        .logo-subtitle { font-size: 13px; color: #94a3b8; }
        .header-tag { padding: 6px 16px; border-radius: 9999px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #4edea3; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; }

        /* Main Workspace Preview */
        .main-canvas { flex: 1; padding: 24px 48px; display: flex; gap: 28px; z-index: 10; }
        
        /* Browser Mockup Window */
        .browser-window { flex: 1; background: #131924; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.6); position: relative; }
        .browser-top { height: 40px; background: #0e131d; display: flex; align-items: center; padding: 0 16px; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .dots { display: flex; gap: 6px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot.r { background: #ef4444; } .dot.y { background: #f59e0b; } .dot.g { background: #10b981; }
        .url-bar { flex: 1; height: 26px; background: #18202d; border-radius: 6px; display: flex; align-items: center; padding: 0 12px; font-size: 11px; color: #94a3b8; border: 1px solid rgba(255,255,255,0.05); }

        .job-content { flex: 1; padding: 24px 32px; overflow: hidden; display: flex; flex-direction: column; gap: 16px; position: relative; }
        .job-header-card { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .company-title { font-size: 18px; font-weight: 700; color: #f1f5f9; }
        .company-name { font-size: 13px; color: #06b6d4; margin-top: 2px; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 11px; font-weight: 600; color: #94a3b8; }
        .form-input { height: 36px; background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981; border-radius: 8px; padding: 0 12px; color: #f1f5f9; font-size: 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 0 12px rgba(16,185,129,0.2); }
        .check-badge { color: #10b981; font-weight: bold; font-size: 13px; }

        .file-upload-box { border: 1.5px dashed #10b981; border-radius: 10px; padding: 14px; background: rgba(16, 185, 129, 0.06); display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
        .file-info { display: flex; align-items: center; gap: 10px; }
        .file-icon { font-size: 20px; }
        .file-name { font-size: 12px; font-weight: 700; color: #f1f5f9; }
        .file-sub { font-size: 10px; color: #10b981; }

        /* Floating AI Copilot Widget Mockup */
        .floating-pill { position: absolute; bottom: 24px; right: 28px; background: rgba(14, 19, 29, 0.95); backdrop-filter: blur(16px); border: 1.5px solid #10b981; border-radius: 9999px; padding: 8px 18px; display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 30px rgba(16,185,129,0.4); animation: floatAnim 3s infinite ease-in-out; }
        @keyframes floatAnim { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .pill-bolt { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #06b6d4); display: flex; align-items: center; justify-content: center; font-size: 15px; color: #090d12; font-weight: bold; }
        .pill-text { font-size: 13px; font-weight: 700; color: #f1f5f9; }
        .pill-status { font-size: 11px; color: #10b981; font-weight: 600; }
        .pill-btn { background: #10b981; border: none; border-radius: 9999px; padding: 7px 16px; font-size: 12px; font-weight: 800; color: #090d12; cursor: pointer; box-shadow: 0 0 14px rgba(16,185,129,0.5); }

        /* Feature Sidebar */
        .feature-panel { width: 350px; display: flex; flex-direction: column; gap: 14px; justify-content: center; }
        .feature-card { background: rgba(19, 25, 36, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; display: flex; gap: 14px; align-items: flex-start; }
        .f-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px; color: #10b981; shrink-0; }
        .f-title { font-size: 13.5px; font-weight: 700; color: #f1f5f9; }
        .f-desc { font-size: 11.5px; color: #94a3b8; margin-top: 3px; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="bg-glow-1"></div>
      <div class="bg-glow-2"></div>
      <header class="banner-header">
        <div class="logo-group">
          <div class="logo-box">⚡</div>
          <div>
            <div class="logo-title">JobCopilot <span>AI</span></div>
            <div class="logo-subtitle">1-Click Client-Side Auto-Fill & ATS Tailoring</div>
          </div>
        </div>
        <div class="header-tag">✓ Anti-Hallucination Guard Active</div>
      </header>

      <div class="main-canvas">
        <div class="browser-window">
          <div class="browser-top">
            <div class="dots"><div class="dot r"></div><div class="dot y"></div><div class="dot g"></div></div>
            <div class="url-bar">🔒 https://boards.greenhouse.io/scaleai/jobs/senior-ml-engineer</div>
          </div>
          <div class="job-content">
            <div class="job-header-card">
              <div>
                <div class="company-title">Senior Machine Learning Engineer</div>
                <div class="company-name">Scale AI • San Francisco, CA (or Remote Worldwide)</div>
              </div>
              <div style="font-size: 12px; padding: 4px 10px; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); color: #4cd7f6; border-radius: 6px; font-weight: 600;">Full-Time • Applied</div>
            </div>

            <div class="file-upload-box">
              <div class="file-info">
                <span class="file-icon">📄</span>
                <div>
                  <div class="file-name">ScaleAI_Senior_ML_Engineer_Anshul_Pandey_Tailored.pdf</div>
                  <div class="file-sub">✓ Generated ATS Single-Column Resume (100% Guard Verified)</div>
                </div>
              </div>
              <div style="font-size: 11px; color: #10b981; font-weight: bold; background: rgba(16,185,129,0.15); padding: 4px 8px; border-radius: 4px;">Attached</div>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <span class="form-label">Full Name</span>
                <div class="form-input"><span>Anshul Pandey</span><span class="check-badge">✓</span></div>
              </div>
              <div class="form-row">
                <span class="form-label">Email Address</span>
                <div class="form-input"><span>anshul.pandey@example.com</span><span class="check-badge">✓</span></div>
              </div>
              <div class="form-row">
                <span class="form-label">LinkedIn Profile</span>
                <div class="form-input"><span>linkedin.com/in/anshul-pandey</span><span class="check-badge">✓</span></div>
              </div>
              <div class="form-row">
                <span class="form-label">Years of Experience with LLMs & PyTorch</span>
                <div class="form-input"><span>6+ years production ML</span><span class="check-badge">✓</span></div>
              </div>
              <div class="form-row" style="grid-column: span 2;">
                <span class="form-label">Why are you interested in this role? (Screening Question)</span>
                <div class="form-input" style="height: 48px;"><span>Deep expertise scaling multi-tenant LLM evaluation pipelines matching Scale AI's infrastructure goals...</span><span class="check-badge">✓</span></div>
              </div>
            </div>

            <div class="floating-pill">
              <div class="pill-bolt">⚡</div>
              <div>
                <div class="pill-text">AI Job Copilot</div>
                <div class="pill-status">All fields filled in green</div>
              </div>
              <button class="pill-btn">1-Click Apply</button>
            </div>
          </div>
        </div>

        <div class="feature-panel">
          <div class="feature-card">
            <div class="f-icon">🎯</div>
            <div>
              <div class="f-title">Works on Every Major Portal</div>
              <div class="f-desc">Seamless auto-fill for LinkedIn, Greenhouse, Lever, Workday, Ashby, and SmartRecruiters.</div>
            </div>
          </div>
          <div class="feature-card">
            <div class="f-icon">🛡️</div>
            <div>
              <div class="f-title">Zero Hallucinations</div>
              <div class="f-desc">Deterministic verification ensures only verified facts, real projects, and true skills pass into applications.</div>
            </div>
          </div>
          <div class="feature-card">
            <div class="f-icon">📊</div>
            <div>
              <div class="f-title">Unified Excel Tracker</div>
              <div class="f-desc">Every application logs to one central sheet. 1-click export to Excel / CSV anytime.</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  await page.setContent(html1);
  const out1 = path.join(screenshotsDir, "screenshot1_autofill_demo.png");
  await page.screenshot({ path: out1 });
  console.log(`Generated: ${out1} (1280x800)`);

  // -------------------------------------------------------------
  // SCREENSHOT 2: Obsidian Cyber Chrome Extension Popup
  // -------------------------------------------------------------
  console.log("Rendering Screenshot 2: Extension Popup...");
  const popupHtmlContent = fs.readFileSync(path.resolve("extension/popup.html"), "utf8");
  const popupCssContent = fs.readFileSync(path.resolve("extension/popup.css"), "utf8");

  const html2 = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
        body { width: 1280px; height: 800px; background: #080c13; color: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; }
        
        .bg-glow-1 { position: absolute; top: 100px; left: 150px; width: 500px; height: 500px; background: rgba(16, 185, 129, 0.12); border-radius: 50%; filter: blur(120px); }
        .bg-glow-2 { position: absolute; bottom: 80px; right: 150px; width: 500px; height: 500px; background: rgba(6, 182, 212, 0.12); border-radius: 50%; filter: blur(120px); }

        .showcase-layout { width: 1140px; display: flex; align-items: center; justify-content: space-between; z-index: 10; gap: 48px; }
        
        .copy-side { flex: 1; display: flex; flex-direction: column; gap: 20px; }
        .badge-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #4edea3; font-size: 13px; font-weight: 700; width: fit-content; }
        .hero-title { font-size: 38px; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; }
        .hero-title span { background: linear-gradient(135deg, #10b981, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-desc { font-size: 16px; color: #94a3b8; line-height: 1.5; }

        .highlights { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
        .hl-item { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #f1f5f9; font-weight: 600; }
        .hl-icon { color: #10b981; font-size: 16px; }

        .popup-preview-frame { width: 385px; border-radius: 20px; box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1); overflow: hidden; background: #090d12; }
      </style>
      <style>${popupCssContent}</style>
    </head>
    <body>
      <div class="bg-glow-1"></div>
      <div class="bg-glow-2"></div>
      <div class="showcase-layout">
        <div class="copy-side">
          <div class="badge-pill">⚡ Obsidian Cyber Chrome Design</div>
          <div class="hero-title">High-Utility Extension.<br><span>Zero Clutter. Total Focus.</span></div>
          <div class="hero-desc">Designed specifically for active job seekers. Displays only actionable tools: 1-click apply, real-time rate limits, master resume switcher, and instant Excel export.</div>
          <div class="highlights">
            <div class="hl-item"><span class="hl-icon">✓</span> <span>Daily quota meter with 20 free daily auto-applies</span></div>
            <div class="hl-item"><span class="hl-icon">✓</span> <span>Unified tracker exports all applications into 1 Excel sheet</span></div>
            <div class="hl-item"><span class="hl-icon">✓</span> <span>Automatic detection of Greenhouse, Lever, LinkedIn & Workday</span></div>
            <div class="hl-item"><span class="hl-icon">✓</span> <span>All secret keys stay secure on your local backend</span></div>
          </div>
        </div>

        <div class="popup-preview-frame">
          ${popupHtmlContent.replace('src="popup.js"', "")}
        </div>
      </div>
      <script>
        // Populate sample data for screenshot
        document.getElementById("candidateName").textContent = "Anshul Pandey";
        document.getElementById("candidateTitle").textContent = "Senior AI/ML Engineer";
        document.getElementById("candidateAvatar").textContent = "AP";
        document.getElementById("statusDot").className = "status-dot online pulse";
        document.getElementById("statusText").textContent = "Engine Ready";
        document.getElementById("contextText").textContent = "Greenhouse Career Portal detected";
        document.getElementById("contextBadge").textContent = "Greenhouse";
        document.getElementById("quotaProgressBar").style.width = "70%";
        document.getElementById("quotaRemainingText").textContent = "14 / 20 Applications Left Today";
        document.getElementById("trackerCountBadge").textContent = "38 logged";
        document.getElementById("trackerList").innerHTML = \`
          <div class="recent-item">
            <div class="item-left">
              <div class="item-company-row">
                <span class="item-company">Scale AI</span>
                <span class="item-portal">Greenhouse</span>
              </div>
              <span class="item-role">Senior Research Engineer</span>
            </div>
            <span class="item-status applied">Applied</span>
          </div>
          <div class="recent-item">
            <div class="item-left">
              <div class="item-company-row">
                <span class="item-company">Stripe</span>
                <span class="item-portal">LinkedIn</span>
              </div>
              <span class="item-role">ML Infrastructure Tech Lead</span>
            </div>
            <span class="item-status interview">Interview</span>
          </div>
          <div class="recent-item">
            <div class="item-left">
              <div class="item-company-row">
                <span class="item-company">Anthropic</span>
                <span class="item-portal">Lever</span>
              </div>
              <span class="item-role">AI Alignment Specialist</span>
            </div>
            <span class="item-status drafted">Drafted</span>
          </div>
        \`;
      </script>
    </body>
    </html>
  `;
  await page.setContent(html2);
  const out2 = path.join(screenshotsDir, "screenshot2_extension_popup.png");
  await page.screenshot({ path: out2 });
  console.log(`Generated: ${out2} (1280x800)`);

  // -------------------------------------------------------------
  // SCREENSHOT 3: Unified Excel Application Tracker Sheet
  // -------------------------------------------------------------
  console.log("Rendering Screenshot 3: Excel Application Tracker...");
  const html3 = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
        body { width: 1280px; height: 800px; background: #0a0e16; color: #f1f5f9; overflow: hidden; display: flex; flex-direction: column; position: relative; }

        .bg-glow { position: absolute; top: -100px; right: 100px; width: 600px; height: 600px; background: rgba(16, 185, 129, 0.12); border-radius: 50%; filter: blur(140px); }

        .header-bar { height: 80px; padding: 0 48px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10; }
        .logo-group { display: flex; align-items: center; gap: 12px; }
        .logo-icon { width: 38px; height: 38px; border-radius: 10px; background: #107c41; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: white; }
        .title-h1 { font-size: 20px; font-weight: 800; }
        .title-sub { font-size: 12px; color: #94a3b8; }
        .btn-export-badge { padding: 8px 16px; border-radius: 8px; background: #107c41; color: white; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(16,124,65,0.4); }

        .sheet-container { flex: 1; padding: 24px 48px; display: flex; flex-direction: column; gap: 16px; z-index: 10; }
        .table-frame { flex: 1; background: #121824; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        
        .sheet-tabs { height: 38px; background: #0c111a; display: flex; align-items: center; padding: 0 16px; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .tab-active { padding: 4px 14px; background: #121824; border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 700; color: #10b981; display: flex; align-items: center; gap: 6px; }

        table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
        th { background: #161e2c; color: #94a3b8; font-weight: 600; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.04em; }
        td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #f1f5f9; }
        tr:hover td { background: rgba(255,255,255,0.02); }

        .portal-pill { padding: 2px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 600; }
        .portal-greenhouse { background: rgba(16,185,129,0.15); color: #4edea3; border: 1px solid rgba(16,185,129,0.3); }
        .portal-linkedin { background: rgba(10,102,194,0.2); color: #70b5f9; border: 1px solid rgba(10,102,194,0.4); }
        .portal-lever { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.3); }
        .portal-workday { background: rgba(6,182,212,0.15); color: #67e8f9; border: 1px solid rgba(6,182,212,0.3); }

        .status-pill-table { padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
        .st-applied { background: rgba(16,185,129,0.15); color: #10b981; }
        .st-interview { background: rgba(6,182,212,0.2); color: #06b6d4; }
        .st-drafted { background: rgba(245,158,11,0.15); color: #f59e0b; }

        .match-badge { font-weight: 700; color: #10b981; font-family: monospace; }
        .pdf-link { color: #06b6d4; text-decoration: none; font-size: 11.5px; }

        .footer-metrics { display: flex; justify-content: space-between; align-items: center; padding: 0 4px; font-size: 12px; color: #94a3b8; }
        .metrics-badges { display: flex; gap: 16px; }
        .m-badge { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="bg-glow"></div>
      <div class="header-bar">
        <div class="logo-group">
          <div class="logo-icon">X</div>
          <div>
            <div class="title-h1">Job_Applications_Tracker.xlsx / .csv</div>
            <div class="title-sub">Universal Single Source of Truth • Automatically syncs across all job portals</div>
          </div>
        </div>
        <div class="btn-export-badge">📥 1-Click Excel Export Active</div>
      </div>

      <div class="sheet-container">
        <div class="table-frame">
          <div class="sheet-tabs">
            <div class="tab-active"><span>📊</span> Master Application Tracker</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Role Title</th>
                <th>Portal</th>
                <th>Match %</th>
                <th>Status</th>
                <th>Generated ATS Resume</th>
                <th>Job URL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2026-11-03</td>
                <td><strong>Scale AI</strong></td>
                <td>Senior Research Engineer</td>
                <td><span class="portal-pill portal-greenhouse">Greenhouse</span></td>
                <td><span class="match-badge">94%</span></td>
                <td><span class="status-pill-table st-applied">✓ Applied</span></td>
                <td><span class="pdf-link">📄 ScaleAI_Tailored_ATS.pdf</span></td>
                <td>boards.greenhouse.io/scaleai/...</td>
              </tr>
              <tr>
                <td>2026-11-02</td>
                <td><strong>Stripe</strong></td>
                <td>ML Infrastructure Tech Lead</td>
                <td><span class="portal-pill portal-linkedin">LinkedIn</span></td>
                <td><span class="match-badge">91%</span></td>
                <td><span class="status-pill-table st-interview">⚡ Interview</span></td>
                <td><span class="pdf-link">📄 Stripe_ML_Lead_Tailored.pdf</span></td>
                <td>linkedin.com/jobs/view/44747...</td>
              </tr>
              <tr>
                <td>2026-11-02</td>
                <td><strong>Anthropic</strong></td>
                <td>AI Alignment Specialist</td>
                <td><span class="portal-pill portal-lever">Lever</span></td>
                <td><span class="match-badge">96%</span></td>
                <td><span class="status-pill-table st-applied">✓ Applied</span></td>
                <td><span class="pdf-link">📄 Anthropic_Alignment_ATS.pdf</span></td>
                <td>jobs.lever.co/anthropic/...</td>
              </tr>
              <tr>
                <td>2026-11-01</td>
                <td><strong>NVIDIA</strong></td>
                <td>Principal Distributed Systems Engineer</td>
                <td><span class="portal-pill portal-workday">Workday</span></td>
                <td><span class="match-badge">89%</span></td>
                <td><span class="status-pill-table st-drafted">⏳ Pre-filled</span></td>
                <td><span class="pdf-link">📄 Nvidia_DistSystems_ATS.pdf</span></td>
                <td>nvidia.wd5.myworkdayjobs.com/...</td>
              </tr>
              <tr>
                <td>2026-10-31</td>
                <td><strong>Databricks</strong></td>
                <td>Staff Software Engineer (AI)</td>
                <td><span class="portal-pill portal-greenhouse">Greenhouse</span></td>
                <td><span class="match-badge">93%</span></td>
                <td><span class="status-pill-table st-applied">✓ Applied</span></td>
                <td><span class="pdf-link">📄 Databricks_Staff_ATS.pdf</span></td>
                <td>boards.greenhouse.io/databricks/...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer-metrics">
          <div class="metrics-badges">
            <span class="m-badge"><strong style="color: #10b981;">38</strong> Total Logged</span>
            <span class="m-badge"><strong style="color: #06b6d4;">12</strong> Greenhouse</span>
            <span class="m-badge"><strong style="color: #3b82f6;">14</strong> LinkedIn</span>
            <span class="m-badge"><strong style="color: #f59e0b;">7</strong> Lever</span>
            <span class="m-badge"><strong style="color: #ec4899;">5</strong> Workday</span>
          </div>
          <div>Deduplication Active: Applying twice updates the existing entry in place</div>
        </div>
      </div>
    </body>
    </html>
  `;
  await page.setContent(html3);
  const out3 = path.join(screenshotsDir, "screenshot3_unified_excel_tracker.png");
  await page.screenshot({ path: out3 });
  console.log(`Generated: ${out3} (1280x800)`);

  // -------------------------------------------------------------
  // SCREENSHOT 4: Quota & Subscription / Recharge Model
  // -------------------------------------------------------------
  console.log("Rendering Screenshot 4: Quota & Subscription...");
  const html4 = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
        body { width: 1280px; height: 800px; background: #090d14; color: #f1f5f9; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }

        .bg-glow-1 { position: absolute; top: -100px; left: 100px; width: 600px; height: 600px; background: rgba(16, 185, 129, 0.12); border-radius: 50%; filter: blur(140px); }
        .bg-glow-2 { position: absolute; bottom: -100px; right: 100px; width: 600px; height: 600px; background: rgba(6, 182, 212, 0.12); border-radius: 50%; filter: blur(140px); }

        .header-section { text-align: center; margin-bottom: 32px; z-index: 10; }
        .tag-pill { display: inline-block; padding: 4px 14px; border-radius: 9999px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #4edea3; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
        .main-h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
        .main-h1 span { background: linear-gradient(135deg, #10b981, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .sub-text { font-size: 15px; color: #94a3b8; margin-top: 6px; }

        .cards-row { width: 1050px; display: flex; gap: 24px; z-index: 10; }

        .tier-card { flex: 1; background: #111722; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); padding: 32px 28px; display: flex; flex-direction: column; gap: 20px; position: relative; }
        .tier-card.pro { border-color: #10b981; background: linear-gradient(180deg, rgba(16,185,129,0.08) 0%, #111722 100%); box-shadow: 0 16px 50px rgba(16,185,129,0.25); }
        .featured-badge { position: absolute; top: -12px; right: 28px; padding: 4px 12px; background: linear-gradient(135deg, #10b981, #06b6d4); color: #090d12; border-radius: 9999px; font-size: 11px; font-weight: 800; }

        .tier-name { font-size: 18px; font-weight: 700; color: #f1f5f9; }
        .tier-price { font-size: 36px; font-weight: 800; margin-top: 4px; }
        .tier-price span { font-size: 14px; font-weight: 500; color: #94a3b8; }
        .tier-desc { font-size: 12.5px; color: #94a3b8; line-height: 1.4; }

        .features-list { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
        .feat-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #f1f5f9; }
        .feat-check { color: #10b981; font-weight: bold; }

        .tier-btn { margin-top: auto; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; text-align: center; border: none; }
        .tier-btn.free { background: rgba(255,255,255,0.08); color: #f1f5f9; border: 1px solid rgba(255,255,255,0.1); }
        .tier-btn.pro-btn { background: linear-gradient(135deg, #10b981, #06b6d4); color: #090d12; box-shadow: 0 4px 18px rgba(16,185,129,0.4); }
      </style>
    </head>
    <body>
      <div class="bg-glow-1"></div>
      <div class="bg-glow-2"></div>
      
      <div class="header-section">
        <div class="tag-pill">⚡ Transparent Rate Limiting & Scaling</div>
        <h1 class="main-h1">Built for 1,000+ Users. <span>Zero API Key Leaks.</span></h1>
        <p class="sub-text">Every candidate enjoys a generous daily free allowance. Upgrade or recharge anytime for high-volume searches.</p>
      </div>

      <div class="cards-row">
        <div class="tier-card">
          <div>
            <div class="tier-name">Daily Free Tier</div>
            <div class="tier-price">$0 <span>/ forever</span></div>
            <p class="tier-desc">Perfect for active daily job hunters searching target roles.</p>
          </div>
          <div class="features-list">
            <div class="feat-item"><span class="feat-check">✓</span> <span><strong>20 Applications / Day</strong> (Auto-resets daily)</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>1-Click LinkedIn, Greenhouse & Lever Auto-Fill</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Tailored ATS Resume & Cover Letter PDFs</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>1-Click Excel / CSV Application Tracker</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Anti-Hallucination Guard Protection</span></div>
          </div>
          <button class="tier-btn free">Default Active Plan</button>
        </div>

        <div class="tier-card pro">
          <div class="featured-badge">MOST POPULAR</div>
          <div>
            <div class="tier-name">Pro Unlimited</div>
            <div class="tier-price">$19 <span>/ month</span></div>
            <p class="tier-desc">For aggressive job hunts, career switchers, and batch applications.</p>
          </div>
          <div class="features-list">
            <div class="feat-item"><span class="feat-check">✓</span> <span><strong>Unlimited Daily Auto-Applies</strong></span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Batch Auto-Hunt on LinkedIn Search & Feed</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Priority DeepSeek LLM Reasoning Engine</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Multi-Profile Master Resume Switching</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Dedicated Support & Custom ATS Templates</span></div>
          </div>
          <button class="tier-btn pro-btn">⚡ Upgrade to Pro Unlimited</button>
        </div>

        <div class="tier-card">
          <div>
            <div class="tier-name">Pay-As-You-Go Recharge</div>
            <div class="tier-price">$5 <span>/ 100 Credits</span></div>
            <p class="tier-desc">No recurring subscription. Extra credits that never expire.</p>
          </div>
          <div class="features-list">
            <div class="feat-item"><span class="feat-check">✓</span> <span>100 Additional Auto-Apply Credits</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Stackable on top of the 20 Free Daily Applies</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Credits never expire</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Instant activation via Extension popup</span></div>
            <div class="feat-item"><span class="feat-check">✓</span> <span>Full Unified Excel Tracker Access</span></div>
          </div>
          <button class="tier-btn free">⚡ Recharge Credits</button>
        </div>
      </div>
    </body>
    </html>
  `;
  await page.setContent(html4);
  const out4 = path.join(screenshotsDir, "screenshot4_quota_and_pro_plans.png");
  await page.screenshot({ path: out4 });
  console.log(`Generated: ${out4} (1280x800)`);

  await browser.close();
  console.log("🎉 All 4 Chrome Web Store screenshots generated successfully!");
}

generateScreenshots().catch(console.error);
