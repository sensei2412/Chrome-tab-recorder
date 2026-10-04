import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";


const recorders = new Map();

let ffmpeg = null;
let ffmpegLoaded = false;


async function loadFFmpeg() {

  if (ffmpegLoaded) {
    return;
  }

  ffmpeg = new FFmpeg();


  ffmpeg.on("log", ({ message }) => {

    console.log("[FFmpeg]", message);

  });


  /*
   * These files must be copied into:
   *
   * public/ffmpeg/
   *
   * during the build.
   */

  const baseURL =
    chrome.runtime.getURL("ffmpeg/");


  await ffmpeg.load({

    coreURL:
      await toBlobURL(
        `${baseURL}ffmpeg-core.js`,
        "text/javascript"
      ),

    wasmURL:
      await toBlobURL(
        `${baseURL}ffmpeg-core.wasm`,
        "application/wasm"
      )

  });


  ffmpegLoaded = true;

  console.log("FFmpeg loaded");

}


chrome.runtime.onMessage.addListener(
  async (message) => {

    if (message.type === "START_OFFSCREEN_RECORDING") {

      await startRecording(
        message.tabId,
        message.streamId,
        message.title
      );

    }


    if (message.type === "STOP_OFFSCREEN_RECORDING") {

      stopRecording(message.tabId);

    }


    if (message.type === "PAUSE_OFFSCREEN_RECORDING") {

      pauseRecording(message.tabId);

    }


    if (message.type === "RESUME_OFFSCREEN_RECORDING") {

      resumeRecording(message.tabId);

    }

  }
);


async function startRecording(
  tabId,
  streamId,
  title
) {

  if (recorders.has(tabId)) {
    return;
  }


  const stream =
    await navigator.mediaDevices.getUserMedia({

      audio: false,

      video: {

        mandatory: {

          chromeMediaSource: "tab",

          chromeMediaSourceId:
            streamId

        }

      }

    });


  const chunks = [];


  const recorder =
    new MediaRecorder(
      stream,
      {
        mimeType:
          "video/webm;codecs=vp9"
      }
    );


  recorder.ondataavailable =
    event => {

      if (event.data.size > 0) {
        chunks.push(event.data);
      }

    };


  recorder.onstop =
    async () => {

      stream
        .getTracks()
        .forEach(track =>
          track.stop()
        );


      const webm =
        new Blob(
          chunks,
          {
            type: "video/webm"
          }
        );


      recorders.delete(tabId);


      await convertToMP4(
        tabId,
        title,
        webm
      );

    };


  recorder.start(1000);


  recorders.set(
    tabId,
    {
      recorder,
      title
    }
  );

}


function pauseRecording(tabId) {

  const item =
    recorders.get(tabId);

  if (!item) {
    return;
  }


  if (
    item.recorder.state ===
    "recording"
  ) {

    item.recorder.pause();

  }

}


function resumeRecording(tabId) {

  const item =
    recorders.get(tabId);

  if (!item) {
    return;
  }


  if (
    item.recorder.state ===
    "paused"
  ) {

    item.recorder.resume();

  }

}


function stopRecording(tabId) {

  const item =
    recorders.get(tabId);

  if (!item) {
    return;
  }


  if (
    item.recorder.state !==
    "inactive"
  ) {

    item.recorder.stop();

  }

}


async function convertToMP4(
  tabId,
  title,
  webmBlob
) {

  try {

    await loadFFmpeg();


    const inputName =
      `input-${tabId}.webm`;

    const outputName =
      `output-${tabId}.mp4`;


    await ffmpeg.writeFile(
      inputName,
      await fetchFile(webmBlob)
    );


    /*
     * H.264 video + AAC audio.
     *
     * There is no audio in our recording,
     * so we only encode the video.
     */

    await ffmpeg.exec([

      "-i",
      inputName,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      "23",

      "-pix_fmt",
      "yuv420p",

      "-movflags",
      "+faststart",

      outputName

    ]);


    const data =
      await ffmpeg.readFile(
        outputName
      );


    const mp4Blob =
      new Blob(
        [data.buffer],
        {
          type: "video/mp4"
        }
      );


    const url =
      URL.createObjectURL(
        mp4Blob
      );


    const safeTitle =
      sanitizeFilename(
        title || `tab-${tabId}`
      );


    chrome.runtime.sendMessage({

      type: "DOWNLOAD_MP4",

      url,

      filename:
        `${safeTitle}.mp4`

    });


    /*
     * Clean FFmpeg's virtual filesystem.
     */

    try {

      await ffmpeg.deleteFile(
        inputName
      );

      await ffmpeg.deleteFile(
        outputName
      );

    } catch (error) {

      console.warn(
        "Could not clean FFmpeg files",
        error
      );

    }


  } catch (error) {

    console.error(
      "MP4 conversion failed:",
      error
    );

  }

}


function sanitizeFilename(name) {

  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

}