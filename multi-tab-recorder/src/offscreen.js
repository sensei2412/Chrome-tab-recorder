// Offscreen document: records every tab with MediaRecorder, then converts
// the recordings to MP4 with FFmpeg (one conversion at a time).

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// tabId -> session
const sessions = new Map();

let ffmpeg = null;
let ffmpegLoading = null;
let currentConversion = null;

// Conversions wait in line here so many recordings never run FFmpeg at once.
let conversionQueue = Promise.resolve();


// ----------------------------------------
// FFMPEG
// ----------------------------------------

function loadFFmpeg() {
  if (ffmpegLoading) {
    return ffmpegLoading;
  }

  ffmpegLoading = (async () => {
    const instance = new FFmpeg();

    instance.on("log", ({ message }) => console.log("[FFmpeg]", message));

    instance.on("progress", ({ progress }) => {
      if (currentConversion && Number.isFinite(progress)) {
        currentConversion.progress = Math.max(
          0,
          Math.min(100, Math.round(progress * 100))
        );
      }
    });

    // Load the files straight from the extension. Blob URLs are blocked by
    // the extension's content security policy.
    await instance.load({
      coreURL: chrome.runtime.getURL("ffmpeg/ffmpeg-core.js"),
      wasmURL: chrome.runtime.getURL("ffmpeg/ffmpeg-core.wasm")
    });

    ffmpeg = instance;
  })();

  // If loading fails, allow another try next time.
  ffmpegLoading.catch(() => {
    ffmpegLoading = null;
  });

  return ffmpegLoading;
}


// ----------------------------------------
// HELPERS
// ----------------------------------------

function sanitizeFilename(name) {
  const cleaned = String(name || "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 100);

  return cleaned || "recording";
}

function elapsedMs(session) {
  if (session.state === "recording") {
    return session.accumulatedMs + (Date.now() - session.lastStart);
  }

  return session.accumulatedMs;
}

function describe(session) {
  return {
    tabId: session.tabId,
    title: session.title,
    state: session.state,
    elapsedMs: elapsedMs(session),
    progress: session.progress,
    message: session.message
  };
}

function pickMimeType() {
  const options = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  return options.find((type) => MediaRecorder.isTypeSupported(type));
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  chrome.runtime.sendMessage({
    target: "background",
    type: "DOWNLOAD",
    url,
    filename: `Tab Recordings/${filename}`
  });

  // Free the memory later, after the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}

function forgetLater(session) {
  setTimeout(() => {
    if (sessions.get(session.tabId) === session) {
      sessions.delete(session.tabId);
    }
  }, 30 * 1000);
}


// ----------------------------------------
// RECORDING
// ----------------------------------------

async function startRecording({ tabId, streamId, title, convert }) {
  const existing = sessions.get(tabId);

  if (
    existing &&
    ["recording", "paused", "queued", "converting"].includes(existing.state)
  ) {
    throw new Error("This tab is already being recorded.");
  }

  if (!streamId) {
    throw new Error("No stream ID was provided.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    }
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 4_000_000
  });

  const session = {
    tabId,
    title: title || `Tab ${tabId}`,
    convert: convert !== false,
    recorder,
    stream,
    chunks: [],
    state: "recording",
    accumulatedMs: 0,
    lastStart: Date.now(),
    progress: 0,
    message: ""
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      session.chunks.push(event.data);
    }
  };

  recorder.onstop = () => finishRecording(session);

  // Closing the tab (or the capture ending) ends the video track.
  stream.getVideoTracks()[0].onended = () => {
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  recorder.start(1000);
  sessions.set(tabId, session);
}

function finishRecording(session) {
  // Freeze the timer at the moment recording stopped.
  if (session.state === "recording") {
    session.accumulatedMs += Date.now() - session.lastStart;
  }

  session.stream.getTracks().forEach((track) => track.stop());

  const webm = new Blob(session.chunks, { type: "video/webm" });
  session.chunks = [];

  if (webm.size === 0) {
    session.state = "error";
    session.message = "Nothing was recorded.";
    forgetLater(session);
    return;
  }

  const baseName = sanitizeFilename(session.title);

  if (!session.convert) {
    saveBlob(webm, `${baseName}.webm`);
    session.state = "done";
    session.message = "Saved as WebM.";
    forgetLater(session);
    return;
  }

  session.state = "queued";

  conversionQueue = conversionQueue
    .then(() => convertToMp4(session, webm, baseName))
    .catch((error) => console.error("Conversion queue error:", error));
}

function pauseRecording(session) {
  if (session.state !== "recording") {
    return;
  }

  session.recorder.pause();
  session.accumulatedMs += Date.now() - session.lastStart;
  session.state = "paused";
}

function resumeRecording(session) {
  if (session.state !== "paused") {
    return;
  }

  session.recorder.resume();
  session.lastStart = Date.now();
  session.state = "recording";
}

function stopRecording(session) {
  if (!["recording", "paused"].includes(session.state)) {
    return;
  }

  if (session.state === "recording") {
    session.accumulatedMs += Date.now() - session.lastStart;
    session.state = "stopping";
  }

  session.recorder.stop();
}


// ----------------------------------------
// MP4 CONVERSION
// ----------------------------------------

async function convertToMp4(session, webm, baseName) {
  const inputName = `input-${session.tabId}.webm`;
  const outputName = `output-${session.tabId}.mp4`;

  session.state = "converting";
  session.progress = 0;
  currentConversion = session;

  try {
    await loadFFmpeg();

    await ffmpeg.writeFile(inputName, await fetchFile(webm));

    const exitCode = await ffmpeg.exec([
      "-i", inputName,
      // H.264 needs even width and height.
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputName
    ]);

    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    const data = await ffmpeg.readFile(outputName);

    saveBlob(new Blob([data], { type: "video/mp4" }), `${baseName}.mp4`);

    session.state = "done";
    session.progress = 100;
    session.message = "Saved as MP4.";
  } catch (error) {
    console.error("MP4 conversion failed:", error);

    // Never lose the recording: save the original WebM instead.
    saveBlob(webm, `${baseName}.webm`);

    const reason = String(error?.message || error).slice(0, 120);

    session.state = "error";
    session.message = `MP4 failed (${reason}). Saved as WebM instead.`;
  } finally {
    currentConversion = null;

    try {
      await ffmpeg?.deleteFile(inputName);
      await ffmpeg?.deleteFile(outputName);
    } catch {
      // The files may not exist if conversion failed early.
    }

    forgetLater(session);
  }
}


// ----------------------------------------
// MESSAGES FROM THE POPUP / BACKGROUND
// ----------------------------------------

function targets(tabId) {
  if (tabId === undefined || tabId === null) {
    return [...sessions.values()];
  }

  const session = sessions.get(tabId);
  return session ? [session] : [];
}

async function handleMessage(message) {
  switch (message.type) {
    case "START":
      await startRecording(message);
      return { ok: true };

    case "PAUSE":
      targets(message.tabId).forEach(pauseRecording);
      return { ok: true };

    case "RESUME":
      targets(message.tabId).forEach(resumeRecording);
      return { ok: true };

    case "STOP":
      targets(message.tabId).forEach(stopRecording);
      return { ok: true };

    case "GET_STATUS":
      return { ok: true, sessions: [...sessions.values()].map(describe) };

    default:
      return { ok: false, error: `Unknown message type: ${message.type}` };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "offscreen") {
    return false;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("Offscreen error:", error);
      sendResponse({ ok: false, error: error?.message || String(error) });
    });

  return true;
});