import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { searchJobs, fetchLinkedInJd, deriveSearchTermsFromResume } from "./jobSearch.js";
import { fetchJd } from "./jdFetch.js";
import { loadResume } from "./resumeIO.js";
import { analyzeJob, skillCoverage } from "./analyzer.js";
import { run } from "./pipeline.js";
import { autoFillApplication, closeSharedBrowser } from "./formFiller.js";
import { updateApplicationStatus } from "./tracker.js";

const SEEN_JOBS_FILE = "data/seen_jobs.json";

function loadSeenJobs() {
  const filePath = path.resolve(SEEN_JOBS_FILE);
  if (!fs.existsSync(filePath)) {
    return new Set();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveSeenJobs(seenSet) {
  const filePath = path.resolve(SEEN_JOBS_FILE);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify([...seenSet], null, 2), "utf8");
}

export async function runAutoCycle({
  keywords,
  location,
  source = config.AUTO_SEARCH_SOURCE,
  minMatchPct = config.AUTO_MIN_MATCH_PCT,
  maxJobs = config.AUTO_MAX_JOBS_PER_RUN,
  autoApply = config.AUTO_APPLY_ENABLED,
  headlessApply = false,
  autoSubmit = false,
  log = console.log,
} = {}) {
  const resume = loadResume(config.RESUME_PATH);
  const derived = deriveSearchTermsFromResume(resume);

  // Derive target keywords from resume unless custom keywords explicitly provided
  const customKw = (keywords || config.AUTO_SEARCH_KEYWORDS || "").trim();
  let targetRoles = [];
  if (customKw) {
    targetRoles = customKw
      .split(/[|,;]+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 1);
  }
  if (!targetRoles.length) {
    targetRoles = derived.roles && derived.roles.length ? derived.roles.slice(0, 3) : [derived.primaryKeyword];
  }

  const effectiveLocation = location || config.AUTO_SEARCH_LOCATION || derived.location;

  const stamp = new Date().toLocaleString();
  log(`\n======================================================`);
  log(`🤖 [${stamp}] Starting Automated Job Discovery Cycle`);
  log(`👤 Candidate: ${resume.basics?.name || "Active Profile"}`);
  log(`🔍 Target Roles: ${targetRoles.map((r) => `"${r}"`).join(", ")} in "${effectiveLocation}"`);
  log(`📡 Source: ${source === "careers" ? "Official Company ATS Pages (Greenhouse, Lever, Ashby, Workable)" : source}`);
  log(`🎯 Min Match Threshold: ${minMatchPct}% | Auto-Apply: ${autoApply ? (autoSubmit ? "Active (Auto-Submit)" : "Active (Auto-Fill & Review)") : "Disabled"}`);
  log(`======================================================`);

  const seenJobs = loadSeenJobs();

  // 1. Search across requested platforms for each candidate role
  log(`Fetching recent postings via source: ${source}...`);
  const foundJobs = [];
  const seenUrls = new Set();
  for (const role of targetRoles) {
    log(`  🔎 Searching for: "${role}"...`);
    const batch = await searchJobs({
      keywords: role,
      location: effectiveLocation,
      source,
      limit: Math.max(10, maxJobs * 2),
    });
    for (const j of batch) {
      if (j.link && !seenUrls.has(j.link)) {
        seenUrls.add(j.link);
        foundJobs.push(j);
      }
    }
  }

  const newJobs = foundJobs.filter((j) => !seenJobs.has(j.link) && !seenJobs.has(j.id));
  log(`Found ${foundJobs.length} total postings across target roles (${newJobs.length} are new unseen).`);

  if (newJobs.length === 0) {
    log(`No new unseen jobs found this cycle. Will check again next run.`);
    return { searched: foundJobs.length, newJobs: 0, tailored: 0, applied: 0 };
  }

  let tailoredCount = 0;
  let appliedCount = 0;
  let processedCount = 0;

  try {
    for (const job of newJobs) {
      if (processedCount >= maxJobs) break;
    processedCount++;

    // Mark as seen immediately to avoid processing twice
    seenJobs.add(job.link || job.id);

    log(`\n[${processedCount}/${Math.min(newJobs.length, maxJobs)}] Checking: ${job.title} @ ${job.company} (${job.source})`);

    // Fetch full JD text
    let jdText = job.description || "";
    if (!jdText || jdText.length < 250) {
      try {
        if (job.source === "LinkedIn") {
          const fetched = await fetchLinkedInJd(job.link || job.id);
          jdText = fetched.description;
        } else if (job.link) {
          jdText = await fetchJd(job.link);
        }
      } catch (err) {
        log(`  ⚠️ Could not fetch full JD: ${err.message}. Using available snippet.`);
      }
    }

    if (!jdText || jdText.length < 100) {
      log(`  ⏭️ Skipped: Insufficient job description text.`);
      continue;
    }

    // Evaluate match score before tailoring
    try {
      const analysis = await analyzeJob(jdText);
      const coverage = skillCoverage(resume, analysis);
      const matchPct = coverage.required_match_pct;

      log(`  📊 Required Skills Match: ${matchPct}% (Threshold: ${minMatchPct}%)`);

      if (matchPct >= minMatchPct) {
        log(`  🎯 High match! Generating tailored resume and cover letter...`);
        const result = await run(jdText, {
          jobUrl: job.link,
          withCoverLetter: true,
          log: (msg) => log(`    ${msg}`),
        });
        tailoredCount++;
        log(`  ✅ Tailored & Tracked! PDF: ${result.resumePdfName}`);

        if (autoApply && job.link) {
          log(`  🚀 Auto-Apply Active: Launching intelligent browser form assistant...`);
          try {
            const pdfFullPath = path.resolve(result.dir, result.resumePdfName);
            const fillRes = await autoFillApplication({
              applyUrl: job.link,
              jobTitle: job.title,
              companyName: job.company,
              resumePdfPath: pdfFullPath,
              headless: headlessApply,
              autoSubmit: autoSubmit,
              log: (m) => log(`    ${m}`),
            });
            if (fillRes && fillRes.success) {
              appliedCount++;
              const finalStatus = autoSubmit ? "Submitted via Assistant" : "Auto-Filled (Ready to Submit)";
              updateApplicationStatus(job.link, finalStatus);
              log(`  ✨ Application form pre-filled and logged (${finalStatus})!`);
            } else {
              const statusMsg = fillRes?.reason || fillRes?.message || "Redirect Pending (Login Required)";
              updateApplicationStatus(job.link, statusMsg);
              log(`  ⚠️ Application not completed (${statusMsg}).`);
            }
          } catch (applyErr) {
            log(`  ⚠️ Auto-apply warning: ${applyErr.message}`);
          }
        }
      } else {
        log(`  ❌ Skipped: Match score below threshold (${matchPct}% < ${minMatchPct}%).`);
      }
    } catch (err) {
      log(`  ⚠️ Error processing job: ${err.message}`);
    }
  }

  } finally {
    saveSeenJobs(seenJobs);
    await closeSharedBrowser().catch(() => {});
  }

  log(`\n======================================================`);
  log(`🏁 Cycle finished: ${tailoredCount} tailored, ${appliedCount} auto-filled & logged.`);
  log(`======================================================\n`);

  return { searched: foundJobs.length, newJobs: newJobs.length, tailored: tailoredCount, applied: appliedCount };
}
