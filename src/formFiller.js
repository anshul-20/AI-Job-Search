import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { chatJson } from "./llm.js";
import { loadResume } from "./resumeIO.js";
import { config } from "./config.js";
import { resolveDirectAtsUrl } from "./jobSearch.js";

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

/**
 * Validates whether a URL is a legitimate company application portal,
 * strictly excluding LinkedIn, about:blank, Chrome internal pages, and identity/OAuth providers.
 */
export function isEligibleJobPortalUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.toLowerCase().trim();
  if (
    u === "about:blank" ||
    u.startsWith("chrome://") ||
    u.startsWith("chrome-extension://") ||
    u.startsWith("edge://")
  ) {
    return false;
  }
  if (u.includes("linkedin.com")) {
    return false;
  }
  // Exclude OAuth, identity providers, and browser account sync flows
  const blockedAuthHosts = [
    "accounts.google.com",
    "google.com/signin",
    "appleid.apple.com",
    "login.microsoftonline.com",
    "login.live.com",
    "github.com/login",
  ];
  if (blockedAuthHosts.some((host) => u.includes(host))) {
    return false;
  }
  return u.startsWith("http://") || u.startsWith("https://");
}

let activeBrowser = null;

export async function getOrLaunchBrowser(headless = false) {
  if (activeBrowser && activeBrowser.isConnected()) {
    return activeBrowser;
  }

  // 1. If user already has Chrome running with remote debugging (Port 9222), connect directly!
  try {
    const res = await fetch("http://127.0.0.1:9222/json/version", { signal: AbortSignal.timeout(600) });
    if (res.ok) {
      console.log(`✨ Connected to your active signed-in Chrome session (Port 9222)!`);
      activeBrowser = await puppeteer.connect({
        browserURL: "http://127.0.0.1:9222",
        defaultViewport: null,
      });
      return activeBrowser;
    }
  } catch {}

  const userDataDir = path.resolve("data/browser_profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  const commonArgs = [
    "--start-maximized",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-features=Translate,OptimizationHints,MediaRouter",
    "--disable-component-update",
    "--password-store=basic",
  ];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless,
      userDataDir,
      defaultViewport: null,
      args: commonArgs,
    });
  } catch (err) {
    if (err.message && err.message.includes("already running")) {
      // Clean up orphaned processes holding data/browser_profile lock if any
      try {
        if (process.platform === "win32") {
          const { execSync } = await import("node:child_process");
          execSync(
            'powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = \'chrome.exe\'\\" | Where-Object { $_.CommandLine -like \\"*browser_profile*\\" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"',
            { stdio: "ignore" }
          );
          await new Promise((r) => setTimeout(r, 1200));
        }
      } catch {}

      try {
        browser = await puppeteer.launch({
          headless,
          userDataDir,
          defaultViewport: null,
          args: commonArgs,
        });
      } catch {
        // Fallback to fresh session profile directory
        const fallbackDir = path.resolve(`data/browser_profile_session_${Date.now()}`);
        fs.mkdirSync(fallbackDir, { recursive: true });
        browser = await puppeteer.launch({
          headless,
          userDataDir: fallbackDir,
          defaultViewport: null,
          args: commonArgs,
        });
      }
    } else {
      const exe = SYSTEM_CHROME.find((p) => fs.existsSync(p));
      if (!exe) {
        throw new Error(`Could not find an installed Chrome/Edge browser. Set PUPPETEER_EXECUTABLE_PATH.`);
      }
      browser = await puppeteer.launch({
        headless,
        executablePath: exe,
        userDataDir,
        defaultViewport: null,
        args: commonArgs,
      });
    }
  }

  // Clean initial tabs: close any unexpected sync or welcome tabs
  try {
    const pages = await browser.pages();
    for (const p of pages) {
      const u = p.url().toLowerCase();
      if (
        u.includes("accounts.google.com") ||
        u.includes("chrome://") ||
        u.includes("chrome-extension://")
      ) {
        await p.close().catch(() => {});
      }
    }
  } catch {}

  activeBrowser = browser;
  return browser;
}

export async function closeSharedBrowser() {
  if (activeBrowser && activeBrowser.isConnected()) {
    try {
      await activeBrowser.close();
    } catch {}
    activeBrowser = null;
  }
}

/**
 * Interactive helper that opens Chrome directly to LinkedIn login,
 * allowing the user to sign in once so all future runs are authenticated.
 */
export async function loginToLinkedIn({ log = console.log, timeoutMs = 150_000 } = {}) {
  const browser = await getOrLaunchBrowser(false);
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  log(`Navigating to LinkedIn login page...`);
  await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2", timeout: 45_000 });
  await page.bringToFront();

  log(`\n======================================================`);
  log(`🔑 [LINKEDIN SIGN-IN WINDOW OPENED]`);
  log(`Please enter your LinkedIn credentials in the Chrome window.`);
  log(`Your login session will be permanently saved in data/browser_profile.`);
  log(`Once logged in, all automated applications will run fully authenticated!`);
  log(`⏳ Waiting for sign-in confirmation (up to 2.5 minutes)...`);
  log(`======================================================\n`);

  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const u = page.url().toLowerCase();
      const cookies = await page.cookies("https://www.linkedin.com");
      const hasAuthCookie = cookies.some((c) => c.name === "li_at" || c.name === "liap");
      if (hasAuthCookie || u.includes("/feed") || u.includes("/mynetwork") || u.includes("/jobs/collections")) {
        log(`🎉 Successfully authenticated with LinkedIn! Session saved.`);
        return { success: true, message: "Signed in to LinkedIn successfully" };
      }
    } catch {}
  }

  log(`⚠️ Sign-in window timed out.`);
  return { success: false, message: "Sign-in timed out" };
}

/**
 * Checks if the user is authenticated with LinkedIn via port 9222 or saved cookies in data/browser_profile.
 */
export async function checkLinkedInAuth() {
  try {
    try {
      const res = await fetch("http://127.0.0.1:9222/json/version", { signal: AbortSignal.timeout(600) });
      if (res.ok) {
        return {
          connected: true,
          mode: "remote_debugging",
          loggedIn: true,
          message: "Connected to your primary Chrome browser (Port 9222)",
        };
      }
    } catch {}

    const userDataDir = path.resolve("data/browser_profile");
    if (!fs.existsSync(userDataDir)) {
      return { connected: false, loggedIn: false, message: "Not signed in yet" };
    }

    const browser = await getOrLaunchBrowser(true).catch(() => null);
    if (!browser) {
      return { connected: false, loggedIn: false, message: "Browser profile idle" };
    }

    const pages = await browser.pages();
    const testPage = pages.length > 0 ? pages[0] : await browser.newPage();
    const cookies = await testPage.cookies("https://www.linkedin.com");
    const hasAuthCookie = cookies.some((c) => c.name === "li_at" || c.name === "liap");
    return {
      connected: true,
      mode: "local_profile",
      loggedIn: hasAuthCookie,
      message: hasAuthCookie ? "Signed in to LinkedIn (Profile active)" : "Not signed in to LinkedIn yet",
    };
  } catch (err) {
    return { connected: false, loggedIn: false, error: err.message };
  }
}

const FORM_ANALYZER_PROMPT = `You are an automated job application form assistant.
Your task is to analyze HTML form fields and map the candidate's real profile data into exact values to fill or select.

RULES:
1. Ground personal information (name, email, phone, location, links, company, title) in the candidate's real profile.
2. For common screening questions:
   - Work authorization / Legal eligibility: Usually "Yes" or true (unless specified otherwise).
   - Visa sponsorship required: Usually "No" or false.
   - Notice period: Use candidate's setting or standard (e.g. "30 days" or "Immediate").
   - Years of experience: Calculate or use the total years from the resume.
3. If a question is free-form (e.g. "Why do you want to join?"), provide a concise, compelling 2-sentence answer using the candidate's core strengths.
4. Return ONLY a JSON object mapping each identifiable field's selector (name, id, or selector) to its target value.

Reply with ONLY a JSON object formatted as:
{
  "fields": [
    {
      "selector": "input name or id",
      "type": "text | email | tel | textarea | select | radio | checkbox",
      "value": "exact string value to type or option text to choose",
      "label": "inferred question label"
    }
  ],
  "reasoning_notes": "Short summary of how screening questions were answered"
}`;

/**
 * Reasons over detected form fields using LLM and candidate profile data.
 * Can be called by Puppeteer or the Chrome Extension backend API.
 */
export async function reasonFormFields({ formInputs, resume, jdText = "" }) {
  const candidateContext = {
    basics: resume.basics,
    skills: (resume.skills || []).flatMap((s) => s.items).slice(0, 15),
    total_experience_years: resume.experience?.length ? resume.experience.length * 2 : 3,
    current_title: resume.basics?.title,
    summary: resume.basics?.summary,
    notice_period: "30 days",
    authorized_to_work: true,
    requires_sponsorship: false,
    job_context: jdText ? jdText.slice(0, 500) : undefined,
  };

  const prompt = `CANDIDATE PROFILE:\n${JSON.stringify(candidateContext, null, 2)}\n\nDETECTED FORM INPUTS:\n${JSON.stringify(formInputs, null, 2)}`;
  return await chatJson(FORM_ANALYZER_PROMPT, prompt);
}

/**
 * Automatically inspects, reasons, and fills application forms on external ATS portals.
 * Handles LinkedIn job postings with outbound redirects to company career portals.
 */
export async function autoFillApplication({
  applyUrl,
  jobTitle = "",
  companyName = "",
  resumePath = config.RESUME_PATH,
  resumePdfPath = null,
  headless = false,
  autoSubmit = false,
  log = console.log,
} = {}) {
  log(`\n======================================================`);
  log(`🤖 Starting Intelligent Application Form Assistant`);
  log(`🔗 Target URL: ${applyUrl}`);
  if (jobTitle || companyName) {
    log(`💼 Target Role: ${jobTitle} @ ${companyName}`);
  }
  log(`======================================================`);

  const resume = loadResume(resumePath);
  const browser = await getOrLaunchBrowser(headless);
  
  const existingPages = await browser.pages();
  let activePage;
  if (existingPages.length === 1 && existingPages[0].url() === "about:blank") {
    activePage = existingPages[0];
  } else {
    activePage = await browser.newPage();
  }
  await activePage.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  try {
    log(`Navigating to initial job portal: ${applyUrl}...`);
    await activePage.goto(applyUrl, { waitUntil: "networkidle2", timeout: 45_000 });

    // Handle LinkedIn Job Postings & Outbound External Apply Redirection
    const isLinkedIn = /linkedin\.com\/jobs\//i.test(activePage.url()) || /linkedin\.com\/jobs\//i.test(applyUrl);
    if (isLinkedIn) {
      log(`🔎 Detected LinkedIn job posting. Resolving external company application portal...`);

      // 1. Dismiss sign-in popup/overlay if present
      try {
        const dismissBtn = await activePage.$(
          '.modal__dismiss, [data-tracking-control-name*="modal_dismiss"], .contextual-sign-in-modal__modal-dismiss'
        );
        if (dismissBtn) {
          await dismissBtn.click();
          await new Promise((r) => setTimeout(r, 600));
        }
      } catch {}

      // 2. Setup listener for any new tab/window opened on clicking Apply
      const newPagePromise = new Promise((resolve) => {
        const handler = async (target) => {
          if (target.type() === "page") {
            const p = await target.page();
            if (p) {
              browser.off("targetcreated", handler);
              resolve(p);
            }
          }
        };
        browser.on("targetcreated", handler);
        setTimeout(() => {
          browser.off("targetcreated", handler);
          resolve(null);
        }, 12_000);
      });

      // 3. Look for Apply / Apply on company website button or link
      const applyElement = await activePage.$(
        'a.apply-button, button.apply-button, button.jobs-apply-button, a.jobs-apply-button, [data-tracking-control-name*="apply-link-offsite"], .top-card-layout__cta--primary, button[data-tracking-control-name*="apply"], a[data-tracking-control-name*="apply"]'
      );

      let followed = false;
      if (applyElement) {
        const directHref = await activePage.evaluate((el) => {
          const h = el.getAttribute("href") || el.getAttribute("data-apply-url") || "";
          if (
            h &&
            !h.includes("linkedin.com") &&
            !h.startsWith("#") &&
            !h.startsWith("javascript") &&
            h.startsWith("http")
          ) {
            return h;
          }
          return null;
        }, applyElement);

        if (directHref) {
          log(`🔗 Found direct outbound external apply link: ${directHref}`);
          await activePage.goto(directHref, { waitUntil: "networkidle2", timeout: 45_000 });
          followed = true;
        } else {
          log(`🖱️ Clicking LinkedIn "Apply" button to follow company career site redirect...`);
          try {
            await applyElement.click();
            followed = true;
          } catch (clickErr) {
            log(`  Could not click apply element: ${clickErr.message}`);
          }
        }
      }

      if (followed) {
        const openedPage = await newPagePromise;
        if (openedPage) {
          activePage = openedPage;
          // Wait if tab opened at about:blank while redirect is resolving
          if (activePage.url() === "about:blank") {
            try {
              await activePage.waitForFunction(
                () => window.location.href !== "about:blank" && window.location.href.startsWith("http"),
                { timeout: 15_000 }
              );
            } catch {}
          }
          log(`🔀 Switched to external company application window: ${activePage.url()}`);
          try {
            await activePage.waitForNavigation({ waitUntil: "networkidle2", timeout: 20_000 }).catch(() => {});
          } catch {}
        } else {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // 4. Check if any tab/window already opened an eligible company job portal
      const currentPages = await browser.pages();
      const companyTab = currentPages.find((p) => isEligibleJobPortalUrl(p.url()));
      if (companyTab) {
        activePage = companyTab;
        await activePage.bringToFront();
        log(`🔀 Detected company application tab: ${activePage.url()}`);
      }

      // 5. If we are STILL not on an eligible company portal
      if (!isEligibleJobPortalUrl(activePage.url())) {
        // Extract title and company from page DOM if not already supplied
        let targetTitle = jobTitle;
        let targetCompany = companyName;
        if (!targetTitle || !targetCompany) {
          const meta = await activePage.evaluate(() => {
            const t =
              document.querySelector("h1")?.innerText ||
              document.querySelector("h2.top-card-layout__title")?.innerText ||
              document.querySelector(".topcard__title")?.innerText ||
              "";
            const c =
              document.querySelector("a.topcard__org-name-link")?.innerText ||
              document.querySelector(".topcard__flavor")?.innerText ||
              "";
            return { title: t.trim(), company: c.trim() };
          });
          targetTitle = targetTitle || meta.title;
          targetCompany = targetCompany || meta.company;
        }

        if (targetCompany) {
          log(`🌐 Searching direct company career ATS portal for: "${targetTitle}" at "${targetCompany}"...`);
          const directAtsUrl = await resolveDirectAtsUrl(targetTitle, targetCompany);
          if (directAtsUrl) {
            log(`🎯 Successfully located official company career page: ${directAtsUrl}`);
            await activePage.goto(directAtsUrl, { waitUntil: "networkidle2", timeout: 45_000 });
          }
        }

        // If STILL not on an eligible portal, wait for human sign-in / redirect in open browser window
        if (!isEligibleJobPortalUrl(activePage.url())) {
          log(`\n======================================================`);
          log(`🔑 [ACTION REQUIRED — SIGN IN TO REDIRECT TO COMPANY SITE]`);
          log(`LinkedIn requires you to sign in to access the external company application link.`);
          log(`👉 In the open browser window: Sign in to LinkedIn (or click "Apply on company website").`);
          log(`👉 Your login is saved in data/browser_profile so you will stay signed in for future jobs.`);
          log(`⏳ Waiting for you to sign in / redirect to the company portal (up to 75s)...`);
          log(`======================================================\n`);

          const waitStart = Date.now();
          while (Date.now() - waitStart < 75_000) {
            await new Promise((r) => setTimeout(r, 1500));

            // Check if any tab has redirected to an eligible company job portal
            const pages = await browser.pages();
            const foundTab = pages.find((p) => isEligibleJobPortalUrl(p.url()));

            if (foundTab) {
              activePage = foundTab;
              await activePage.bringToFront();
              log(`🚀 Company application portal detected in new window: ${activePage.url()}`);
              break;
            }

            if (isEligibleJobPortalUrl(activePage.url())) {
              log(`🚀 Active page navigated to company application portal: ${activePage.url()}`);
              break;
            }

            // If user signed in on LinkedIn, try clicking the apply button again
            try {
              const postLoginApplyBtn = await activePage.$(
                'button.jobs-apply-button, a.jobs-apply-button, .jobs-apply-button--top-card, button[data-tracking-control-name*="apply"]'
              );
              if (postLoginApplyBtn) {
                await postLoginApplyBtn.click();
              }
            } catch {}
          }
        }
      }

      // Hard safety check: DO NOT attempt to fill form if not on a legitimate job application portal
      if (!isEligibleJobPortalUrl(activePage.url())) {
        log(`\n❌ Could not navigate to a valid external company application portal (Current URL: ${activePage.url()}).`);
        log(`💡 Please sign in to LinkedIn once in the open browser window so external company apply links can be followed.`);
        return {
          success: false,
          reason: "External company application portal not reached",
          message: "External company application portal not reached",
        };
      }
    }

    // Safety guard for all entry paths: never attempt to fill credentials or non-job pages
    if (!isEligibleJobPortalUrl(activePage.url())) {
      log(`⚠️ Active page (${activePage.url()}) is not an eligible job application portal. Aborting.`);
      return {
        success: false,
        reason: "Invalid application portal URL",
        message: "Invalid application portal URL",
      };
    }

    log(`Current active application page: ${activePage.url()}`);

    // Handle iframe forms if present (e.g., embedded Greenhouse or Lever forms)
    let targetFrame = activePage.mainFrame();
    for (const frame of activePage.frames()) {
      const url = frame.url();
      if (
        url.includes("greenhouse") ||
        url.includes("lever") ||
        url.includes("ashby") ||
        url.includes("workable") ||
        url.includes("smartrecruiters")
      ) {
        targetFrame = frame;
        log(`Detected embedded ATS iframe: ${url}`);
        break;
      }
    }

    // If company career page has an "Apply" / "Apply Now" button before showing form fields, click it
    try {
      const existingInputs = await targetFrame.$$('input:not([type="hidden"]):not([type="submit"]), textarea, select');
      if (existingInputs.length === 0) {
        const revealBtn = await targetFrame.$(
          'a[href*="#apply"], a[href*="apply"], button[class*="apply"], .btn-apply, #apply-button, a.postings-btn, [data-qa="btn-apply"], .jobs-apply-button'
        );
        if (revealBtn) {
          log(`Clicking company "Apply" button to reveal form questions...`);
          await revealBtn.click();
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch {}

    // 1. Detect & attach Resume PDF
    log(`Looking for resume upload field...`);
    let fileUploaded = false;
    if (resumePdfPath && fs.existsSync(resumePdfPath)) {
      const fileInputs = await targetFrame.$$('input[type="file"]');
      for (const input of fileInputs) {
        try {
          await input.uploadFile(path.resolve(resumePdfPath));
          fileUploaded = true;
          log(`✅ Attached tailored resume PDF: ${path.basename(resumePdfPath)}`);
          break;
        } catch (e) {
          // try next file input
        }
      }
    } else {
      log(`ℹ️ No local tailored PDF supplied or found. Skipping file upload.`);
    }

    // 2. Scan DOM for interactive form fields
    log(`Scanning interactive form fields and questions...`);
    const formInputs = await targetFrame.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("input, textarea, select"));
      return elements
        .filter((el) => {
          const type = (el.getAttribute("type") || "").toLowerCase();
          return type !== "hidden" && type !== "submit" && type !== "file";
        })
        .map((el) => {
          const id = el.id || "";
          const name = el.name || "";
          const type = el.tagName.toLowerCase() === "textarea" ? "textarea" : el.tagName.toLowerCase() === "select" ? "select" : (el.type || "text");
          const placeholder = el.placeholder || "";
          
          // Try to locate surrounding or corresponding label
          let labelText = "";
          if (id) {
            const labelEl = document.querySelector(`label[for="${id}"]`);
            if (labelEl) labelText = labelEl.innerText;
          }
          if (!labelText) {
            const parentLabel = el.closest("label");
            if (parentLabel) labelText = parentLabel.innerText;
          }
          if (!labelText) {
            // Check preceding sibling or parent container heading
            const container = el.closest(".field, .form-group, .application-question, div");
            if (container) {
              const header = container.querySelector("label, .label, h3, h4, span");
              if (header) labelText = header.innerText;
            }
          }

          // Options for select dropdowns
          const options = el.tagName.toLowerCase() === "select" 
            ? Array.from(el.options).map(o => ({ text: o.text.trim(), value: o.value })) 
            : [];

          return {
            id,
            name,
            type,
            placeholder,
            label: (labelText || placeholder || name || id).replace(/\s+/g, " ").trim(),
            options: options.slice(0, 10), // cap options for token efficiency
          };
        });
    });

    log(`Found ${formInputs.length} interactive form fields. Reasoning with AI...`);

    if (formInputs.length === 0) {
      log(`⚠️ No open form fields detected. The page might require an initial "Apply" button click.`);
      return { success: false, message: "No form fields found on page." };
    }

    // 3. LLM Form Reasoning & Value Mapping
    const mappingResponse = await reasonFormFields({ formInputs, resume });

    const filledFields = [];
    const fieldsToFill = mappingResponse.fields || [];

    // 4. Fill values into the browser form
    for (const item of fieldsToFill) {
      let selector = item.selector;
      if (!selector) {
        selector = item.name ? `[name="${item.name}"]` : item.id ? `#${item.id}` : null;
      } else if (!selector.startsWith("#") && !selector.startsWith("[") && !selector.startsWith(".")) {
        selector = `[name="${selector}"], #${selector}`;
      }
      if (!selector) continue;

      try {
        const el = await targetFrame.$(selector);
        if (!el) continue;

        if (item.type === "select") {
          // Select dropdown
          await targetFrame.select(selector, String(item.value));
          filledFields.push({ label: item.label, value: item.value });
        } else if (item.type === "checkbox" || item.type === "radio") {
          // Checkbox or radio
          if (item.value === true || item.value === "true" || item.value === "yes" || item.value === "Yes") {
            await el.click();
            filledFields.push({ label: item.label, value: "Checked" });
          }
        } else {
          // Text, email, phone, textarea
          await el.click({ clickCount: 3 }); // select any existing text
          await el.type(String(item.value), { delay: 15 });
          filledFields.push({ label: item.label, value: item.value });
        }
      } catch (err) {
        // Silently move to next field if selector is tricky
      }
    }

    log(`\n✨ Auto-Filled ${filledFields.length} Form Fields:`);
    filledFields.forEach(f => {
      log(`   ✓ ${f.label.slice(0, 35).padEnd(35)} : "${String(f.value).slice(0, 40)}"`);
    });

    if (mappingResponse.reasoning_notes) {
      log(`💡 Reasoning Notes: ${mappingResponse.reasoning_notes}`);
    }

    // 5. Submit or Human-in-the-Loop Review
    if (autoSubmit) {
      log(`\n⚡ Auto-Submit enabled. Looking for submit button...`);
      const submitBtn = await targetFrame.$('button[type="submit"], input[type="submit"], #submit_app, .btn-submit');
      if (submitBtn) {
        await submitBtn.click();
        log(`🚀 Form submitted!`);
      } else {
        log(`⚠️ Could not identify final submit button.`);
      }
    } else {
      log(`\n👀 [HUMAN-IN-THE-LOOP MODE ACTIVE]`);
      log(`The application form has been filled with your details and tailored resume!`);
      log(`Please review the browser window, answer any remaining captcha or sensitive questions, and click Submit.`);
      
      // Wait for user or keep window open
      if (!headless) {
        log(`Application form opened and filled for review. You can review and submit in the open browser window.`);
        log(`(Will keep window open for up to 45s, or press Enter / close browser window)`);
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            log(`Review window timed out (45s). Proceeding to next job...`);
            resolve();
          }, 45_000);

          browser.on("disconnected", () => {
            clearTimeout(timer);
            resolve();
          });

          if (process.stdin && process.stdin.isTTY) {
            process.stdin.once("data", () => {
              clearTimeout(timer);
              resolve();
            });
          }
        });
      }
    }

    return {
      success: true,
      fileUploaded,
      filledCount: filledFields.length,
      filledFields,
      reasoningNotes: mappingResponse.reasoning_notes,
    };
  } catch (err) {
    log(`❌ Auto-fill error: ${err.message}`);
    throw err;
  } finally {
    // Close the specific job application tab so tabs do not accumulate,
    // while keeping the shared browser process alive for next jobs in the cycle
    try {
      const allPages = await browser.pages();
      if (allPages.length > 1) {
        await activePage.close().catch(() => {});
      }
    } catch {}
  }
}
