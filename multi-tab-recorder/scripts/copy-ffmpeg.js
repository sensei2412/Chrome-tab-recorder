// Copies the FFmpeg core files from node_modules into public/ffmpeg/
// so Vite bundles them with the extension. Runs automatically before
// "npm run build".

const fs = require("fs");
const path = require("path");

const source = path.join(
  __dirname, "..", "node_modules", "@ffmpeg", "core", "dist", "esm"
);
const target = path.join(__dirname, "..", "public", "ffmpeg");

fs.mkdirSync(target, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}

console.log("Copied FFmpeg core files to public/ffmpeg/");
