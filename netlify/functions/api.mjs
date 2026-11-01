// Poziv na klik API on Netlify: the same code as server.js (lib/app.js), with data kept in Netlify Blobs.
import { Readable } from "node:stream";
import { getStore } from "@netlify/blobs";
import app from "../../lib/app.js";

const KEY = "db";

function nodeReq(request, bodyBuf) {
  const u = new URL(request.url);
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  if (!headers["x-forwarded-proto"]) headers["x-forwarded-proto"] = u.protocol.replace(":", "");
  const req = Readable.from(bodyBuf && bodyBuf.length ? [bodyBuf] : []);
  Object.assign(req, { method: request.method, url: u.pathname + u.search, headers, socket: {} });
  return { req, url: new URL(u.pathname + u.search, "http://localhost") };
}

function nodeRes() {
  const out = { status: 200, headers: {}, body: "", headersSent: false };
  return {
    out,
    get headersSent() { return out.headersSent; },
    writeHead(code, h = {}) { out.status = code; Object.assign(out.headers, h); out.headersSent = true; },
    setHeader(k, v) { out.headers[k] = v; },
    end(b) { out.body = b == null ? "" : b; out.headersSent = true; }
  };
}

// one request at a time per instance, so requests never share the in-memory data
let queue = Promise.resolve();
export default (request) => { const run = queue.then(() => handle(request)); queue = run.catch(() => {}); return run; };

async function handle(request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/health") return Response.json({ app: "paperlace", ok: true });

  const store = getStore({ name: "pozivnaklik", consistency: "strong" });
  const bodyBuf = request.method === "GET" || request.method === "HEAD" ? null : Buffer.from(await request.arrayBuffer());

  for (let attempt = 0; attempt < 4; attempt++) {
    const found = await store.getWithMetadata(KEY, { type: "json" });
    app.setDb(found ? found.data : null);
    const { req, url } = nodeReq(request, bodyBuf);
    const res = nodeRes();
    try {
      if (app.crossSiteBlocked(req)) app.fail(res, 403, app.M(req, "Cross-site requests are not allowed."));
      else await app.api(req, res, url);
    } catch (e) {
      const bad = e.message === "bad json";
      if (!res.headersSent) app.fail(res, bad ? 400 : 500, app.M(req, bad ? "The request couldn't be read." : "Something went wrong on our side. Please try again."));
      if (!bad) console.error(e);
    }
    if (app.isDirty()) {
      // save only if nobody else changed the data meanwhile; otherwise run the request again on fresh data
      const opts = found && found.etag ? { onlyIfMatch: found.etag } : { onlyIfNew: true };
      const r = await store.setJSON(KEY, app.getDb(), opts);
      if (r && r.modified === false) continue;
    }
    return new Response(res.out.body, { status: res.out.status, headers: res.out.headers });
  }
  return Response.json({ error: "Busy, please try again." }, { status: 503 });
}

export const config = { path: ["/api", "/api/*"] };
