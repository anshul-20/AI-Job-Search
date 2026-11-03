import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { config } from "./config.js";
import { loadResume } from "./resumeIO.js";
import { analyzeJob, skillCoverage } from "./analyzer.js";
import { run } from "./pipeline.js";
import { fetchJd } from "./jdFetch.js";
import { renderHtml, renderPdf, closeBrowser } from "./renderer.js";
import { searchJobs, deriveSearchTermsFromResume } from "./jobSearch.js";
import { extractTextFromBuffer, parseRawResumeToSchema } from "./resumeParser.js";
import { autoFillApplication, loginToLinkedIn } from "./formFiller.js";
import { runAutoCycle } from "./autoRunner.js";

async function readStdin() {
  if (process.stdin.isTTY) console.error("Paste the job description, then press Ctrl-D:");
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function getJd(opts) {
  if (opts.jdFile) return fs.readFileSync(opts.jdFile, "utf8");
  if (opts.jd) return opts.jd;
  if (opts.url) return fetchJd(opts.url);
  return readStdin();
}

const withJdOptions = (cmd) =>
  cmd
    .option("--jd-file <path>", "read the job description from a file")
    .option("--jd <text>", "job description text")
    .option("--url <url>", "fetch the job description from a URL (best effort)");

const program = new Command().name("resume-tailor");

withJdOptions(
  program
    .command("tailor")
    .description("Tailor resume and cover letter to a job description")
    .option("--no-cover", "skip cover letter generation"),
).action(async (opts) => {
  const jdText = await getJd(opts);
  const result = await run(jdText, {
    jobUrl: opts.url || "",
    withCoverLetter: opts.cover !== false,
  });

  console.log(`\n========================================`);
  console.log(`✨ Run Complete: ${result.runId}`);
  console.log(`📄 Resume PDF:       ${path.join(result.dir, result.resumePdfName)}`);
  if (result.coverLetterPdfName) {
    console.log(`✉️  Cover Letter PDF: ${path.join(result.dir, result.coverLetterPdfName)}`);
  }
  console.log(`📊 Report:           ${path.join(result.dir, "report.md")}`);
  console.log(`🎯 Match Score:      ${result.coverage.required_match_pct}%`);
  console.log(`📋 Logged into:      job_search_tracker.csv`);
  if (result.warnings.length) {
    console.log(`⚠️  Guard warnings:   ${result.warnings.length} (see report.md)`);
  }
  console.log(`========================================\n`);
});

withJdOptions(
  program
    .command("analyze")
    .description("Analyse a job description against the resume"),
).action(async (opts) => {
  const analysis = await analyzeJob(await getJd(opts));
  const coverage = skillCoverage(loadResume(), analysis);
  console.log(JSON.stringify({ analysis, coverage }, null, 2));
});

program
  .command("render")
  .description("Render the base resume to PDF (no LLM call)")
  .option("--out <path>", "output PDF path", path.join(config.OUTPUT_DIR, "base_resume.pdf"))
  .action(async (opts) => {
    await renderPdf(renderHtml(loadResume()), path.resolve(opts.out));
    console.log(`Wrote ${opts.out}`);
  });

program
  .command("search")
  .description("Search public job postings (LinkedIn, Indeed, Naukri, RemoteOK, Career Pages, or all)")
  .option("-k, --keywords <query>", "job title or skills (defaults to your resume title)")
  .option("-l, --location <city>", "location or country (defaults to your resume location)")
  .option("-n, --limit <number>", "max number of jobs to fetch", "10")
  .option("--source <source>", "source: linkedin, indeed, naukri, remoteok, careers, or all", "all")
  .action(async (opts) => {
    const resume = loadResume(config.RESUME_PATH);
    const derived = deriveSearchTermsFromResume(resume);
    const keywords = opts.keywords || derived.primaryKeyword;
    const location = opts.location || derived.location;

    console.log(`Searching for "${keywords}" in "${location}" via ${opts.source}...`);
    try {
      const jobs = await searchJobs({
        keywords,
        location,
        source: opts.source,
        limit: parseInt(opts.limit, 10),
      });

      if (!jobs.length) {
        console.log("No jobs found matching your criteria.");
        return;
      }

      console.log(`\nFound ${jobs.length} postings:\n`);
      jobs.forEach((j, i) => {
        console.log(`[${i + 1}] ${j.title} @ ${j.company} (${j.source})`);
        console.log(`    📍 Location: ${j.location}`);
        if (j.experience) console.log(`    💼 Exp:      ${j.experience}`);
        console.log(`    🔗 Link:     ${j.link}`);
        console.log("");
      });
      console.log(`Tip: To tailor your resume & cover letter for any of these, run:`);
      console.log(`  npm run tailor -- --url "<link>"`);
    } catch (err) {
      console.error(`Search error: ${err.message}`);
    }
  });

program
  .command("tracker")
  .description("View the application tracker spreadsheet summary")
  .action(() => {
    const trackerPath = path.resolve("job_search_tracker.csv");
    if (!fs.existsSync(trackerPath)) {
      console.log("No job applications tracked yet (job_search_tracker.csv does not exist).");
      return;
    }
    const content = fs.readFileSync(trackerPath, "utf8").trim().split("\n");
    console.log(`\n📋 Application Tracker (${content.length - 1} entries):\n`);
    content.forEach((line, idx) => {
      if (idx === 0) {
        console.log(`\x1b[1m${line}\x1b[0m`);
      } else {
        console.log(line);
      }
    });
    console.log("");
  });

program
  .command("import")
  .description("Upload/import any resume (PDF, Word text, JSON) and parse it into your candidate profile")
  .argument("<file>", "path to your resume file (.pdf, .json, .txt)")
  .option("--out <path>", "destination json path", config.RESUME_PATH)
  .option("--auto", "immediately run autonomous search and apply pipeline after import")
  .action(async (file, opts) => {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      return;
    }
    console.log(`Reading and extracting text from: ${path.basename(fullPath)}...`);
    const buffer = fs.readFileSync(fullPath);
    const extracted = await extractTextFromBuffer(buffer, path.basename(fullPath));

    let structuredResume;
    if (extracted.isStructuredJson) {
      console.log(`File is already structured resume JSON. Validating...`);
      structuredResume = extracted.data;
    } else {
      console.log(`Parsing unstructured resume with AI parser into canonical schema...`);
      structuredResume = await parseRawResumeToSchema(extracted.rawText);
    }

    // Save backup if destination exists
    const dest = path.resolve(opts.out);
    if (fs.existsSync(dest)) {
      const backupPath = dest.replace(/\.json$/, ".backup.json");
      fs.copyFileSync(dest, backupPath);
      console.log(`Backed up previous resume to: ${path.relative(process.cwd(), backupPath)}`);
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(structuredResume, null, 2), "utf8");

    console.log(`\n========================================`);
    console.log(`✅ Resume successfully imported & activated!`);
    console.log(`👤 Name:     ${structuredResume.basics.name}`);
    console.log(`💼 Title:    ${structuredResume.basics.title}`);
    console.log(`📍 Location: ${structuredResume.basics.location}`);
    console.log(`🛠️  Skills:   ${structuredResume.skills.map((s) => s.category).join(", ")}`);
    console.log(
      `🏢 Roles:    ${structuredResume.experience.length} experiences with ${structuredResume.experience.reduce(
        (acc, e) => acc + e.bullets.length,
        0,
      )} bullets`,
    );
    console.log(`📁 Saved to: ${path.relative(process.cwd(), dest)}`);
    console.log(`========================================\n`);

    if (opts.auto) {
      console.log(`🚀 Auto mode activated! Launching autonomous job search and application pipeline...\n`);
      await runAutoCycle();
    }
  });

program
  .command("apply")
  .description("Automatically open an external job link, tailor resume, attach PDF, and fill required fields")
  .requiredOption("--url <url>", "direct application or job portal URL")
  .option("--resume-pdf <path>", "optional specific tailored resume PDF to upload")
  .option("--auto-submit", "automatically click final submit button (defaults to human-in-the-loop review)")
  .option("--headless", "run browser in background without showing window")
  .action(async (opts) => {
    let pdfPath = opts.resumePdf;

    // If no PDF supplied, tailor one right now for this job
    if (!pdfPath) {
      console.log(`Tailoring fresh resume & cover letter for this position first...`);
      try {
        const result = await run(await getJd({ url: opts.url }), {
          jobUrl: opts.url,
          withCoverLetter: true,
          log: (m) => console.log(`  ${m}`),
        });
        pdfPath = path.join(result.dir, result.resumePdfName);
        console.log(`Generated tailored PDF: ${pdfPath}`);
      } catch (err) {
        console.log(`Could not pre-fetch JD text (${err.message}). Proceeding directly to fill form.`);
      }
    }

    await autoFillApplication({
      applyUrl: opts.url,
      resumePdfPath: pdfPath,
      headless: opts.headless || false,
      autoSubmit: opts.autoSubmit || false,
    });
  });

program
  .command("login")
  .description("Launch Chrome to sign in to LinkedIn (saves session permanently in data/browser_profile)")
  .action(async () => {
    await loginToLinkedIn();
  });

try {
  await program.parseAsync();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser();
}
