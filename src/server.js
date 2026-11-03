import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config.js";
import { run } from "./pipeline.js";
import { fetchJd, JdFetchError } from "./jdFetch.js";
import { LLMError } from "./llm.js";
import { loadResume, parseResume } from "./resumeIO.js";
import { extractTextFromBuffer, parseRawResumeToSchema } from "./resumeParser.js";
import { searchJobs, fetchLinkedInJd } from "./jobSearch.js";
import { autoFillApplication, checkLinkedInAuth, loginToLinkedIn, reasonFormFields } from "./formFiller.js";
import { runAutoCycle } from "./autoRunner.js";
import { getTrackerRecords, updateApplicationStatus } from "./tracker.js";
import { getUserQuota, consumeQuota, rechargeUserQuota } from "./quota.js";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const outputRoot = path.resolve(config.OUTPUT_DIR);

export const app = express();
app.use(express.json({ limit: "25mb" }));

// Enable CORS for Chrome Extension content scripts and popups
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Autonomous Runner State
let autoJobState = {
  running: false,
  status: "idle", // "idle" | "running" | "completed" | "error"
  logs: [],
  startedAt: null,
  finishedAt: null,
  summary: null,
  error: null,
};

export function triggerAutoMode(options = {}) {
  if (autoJobState.running) {
    return { alreadyRunning: true, state: autoJobState };
  }

  autoJobState = {
    running: true,
    status: "running",
    logs: [`[${new Date().toLocaleTimeString()}] Autonomous search & apply sequence triggered...`],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    summary: null,
    error: null,
  };

  const logHandler = (msg) => {
    console.log(msg);
    autoJobState.logs.push(msg);
    if (autoJobState.logs.length > 200) {
      autoJobState.logs.shift();
    }
  };

  // Launch in background
  (async () => {
    try {
      const result = await runAutoCycle({
        ...options,
        log: logHandler,
      });
      autoJobState.running = false;
      autoJobState.status = "completed";
      autoJobState.finishedAt = new Date().toISOString();
      autoJobState.summary = result;
      logHandler(`[${new Date().toLocaleTimeString()}] 🎉 Finished! (${result.tailored} tailored, ${result.applied || 0} auto-filled)`);
    } catch (err) {
      autoJobState.running = false;
      autoJobState.status = "error";
      autoJobState.error = err.message;
      logHandler(`[${new Date().toLocaleTimeString()}] ❌ Autonomous runner error: ${err.message}`);
    }
  })();

  return { success: true, alreadyRunning: false, state: autoJobState };
}

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

export function getUserResumePath(req) {
  const userId = req.headers["x-user-id"];
  if (userId && /^[a-zA-Z0-9_-]+$/.test(userId)) {
    const userResume = path.resolve(`data/users/${userId}/resume.json`);
    if (fs.existsSync(userResume)) return userResume;
  }
  return config.RESUME_PATH;
}

export function getUserTrackerPath(req) {
  const userId = req.headers["x-user-id"];
  if (userId && /^[a-zA-Z0-9_-]+$/.test(userId)) {
    return path.resolve(`data/users/${userId}/job_search_tracker.csv`);
  }
  return "job_search_tracker.csv";
}

// GET current active resume profile
app.get("/api/resume", (req, res) => {
  try {
    const resume = loadResume(getUserResumePath(req));
    res.json(resume);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upload and parse raw resume (PDF, JSON, or plain text)
app.post("/api/resume/upload", async (req, res) => {
  try {
    const {
      base64,
      filename,
      text,
      target_roles,
      location,
      source,
      min_match_pct,
      max_jobs,
      auto_apply = true,
      auto_submit = false,
      headless = false,
    } = req.body ?? {};
    let structuredResume;

    if (base64) {
      const buffer = Buffer.from(base64, "base64");
      const extracted = await extractTextFromBuffer(buffer, filename || "resume.pdf");

      if (extracted.isStructuredJson) {
        structuredResume = extracted.data;
      } else {
        structuredResume = await parseRawResumeToSchema(extracted.rawText);
      }
    } else if (text && text.trim()) {
      structuredResume = await parseRawResumeToSchema(text.trim());
    } else {
      return res.status(400).json({ error: "Please provide a file or text content." });
    }

    // Save resume to user-specific or global path
    const userId = req.headers["x-user-id"];
    let savePath = config.RESUME_PATH;
    if (userId && /^[a-zA-Z0-9_-]+$/.test(userId)) {
      savePath = path.resolve(`data/users/${userId}/resume.json`);
    }

    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(structuredResume, null, 2), "utf8");

    // Automatically trigger autonomous search-to-apply cycle if auto_apply is enabled
    let autoLaunch = { alreadyRunning: false };
    if (auto_apply) {
      autoLaunch = triggerAutoMode({
        keywords: target_roles || "",
        location: location || "",
        source: source || "all",
        minMatchPct: min_match_pct ? Number(min_match_pct) : undefined,
        maxJobs: max_jobs ? Number(max_jobs) : undefined,
        autoApply: true,
        autoSubmit: Boolean(auto_submit),
        headlessApply: Boolean(headless),
      });
    }

    res.json({
      success: true,
      message: `Resume for ${structuredResume.basics.name} parsed and activated! ${auto_apply ? "Auto-mode engaged from searching to applying." : "Profile saved."}`,
      resume: structuredResume,
      auto_started: auto_apply && !autoLaunch.alreadyRunning,
    });
  } catch (err) {
    res.status(500).json({ error: `Resume parsing failed: ${err.message}` });
  }
});

// GET search jobs
app.get("/api/jobs/search", async (req, res) => {
  try {
    const keywords = req.query.keywords || "";
    const location = req.query.location || "India and Remote";
    const source = req.query.source || "all";
    const limit = parseInt(req.query.limit, 10) || 10;

    const jobs = await searchJobs({ keywords, location, source, limit });
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST tailor resume & cover letter
app.post("/api/tailor", async (req, res) => {
  try {
    const { jd_text: jdText, url, with_cover = true } = req.body ?? {};
    let jd = typeof jdText === "string" ? jdText.trim() : "";
    if (!jd && typeof url === "string" && url.trim()) jd = await fetchJd(url.trim());
    if (!jd) return res.status(400).json({ error: "Provide jd_text or url." });

    const r = await run(jd, { jobUrl: url || "", withCoverLetter: with_cover, log: () => {} });
    const base = `/api/runs/${encodeURIComponent(r.runId)}`;

    res.json({
      run_id: r.runId,
      job: r.analysis,
      coverage: r.coverage,
      warnings: r.warnings,
      notes: r.notes,
      pdf_url: `${base}/${encodeURIComponent(r.resumePdfName)}`,
      cover_pdf_url: r.coverLetterPdfName ? `${base}/${encodeURIComponent(r.coverLetterPdfName)}` : null,
      report_url: `${base}/report.md`,
    });
  } catch (err) {
    const status =
      err instanceof JdFetchError || /too short/.test(err.message) ? 400 : err instanceof LLMError ? 502 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST launch form auto-fill assistant for a URL
app.post("/api/apply/autofill", async (req, res) => {
  try {
    const { url, title = "", company = "", resume_pdf_path, headless = false, auto_submit = false } = req.body ?? {};
    if (!url) return res.status(400).json({ error: "Please provide a job URL." });

    // Launch in background so user can interact with the open browser window
    autoFillApplication({
      applyUrl: url,
      jobTitle: title,
      companyName: company,
      resumePdfPath: resume_pdf_path || null,
      headless: Boolean(headless),
      autoSubmit: Boolean(auto_submit),
    }).catch((err) => {
      console.error(`Auto-fill error for ${url}:`, err.message);
    });

    res.json({
      success: true,
      message: "Browser assistant launched! It will open the application page, attach your resume, and auto-fill details.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST 1-Click Tailor & Apply for a specific job (fetches JD, tailors resume, then launches form filler)
app.post("/api/apply/job", async (req, res) => {
  try {
    const { url, title = "", company = "", headless = false, auto_submit = false } = req.body ?? {};
    if (!url) return res.status(400).json({ error: "Please provide a job URL." });

    let jd = "";
    try {
      if (url.includes("linkedin.com")) {
        const fetched = await fetchLinkedInJd(url);
        jd = fetched.description;
      } else {
        jd = await fetchJd(url);
      }
    } catch (e) {
      console.warn(`Could not fetch full JD for ${url}: ${e.message}`);
    }

    let resumePdfPath = null;
    let tailorResult = null;
    if (jd && jd.length > 80) {
      tailorResult = await run(jd, { jobUrl: url, withCoverLetter: true, log: () => {} });
      resumePdfPath = path.resolve(tailorResult.dir, tailorResult.resumePdfName);
    }

    // Launch form filler in background
    autoFillApplication({
      applyUrl: url,
      jobTitle: title,
      companyName: company,
      resumePdfPath,
      headless: Boolean(headless),
      autoSubmit: Boolean(auto_submit),
    }).catch((err) => {
      console.error(`1-Click Apply error for ${url}:`, err.message);
    });

    res.json({
      success: true,
      message: `Form assistant launched for ${title || "role"} @ ${company || "company"}! Tailored resume PDF generated and attached.`,
      resumePdfPath,
      runId: tailorResult?.runId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET autonomous runner status & logs
app.get("/api/auto/status", (_req, res) => {
  res.json(autoJobState);
});

// POST start autonomous runner manually (supports custom roles, location, source, match threshold)
app.post("/api/auto/start", (req, res) => {
  const {
    keywords,
    target_roles,
    location,
    source,
    min_match_pct,
    max_jobs,
    auto_apply = true,
    auto_submit = false,
    headless = false,
  } = req.body || {};

  const result = triggerAutoMode({
    keywords: target_roles || keywords || "",
    location: location || "",
    source: source || config.AUTO_SEARCH_SOURCE,
    minMatchPct: min_match_pct !== undefined ? Number(min_match_pct) : undefined,
    maxJobs: max_jobs !== undefined ? Number(max_jobs) : undefined,
    autoApply: Boolean(auto_apply),
    autoSubmit: Boolean(auto_submit),
    headlessApply: Boolean(headless),
  });
  res.json(result);
});

// GET check LinkedIn auth status
app.get("/api/auth/status", async (_req, res) => {
  try {
    const status = await checkLinkedInAuth();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST open interactive LinkedIn sign-in window
app.post("/api/auth/linkedin", async (_req, res) => {
  try {
    loginToLinkedIn({
      log: (m) => console.log(m),
    }).catch((err) => {
      console.error(`LinkedIn sign-in error:`, err.message);
    });

    res.json({
      success: true,
      message: "Browser window opened to https://www.linkedin.com/login. Please sign in there; your session will be saved automatically.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET applications tracker records
app.get("/api/tracker", (req, res) => {
  try {
    const records = getTrackerRecords(getUserTrackerPath(req));
    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CHROME EXTENSION PRODUCTION API ENDPOINTS
// ==========================================

// GET extension active profile & user quota
app.get("/api/extension/profile", (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const resume = loadResume(getUserResumePath(req));
    const quota = getUserQuota(userId);
    res.json({
      ok: true,
      basics: resume.basics,
      skills: resume.skills,
      experience: resume.experience,
      education: resume.education,
      quota,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST extension tailor JD for current active page (Rate Limited)
app.post("/api/extension/tailor", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const quotaCheck = consumeQuota(userId, 1);
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        error: quotaCheck.error,
        limitReached: true,
        quota: quotaCheck.quota,
      });
    }

    const { jdText, jobUrl, title, company } = req.body || {};
    if (!jdText || jdText.length < 50) {
      return res.status(400).json({ error: "Insufficient job description text provided." });
    }

    const result = await run(jdText, {
      jobUrl: jobUrl || "",
      withCoverLetter: true,
      log: () => {},
    });

    const resumePdfUrl = `/api/runs/${result.runId}/${result.resumePdfName}`;
    const coverPdfUrl = result.coverPdfName ? `/api/runs/${result.runId}/${result.coverPdfName}` : null;

    res.json({
      success: true,
      runId: result.runId,
      resumePdfName: result.resumePdfName,
      resumePdfUrl,
      coverPdfUrl,
      matchPct: result.analysis?.coverage?.required_match_pct || 80,
      quota: quotaCheck.quota,
    });
  } catch (err) {
    res.status(500).json({ error: `Tailoring failed: ${err.message}` });
  }
});

// POST extension reason over detected form inputs
app.post("/api/extension/reason-fields", async (req, res) => {
  try {
    const { formInputs, jdText } = req.body || {};
    if (!Array.isArray(formInputs)) {
      return res.status(400).json({ error: "formInputs array is required" });
    }

    const resume = loadResume(getUserResumePath(req));
    const reasoning = await reasonFormFields({ formInputs, resume, jdText });
    res.json(reasoning);
  } catch (err) {
    res.status(500).json({ error: `Reasoning failed: ${err.message}` });
  }
});

// POST extension record application status in tracker
app.post("/api/extension/track", (req, res) => {
  try {
    const { jobUrl, status, company, title, portal } = req.body || {};
    if (!jobUrl) return res.status(400).json({ error: "jobUrl is required" });

    const notes = portal ? `[Portal: ${portal}] Applied via Chrome Extension` : "Applied via Chrome Extension";
    updateApplicationStatus(jobUrl, status || "Applied via Extension", getUserTrackerPath(req), {
      company,
      role: title,
      notes,
    });
    res.json({ success: true, message: "Tracker updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET export full application tracker as Excel-compatible CSV download
app.get(["/api/extension/export-csv", "/api/tracker/export"], (req, res) => {
  try {
    const trackerPath = getUserTrackerPath(req);
    const absPath = path.resolve(trackerPath);

    if (!fs.existsSync(absPath)) {
      // Create template with headers
      const defaultHeader = '"Date","Company","Role","Match %","Status","Resume PDF","Cover Letter PDF","Job URL","Notes"\n';
      fs.writeFileSync(absPath, defaultHeader, "utf8");
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="Job_Applications_Tracker.csv"');
    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: `Failed to export tracker: ${err.message}` });
  }
});

// POST recharge credits or activate Pro subscription
app.post("/api/user/recharge", (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { addCredits = 25, activatePro = false, plan } = req.body || {};
    const updatedQuota = rechargeUserQuota(userId, { addCredits, activatePro, plan });
    res.json({
      success: true,
      message: activatePro ? "Pro subscription activated!" : `Successfully added ${addCredits} credits.`,
      quota: updatedQuota,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/runs/:runId/:file", (req, res) => {
  const target = path.resolve(outputRoot, req.params.runId, req.params.file);
  if (!target.startsWith(outputRoot + path.sep)) return res.status(403).json({ error: "Forbidden" });
  res.sendFile(target, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Not found" });
  });
});

// Health check endpoint for cloud hosting (Render, Railway, AWS, Fly.io)
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: "JobCopilot AI Engine",
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || "0.0.0.0";
  app.listen(config.PORT, host, () => {
    console.log(`JobCopilot AI Server running at http://${host === "0.0.0.0" ? "localhost" : host}:${config.PORT}`);
  });
}
