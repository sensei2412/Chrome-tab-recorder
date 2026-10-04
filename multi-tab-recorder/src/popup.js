const listEl = document.getElementById("list");
const messageEl = document.getElementById("message");
const convertEl = document.getElementById("convert");


// ----------------------------------------
// HELPERS
// ----------------------------------------

function showMessage(text) {
  messageEl.textContent = text || "";
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

// Talk to the offscreen page. If it does not exist yet, nothing is recording.
async function sendToOffscreen(message) {
  try {
    return await chrome.runtime.sendMessage({ target: "offscreen", ...message });
  } catch {
    return undefined;
  }
}

async function getSessions() {
  const response = await sendToOffscreen({ type: "GET_STATUS" });
  return response?.sessions || [];
}

try {
  convertEl.checked = localStorage.getItem("convert") !== "false";
} catch {
  // Storage can be unavailable. The default is fine.
}

convertEl.onchange = () => {
  try {
    localStorage.setItem("convert", String(convertEl.checked));
  } catch {
    // Ignore.
  }
};


// ----------------------------------------
// LIST OF RECORDINGS
// ----------------------------------------

function button(label, onClick) {
  const el = document.createElement("button");
  el.textContent = label;
  el.className = "small";
  el.onclick = onClick;
  return el;
}

function statusText(session) {
  switch (session.state) {
    case "recording":
      return `Recording ${formatTime(session.elapsedMs)}`;
    case "paused":
      return `Paused ${formatTime(session.elapsedMs)}`;
    case "stopping":
      return "Stopping...";
    case "queued":
      return "Waiting to convert...";
    case "converting":
      return session.progress > 0
        ? `Converting ${session.progress}%`
        : "Converting...";
    default:
      return session.message || session.state;
  }
}

function renderList(sessions) {
  listEl.innerHTML = "";

  for (const session of sessions) {
    const row = document.createElement("div");
    row.className = "tab";

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = session.title;
    title.title = session.title;

    const status = document.createElement("span");
    status.className = `status ${session.state}`;
    status.textContent = statusText(session);

    row.append(title, status);

    if (session.state === "recording") {
      row.append(
        button("Pause", () => control("PAUSE", session.tabId)),
        button("Stop", () => control("STOP", session.tabId))
      );
    } else if (session.state === "paused") {
      row.append(
        button("Resume", () => control("RESUME", session.tabId)),
        button("Stop", () => control("STOP", session.tabId))
      );
    }

    listEl.appendChild(row);
  }
}

async function refresh() {
  renderList(await getSessions());
}

async function control(type, tabId) {
  await sendToOffscreen({ type, tabId });
  refresh();
}


// ----------------------------------------
// RECORD THIS TAB
// ----------------------------------------

document.getElementById("recordThis").onclick = async () => {
  showMessage("");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      showMessage("Could not find the current tab.");
      return;
    }

    if (/^(chrome|edge|about|chrome-extension|devtools):/.test(tab.url || "")) {
      showMessage("Chrome's own pages cannot be recorded.");
      return;
    }

    const existing = (await getSessions()).find((s) => s.tabId === tab.id);

    if (existing && ["recording", "paused"].includes(existing.state)) {
      showMessage("This tab is already being recorded.");
      return;
    }

    // This only works because the popup was opened on this tab (activeTab).
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });

    const response = await chrome.runtime.sendMessage({
      target: "background",
      type: "START_RECORDING",
      tabId: tab.id,
      streamId,
      title: tab.title || `Tab ${tab.id}`,
      convert: convertEl.checked
    });

    if (!response?.ok) {
      showMessage(response?.error || "Could not start recording.");
    }
  } catch (error) {
    showMessage(error?.message || String(error));
  }

  refresh();
};

document.getElementById("pauseAll").onclick = () => control("PAUSE");
document.getElementById("resumeAll").onclick = () => control("RESUME");
document.getElementById("stopAll").onclick = () => control("STOP");


// ----------------------------------------
// KEEP THE LIST UP TO DATE
// ----------------------------------------

refresh();
setInterval(refresh, 1000);
