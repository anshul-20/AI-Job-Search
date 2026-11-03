import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { loadResume } from "./resumeIO.js";
import { analyzeJob, skillCoverage } from "./analyzer.js";
import { proposeTailoring } from "./tailor.js";
import { applyProposal } from "./guard.js";
import { generateCoverLetter } from "./coverLetter.js";
import { renderHtml, renderCoverLetterHtml, renderPdf } from "./renderer.js";
import { logApplication } from "./tracker.js";

const slug = (s) =>
  String(s ?? "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "Unknown";

const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

function buildReport({ analysis, coverage, proposal, warnings, coverPitch }) {
  const list = (a) => (a.length ? a.map((x) => `- ${x}`).join("\n") : "- none");
  return `# ${analysis.job_title} @ ${analysis.company ?? "Unknown company"}

- Seniority: ${analysis.seniority}
- Experience asked: ${analysis.years_experience ?? "not stated"}
- Match Percentage: **${coverage.required_match_pct}%**

## Cover Letter Pitch
> ${coverPitch || "Tailored application generated."}

## Required skills matched (${coverage.required_match_pct}%)
${list(coverage.required_matched)}

## Required skills missing
Add them to resume.json if you genuinely have them.
${list(coverage.required_missing)}

## Nice-to-haves missing
${list(coverage.nice_missing)}

## Model notes
${proposal.notes || "none"}

## Guard warnings
${list(warnings)}
`;
}

export async function run(
  jdText,
  {
    resumePath,
    outDir,
    client,
    jobUrl = "",
    withCoverLetter = true,
    log = console.log,
  } = {},
) {
  log("[1/5] Loading resume and analysing job description...");
  const resume = loadResume(resumePath ?? config.RESUME_PATH);
  const analysis = await analyzeJob(jdText, { client });
  const coverage = skillCoverage(resume, analysis);

  log("[2/5] Proposing tailoring...");
  const { proposal, raw } = await proposeTailoring(resume, analysis, { client });

  log("[3/5] Applying guard (select/reorder/rephrase only)...");
  const { final, warnings } = applyProposal(resume, proposal);

  const runId = `${stamp()}_${slug(analysis.company)}_${slug(analysis.job_title)}`;
  const dir = path.resolve(outDir ?? config.OUTPUT_DIR, runId);
  fs.mkdirSync(dir, { recursive: true });

  log("[4/5] Rendering ATS Resume PDF...");
  const resumeHtml = renderHtml(final);
  const resumePdfName = `${slug(final.basics.name)}_${slug(analysis.company)}_Resume.pdf`;
  const resumePdfPath = path.join(dir, resumePdfName);
  await renderPdf(resumeHtml, resumePdfPath);

  let coverLetterPdfName = "";
  let coverLetterPdfPath = "";
  let coverLetterData = null;

  if (withCoverLetter) {
    log("[5/5] Drafting & rendering Cover Letter PDF...");
    coverLetterData = await generateCoverLetter(resume, analysis, { client });
    const coverHtml = renderCoverLetterHtml({
      resume: final,
      company: analysis.company || "Hiring Company",
      role: analysis.job_title,
      paragraphs: coverLetterData.paragraphs,
    });
    coverLetterPdfName = `${slug(final.basics.name)}_${slug(analysis.company)}_CoverLetter.pdf`;
    coverLetterPdfPath = path.join(dir, coverLetterPdfName);
    await renderPdf(coverHtml, coverLetterPdfPath);

    fs.writeFileSync(path.join(dir, "cover_letter.html"), coverHtml);
    fs.writeFileSync(path.join(dir, "cover_letter.json"), JSON.stringify(coverLetterData, null, 2));
  } else {
    log("[5/5] Skipped cover letter generation (--no-cover).");
  }

  const w = (name, data) => fs.writeFileSync(path.join(dir, name), data);
  w("resume.html", resumeHtml);
  w("job_description.txt", jdText);
  w("analysis.json", JSON.stringify({ analysis, coverage }, null, 2));
  w("tailored_resume.json", JSON.stringify(final, null, 2));
  w("model_proposal.json", JSON.stringify(raw, null, 2));
  w(
    "report.md",
    buildReport({
      analysis,
      coverage,
      proposal,
      warnings,
      coverPitch: coverLetterData?.summary_pitch,
    }),
  );

  // Automatically log to CSV tracker
  logApplication({
    company: analysis.company || "Unknown Company",
    role: analysis.job_title || "Unknown Role",
    matchPct: coverage.required_match_pct,
    status: "Drafted",
    resumePdf: path.relative(process.cwd(), resumePdfPath),
    coverLetterPdf: coverLetterPdfPath ? path.relative(process.cwd(), coverLetterPdfPath) : "",
    jobUrl,
    notes: `Missing: ${coverage.required_missing.slice(0, 3).join(", ") || "None"}`,
  });

  return {
    runId,
    dir,
    resumePdfName,
    pdfName: resumePdfName,
    coverLetterPdfName,
    analysis,
    coverage,
    warnings,
    notes: proposal.notes,
    resume: final,
  };
}
