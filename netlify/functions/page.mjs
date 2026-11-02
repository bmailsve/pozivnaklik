// Guest links (/i/<code>): the site's page with the invitation's own title, description, picture and
// background colour, so shared links look right and the page opens on the design's colour.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appFor } from "../../server/netlify.js";
import { slugOk } from "../../server/api.js";

// The built page ships inside this function (netlify.toml: included_files). Reading it over HTTP is
// only a fallback: on staging such a request would meet the password page.
async function loadShell(req) {
  try { return await readFile(join(process.cwd(), "dist", "index.html"), "utf8"); } catch (e) { /* fall back */ }
  const r = await fetch(new URL("/index.html", req.url), { headers: { cookie: req.headers.get("cookie") || "" } });
  if (!r.ok) return null;
  return r.text();
}

let shell = null;
export default async (req, context) => {
  if (!shell) shell = await loadShell(req);
  if (!shell) return new Response("Page not available", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const m = new URL(req.url).pathname.match(/^\/i\/([A-Za-z0-9]+)\/?$/);
  const html = m && slugOk(m[1]) ? await appFor(context).invitePage(shell, m[1], new URL(req.url).origin) : shell;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" } });
};

export const config = { path: "/i/*" };
