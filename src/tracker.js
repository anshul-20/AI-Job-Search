import fs from "node:fs";
import path from "node:path";

const DEFAULT_TRACKER_PATH = "job_search_tracker.csv";

const HEADERS = [
  "Date",
  "Company",
  "Role",
  "Match %",
  "Status",
  "Resume PDF",
  "Cover Letter PDF",
  "Job URL",
  "Notes",
];

function escapeCsv(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

export function logApplication({
  date = new Date().toISOString().split("T")[0],
  company,
  role,
  matchPct = 0,
  status = "Drafted",
  resumePdf = "",
  coverLetterPdf = "",
  jobUrl = "",
  notes = "",
  trackerPath = DEFAULT_TRACKER_PATH,
}) {
  const filePath = path.resolve(trackerPath);
  const fileExists = fs.existsSync(filePath);

  const row = [
    date,
    company,
    role,
    `${matchPct}%`,
    status,
    resumePdf,
    coverLetterPdf,
    jobUrl,
    notes,
  ].map(escapeCsv).join(",");

  if (!fileExists) {
    fs.writeFileSync(filePath, HEADERS.map(escapeCsv).join(",") + "\n" + row + "\n", "utf8");
  } else {
    fs.appendFileSync(filePath, row + "\n", "utf8");
  }

  return filePath;
}

export function getTrackerRecords(trackerPath = DEFAULT_TRACKER_PATH) {
  const filePath = path.resolve(trackerPath);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return [];
  const lines = content.split("\n");
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = [];
    let insideQuote = false;
    let currentVal = "";
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' && line[c + 1] === '"') {
        currentVal += '"';
        c++;
      } else if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        values.push(currentVal);
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal);

    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || "";
    });
    records.push(record);
  }
  return records;
}

export function updateApplicationStatus(jobUrl, newStatus, trackerPath = DEFAULT_TRACKER_PATH, extra = {}) {
  const filePath = path.resolve(trackerPath);
  if (!fs.existsSync(filePath)) {
    logApplication({
      jobUrl,
      status: newStatus,
      company: extra.company || "Company",
      role: extra.role || extra.title || "Target Role",
      matchPct: extra.matchPct || 80,
      resumePdf: extra.resumePdf || "",
      coverLetterPdf: extra.coverLetterPdf || "",
      trackerPath,
    });
    return true;
  }
  const records = getTrackerRecords(trackerPath);
  let updated = false;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i]["Job URL"] === jobUrl || (jobUrl && records[i]["Job URL"].includes(jobUrl))) {
      records[i]["Status"] = newStatus;
      if (extra.company && (!records[i]["Company"] || records[i]["Company"] === "Company")) records[i]["Company"] = extra.company;
      if (extra.role && (!records[i]["Role"] || records[i]["Role"] === "Role" || records[i]["Role"] === "Target Role")) records[i]["Role"] = extra.role;
      updated = true;
      break;
    }
  }
  if (updated) {
    const rows = [HEADERS.map(escapeCsv).join(",")];
    for (const r of records) {
      rows.push(HEADERS.map((h) => escapeCsv(r[h] || "")).join(","));
    }
    fs.writeFileSync(filePath, rows.join("\n") + "\n", "utf8");
  } else {
    logApplication({
      jobUrl,
      status: newStatus,
      company: extra.company || "Company",
      role: extra.role || extra.title || "Target Role",
      matchPct: extra.matchPct || 80,
      resumePdf: extra.resumePdf || "",
      coverLetterPdf: extra.coverLetterPdf || "",
      trackerPath,
    });
    updated = true;
  }
  return updated;
}
