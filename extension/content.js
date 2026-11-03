(() => {
  // Prevent duplicate injection
  if (window.__AI_JOB_COPILOT_INJECTED__) return;
  window.__AI_JOB_COPILOT_INJECTED__ = true;

  let isApplying = false;

  function getPageMode() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/feed")) {
      return "feed";
    }
    const searchCards = document.querySelectorAll(
      ".jobs-search-results__list-item, .job-card-container, [data-occludable-job-id], .scaffold-layout__list-item"
    );
    if (path.includes("/jobs/search") || searchCards.length > 1) {
      return "search_results";
    }
    return "single_job";
  }

  // 1. Mount Context-Aware Floating Widget
  function mountWidget() {
    let host = document.getElementById("ai-copilot-host");
    const mode = getPageMode();

    if (!host) {
      host = document.createElement("div");
      host.id = "ai-copilot-host";
      document.body.appendChild(host);
    }

    let btnText = "1-Click Apply";
    let icon = "⚡";
    let pillText = "AI Job Copilot";

    if (mode === "feed") {
      icon = "🚀";
      pillText = "LinkedIn Feed";
      btnText = "Auto-Hunt Jobs";
    } else if (mode === "search_results") {
      const jobCards = document.querySelectorAll(
        ".jobs-search-results__list-item, .job-card-container, [data-occludable-job-id], .scaffold-layout__list-item"
      );
      icon = "⚡";
      pillText = `${jobCards.length} Jobs Listed`;
      btnText = `Batch Auto-Apply`;
    }

    host.innerHTML = `
      <div class="ai-copilot-pill">
        <div class="ai-copilot-icon">${icon}</div>
        <span class="ai-copilot-text">${pillText}</span>
        <button class="ai-copilot-btn" id="ai-copilot-trigger-btn">${btnText}</button>
      </div>
    `;

    const btn = host.querySelector("#ai-copilot-trigger-btn");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleTriggerClick(mode);
    });

    const pill = host.querySelector(".ai-copilot-pill");
    pill.addEventListener("click", () => {
      handleTriggerClick(mode);
    });
  }

  function handleTriggerClick(mode) {
    if (mode === "feed") {
      handleFeedAutoHunt();
    } else if (mode === "search_results") {
      executeBatchApplyOnSearch();
    } else {
      executeAutoApply();
    }
  }

  function showToast(message, type = "info", duration = 6000) {
    const existing = document.querySelector(".ai-copilot-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `ai-copilot-toast ${type}`;
    toast.innerHTML = `
      <span>${type === "success" ? "✅" : type === "error" ? "❌" : "⏳"}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(12px)";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Handle action when user is on LinkedIn Feed
  async function handleFeedAutoHunt() {
    showToast("Checking active candidate role from AI Engine...", "info", 5000);

    try {
      const statusRes = await chrome.runtime.sendMessage({ action: "GET_STATUS" });
      const targetRole = statusRes?.profile?.basics?.title || "Data Scientist";

      showToast(`🎯 Found active role: "${targetRole}". Navigating to LinkedIn Jobs to search and apply...`, "success", 4000);

      // Trigger background discovery & navigate to user's personalized jobs search
      chrome.runtime.sendMessage({
        action: "START_AUTONOMOUS_RUN",
        payload: { target_roles: targetRole, max_jobs: 25 },
      }).catch(() => {});

      setTimeout(() => {
        window.location.href = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(targetRole)}`;
      }, 1500);
    } catch (err) {
      showToast(`Could not connect to AI Engine: ${err.message}`, "error", 6000);
    }
  }

  // Handle Batch Apply on LinkedIn Jobs Search page
  async function executeBatchApplyOnSearch() {
    if (isApplying) return;
    isApplying = true;

    const cards = Array.from(
      document.querySelectorAll(
        ".jobs-search-results__list-item, .job-card-container, [data-occludable-job-id], .scaffold-layout__list-item"
      )
    );

    if (cards.length === 0) {
      showToast("No job cards found on this page.", "error", 4000);
      isApplying = false;
      return;
    }

    showToast(`🚀 Found ${cards.length} jobs on this page. Starting sequential tailoring & auto-apply...`, "info", 6000);

    let appliedCount = 0;
    for (let i = 0; i < Math.min(cards.length, 10); i++) {
      const card = cards[i];
      try {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        const clickTarget = card.querySelector("a.job-card-list__title, a.job-card-container__link, strong, h3") || card;
        clickTarget.click();

        showToast(`[${i + 1}/${Math.min(cards.length, 10)}] Loading job details...`, "info", 4000);
        await new Promise((r) => setTimeout(r, 2500));

        // Process this selected job
        const applied = await executeAutoApply({ silentFail: true });
        if (applied) appliedCount++;

        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.warn(`Error on job card ${i}:`, err);
      }
    }

    isApplying = false;
    showToast(`🎉 Batch complete: Tailored and processed ${appliedCount} job applications!`, "success", 8000);
  }

  // 2. Extract Job Details from DOM
  function extractJobDetails() {
    let title = "";
    let company = "";
    let jdText = "";

    // Title
    const titleEl =
      document.querySelector("h1") ||
      document.querySelector("h2.top-card-layout__title") ||
      document.querySelector(".job-details-jobs-unified-top-card__job-title") ||
      document.querySelector(".posting-headline h2") ||
      document.querySelector(".app-title") ||
      document.querySelector('[data-automation-id="jobPostingHeader"]');
    if (titleEl) title = titleEl.innerText.trim();

    // Company
    const companyEl =
      document.querySelector("a.topcard__org-name-link") ||
      document.querySelector(".topcard__flavor") ||
      document.querySelector(".job-details-jobs-unified-top-card__company-name") ||
      document.querySelector(".posting-headline .company") ||
      document.querySelector('[data-automation-id="companyName"]');
    if (companyEl) company = companyEl.innerText.trim();

    // JD Text
    const jdEl =
      document.querySelector(".show-more-less-html__markup") ||
      document.querySelector(".jobs-description__content") ||
      document.querySelector("#job-details") ||
      document.querySelector(".description__text") ||
      document.querySelector("#content") ||
      document.querySelector(".job-description") ||
      document.querySelector('[data-automation-id="jobPostingDescription"]');
    if (jdEl) {
      jdText = jdEl.innerText.trim();
    } else {
      jdText = document.body.innerText.slice(0, 5000);
    }

    return { title, company, jdText, jobUrl: window.location.href };
  }

  // 3. Scan DOM for interactive form fields
  function scanFormInputs() {
    const elements = Array.from(document.querySelectorAll("input, textarea, select"));
    return elements
      .filter((el) => {
        const type = (el.getAttribute("type") || "").toLowerCase();
        return (
          type !== "hidden" &&
          type !== "submit" &&
          type !== "file" &&
          el.offsetParent !== null
        );
      })
      .map((el) => {
        const id = el.id || "";
        const name = el.name || "";
        const type =
          el.tagName.toLowerCase() === "textarea"
            ? "textarea"
            : el.tagName.toLowerCase() === "select"
            ? "select"
            : el.type || "text";
        const placeholder = el.placeholder || "";

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
          const container = el.closest(".field, .form-group, .application-question, div");
          if (container) {
            const header = container.querySelector("label, .label, h3, h4, span");
            if (header) labelText = header.innerText;
          }
        }

        const options =
          el.tagName.toLowerCase() === "select"
            ? Array.from(el.options).map((o) => ({ text: o.text.trim(), value: o.value }))
            : [];

        return {
          id,
          name,
          type,
          placeholder,
          label: (labelText || placeholder || name || id).replace(/\s+/g, " ").trim(),
          options: options.slice(0, 10),
        };
      });
  }

  // 4. Attach Tailored PDF to file input via DataTransfer
  function attachPdfToFileInputs(pdfBase64, filename = "Tailored_Resume.pdf") {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (!fileInputs.length) return false;

    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const file = new File([blob], filename, { type: "application/pdf" });

    let attached = false;
    for (const input of fileInputs) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.classList.add("ai-filled-field-highlight");
        attached = true;
      } catch (err) {
        console.warn("Could not set file input:", err);
      }
    }
    return attached;
  }

  // 5. Populate reasoned field values
  function fillFields(fieldMappings) {
    let filledCount = 0;

    for (const item of fieldMappings) {
      let el = null;
      if (item.selector) {
        try {
          el = document.querySelector(item.selector);
        } catch {}
      }
      if (!el && item.name) {
        el = document.querySelector(`[name="${item.name}"]`);
      }
      if (!el && item.id) {
        el = document.getElementById(item.id);
      }

      if (!el) continue;

      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();

      try {
        if (tag === "select") {
          const targetVal = String(item.value).toLowerCase();
          const matchOpt = Array.from(el.options).find(
            (o) => o.text.toLowerCase().includes(targetVal) || o.value.toLowerCase() === targetVal
          );
          if (matchOpt) {
            el.value = matchOpt.value;
          }
        } else if (type === "checkbox") {
          el.checked = Boolean(item.value);
        } else if (type === "radio") {
          const radioGroup = document.querySelectorAll(`[name="${el.name}"]`);
          for (const r of radioGroup) {
            if (r.value.toLowerCase() === String(item.value).toLowerCase()) {
              r.checked = true;
              r.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        } else {
          el.value = item.value;
        }

        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        el.classList.add("ai-filled-field-highlight");
        filledCount++;
      } catch (e) {
        console.warn("Error setting input value:", e);
      }
    }

    return filledCount;
  }

  // 6. Main Auto-Apply Controller
  async function executeAutoApply({ silentFail = false } = {}) {
    if (isApplying) return false;
    isApplying = true;

    const btn = document.getElementById("ai-copilot-trigger-btn");
    if (btn) btn.disabled = true;

    showToast("Analyzing job description and compiling ATS resume...", "info", 10000);

    try {
      const details = extractJobDetails();
      if (!details.jdText || details.jdText.length < 50) {
        if (!silentFail) throw new Error("Could not extract enough job description text from this page.");
        return false;
      }

      // Step 1: Request Tailored Resume from Backend
      showToast("Compiling ATS Resume PDF with Anti-Hallucination Guard...", "info", 12000);
      const tailorRes = await chrome.runtime.sendMessage({
        action: "TAILOR_JOB",
        payload: {
          jdText: details.jdText,
          jobUrl: details.jobUrl,
          title: details.title,
          company: details.company,
        },
      });

      if (!tailorRes || !tailorRes.success) {
        if (!silentFail) throw new Error(tailorRes?.error || "Failed to generate tailored resume");
        return false;
      }

      // Step 2: Click Apply button if present
      const applyBtn = document.querySelector(
        'button.jobs-apply-button, a.jobs-apply-button, .jobs-apply-button--top-card, button[data-tracking-control-name*="apply"], a[href*="apply"]'
      );
      if (applyBtn) {
        try {
          applyBtn.click();
          await new Promise((r) => setTimeout(r, 1500));
        } catch {}
      }

      // Step 3: Attach the generated PDF
      let pdfAttached = false;
      if (tailorRes.pdfBase64) {
        pdfAttached = attachPdfToFileInputs(tailorRes.pdfBase64, tailorRes.resumePdfName);
      }

      // Step 4: Scan and reason over form fields
      showToast("Reasoning over application questions...", "info", 6000);
      const formInputs = scanFormInputs();

      let filledCount = 0;
      if (formInputs.length > 0) {
        const reasonRes = await chrome.runtime.sendMessage({
          action: "REASON_FIELDS",
          payload: {
            formInputs,
            jdText: details.jdText.slice(0, 1000),
          },
        });

        if (reasonRes && reasonRes.fields) {
          filledCount = fillFields(reasonRes.fields);
        }
      }

      // Step 5: Track application
      let portalName = "Career Portal";
      const hostLower = window.location.hostname.toLowerCase();
      if (hostLower.includes("linkedin")) portalName = "LinkedIn";
      else if (hostLower.includes("greenhouse")) portalName = "Greenhouse";
      else if (hostLower.includes("lever")) portalName = "Lever";
      else if (hostLower.includes("workday")) portalName = "Workday";
      else if (hostLower.includes("ashby")) portalName = "Ashby";
      else if (hostLower.includes("smartrecruiters")) portalName = "SmartRecruiters";

      chrome.runtime.sendMessage({
        action: "TRACK_JOB",
        payload: {
          jobUrl: details.jobUrl,
          title: details.title || details.jobTitle || "Target Role",
          role: details.title || details.jobTitle || "Target Role",
          company: details.company || "Company",
          portal: portalName,
          status: "Pre-filled via Extension (Ready to Submit)",
        },
      }).catch(() => {});

      showToast(
        `🎉 Done! ${pdfAttached ? "Tailored ATS Resume attached. " : ""}${filledCount} fields filled in green. Review and click Submit!`,
        "success",
        8000
      );
      return true;
    } catch (err) {
      if (!silentFail) showToast(`Auto-apply error: ${err.message}`, "error", 8000);
      return false;
    } finally {
      isApplying = false;
      if (btn) btn.disabled = false;
    }
  }

  // Mount on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWidget);
  } else {
    mountWidget();
  }

  // Re-check for SPAs (like LinkedIn or Workday) on URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      mountWidget();
    }
  }).observe(document, { subtree: true, childList: true });
})();
