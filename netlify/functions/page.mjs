// Guest links (/i/<code>): the site's page with the invitation's own title, description, picture and
// background colour, so shared links look right and the page opens on the design's colour.
import { appFor } from "../../server/netlify.js";
import { slugOk } from "../../server/api.js";

let shell = null;
export default async (req, context) => {
  const u = new URL(req.url);
  if (!shell) {
    const r = await fetch(new URL("/index.html", u.origin));
    if (!r.ok) return r;
    shell = await r.text();
  }
  const m = u.pathname.match(/^\/i\/([A-Za-z0-9]+)\/?$/);
  const html = m && slugOk(m[1]) ? await appFor(context).invitePage(shell, m[1], u.origin) : shell;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" } });
};

export const config = { path: "/i/*" };
