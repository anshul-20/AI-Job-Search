import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { getUserQuota, consumeQuota, rechargeUserQuota, saveUserQuota } from "../src/quota.js";
import { app } from "../src/server.js";
import { updateApplicationStatus, getTrackerRecords } from "../src/tracker.js";

describe("Quota & Rate Limiting Engine", () => {
  const testUserId = "usr_test_quota_123";
  const userDir = path.resolve(`data/users/${testUserId}`);

  beforeEach(() => {
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
  });

  it("initializes with 20 free daily applications", () => {
    const quota = getUserQuota(testUserId);
    expect(quota.plan).toBe("Free Tier");
    expect(quota.dailyLimit).toBe(20);
    expect(quota.usedToday).toBe(0);
    expect(quota.remaining).toBe(20);
    expect(quota.isPro).toBe(false);
  });

  it("consumes quota correctly and enforces rate limits", () => {
    const res1 = consumeQuota(testUserId, 5);
    expect(res1.allowed).toBe(true);
    expect(res1.quota.usedToday).toBe(5);
    expect(res1.quota.remaining).toBe(15);

    // Consume remaining 15
    const res2 = consumeQuota(testUserId, 15);
    expect(res2.allowed).toBe(true);
    expect(res2.quota.remaining).toBe(0);

    // Try to exceed limit
    const res3 = consumeQuota(testUserId, 1);
    expect(res3.allowed).toBe(false);
    expect(res3.error).toContain("Daily application quota reached");
  });

  it("recharges credits and activates pro subscription", () => {
    // Add 50 credits
    const q1 = rechargeUserQuota(testUserId, { addCredits: 50 });
    expect(q1.extraCredits).toBe(50);
    expect(q1.remaining).toBe(70);

    // Activate Pro
    const q2 = rechargeUserQuota(testUserId, { activatePro: true });
    expect(q2.isPro).toBe(true);
    expect(q2.remaining).toBe(9999);
  });
});

describe("Unified Excel Tracker & Export API", () => {
  const testUserId = "usr_test_tracker_export";
  const userDir = path.resolve(`data/users/${testUserId}`);
  const trackerPath = path.join(userDir, "job_search_tracker.csv");

  beforeEach(() => {
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
    fs.mkdirSync(userDir, { recursive: true });
  });

  it("logs applications from multiple portals to the same sheet and updates duplicates in place", () => {
    // App 1: Greenhouse
    updateApplicationStatus("https://boards.greenhouse.io/job1", "Applied", trackerPath, {
      company: "Scale AI",
      role: "ML Engineer",
      notes: "[Portal: Greenhouse] Applied via Chrome Extension",
    });

    // App 2: LinkedIn
    updateApplicationStatus("https://linkedin.com/jobs/view/job2", "Applied", trackerPath, {
      company: "Stripe",
      role: "Backend Lead",
      notes: "[Portal: LinkedIn] Applied via Chrome Extension",
    });

    let records = getTrackerRecords(trackerPath);
    expect(records.length).toBe(2);
    expect(records[0]["Company"]).toBe("Scale AI");
    expect(records[1]["Company"]).toBe("Stripe");

    // Re-apply to Greenhouse job -> updates status in place, no duplicate row
    updateApplicationStatus("https://boards.greenhouse.io/job1", "Interview", trackerPath, {
      company: "Scale AI",
      role: "ML Engineer",
    });

    records = getTrackerRecords(trackerPath);
    expect(records.length).toBe(2);
    expect(records[0]["Status"]).toBe("Interview");
  });

  it("GET /api/extension/export-csv streams downloadable CSV attachment", async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/extension/export-csv`, {
        headers: { "x-user-id": testUserId },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(res.headers.get("content-disposition")).toContain('attachment; filename="Job_Applications_Tracker.csv"');
      const text = await res.text();
      expect(text).toContain("Company");
      expect(text).toContain("Role");
    } finally {
      server.close();
    }
  });

  it("POST /api/user/recharge allows adding credits", async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/user/recharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": testUserId,
        },
        body: JSON.stringify({ addCredits: 25 }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.quota.extraCredits).toBe(25);
    } finally {
      server.close();
    }
  });
});
