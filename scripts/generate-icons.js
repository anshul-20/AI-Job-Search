import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

async function generateIcons() {
  const iconsDir = path.resolve("extension/icons");
  fs.mkdirSync(iconsDir, { recursive: true });

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
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();

  const svgContent = `
    <html>
      <body style="margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; width: 128px; height: 128px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#8b5cf6" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="128" height="128" rx="28" fill="url(#grad)" />
          <path d="M70 14 L34 72 L62 72 L54 114 L94 56 L66 56 Z" fill="#ffffff" filter="url(#glow)" />
        </svg>
      </body>
    </html>
  `;

  await page.setContent(svgContent);

  const sizes = [16, 48, 128];
  for (const size of sizes) {
    await page.setViewport({ width: size, height: size });
    const outPath = path.join(iconsDir, `icon${size}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`Generated: ${outPath} (${size}x${size})`);
  }

  await browser.close();
}

generateIcons().catch(console.error);
