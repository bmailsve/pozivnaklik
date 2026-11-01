// Poziv na klik — run on any Node 18+ host: serves the page and the API, keeps data in data/db.json.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const app = require("./lib/app");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
try { app.setDb(JSON.parse(fs.readFileSync(DB_FILE, "utf8"))); } catch (e) { /* first run */ }
let writing = false, again = false;
app.hooks.onSave = function persist() {
  if (writing) { again = true; return; }
  writing = true;
  const tmp = DB_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(app.getDb()), err => {
    if (err) { writing = false; console.error("save failed", err); return; }
    fs.rename(tmp, DB_FILE, () => { writing = false; if (again) { again = false; persist(); } });
  });
};

const PAGE = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
function sendPage(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
  res.end(PAGE);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      if (app.crossSiteBlocked(req)) return app.fail(res, 403, app.M(req, "Cross-site requests are not allowed."));
      return await app.api(req, res, url);
    }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
    if (req.method === "GET" || req.method === "HEAD") return sendPage(res);
    res.writeHead(405); res.end();
  } catch (e) {
    if (!res.headersSent) app.fail(res, e.message === "bad json" ? 400 : 500, app.M(req, e.message === "bad json" ? "The request couldn't be read." : "Something went wrong on our side. Please try again."));
    if (e.message !== "bad json") console.error(e);
  }
}).listen(PORT, () => console.log(`Poziv na klik running on http://localhost:${PORT}`));
