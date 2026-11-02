// Runs the whole site on a plain Node server: the built page from dist/, the API, photos and guest links.
// `npm start` (after `npm run build`) for a local production check or a non-Netlify host;
// `npm run dev` starts it with --api-only behind Vite's dev server.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createApp, slugOk } from "./api.js";

const apiOnly = process.argv.includes("--api-only");
const PORT = Number(process.env.PORT) || (apiOnly ? 8788 : 3000);
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const app = createApp(loadConfig({ platform: "node" }));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".txt": "text/plain" };

async function toRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await new Promise((res, rej) => {
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size > 5_000_000) { rej(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => res(Buffer.concat(chunks))); req.on("error", rej);
  });
  return new Request(`${proto}://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body });
}
async function send(res, r) {
  const headers = {};
  r.headers.forEach((v, k) => { headers[k] = v; });
  const cookie = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (cookie.length) headers["set-cookie"] = cookie;
  res.writeHead(r.status, headers);
  res.end(Buffer.from(await r.arrayBuffer()));
}
async function staticFile(res, path) {
  const file = normalize(join(DIST, path));
  if (!file.startsWith(normalize(DIST))) return false;
  try { if (!(await stat(file)).isFile()) return false; } catch (e) { return false; }
  const hashed = path.startsWith("/assets/");
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" });
  res.end(await readFile(file));
  return true;
}

http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/api" || path.startsWith("/api/")) return send(res, await app.handle(await toRequest(req), req.socket.remoteAddress || ""));
    if (path.startsWith("/media/") || path.startsWith("/og/")) return send(res, await app.file(await toRequest(req)));
    if (apiOnly) { res.writeHead(404); return res.end(); }
    if (path !== "/" && path !== "/index.html" && await staticFile(res, path)) return;
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    let html = await readFile(join(DIST, "index.html"), "utf8");
    const m = path.match(/^\/i\/([A-Za-z0-9]+)\/?$/);
    if (m && slugOk(m[1])) {
      let manifest = null;
      try { manifest = JSON.parse(await readFile(join(DIST, ".vite", "manifest.json"), "utf8")); } catch (e) { /* not built with a manifest */ }
      html = await app.invitePage(html, m[1], `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`, manifest);
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
    res.end(html);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.writeHead(e.message === "too large" ? 413 : 500); res.end(); }
  }
}).listen(PORT, () => console.log(`Poziv na klik ${apiOnly ? "API" : "site"} on http://localhost:${PORT}`));
