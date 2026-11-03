// Poziv na klik JSON API: accounts, invitations, guests, RSVPs, custom-design requests and payments.
// Works with standard Request/Response objects, so the same code runs as a Netlify Function and in
// the Node server (server/node-server.mjs). The routes and responses match what src/main.js expects.
import crypto from "node:crypto";
import { connect } from "./db.js";
import { mediaStore, keyOk } from "./media.js";

/* ---------- catalogue ---------- */
// Package of each template that is on sale. Older templates stay valid for existing invitations.
export const TEMPLATE_TIERS = { b_rose: "basic", b_olive: "basic", b_bunny: "basic", b_balloon: "basic", b_gold: "basic", b_dove: "basic", b_lav: "basic", b_euca: "basic", b_bless: "basic", b_dino: "basic", b_champ: "basic", b_ruby: "basic",
  e_peony: "envelope", e_night: "envelope", e_lamb: "envelope", e_picnic: "envelope", e_lace: "envelope", e_disco: "envelope", e_kiss: "envelope", vinyl: "premium", p_disco: "premium", p_bow: "premium", p_honey: "premium", p_dino: "premium", p_plane: "premium", p_bloom: "premium", p_rip: "premium", b_ilija: "basic", b_sea: "basic", b_esp: "basic", e_estate: "envelope", e_lemon: "envelope", e_rouge: "envelope", p_letter: "premium", p_sky: "premium", p_balloon: "premium", p_gold: "premium" };
// Premium is on sale: regular price 3490 RSD · 30 €
export const PRICES = { basic: { eur: 10, rsd: 1190 }, envelope: { eur: 19, rsd: 2190 }, premium: { eur: 26, rsd: 3090 } };
const TEMPLATE_IDS = new Set([...Object.keys(TEMPLATE_TIERS), "storybook", "cherry", "era", "jungle", "castle", "princess", "blossom", "cars", "noir", "champagne", "emerald", "marble", "starlit", "garden", "olive", "ivory", "gatsby", "dustyblue", "christening", "celebration"]);
const SESSION_DAYS = 30;

/* ---------- messages (Serbian default, English on request) ---------- */
const SR = {
  "Too many attempts. Please wait a minute and try again.": "Previše pokušaja. Sačekajte minut i pokušajte ponovo.",
  "Please enter your name.": "Unesite svoje ime.",
  "Please fill in your name, email and a short description.": "Upišite ime, imejl i kratak opis.",
  "Please enter a valid email address.": "Unesite ispravnu imejl adresu.",
  "Use at least 8 characters for your password.": "Lozinka mora imati najmanje 8 karaktera.",
  "An account with this email already exists. Sign in instead.": "Nalog sa ovom imejl adresom već postoji. Prijavite se.",
  "That email and password don't match. Try again.": "Imejl i lozinka se ne poklapaju. Pokušajte ponovo.",
  "This invitation doesn't exist or was removed by the host.": "Ova pozivnica ne postoji ili ju je domaćin uklonio.",
  "Too many replies from this connection. Please wait a minute.": "Previše odgovora sa ove veze. Sačekajte minut.",
  "This invitation doesn't exist anymore.": "Ova pozivnica više ne postoji.",
  "Please choose whether you can attend.": "Izaberite da li dolazite.",
  "Please tell the host your name.": "Napišite domaćinu svoje ime.",
  "This invitation has reached its reply limit.": "Ova pozivnica je dostigla maksimalan broj odgovora.",
  "Please sign in to continue.": "Prijavite se da biste nastavili.",
  "Please choose a template.": "Izaberite dizajn.",
  "You've reached the limit of 200 invitations.": "Dostigli ste ograničenje od 200 pozivnica.",
  "We couldn't find that invitation.": "Nismo pronašli tu pozivnicu.",
  "Please enter the guest's name.": "Unesite ime gosta.",
  "Not found.": "Nije pronađeno.",
  "Cross-site requests are not allowed.": "Zahtevi sa drugih sajtova nisu dozvoljeni.",
  "The request couldn't be read.": "Zahtev nije moguće pročitati.",
  "The request is too large.": "Zahtev je prevelik.",
  "Something went wrong on our side. Please try again.": "Došlo je do greške kod nas. Pokušajte ponovo.",
  "The site is being updated. Please try again in a minute.": "Sajt se ažurira. Pokušajte ponovo za minut.",
  "This invitation isn't active yet.": "Ova pozivnica još nije aktivna.",
  "To switch to a different package, please contact us.": "Za promenu paketa nas kontaktirajte."
};

/* ---------- helpers ---------- */
const ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const rid = (n = 10) => { let s = ""; for (const x of crypto.randomBytes(n)) s += ALPHA[x % ALPHA.length]; return s; };
const now = () => Date.now();
const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");
export const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
function checkPw(pw, salt, hash) { const a = Buffer.from(hashPw(pw, salt), "hex"), b = Buffer.from(hash, "hex"); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const str = (v, max) => String(v ?? "").trim().slice(0, max);
export const slugOk = s => /^[A-Za-z0-9]{4,20}$/.test(String(s || ""));
const idOk = s => /^[A-Za-z0-9]{1,40}$/.test(String(s || ""));
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const EXT = { jpeg: "jpg", png: "png", webp: "webp" };

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function stats(gs) {
  const s = { invited: gs.length, opened: 0, yes: 0, no: 0, pending: 0, people: 0 };
  for (const g of gs) {
    if (g.openedAt || g.status !== "pending") s.opened++;
    if (g.status === "yes") { s.yes++; s.people += Number(g.count) || 1; }
    else if (g.status === "no") s.no++; else s.pending++;
  }
  return s;
}

/* rows → the JSON shapes the page uses */
const userOut = r => r && ({ id: r.id, name: r.name, email: r.email, salt: r.salt, hash: r.hash, createdAt: r.created_at, lastLogin: r.last_login });
const inviteOut = r => r && ({ id: r.id, slug: r.slug, ownerId: r.owner_id, templateId: r.template_id, data: r.data || {}, tier: r.tier, status: r.status, price: r.price, og: r.og || undefined, views: r.views, paidAt: r.paid_at || undefined, createdAt: r.created_at, updatedAt: r.updated_at });
const guestOut = r => r && ({ id: r.id, invitationId: r.invitation_id, token: r.token, name: r.name, contact: r.contact, source: r.source, status: r.status, count: r.count, note: r.note, createdAt: r.created_at, openedAt: r.opened_at, respondedAt: r.responded_at });
const guestPublic = g => ({ name: g.name, status: g.status, count: g.count, note: g.note, token: g.token, source: g.source });
const requestOut = r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, date: r.date, occasion: r.occasion, tier: r.tier, message: r.message, link: r.link, images: r.images || [], lang: r.lang, status: r.status, createdAt: r.created_at });

/* rate limiting per IP and bucket (per server instance) */
const hits = new Map();
function limited(ip, bucket, max) {
  const key = bucket + ":" + ip, t = now();
  let h = hits.get(key);
  if (!h || h.reset < t) { h = { n: 0, reset: t + 60000 }; hits.set(key, h); }
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < t) hits.delete(k);
  return ++h.n > max;
}

function cookies(req) {
  const o = {};
  (req.headers.get("cookie") || "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) { try { o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) { /* ignore bad cookie */ } } });
  return o;
}
function sessionCookie(req, sid, maxAge) {
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return `pl_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export function crossSiteBlocked(req) {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const o = req.headers.get("origin");
  if (!o) return false;
  try { return new URL(o).host !== (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host); } catch (e) { return true; }
}
async function readJson(req, max = 4_000_000) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) throw new HttpError(413, "The request is too large.");
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, "The request is too large.");
  if (!text) return {};
  try { const b = JSON.parse(text); return b && typeof b === "object" ? b : {}; } catch (e) { throw new HttpError(400, "The request couldn't be read."); }
}
const json = (status, obj, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

/* ---------- the app ---------- */
export function createApp(cfg) {
  const isAdmin = u => !!u && cfg.adminEmails.has(String(u.email).toLowerCase());
  const publicUser = u => ({ id: u.id, name: u.name, email: u.email, admin: isAdmin(u) });
  const statusOf = i => (cfg.payments ? (i.status || "active") : "active");
  const withStatus = i => i && ({ ...i, status: statusOf(i) });
  let media = null;
  const getMedia = async () => media || (media = await mediaStore(cfg));

  // Photos arrive as data URLs from the editor; they are stored as files and the invitation keeps a short link.
  async function cleanData(d, invId, keep = {}) {
    const out = {};
    if (!d || typeof d !== "object") return out;
    for (const [k, v] of Object.entries(d).slice(0, 60)) {
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,29}$/.test(k)) continue;
      const val = String(v ?? "");
      if (/^photo\d?$/.test(k)) {
        if (val === "") { out[k] = ""; continue; }
        const m = DATA_URL.exec(val);
        if (m && val.length <= 700000) {
          const buf = Buffer.from(m[2], "base64");
          const key = `inv/${invId}/${k}-${sha256(buf).slice(0, 12)}.${EXT[m[1]]}`;
          await (await getMedia()).put(key, buf, `image/${m[1]}`);
          out[k] = `/media/${key}`;
        } else if (val.startsWith(`/media/inv/${invId}/`) && keyOk(val.slice(7))) out[k] = val;
        else if (keep[k] && keep[k] === val) out[k] = val;
        continue;
      }
      out[k] = val.slice(0, 600);
    }
    return out;
  }

  async function handle(req, ip = "") {
    const url = new URL(req.url);
    const p = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
    const lang = req.headers.get("x-lang") === "en" ? "en" : "sr";
    const M = s => (lang === "en" ? s : (SR[s] || s));
    const fail = (status, msg) => json(status, { error: M(msg) });

    if (p === "/health") return json(200, { app: "paperlace", ok: true, env: cfg.appEnv });
    if (crossSiteBlocked(req)) return fail(403, "Cross-site requests are not allowed.");

    let db;
    try {
      if (cfg.platform === "netlify" && !cfg.databaseUrl) throw Object.assign(new Error(`DATABASE_URL is not set for the "${cfg.appEnv}" environment`), { code: "NO_DB" });
      db = await connect(cfg);
    } catch (e) {
      console.error("database unavailable:", e.message);
      return fail(503, "The site is being updated. Please try again in a minute.");
    }
    try {
      return await route(req, url, p, ip, db, M, fail);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e);
      return fail(500, "Something went wrong on our side. Please try again.");
    }
  }

  async function currentUser(req, db) {
    const sid = cookies(req).pl_sid; if (!sid) return null;
    const [u] = await db.query("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.sid_hash = $1 AND s.exp > $2", [sha256(sid), now()]);
    return userOut(u) || null;
  }
  async function startSession(req, db, user) {
    const sid = rid(32);
    await db.query("INSERT INTO sessions (sid_hash, user_id, exp) VALUES ($1, $2, $3)", [sha256(sid), user.id, now() + SESSION_DAYS * 864e5]);
    // occasional clean-up of expired sessions
    if (Math.random() < 0.05) await db.query("DELETE FROM sessions WHERE exp < $1", [now()]);
    return { "Set-Cookie": sessionCookie(req, sid, SESSION_DAYS * 86400) };
  }
  const guestsOf = async (db, invId) => (await db.query("SELECT * FROM guests WHERE invitation_id = $1 ORDER BY created_at", [invId])).map(guestOut);

  async function route(req, url, p, ip, db, M, fail) {
    const m = req.method;
    let seg;

    if (p === "/auth/signup" && m === "POST") {
      if (limited(ip, "auth", 20)) return fail(429, "Too many attempts. Please wait a minute and try again.");
      const b = await readJson(req);
      const name = str(b.name, 80), email = str(b.email, 160).toLowerCase(), pw = String(b.password || "");
      if (!name) return fail(400, "Please enter your name.");
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail(400, "Please enter a valid email address.");
      if (pw.length < 8) return fail(400, "Use at least 8 characters for your password.");
      const salt = rid(16);
      const user = { id: rid(12), name, email, salt, hash: hashPw(pw, salt), createdAt: now() };
      const [made] = await db.query("INSERT INTO users (id, name, email, salt, hash, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING RETURNING id",
        [user.id, name, email, salt, user.hash, user.createdAt]);
      if (!made) return fail(409, "An account with this email already exists. Sign in instead.");
      return json(201, { user: publicUser(user) }, await startSession(req, db, user));
    }
    if (p === "/auth/login" && m === "POST") {
      if (limited(ip, "auth", 20)) return fail(429, "Too many attempts. Please wait a minute and try again.");
      const b = await readJson(req);
      const user = userOut((await db.query("SELECT * FROM users WHERE email = $1", [str(b.email, 160).toLowerCase()]))[0]);
      if (!user || !checkPw(String(b.password || ""), user.salt, user.hash)) return fail(401, "That email and password don't match. Try again.");
      await db.query("UPDATE users SET last_login = $1 WHERE id = $2", [now(), user.id]);
      return json(200, { user: publicUser(user) }, await startSession(req, db, user));
    }
    if (p === "/auth/logout" && m === "POST") {
      const sid = cookies(req).pl_sid;
      if (sid) await db.query("DELETE FROM sessions WHERE sid_hash = $1", [sha256(sid)]);
      return json(200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
    }
    if (p === "/config" && m === "GET") return json(200, { payment: cfg.payment, prices: PRICES });
    if (p === "/me" && m === "GET") { const u = await currentUser(req, db); return json(200, { user: u ? publicUser(u) : null }); }

    /* public guest routes */
    if ((seg = p.match(/^\/public\/([A-Za-z0-9]{4,20})$/)) && m === "GET") {
      const inv = inviteOut((await db.query("SELECT * FROM invites WHERE slug = $1", [seg[1]]))[0]);
      if (!inv) return fail(404, "This invitation doesn't exist or was removed by the host.");
      if (statusOf(inv) !== "active") { const u = await currentUser(req, db); if (!u || (u.id !== inv.ownerId && !isAdmin(u))) return json(200, { inactive: true }); }
      const token = url.searchParams.get("g");
      const [, rows] = await Promise.all([
        db.query("UPDATE invites SET views = views + 1 WHERE id = $1", [inv.id]),
        token ? db.query("UPDATE guests SET opened_at = COALESCE(opened_at, $3) WHERE token = $1 AND invitation_id = $2 RETURNING *", [token, inv.id, now()]) : []
      ]);
      const g = guestOut(rows[0]);
      return json(200, { invitation: { slug: inv.slug, templateId: inv.templateId, data: inv.data }, guest: g ? guestPublic(g) : null });
    }
    if ((seg = p.match(/^\/public\/([A-Za-z0-9]{4,20})\/rsvp$/)) && m === "POST") {
      if (limited(ip, "rsvp", 40)) return fail(429, "Too many replies from this connection. Please wait a minute.");
      const inv = inviteOut((await db.query("SELECT * FROM invites WHERE slug = $1", [seg[1]]))[0]);
      if (!inv) return fail(404, "This invitation doesn't exist anymore.");
      if (statusOf(inv) !== "active") return fail(403, "This invitation isn't active yet.");
      const b = await readJson(req, 20000);
      if (!["yes", "no"].includes(b.status)) return fail(400, "Please choose whether you can attend.");
      const count = b.status === "yes" ? Math.max(1, Math.min(20, Number(b.count) || 1)) : 0;
      const note = str(b.note, 500), t = now();
      let g = b.token ? guestOut((await db.query("SELECT * FROM guests WHERE token = $1 AND invitation_id = $2", [String(b.token), inv.id]))[0]) : null;
      if (!g) {
        const name = str(b.name, 80);
        if (!name) return fail(400, "Please tell the host your name.");
        const [{ n }] = await db.query("SELECT count(*)::int AS n FROM guests WHERE invitation_id = $1", [inv.id]);
        if (n >= 2000) return fail(400, "This invitation has reached its reply limit.");
        g = guestOut((await db.query(`INSERT INTO guests (id, invitation_id, token, name, contact, source, status, count, note, created_at, opened_at, responded_at)
          VALUES ($1,$2,$3,$4,'','link',$5,$6,$7,$8,$8,$8) RETURNING *`, [rid(10), inv.id, rid(12), name, b.status, count, note, t]))[0]);
      } else {
        const name = b.name && g.source === "link" ? (str(b.name, 80) || g.name) : g.name;
        g = guestOut((await db.query("UPDATE guests SET name = $2, status = $3, count = $4, note = $5, responded_at = $6 WHERE id = $1 RETURNING *", [g.id, name, b.status, count, note, t]))[0]);
      }
      return json(200, { token: g.token, guest: guestPublic(g) });
    }

    if (p === "/requests" && m === "POST") {
      if (limited(ip, "requests", 6)) return fail(429, "Too many attempts. Please wait a minute and try again.");
      const b = await readJson(req);
      const name = str(b.name, 80), email = str(b.email, 160), message = str(b.message, 3000);
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message) return fail(400, "Please fill in your name, email and a short description.");
      const id = rid(10);
      const imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 3).filter(u => typeof u === "string" && u.length < 1100000 && DATA_URL.test(u));
      const store = imgs.length ? await getMedia() : null;
      const images = await Promise.all(imgs.map(async (u, i) => {
        const mm = DATA_URL.exec(u), key = `req/${id}/${i + 1}.${EXT[mm[1]]}`;
        await store.put(key, Buffer.from(mm[2], "base64"), `image/${mm[1]}`);
        return `/media/${key}`;
      }));
      const link = /^https?:\/\//.test(String(b.link || "")) ? str(b.link, 500) : "";
      await db.query(`INSERT INTO requests (id, name, email, phone, date, occasion, tier, message, link, images, lang, status, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new',$12)`,
        [id, name, email, str(b.phone, 40), str(b.date, 20), str(b.occasion, 30), str(b.tier, 20), message, link, JSON.stringify(images), str(b.lang, 4), now()]);
      return json(201, { ok: true });
    }

    /* owner routes */
    const user = await currentUser(req, db);
    if (!user) return fail(401, "Please sign in to continue.");
    const own = async id => idOk(id) ? inviteOut((await db.query("SELECT * FROM invites WHERE id = $1 AND owner_id = $2", [id, user.id]))[0]) : null;

    /* site owner: orders and payments */
    if (p.startsWith("/admin/") && !isAdmin(user)) return fail(403, "Not found.");
    if (p === "/admin/requests" && m === "GET") {
      return json(200, { requests: (await db.query("SELECT * FROM requests ORDER BY created_at DESC")).map(requestOut) });
    }
    if ((seg = p.match(/^\/admin\/requests\/([A-Za-z0-9]+)\/status$/)) && m === "POST") {
      const b = await readJson(req);
      const rows = await db.query("UPDATE requests SET status = $2 WHERE id = $1 RETURNING id", [seg[1], b.status === "done" ? "done" : "new"]);
      return rows.length ? json(200, { ok: true }) : fail(404, "Not found.");
    }
    if (p === "/admin/users" && m === "GET") {
      const rows = await db.query(`SELECT u.id, u.name, u.email, u.created_at, u.last_login, count(i.id)::int AS invitations
        FROM users u LEFT JOIN invites i ON i.owner_id = u.id GROUP BY u.id ORDER BY u.created_at DESC`);
      return json(200, { users: rows.map(r => ({ id: r.id, name: r.name, email: r.email, createdAt: r.created_at || null, lastLogin: r.last_login || null, invitations: r.invitations, admin: isAdmin(r) })) });
    }
    if ((seg = p.match(/^\/admin\/users\/([A-Za-z0-9]+)\/password$/)) && m === "POST") {
      const pw = rid(10), salt = rid(16);
      const rows = await db.query("UPDATE users SET salt = $2, hash = $3 WHERE id = $1 RETURNING id", [seg[1], salt, hashPw(pw, salt)]);
      if (!rows.length) return fail(404, "Not found.");
      await db.query("DELETE FROM sessions WHERE user_id = $1", [seg[1]]);
      return json(200, { password: pw });
    }
    if (p === "/admin/invitations" && m === "GET") {
      const rows = await db.query(`SELECT i.*, u.name AS owner_name, u.email AS owner_email FROM invites i LEFT JOIN users u ON u.id = i.owner_id ORDER BY i.created_at DESC`);
      return json(200, { invitations: rows.map(r => {
        const data = Object.fromEntries(Object.entries(r.data || {}).filter(([k]) => !/^photo/.test(k)));
        return { id: r.id, slug: r.slug, templateId: r.template_id, tier: r.tier || TEMPLATE_TIERS[r.template_id] || null, status: statusOf(r), createdAt: r.created_at, data, ownerName: r.owner_name || "", ownerEmail: r.owner_email || "" };
      }) });
    }
    if ((seg = p.match(/^\/admin\/invitations\/([A-Za-z0-9]+)\/status$/)) && m === "POST") {
      const b = await readJson(req);
      if (!["active", "pending"].includes(b.status)) return fail(400, "The request couldn't be read.");
      const rows = await db.query("UPDATE invites SET status = $2, paid_at = CASE WHEN $2 = 'active' THEN $3 ELSE paid_at END WHERE id = $1 RETURNING id", [seg[1], b.status, now()]);
      return rows.length ? json(200, { ok: true }) : fail(404, "We couldn't find that invitation.");
    }

    if (p === "/invitations" && m === "GET") {
      const [invs, gs] = await Promise.all([
        db.query("SELECT * FROM invites WHERE owner_id = $1 ORDER BY created_at DESC", [user.id]),
        db.query("SELECT g.invitation_id, g.status, g.count, g.opened_at FROM guests g JOIN invites i ON i.id = g.invitation_id WHERE i.owner_id = $1", [user.id])
      ]);
      const by = {};
      for (const g of gs) (by[g.invitation_id] ||= []).push({ status: g.status, count: g.count, openedAt: g.opened_at });
      return json(200, { invitations: invs.map(r => ({ ...withStatus(inviteOut(r)), stats: stats(by[r.id] || []) })) });
    }
    if (p === "/invitations" && m === "POST") {
      const b = await readJson(req);
      if (!TEMPLATE_IDS.has(b.templateId)) return fail(400, "Please choose a template.");
      const [{ n }] = await db.query("SELECT count(*)::int AS n FROM invites WHERE owner_id = $1", [user.id]);
      if (n >= 200) return fail(400, "You've reached the limit of 200 invitations.");
      const tier = TEMPLATE_TIERS[b.templateId] || null, id = rid(10), t = now();
      const data = await cleanData(b.data, id);
      const row = (await db.query(`INSERT INTO invites (id, slug, owner_id, template_id, data, tier, status, price, created_at, updated_at, views)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,0) RETURNING *`,
        [id, rid(8), user.id, b.templateId, JSON.stringify(data), tier, tier && cfg.payments ? "pending" : "active", tier ? JSON.stringify(PRICES[tier]) : null, t]))[0];
      return json(201, { invitation: withStatus(inviteOut(row)) });
    }
    // small picture + title used when the guest link is shared (WhatsApp, Viber, Instagram)
    if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)\/preview$/)) && m === "POST") {
      const inv = await own(seg[1]);
      if (!inv) return fail(404, "We couldn't find that invitation.");
      const b = await readJson(req);
      const mt = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
      if (!mt || mt[1].length > 900000) return fail(400, "The request couldn't be read.");
      await (await getMedia()).put(`og/${inv.slug}.jpg`, Buffer.from(mt[1], "base64"), "image/jpeg");
      const og = { title: str(b.title, 90), desc: str(b.desc, 220), v: now() };
      await db.query("UPDATE invites SET og = $2 WHERE id = $1", [inv.id, JSON.stringify(og)]);
      return json(200, { ok: true, og });
    }
    if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)$/))) {
      const inv = await own(seg[1]);
      if (!inv) return fail(404, "We couldn't find that invitation.");
      if (m === "GET") {
        const gs = await guestsOf(db, inv.id);
        return json(200, { invitation: withStatus(inv), guests: gs, stats: stats(gs) });
      }
      if (m === "PUT") {
        const b = await readJson(req);
        let { templateId, tier, price } = inv;
        if (b.templateId && TEMPLATE_IDS.has(b.templateId) && b.templateId !== inv.templateId) {
          const nt = TEMPLATE_TIERS[b.templateId] || null;
          if (cfg.payments && statusOf(inv) === "active" && inv.tier && nt !== inv.tier) return fail(400, "To switch to a different package, please contact us.");
          templateId = b.templateId;
          if (nt && (!cfg.payments || statusOf(inv) === "pending")) { tier = nt; price = PRICES[nt]; }
        }
        const data = b.data ? await cleanData(b.data, inv.id, inv.data) : inv.data;
        const row = (await db.query("UPDATE invites SET template_id = $2, tier = $3, price = $4, data = $5, updated_at = $6 WHERE id = $1 RETURNING *",
          [inv.id, templateId, tier, price ? JSON.stringify(price) : null, JSON.stringify(data), now()]))[0];
        return json(200, { invitation: withStatus(inviteOut(row)) });
      }
      if (m === "DELETE") {
        await db.query("DELETE FROM invites WHERE id = $1", [inv.id]); // guests go with it (ON DELETE CASCADE)
        try { const st = await getMedia(); await Promise.all([st.removePrefix(`inv/${inv.id}/`), st.removePrefix(`og/${inv.slug}.jpg`)]); } catch (e) { console.error("media clean-up", e.message); }
        return json(200, { ok: true });
      }
    }
    if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)\/guests$/)) && m === "POST") {
      const inv = await own(seg[1]);
      if (!inv) return fail(404, "We couldn't find that invitation.");
      const b = await readJson(req, 20000);
      const name = str(b.name, 80);
      if (!name) return fail(400, "Please enter the guest's name.");
      const g = guestOut((await db.query(`INSERT INTO guests (id, invitation_id, token, name, contact, source, status, count, note, created_at)
        VALUES ($1,$2,$3,$4,$5,'personal','pending',1,'',$6) RETURNING *`, [rid(10), inv.id, rid(12), name, str(b.contact, 80), now()]))[0]);
      return json(201, { guest: g });
    }
    // the host corrects a guest by hand: name, reply and how many people are coming
    if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)\/guests\/([A-Za-z0-9]+)$/)) && m === "PATCH") {
      const inv = await own(seg[1]);
      if (!inv) return fail(404, "We couldn't find that invitation.");
      const g = (await db.query("SELECT * FROM guests WHERE id = $1 AND invitation_id = $2", [seg[2], inv.id]))[0];
      if (!g) return fail(404, "We couldn't find that guest.");
      const b = await readJson(req, 20000);
      const name = b.name === undefined ? g.name : str(b.name, 80);
      if (!name) return fail(400, "Please enter the guest's name.");
      const status = ["yes", "no", "pending"].includes(b.status) ? b.status : g.status;
      const count = status === "yes" ? Math.max(1, Math.min(50, parseInt(b.count ?? g.count) || 1)) : status === "no" ? 0 : 1;
      const responded = status === "pending" ? null : (g.responded_at || now());
      const row = (await db.query("UPDATE guests SET name = $1, status = $2, count = $3, responded_at = $4 WHERE id = $5 RETURNING *", [name, status, count, responded, g.id]))[0];
      return json(200, { guest: guestOut(row) });
    }
    if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)\/guests\/([A-Za-z0-9]+)$/)) && m === "DELETE") {
      const inv = await own(seg[1]);
      if (!inv) return fail(404, "We couldn't find that invitation.");
      await db.query("DELETE FROM guests WHERE id = $1 AND invitation_id = $2", [seg[2], inv.id]);
      return json(200, { ok: true });
    }
    return fail(404, "Not found.");
  }

  /* ---------- files: /media/... (photos) and /og/<slug>.jpg (link previews) ---------- */
  async function file(req) {
    const path = new URL(req.url).pathname;
    let key = null, fallback = null, cache = "public, max-age=31536000, immutable";
    let mm;
    if ((mm = path.match(/^\/media\/(.+)$/)) && keyOk(mm[1])) key = mm[1];
    else if ((mm = path.match(/^\/og\/([A-Za-z0-9]+)\.jpg$/)) && slugOk(mm[1])) { key = `og/${mm[1]}.jpg`; fallback = "/og.jpg"; cache = "public, max-age=300"; }
    if (!key) return new Response("Not found", { status: 404 });
    try {
      const f = await (await getMedia()).get(key);
      if (f) return new Response(f.body, { headers: { "Content-Type": f.type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });
    } catch (e) { console.error("media", e.message); }
    return fallback ? Response.redirect(new URL(fallback, req.url), 302) : new Response("Not found", { status: 404 });
  }

  /* ---------- guest links: the page with the invitation's own title, picture and colour ---------- */
  // page colour of each premium design, so a guest link opens straight on the invitation's own background
  const PAGE_BG = { e_kiss: "#F2EBDF", p_dino: "#F3F0E2", e_estate: "#F3EEE1", e_lemon: "#F7F8FA", e_rouge: "#3A0C16", e_peony: "#F8F1EC", e_night: "#0B1024", e_lamb: "#EAF2FA", e_picnic: "#FBF5E6", e_lace: "#4E1420", e_disco: "#0D0D0F", p_gold: "#1C0D10", p_balloon: "#FFF3F0", p_sky: "#060914", p_rip: "#0B0A0A", p_bloom: "#FBF3EE", p_plane: "#E3EEF6", p_letter: "#1B120C", p_disco: "#09090A", vinyl: "#F1E8D8", p_bow: "#F3EFE7", p_honey: "#FBF4E3" };
  const escAttr = v => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // designs whose 3D code (three.js) the guest page should start downloading straight away
  const DESIGN_CODE = { p_sky: "designs/sky.js", p_balloon: "designs/balloons.js", p_gold: "designs/record.js", p_disco: "designs/mirrorball.js" };
  function preloads(manifest, templateId) {
    const out = new Set(), walk = key => { const e = manifest && manifest[key]; if (!e || out.has(e.file)) return; out.add(e.file); (e.imports || []).forEach(walk); };
    walk(DESIGN_CODE[templateId]);
    return [...out].map(f => `<link rel="modulepreload" href="/${escAttr(f)}">`).join("\n");
  }
  async function invitePage(html, slug, origin, manifest = null) {
    let inv = null;
    try { const db = await connect(cfg); inv = (await db.query("SELECT template_id, og FROM invites WHERE slug = $1", [slug]))[0] || null; }
    catch (e) { console.error("invite page:", e.message); }
    const bg = (inv && PAGE_BG[inv.template_id]) || "#FBF5F0";
    const og = inv && inv.og;
    const title = og && og.title ? og.title : "Pozivnica · Poziv na klik";
    const desc = og && og.desc ? og.desc : "Otvorite pozivnicu i potvrdite dolazak.";
    const img = og ? `${origin}/og/${slug}.jpg?v=${og.v}` : `${origin}/og.jpg`;
    const tags = `<style>:root{--boot-bg:${bg}}</style>
<title>${escAttr(title)}</title>
<meta name="description" content="${escAttr(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Poziv na klik">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${escAttr(origin + "/i/" + slug)}">
<meta property="og:image" content="${escAttr(img)}">
<meta property="og:image:secure_url" content="${escAttr(img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${escAttr(title)}">
<meta name="twitter:card" content="summary_large_image">${inv ? "\n" + preloads(manifest, inv.template_id) : ""}`;
    return html.replace(/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${bg}">`)
      .replace(/<title>[\s\S]*?<\/title>\n?/, "").replace(/<meta name="description"[^>]*>\n?/, "")
      .replace(/<meta property="og:[^>]*>\n?/g, "").replace(/<meta name="twitter:[^>]*>\n?/g, "")
      .replace("<!--boot-meta-->", tags);
  }

  return { handle, file, invitePage };
}
