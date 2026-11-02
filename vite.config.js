import { defineConfig } from "vite";

// Netlify sets CONTEXT while building: only the production build may be indexed by search engines,
// so staging and preview copies of the site never compete with the real one in Google.
const indexable = process.env.CONTEXT === "production";
const robots = {
  name: "robots",
  transformIndexHtml: html => indexable ? html : html.replace("<meta charset=\"utf-8\">", "<meta charset=\"utf-8\">\n<meta name=\"robots\" content=\"noindex, nofollow\">"),
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "robots.txt", source: indexable ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n" });
  }
};

// The site lives in src/ and is built into dist/ (what Netlify publishes).
// Every built file except index.html gets a content hash in its name, so it can be cached for a year.
export default defineConfig({
  root: "src",
  plugins: [robots],
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    reportCompressedSize: false,
    // dist/.vite/manifest.json: lets guest links preload the 3D code of their design (server/api.js)
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  server: {
    port: 5173,
    // npm run dev starts the API on 8788 (see scripts/dev.mjs); the page talks to it through here
    proxy: Object.fromEntries(["/api", "/og", "/media"].map(p => [p, "http://localhost:8788"]))
  }
});
