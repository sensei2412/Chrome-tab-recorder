import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.html"),
        offscreen: resolve(__dirname, "src/offscreen.html")
      },
      output: {
        entryFileNames: "src/[name].js",
        chunkFileNames: "src/[name].js",
        assetFileNames: "src/[name][extname]"
      }
    },
    outDir: "dist",
    emptyOutDir: true
  },
  publicDir: "public",

  plugins: [
    {
      name: "copy-extension-files",

      closeBundle() {
        // manifest.json lives in public/, so Vite copies it to dist/ by itself.
        const files = [
          ["src/background.js", "dist/src/background.js"]
        ];

        for (const [source, destination] of files) {
          const dir = destination.substring(0, destination.lastIndexOf("/"));

          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }

          copyFileSync(source, destination);
        }
      }
    }
  ]
});