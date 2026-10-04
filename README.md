# Chrome-tab-recorder

A free Chrome extension that records multiple tabs at the same time and saves them as MP4.

## Why

I'm collecting video material for my AI car project. Every recorder extension I tried either cost money and only recorded one tab at a time, or was rated 2 stars for a good reason (one wouldn't stop, pause, or download the video). The paid one I used cost $6 and shut itself off after 6 hours.

So I'm building my own, for fun and convenience.

## Features

- Record several tabs at the same time
- Pause, resume, and stop each tab separately, or all at once
- Recording timer for every tab
- MP4 conversion with FFmpeg (one at a time, with progress), or save the fast WebM file instead
- If MP4 conversion fails, the WebM is saved so nothing is lost
- Closing a tab stops and saves its recording
- Files are named after the tab title
- Free, with no time limit

## Install

You need [Node.js](https://nodejs.org).

```bash
git clone https://github.com/sensei2412/Chrome-tab-recorder.git
cd Chrome-tab-recorder/multi-tab-recorder
npm install
npm run build
```

`npm run build` also copies the FFmpeg files from `@ffmpeg/core` into `public/ffmpeg/` for you.

Then load it into Chrome:

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `multi-tab-recorder/dist` folder
5. Pin the extension from the puzzle icon in the toolbar

After changing code, run `npm run build` again and click the refresh icon on the extension's card.

## Usage

Chrome only lets an extension record a tab after you have opened the extension on that tab, so you start each tab yourself:

1. Go to the first tab you want to record.
2. Click the extension icon, then **Record this tab**.
3. Go to the next tab and repeat. Every recording shows up in the list.
4. Use **Pause**, **Resume**, and **Stop** on each row, or **Pause all**, **Resume all**, and **Stop all & save**.
5. Finished videos are saved in your Downloads folder, in `Tab Recordings/`.

Notes:

- Chrome's own pages (`chrome://...`) can't be recorded.
- Only video is recorded, not audio.
- MP4 conversion runs in the browser and is slow for long recordings. Untick **Convert to MP4** to save the WebM directly.

## Project structure

```
multi-tab-recorder/
├── public/manifest.json      extension manifest (copied to dist/)
├── scripts/copy-ffmpeg.js    copies FFmpeg core files before the build
├── src/
│   ├── popup.html/.css/.js   the popup you click
│   ├── background.js         creates the offscreen page, saves downloads
│   ├── offscreen.html/.js    records tabs and converts to MP4
├── vite.config.js
└── package.json
```

## Roadmap

- [x] Pause / Resume / Stop for every tab
- [x] Recording timers
- [x] Conversion progress
- [x] Queue so conversions don't run at the same time
- [x] Handle a tab closing mid-recording
- [x] Filenames from tab titles
- [ ] Download All after every conversion finishes
- [ ] Audio recording
