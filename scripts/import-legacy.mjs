// Copies the data of the old site (one JSON document in the Netlify Blobs store "pozivnaklik")
// into Postgres, moving photos into the new photo store. The old data is only read, never changed.
// Running it twice is safe: records that are already there are skipped.
//
// From the live site's Blobs (read-only):
//   NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... DATABASE_URL=... APP_ENV=staging npm run import-legacy
// From a file saved earlier (e.g. `netlify blobs:get pozivnaklik db > legacy-db.json`):
//   DATABASE_URL=... APP_ENV=staging npm run import-legacy -- legacy-db.json
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadConfig } from "../server/config.js";
import { connect } from "../server/db.js";
import { mediaStore } from "../server/media.js";

const cfg = loadConfig({ platform: "node" });
const file = process.argv[2];
let legacyStore = null;
if (cfg.blobs.siteID && cfg.blobs.token) {
  const { getStore } = await import("@netlify/blobs");
  legacyStore = getStore({ name: "pozivnaklik", siteID: cfg.blobs.siteID, token: cfg.blobs.token });
}
const old = file ? JSON.parse(await readFile(file, "utf8")) : legacyStore ? await legacyStore.get("db", { type: "json" }) : null;
if (!old) { console.error("Give a legacy JSON file, or set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN to read it from the live site."); process.exit(1); }

const db = await connect(cfg);
const media = await mediaStore(cfg);
const sha = b => createHash("sha256").update(b).digest("hex");
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const EXT = { jpeg: "jpg", png: "png", webp: "webp" };
const n = { users: 0, sessions: 0, invites: 0, photos: 0, previews: 0, guests: 0, requests: 0 };
const t0 = Date.now();

for (const u of old.users || []) {
  const r = await db.query(`INSERT INTO users (id, name, email, salt, hash, created_at, last_login) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
    [u.id, u.name || "", String(u.email).toLowerCase(), u.salt, u.hash, u.createdAt || t0, u.lastLogin || null]);
  n.users += r.length;
}
// people who are signed in on the old site stay signed in
for (const s of old.sessions || []) {
  if (!(s.exp > t0)) continue;
  const r = await db.query("INSERT INTO sessions (sid_hash, user_id, exp) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM users WHERE id = $2) ON CONFLICT DO NOTHING RETURNING sid_hash", [sha(s.sid), s.userId, s.exp]);
  n.sessions += r.length;
}
for (const i of old.invites || []) {
  const data = {};
  for (const [k, v] of Object.entries(i.data || {})) {
    const m = /^photo\d?$/.test(k) && DATA_URL.exec(String(v));
    if (m) {
      const buf = Buffer.from(m[2], "base64"), key = `inv/${i.id}/${k}-${sha(buf).slice(0, 12)}.${EXT[m[1]]}`;
      await media.put(key, buf, `image/${m[1]}`);
      data[k] = `/media/${key}`; n.photos++;
    } else data[k] = v;
  }
  const r = await db.query(`INSERT INTO invites (id, slug, owner_id, template_id, data, tier, status, price, og, views, paid_at, created_at, updated_at)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13 WHERE EXISTS (SELECT 1 FROM users WHERE id = $3) ON CONFLICT DO NOTHING RETURNING id`,
    [i.id, i.slug, i.ownerId, i.templateId, JSON.stringify(data), i.tier || null, i.status || "active", i.price ? JSON.stringify(i.price) : null,
     i.og ? JSON.stringify(i.og) : null, i.views || 0, i.paidAt || null, i.createdAt || t0, i.updatedAt || i.createdAt || t0]);
  n.invites += r.length;
  if (i.og && legacyStore) {
    const buf = await legacyStore.get("og/" + i.slug, { type: "arrayBuffer" });
    if (buf) { await media.put(`og/${i.slug}.jpg`, Buffer.from(buf), "image/jpeg"); n.previews++; }
  }
}
for (const g of old.guests || []) {
  const r = await db.query(`INSERT INTO guests (id, invitation_id, token, name, contact, source, status, count, note, created_at, opened_at, responded_at)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12 WHERE EXISTS (SELECT 1 FROM invites WHERE id = $2) ON CONFLICT DO NOTHING RETURNING id`,
    [g.id, g.invitationId, g.token, g.name || "", g.contact || "", g.source || "personal", g.status || "pending", Number(g.count) || 0, g.note || "", g.createdAt || t0, g.openedAt || null, g.respondedAt || null]);
  n.guests += r.length;
}
for (const q of old.requests || []) {
  const images = [];
  for (const [k, u] of (q.images || []).entries()) {
    const m = DATA_URL.exec(String(u));
    if (!m) continue;
    const key = `req/${q.id}/${k + 1}.${EXT[m[1]]}`;
    await media.put(key, Buffer.from(m[2], "base64"), `image/${m[1]}`);
    images.push(`/media/${key}`);
  }
  const r = await db.query(`INSERT INTO requests (id, name, email, phone, date, occasion, tier, message, link, images, lang, status, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING RETURNING id`,
    [q.id, q.name || "", q.email || "", q.phone || "", q.date || "", q.occasion || "", q.tier || "", q.message || "", q.link || "", JSON.stringify(images), q.lang || "", q.status || "new", q.createdAt || t0]);
  n.requests += r.length;
}
console.log(`Imported into "${cfg.appEnv}":`, n);
await db.close();
