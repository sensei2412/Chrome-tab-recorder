# Chrome-tab-recorder
A free Chrome extension that records multiple tabs at the same time and saves them as MP4.

# Why
I'm collecting video material for my AI car project. Every recorder extension I tried either cost money and only recorded one tab at a time, or was rated 2 stars for a good reason (one wouldn't stop, pause, or download the video). The paid one I used cost $6 and shut itself off after 6 hours.
So I'm building my own, for fun and convenience.

# Features
Record several tabs at the same time
Pause, resume, and stop each tab separately, or all at once
Recording timer for every tab
Records MP4 directly when Chrome supports it, so there is no waiting
If Chrome can't record MP4, it records WebM and converts it with FFmpeg (one at a time, with progress)
If MP4 conversion fails, the WebM is saved so nothing is lost
Closing a tab stops and saves its recording
Files are named after the tab title
Free, with no time limit

# Install
You need Node.js.

just copy this haha
bash
git clone https://github.com/sensei2412/Chrome-tab-recorder.git
cd Chrome-tab-recorder/multi-tab-recorder
npm install
npm run build

npm run build also copies the FFmpeg files from @ffmpeg/core into public/ffmpeg/ for you.

Then load it into Chrome:
Go to chrome://extensions
Turn on Developer mode (top right)
Click Load unpacked
Select the multi-tab-recorder/dist folder
Pin the extension from the puzzle icon in the toolbar

After changing code, run npm run build again and click the refresh icon on the extension's card.

# Usage
Chrome only lets an extension record a tab after you have opened the extension on that tab, so you start each tab yourself:

Go to the first tab you want to record.
Click the extension icon, then Record this tab.
Go to the next tab and repeat. Every recording shows up in the list.
Use Pause, Resume, and Stop on each row, or Pause all, Resume all, and Stop all & save.
Finished videos are saved in your Downloads folder, in Tab Recordings/.

# Notes:
Chrome's own pages (chrome://...) can't be recorded.
Only video is recorded, not audio.
If Chrome can't record MP4 directly, the FFmpeg conversion runs in the browser and is much slower than the video length. Untick Save as MP4 to save WebM instead.

# Project structure
Chrome-tab-recorder/
├── README.md
├── .gitignore
└── multi-tab-recorder/
    ├── public/
    │   ├── manifest.json      extension manifest (copied to dist/)
    │   └── icons/             extension icons (16, 48, 128)
    ├── scripts/
    │   └── copy-ffmpeg.js     copies the FFmpeg core files before the build
    ├── src/
    │   ├── popup.html         the popup you click
    │   ├── popup.css
    │   ├── popup.js           start, pause, resume, stop, and the list of recordings
    │   ├── background.js      creates the offscreen page, saves the downloads
    │   ├── offscreen.html
    │   └── offscreen.js       records the tabs, saves MP4, falls back to FFmpeg
    ├── vite.config.js         build setup
    ├── package.json
    └── package-lock.json

dist/, node_modules/, and public/ffmpeg/ are created by npm install and npm run build, so they are in .gitignore and not in the repo.

Roadmap
 Pause / Resume / Stop for every tab
 Recording timers
 Conversion progress
 Queue so conversions don't run at the same time
 Handle a tab closing mid-recording
 Filenames from tab titles
 Record MP4 directly when Chrome supports it
