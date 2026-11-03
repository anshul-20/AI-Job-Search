import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";

const RESUME_TEMPLATE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates/resume.hbs");
const COVER_TEMPLATE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates/cover_letter.hbs");

const hbs = Handlebars.create();
hbs.registerHelper("join", (items) => (items ?? []).join(", "));
hbs.registerHelper("dates", (start, end) => [start, end || "Present"].filter(Boolean).join(" - "));

let compiledResume;
let compiledCover;

export function renderHtml(resume) {
  compiledResume ??= hbs.compile(fs.readFileSync(RESUME_TEMPLATE_PATH, "utf8"));
  const b = resume.basics;
  const contactLine = [b.location, b.phone, b.email, ...b.links.map((l) => `${l.label}: ${l.url}`)]
    .filter(Boolean)
    .join(" | ");
  return compiledResume({ ...resume, contactLine });
}

export function renderCoverLetterHtml({ resume, company, role, date, paragraphs }) {
  compiledCover ??= hbs.compile(fs.readFileSync(COVER_TEMPLATE_PATH, "utf8"));
  const b = resume.basics;
  const contactLine = [b.location, b.phone, b.email, ...b.links.map((l) => `${l.label}: ${l.url}`)]
    .filter(Boolean)
    .join(" | ");
  const formattedDate = date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return compiledCover({ basics: b, contactLine, company, role, date: formattedDate, paragraphs });
}

let browserPromise;

const SYSTEM_CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  // macOS & Linux
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

async function launch() {
  try {
    return await puppeteer.launch({ headless: true });
  } catch (err) {
    // bundled Chrome missing: fall back to an installed one
    const exe = SYSTEM_CHROME.find((p) => fs.existsSync(p));
    if (!exe) {
      throw new Error(
        `Could not launch Chrome (${err.message.split("\n")[0]}). Run "npx puppeteer browsers install chrome" or set PUPPETEER_EXECUTABLE_PATH.`,
      );
    }
    return puppeteer.launch({ headless: true, executablePath: exe });
  }
}

function getBrowser() {
  browserPromise ??= launch();
  return browserPromise;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const p = browserPromise;
  browserPromise = undefined;
  try {
    await (await p).close();
  } catch {
    /* already closed */
  }
}

let hooked = false;
function hookExit() {
  if (hooked) return;
  hooked = true;
  const shutdown = () => closeBrowser().finally(() => process.exit());
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  process.once("beforeExit", () => void closeBrowser());
}

export async function renderPdf(html, outPath) {
  hookExit();
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, pdf);
    return outPath;
  } finally {
    await page.close();
  }
}
