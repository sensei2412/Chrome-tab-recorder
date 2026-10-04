// Background service worker.
//
// Its only jobs are:
//   1. create the offscreen document (where MediaRecorder + FFmpeg run)
//   2. forward "start recording" from the popup to the offscreen document
//   3. save finished files with chrome.downloads
//
// The stream ID is NOT created here. Chrome only allows getMediaStreamId()
// for a tab the user has just invoked the extension on (activeTab), so the
// popup creates it for the tab it was opened on and sends it to us.

let creatingOffscreen = null;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });

  if (contexts.length > 0) {
    return;
  }

  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: "src/offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Record Chrome tab video and convert it to MP4."
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }

  await creatingOffscreen;
}

async function sendToOffscreen(message) {
  // The offscreen page may need a moment before its listener is ready.
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await chrome.runtime.sendMessage({
      target: "offscreen",
      ...message
    });

    if (response !== undefined) {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("The recorder did not respond. Try again.");
}

async function handleMessage(message) {
  switch (message.type) {
    case "START_RECORDING": {
      await ensureOffscreen();

      return sendToOffscreen({
        type: "START",
        tabId: message.tabId,
        streamId: message.streamId,
        title: message.title,
        convert: message.convert
      });
    }

    case "DOWNLOAD": {
      await chrome.downloads.download({
        url: message.url,
        filename: message.filename,
        saveAs: false,
        conflictAction: "uniquify"
      });

      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown message type: ${message.type}` };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages meant for the popup or the offscreen page.
  if (message?.target !== "background") {
    return false;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("Background error:", error);
      sendResponse({ ok: false, error: error?.message || String(error) });
    });

  return true;
});
