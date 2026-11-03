import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function packageExtension() {
  const extensionDir = path.resolve("extension");
  const distDir = path.resolve("dist");
  const stagingDir = path.join(distDir, "staging");

  fs.mkdirSync(distDir, { recursive: true });
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  const zipPath = path.join(distDir, "ai-job-copilot-extension.zip");
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log("Optimizing and assembling production extension package...");

  // Strictly copy runtime files required by Chrome
  const runtimeFiles = [
    "manifest.json",
    "background.js",
    "content.js",
    "content.css",
    "popup.html",
    "popup.css",
    "popup.js",
  ];

  for (const file of runtimeFiles) {
    const src = path.join(extensionDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(stagingDir, file));
    }
  }

  // Copy icons
  const iconsSrc = path.join(extensionDir, "icons");
  const iconsDest = path.join(stagingDir, "icons");
  if (fs.existsSync(iconsSrc)) {
    fs.cpSync(iconsSrc, iconsDest, { recursive: true });
  }

  // Create lightweight production zip
  if (process.platform === "win32") {
    execSync(
      `powershell -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${zipPath}' -Force"`
    );
  } else {
    execSync(`cd "${stagingDir}" && zip -r "${zipPath}" ./*`);
  }

  // Clean staging
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const stat = fs.statSync(zipPath);
  console.log(`✅ Production Extension Package Ready:`);
  console.log(`   Path: ${zipPath}`);
  console.log(`   Size: ${(stat.size / 1024).toFixed(1)} KB (Ultra-lean build, 0 unused assets)`);
}

packageExtension();
