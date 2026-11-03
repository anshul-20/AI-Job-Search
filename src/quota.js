import fs from "node:fs";
import path from "node:path";

const DEFAULT_DAILY_LIMIT = 20;

function getQuotaFilePath(userId) {
  if (userId && /^[a-zA-Z0-9_-]+$/.test(userId)) {
    const userDir = path.resolve(`data/users/${userId}`);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, "quota.json");
  }
  const defaultDir = path.resolve("data");
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return path.join(defaultDir, "quota.json");
}

export function getUserQuota(userId) {
  const filePath = getQuotaFilePath(userId);
  const today = new Date().toISOString().split("T")[0];

  let quotaData = {
    plan: "Free Tier",
    dailyLimit: DEFAULT_DAILY_LIMIT,
    usedToday: 0,
    lastDate: today,
    extraCredits: 0,
    isPro: false,
  };

  if (fs.existsSync(filePath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
      quotaData = { ...quotaData, ...saved };
    } catch {}
  }

  // Auto-reset if new day
  if (quotaData.lastDate !== today) {
    quotaData.usedToday = 0;
    quotaData.lastDate = today;
    saveUserQuota(userId, quotaData);
  }

  const remaining = quotaData.isPro
    ? 9999
    : Math.max(0, quotaData.dailyLimit + (quotaData.extraCredits || 0) - quotaData.usedToday);

  return {
    ...quotaData,
    remaining,
    totalAvailable: quotaData.isPro ? 9999 : quotaData.dailyLimit + (quotaData.extraCredits || 0),
  };
}

export function saveUserQuota(userId, data) {
  const filePath = getQuotaFilePath(userId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function consumeQuota(userId, count = 1) {
  const quota = getUserQuota(userId);
  if (quota.isPro) return { allowed: true, quota };

  if (quota.remaining < count) {
    return {
      allowed: false,
      quota,
      error: `Daily application quota reached (${quota.usedToday}/${quota.totalAvailable} used). Recharge credits or upgrade to Pro for unlimited applies.`,
    };
  }

  quota.usedToday += count;
  saveUserQuota(userId, quota);
  return { allowed: true, quota: getUserQuota(userId) };
}

export function rechargeUserQuota(userId, { addCredits = 0, activatePro = false, plan = null }) {
  const quota = getUserQuota(userId);
  if (activatePro) {
    quota.isPro = true;
    quota.plan = "Pro Unlimited";
  }
  if (plan) {
    quota.plan = plan;
  }
  if (addCredits > 0) {
    quota.extraCredits = (quota.extraCredits || 0) + addCredits;
  }
  saveUserQuota(userId, quota);
  return getUserQuota(userId);
}
