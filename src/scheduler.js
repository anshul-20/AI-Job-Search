import { runAutoCycle } from "./autoRunner.js";
import { closeBrowser } from "./renderer.js";

const TARGET_HOURS = [9, 14, 20]; // 9:00 AM, 2:00 PM, 8:00 PM

let lastRunHour = -1;

async function checkAndRun(force = false) {
  const now = new Date();
  const currentHour = now.getHours();

  if (force || (TARGET_HOURS.includes(currentHour) && lastRunHour !== currentHour)) {
    lastRunHour = currentHour;
    try {
      await runAutoCycle();
    } catch (err) {
      console.error(`Error in automated run: ${err.message}`);
    } finally {
      await closeBrowser();
    }
  }
}

const isRunOnce = process.argv.includes("--now") || process.argv.includes("--once");

if (isRunOnce) {
  console.log("Running one immediate automated cycle...");
  await checkAndRun(true);
  process.exit(0);
} else {
  console.log(`🤖 Auto-job-apply scheduler started.`);
  console.log(`Scheduled to run 3 times daily at: 9:00 AM, 2:00 PM, and 8:00 PM.`);
  console.log(`Checking for matching jobs...`);

  // Run initial cycle immediately
  await checkAndRun(true);

  // Check every 60 seconds if it is time to run
  setInterval(() => {
    checkAndRun(false);
  }, 60_000);
}
