// Guest links (/i/<code>) with their own title, description and picture for WhatsApp, Viber and Instagram,
// and the picture itself (/og/<code>.jpg). Data comes from Netlify Blobs, like the API.
import { getStore } from "@netlify/blobs";
import app from "../../lib/app.js";

export default async (request) => {
  const u = new URL(request.url);
  const store = getStore({ name: "pozivnaklik", consistency: "strong" });
  let m = u.pathname.match(/^\/og\/([A-Za-z0-9]+)\.jpg$/);
  if (m && app.slugOk(m[1])) {
    const buf = await store.get("og/" + m[1], { type: "arrayBuffer" });
    if (buf) return new Response(buf, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" } });
    return Response.redirect(new URL("/og.jpg", u.origin), 302);
  }
  const page = await fetch(new URL("/index.html", u.origin));
  let html = await page.text();
  m = u.pathname.match(/^\/i\/([A-Za-z0-9]+)\/?$/);
  if (m && app.slugOk(m[1])) {
    try { app.setDb(await store.get("db", { type: "json" })); html = app.pageWithMeta(html, m[1], u.origin); } catch (e) { console.error(e); }
  }
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" } });
};

export const config = { path: ["/i/*", "/og/*"] };
