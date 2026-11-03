const DEFAULT_API_URL = "http://127.0.0.1:3000";

async function getApiUrl() {
  const data = await chrome.storage.local.get("apiUrl");
  return data.apiUrl || DEFAULT_API_URL;
}

async function getUserId() {
  const data = await chrome.storage.local.get("userId");
  if (data.userId) return data.userId;
  const newId = "usr_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await chrome.storage.local.set({ userId: newId });
  return newId;
}

chrome.runtime.onInstalled.addListener(async () => {
  await getUserId();
  chrome.storage.local.set({
    apiUrl: DEFAULT_API_URL,
    autoFillResume: true,
    autoFillScreening: true,
    autoSubmit: false,
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // Keep channel open for async response
});

async function handleMessage(request) {
  const apiUrl = await getApiUrl();
  const userId = await getUserId();
  const commonHeaders = {
    "Content-Type": "application/json",
    "x-user-id": userId,
  };

  switch (request.action) {
    case "GET_STATUS": {
      const res = await fetch(`${apiUrl}/api/extension/profile`, {
        headers: { "x-user-id": userId },
      });
      if (!res.ok) throw new Error("Could not connect to AI Engine");
      const data = await res.json();
      return { ok: true, profile: data, userId };
    }

    case "TAILOR_JOB": {
      const res = await fetch(`${apiUrl}/api/extension/tailor`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(request.payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tailoring failed");

      // Fetch the binary PDF from the server as base64
      const pdfRes = await fetch(`${apiUrl}${data.resumePdfUrl}`);
      const pdfBlob = await pdfRes.blob();
      const pdfBase64 = await blobToBase64(pdfBlob);

      return {
        success: true,
        runId: data.runId,
        resumePdfName: data.resumePdfName,
        pdfBase64,
        matchPct: data.matchPct,
      };
    }

    case "REASON_FIELDS": {
      const res = await fetch(`${apiUrl}/api/extension/reason-fields`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(request.payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reasoning failed");
      return data;
    }

    case "TRACK_JOB": {
      const res = await fetch(`${apiUrl}/api/extension/track`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(request.payload),
      });
      return await res.json();
    }

    case "START_AUTONOMOUS_RUN": {
      const res = await fetch(`${apiUrl}/api/auto/start`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(request.payload || {}),
      });
      return await res.json();
    }

    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(",")[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
