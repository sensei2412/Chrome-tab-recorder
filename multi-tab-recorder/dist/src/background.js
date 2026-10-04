async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({});

  const exists = contexts.some(
    context => context.contextType === "OFFSCREEN_DOCUMENT"
  );

  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "src/offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Record and convert Chrome tab video"
    });
  }
}

chrome.runtime.onMessage.addListener(async (message) => {

  if (message.type === "START_RECORDING") {

    try {

      await ensureOffscreen();

      const streamId =
        await chrome.tabCapture.getMediaStreamId({
          targetTabId: message.tabId
        });

      chrome.runtime.sendMessage({
        type: "START_OFFSCREEN_RECORDING",
        tabId: message.tabId,
        streamId,
        title: message.title
      });

    } catch (error) {

      console.error(error);

    }
  }


  if (message.type === "STOP_RECORDING") {

    chrome.runtime.sendMessage({
      type: "STOP_OFFSCREEN_RECORDING",
      tabId: message.tabId
    });

  }


  if (message.type === "PAUSE_RECORDING") {

    chrome.runtime.sendMessage({
      type: "PAUSE_OFFSCREEN_RECORDING",
      tabId: message.tabId
    });

  }


  if (message.type === "RESUME_RECORDING") {

    chrome.runtime.sendMessage({
      type: "RESUME_OFFSCREEN_RECORDING",
      tabId: message.tabId
    });

  }


  if (message.type === "DOWNLOAD_MP4") {

    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    });

  }

});