document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const candidateName = document.getElementById("candidateName");
  const candidateTitle = document.getElementById("candidateTitle");
  const candidateAvatar = document.getElementById("candidateAvatar");
  const activeResumeName = document.getElementById("activeResumeName");
  const uploadResumeBtn = document.getElementById("uploadResumeBtn");
  const resumeUploadInput = document.getElementById("resumeUploadInput");
  const uploadStatusMsg = document.getElementById("uploadStatusMsg");
  const planBadge = document.getElementById("planBadge");
  const upgradeBtn = document.getElementById("upgradeBtn");
  const quotaProgressBar = document.getElementById("quotaProgressBar");
  const quotaRemainingText = document.getElementById("quotaRemainingText");
  const fillTabBtn = document.getElementById("fillTabBtn");
  const downloadExcelBtn = document.getElementById("downloadExcelBtn");
  const openWebTrackerBtn = document.getElementById("openWebTrackerBtn");
  const trackerCountBadge = document.getElementById("trackerCountBadge");
  const trackerList = document.getElementById("trackerList");
  const contextText = document.getElementById("contextText");
  const contextBadge = document.getElementById("contextBadge");
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const userIdDisplay = document.getElementById("userIdDisplay");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const modalUpgradeBtn = document.getElementById("modalUpgradeBtn");
  const modalPlanName = document.getElementById("modalPlanName");

  // Load stored settings
  const stored = await chrome.storage.local.get(["apiUrl", "userId"]);
  const apiUrl = stored.apiUrl || "http://127.0.0.1:3000";
  apiUrlInput.value = apiUrl;
  if (stored.userId) userIdDisplay.value = stored.userId;

  // Detect active tab context
  detectActiveTabContext();

  // Check backend engine connection
  checkConnection();

  // Context Detection on active browser tab
  async function detectActiveTabContext() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        contextText.textContent = "Open any job application page";
        contextBadge.textContent = "Standby";
        return;
      }

      const url = tab.url.toLowerCase();
      if (url.includes("linkedin.com/jobs") || url.includes("linkedin.com/feed")) {
        contextText.textContent = "LinkedIn Job Page detected";
        contextBadge.textContent = "LinkedIn";
      } else if (url.includes("greenhouse.io")) {
        contextText.textContent = "Greenhouse Career Portal detected";
        contextBadge.textContent = "Greenhouse";
      } else if (url.includes("lever.co")) {
        contextText.textContent = "Lever Application Form detected";
        contextBadge.textContent = "Lever";
      } else if (url.includes("workday.com") || url.includes("myworkdayjobs.com")) {
        contextText.textContent = "Workday Job Portal detected";
        contextBadge.textContent = "Workday";
      } else if (url.includes("ashbyhq.com")) {
        contextText.textContent = "Ashby Job Board detected";
        contextBadge.textContent = "Ashby";
      } else if (url.includes("smartrecruiters.com")) {
        contextText.textContent = "SmartRecruiters Portal detected";
        contextBadge.textContent = "SmartRecruiters";
      } else if (url.includes("indeed.com")) {
        contextText.textContent = "Indeed Job Posting detected";
        contextBadge.textContent = "Indeed";
      } else {
        contextText.textContent = "Direct Company Career Portal";
        contextBadge.textContent = "Ready";
      }
    } catch {
      contextText.textContent = "Ready for application forms";
      contextBadge.textContent = "Ready";
    }
  }

  // Check Backend Connection & Load Profile/Quota
  async function checkConnection() {
    statusDot.className = "status-dot";
    statusText.textContent = "Connecting...";

    try {
      const response = await chrome.runtime.sendMessage({ action: "GET_STATUS" });
      if (response && response.ok && response.profile) {
        statusDot.className = "status-dot online pulse";
        statusText.textContent = "Engine Ready";

        if (response.userId) {
          userIdDisplay.value = response.userId;
        }

        const basics = response.profile.basics || {};
        const name = basics.name || "Active Candidate";
        candidateName.textContent = name;
        candidateTitle.textContent = basics.title || "Target Roles Synchronized";

        // Initials avatar
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "AP";
        candidateAvatar.textContent = initials;

        // Quota meter handling
        const quota = response.profile.quota || {};
        updateQuotaDisplay(quota);

        fillTabBtn.disabled = false;
        loadRecentApplications();
      } else {
        throw new Error("Invalid response");
      }
    } catch {
      statusDot.className = "status-dot";
      statusText.textContent = "Server Offline";
      candidateName.textContent = "Engine Not Reachable";
      candidateTitle.textContent = "Run `npm start` in your project folder";
      fillTabBtn.disabled = true;
    }
  }

  function updateQuotaDisplay(quota) {
    if (!quota) return;
    const plan = quota.plan || "Free Tier";
    planBadge.textContent = plan;
    modalPlanName.textContent = `${plan} (${quota.isPro ? "Unlimited" : quota.totalAvailable + " Daily Applies"})`;

    if (quota.isPro) {
      quotaProgressBar.style.width = "100%";
      quotaRemainingText.textContent = "Unlimited Applications (Pro Plan)";
      upgradeBtn.textContent = "✓ Active Pro";
      upgradeBtn.disabled = true;
    } else {
      const total = quota.totalAvailable || 20;
      const remaining = Math.max(0, quota.remaining ?? total);
      const used = quota.usedToday || 0;
      const pct = Math.min(100, Math.max(0, Math.round((remaining / total) * 100)));
      quotaProgressBar.style.width = `${pct}%`;
      quotaRemainingText.textContent = `${remaining} / ${total} Applications Left Today`;

      if (remaining === 0) {
        quotaProgressBar.style.background = "#ef4444";
        fillTabBtn.disabled = true;
        fillTabBtn.innerHTML = `<span>⚠️</span> Daily Limit Reached (Click to Recharge)`;
      } else {
        quotaProgressBar.style.background = "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)";
      }
    }
  }

  // Load Recent Applications from Unified Master Tracker
  async function loadRecentApplications() {
    try {
      const stored = await chrome.storage.local.get("apiUrl");
      const currentApi = stored.apiUrl || "http://127.0.0.1:3000";
      const res = await fetch(`${currentApi}/api/tracker`);
      if (!res.ok) return;
      const data = await res.json();
      const records = data.records || [];

      if (trackerCountBadge) trackerCountBadge.textContent = `${records.length} logged`;

      if (records.length === 0) {
        trackerList.innerHTML = `<div class="tracker-empty">No applications tracked yet. Click Auto-Fill on any job to start!</div>`;
        return;
      }

      // Show top 3 recent applications
      const recent = records.slice(-3).reverse();
      trackerList.innerHTML = recent
        .map((r) => {
          const role = r.Role || r.role || "Target Role";
          const company = r.Company || r.company || "Company";
          let status = r.Status || r.status || "Applied";
          if (status.includes("Pre-filled")) status = "Pre-filled";

          // Detect portal from Job URL or notes
          let portal = "Direct";
          const notes = r.Notes || "";
          const match = notes.match(/\[Portal:\s*([^\]]+)\]/);
          if (match) portal = match[1];
          else if (r["Job URL"]?.includes("linkedin")) portal = "LinkedIn";
          else if (r["Job URL"]?.includes("greenhouse")) portal = "Greenhouse";
          else if (r["Job URL"]?.includes("lever")) portal = "Lever";
          else if (r["Job URL"]?.includes("workday")) portal = "Workday";

          const statusClass = status.toLowerCase().includes("interview")
            ? "interview"
            : status.toLowerCase().includes("draft")
            ? "drafted"
            : "applied";

          return `
            <div class="recent-item">
              <div class="item-left">
                <div class="item-company-row">
                  <span class="item-company" title="${escapeHtml(company)}">${escapeHtml(company)}</span>
                  <span class="item-portal">${escapeHtml(portal)}</span>
                </div>
                <span class="item-role" title="${escapeHtml(role)}">${escapeHtml(role)}</span>
              </div>
              <span class="item-status ${statusClass}">${escapeHtml(status)}</span>
            </div>
          `;
        })
        .join("");
    } catch {}
  }

  // 1-Click Master Excel Tracker Download
  downloadExcelBtn.addEventListener("click", async () => {
    downloadExcelBtn.style.opacity = "0.7";
    const stored = await chrome.storage.local.get(["apiUrl", "userId"]);
    const currentApi = stored.apiUrl || "http://127.0.0.1:3000";
    const exportUrl = `${currentApi}/api/extension/export-csv`;

    try {
      if (chrome.downloads && chrome.downloads.download) {
        await chrome.downloads.download({
          url: exportUrl,
          filename: "Job_Applications_Tracker.csv",
          saveAs: false,
        });
      } else {
        // Fallback: Trigger browser download via invisible link
        const a = document.createElement("a");
        a.href = exportUrl;
        a.download = "Job_Applications_Tracker.csv";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      // Direct tab fallback
      chrome.tabs.create({ url: exportUrl });
    } finally {
      setTimeout(() => {
        downloadExcelBtn.style.opacity = "1";
      }, 1000);
    }
  });

  // Open Web Tracker Sheet
  openWebTrackerBtn.addEventListener("click", async () => {
    const stored = await chrome.storage.local.get("apiUrl");
    const currentApi = stored.apiUrl || "http://127.0.0.1:3000";
    chrome.tabs.create({ url: `${currentApi}/#trackerTab` });
  });

  // Trigger 1-Click Auto-Fill on active tab
  fillTabBtn.addEventListener("click", async () => {
    fillTabBtn.disabled = true;
    fillTabBtn.innerHTML = `<span>⏳</span> Analyzing Job Form...`;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error("No active browser tab found");

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const btn = document.getElementById("ai-copilot-trigger-btn");
          if (btn) btn.click();
          else alert("AI Job Copilot widget not found on this tab. Refresh this job page to inject the widget.");
        },
      });

      fillTabBtn.innerHTML = `<span>✅</span> Auto-Fill Dispatched!`;
      setTimeout(() => {
        fillTabBtn.disabled = false;
        fillTabBtn.innerHTML = `
          <span class="cta-icon">⚡</span>
          <div class="cta-text-group">
            <span class="cta-title">Auto-Fill This Job Tab</span>
            <span class="cta-sub">1-Click ATS Tailor & Reasoning</span>
          </div>
        `;
        checkConnection();
        loadRecentApplications();
      }, 3000);
    } catch (err) {
      alert("Could not trigger auto-fill: " + err.message);
      fillTabBtn.disabled = false;
      fillTabBtn.innerHTML = `
        <span class="cta-icon">⚡</span>
        <div class="cta-text-group">
          <span class="cta-title">Auto-Fill This Job Tab</span>
          <span class="cta-sub">1-Click ATS Tailor & Reasoning</span>
        </div>
      `;
    }
  });

  // Resume Upload / Switch
  uploadResumeBtn.addEventListener("click", () => {
    resumeUploadInput.click();
  });

  resumeUploadInput.addEventListener("change", async () => {
    if (!resumeUploadInput.files.length) return;
    const file = resumeUploadInput.files[0];

    uploadStatusMsg.style.display = "block";
    uploadStatusMsg.style.color = "#38bdf8";
    uploadStatusMsg.textContent = `⏳ Parsing ${file.name}...`;

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const stored = await chrome.storage.local.get("apiUrl");
      const currentApi = stored.apiUrl || "http://127.0.0.1:3000";

      const res = await fetch(`${currentApi}/api/resume/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64,
          filename: file.name,
          auto_apply: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      uploadStatusMsg.style.color = "#4ade80";
      uploadStatusMsg.textContent = `✅ Activated: ${data.resume.basics.name}`;
      candidateName.textContent = data.resume.basics.name;
      candidateTitle.textContent = data.resume.basics.title;
      activeResumeName.textContent = file.name;

      setTimeout(() => {
        uploadStatusMsg.style.display = "none";
      }, 4000);
    } catch (err) {
      uploadStatusMsg.style.color = "#f87171";
      uploadStatusMsg.textContent = `❌ ${err.message}`;
    }
  });

  // Settings Modal Handlers
  openSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("open");
  });

  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("open");
  });

  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove("open");
  });

  saveSettingsBtn.addEventListener("click", async () => {
    const newUrl = apiUrlInput.value.trim() || "http://127.0.0.1:3000";
    await chrome.storage.local.set({ apiUrl: newUrl });
    settingsModal.classList.remove("open");
    checkConnection();
  });

  // Upgrade / Add Credits Simulation
  upgradeBtn.addEventListener("click", () => {
    settingsModal.classList.add("open");
  });

  modalUpgradeBtn.addEventListener("click", async () => {
    modalUpgradeBtn.disabled = true;
    modalUpgradeBtn.textContent = "⏳ Adding Credits...";
    try {
      const stored = await chrome.storage.local.get(["apiUrl", "userId"]);
      const currentApi = stored.apiUrl || "http://127.0.0.1:3000";
      const res = await fetch(`${currentApi}/api/user/recharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": stored.userId || "usr_default",
        },
        body: JSON.stringify({ addCredits: 50, activatePro: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recharge failed");

      modalUpgradeBtn.textContent = "✅ Pro Plan Active!";
      updateQuotaDisplay(data.quota);
      setTimeout(() => {
        settingsModal.classList.remove("open");
        modalUpgradeBtn.disabled = false;
        modalUpgradeBtn.textContent = "⚡ Add 50 Credits";
      }, 1200);
    } catch (err) {
      alert("Recharge error: " + err.message);
      modalUpgradeBtn.disabled = false;
      modalUpgradeBtn.textContent = "⚡ Add 50 Credits";
    }
  });

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});
