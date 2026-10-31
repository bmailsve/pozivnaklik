// Poziv na klik — e-invitation website server. No dependencies: Node 18+ only.
// Serves the single-page app and a small JSON API with accounts, invitations, guests and RSVPs.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
// Site owner(s) who confirm payments: comma-separated emails in ADMIN_EMAILS.
const ADMIN_EMAILS = new Set(String(process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
// Payment details shown to clients. Set them in config.json (see README) or with PAY_* environment variables.
let CONFIG = {};
try { CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")); } catch (e) { /* optional */ }
const PAYMENT = Object.assign({ recipient: "", account: "", bank: "", phone: "", note: "" }, CONFIG.payment || {},
  Object.fromEntries([["recipient", process.env.PAY_RECIPIENT], ["account", process.env.PAY_ACCOUNT], ["bank", process.env.PAY_BANK], ["phone", process.env.PAY_PHONE], ["note", process.env.PAY_NOTE]].filter(([, v]) => v)));
const SESSION_DAYS = 30;
// Package of each template that is on sale. Older templates stay valid for existing invitations.
const TEMPLATE_TIERS = { b_rose: "basic", b_olive: "basic", b_bunny: "basic", b_balloon: "basic", b_gold: "basic", b_dove: "basic",
  e_peony: "envelope", e_night: "envelope", e_lamb: "envelope", e_picnic: "envelope", e_lace: "envelope", e_disco: "envelope", vinyl: "premium", premiere: "premium", p_disco: "premium", p_bow: "premium", p_honey: "premium", b_ilija: "basic", b_sea: "basic", b_esp: "basic", e_estate: "envelope", e_lemon: "envelope", e_rouge: "envelope" };
const PRICES = { basic: { eur: 10, rsd: 1190 }, envelope: { eur: 20, rsd: 2349 }, premium: { eur: 40, rsd: 4499 } };
const TEMPLATE_IDS = new Set([...Object.keys(TEMPLATE_TIERS),"storybook","cherry","era","jungle","castle","princess","blossom","cars","noir","champagne","emerald","marble","starlit","garden","olive","ivory","gatsby","dustyblue","christening","celebration"]);

/* ---------- storage (JSON file, atomic writes) ---------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { users: [], sessions: [], invites: [], guests: [], requests: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, "utf8"))); } catch (e) { /* first run */ }
let writing = false, again = false;
function save() {
  if (writing) { again = true; return; }
  writing = true;
  const tmp = DB_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(db), err => {
    if (err) { writing = false; console.error("save failed", err); return; }
    fs.rename(tmp, DB_FILE, () => { writing = false; if (again) { again = false; save(); } });
  });
}


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
 "Something went wrong on our side. Please try again.": "Došlo je do greške kod nas. Pokušajte ponovo.",
 "This invitation isn't active yet.": "Ova pozivnica još nije aktivna.",
 "To switch to a different package, please contact us.": "Za promenu paketa nas kontaktirajte."
};
const M = (req, s) => ((req.headers["x-lang"] || "sr") === "en" ? s : (SR[s] || s));

/* ---------- helpers ---------- */
const ALPHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rid = (n = 10) => { const b = crypto.randomBytes(n); let s = ""; for (const x of b) s += ALPHA[x % ALPHA.length]; return s; };
const now = () => Date.now();
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString("hex"); }
function checkPw(pw, salt, hash) { const a = Buffer.from(hashPw(pw, salt), "hex"), b = Buffer.from(hash, "hex"); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const isAdmin = u => !!u && ADMIN_EMAILS.has(String(u.email).toLowerCase());
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, admin: isAdmin(u) });
const statusOf = i => i.status || "active";
function stats(gs) {
  const s = { invited: gs.length, opened: 0, yes: 0, no: 0, pending: 0, people: 0 };
  for (const g of gs) {
    if (g.openedAt || g.status !== "pending") s.opened++;
    if (g.status === "yes") { s.yes++; s.people += Number(g.count) || 1; }
    else if (g.status === "no") s.no++; else s.pending++;
  }
  return s;
}
function cleanData(d) {
  const out = {};
  if (!d || typeof d !== "object") return out;
  for (const [k, v] of Object.entries(d).slice(0, 60)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,29}$/.test(k)) continue;
    const val = String(v ?? "");
    // photo fields hold a small, already-resized JPEG/PNG/WebP image as a data URL
    if (/^photo\d?$/.test(k)) { if (val === "" || (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(val) && val.length <= 700000)) out[k] = val; continue; }
    out[k] = val.slice(0, 600);
  }
  return out;
}
const str = (v, max) => String(v ?? "").trim().slice(0, max);

/* rate limiting per IP and bucket */
const hits = new Map();
function limited(req, bucket, max) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const key = bucket + ":" + ip, t = now();
  let h = hits.get(key);
  if (!h || h.reset < t) { h = { n: 0, reset: t + 60000 }; hits.set(key, h); }
  return ++h.n > max;
}
setInterval(() => { const t = now(); for (const [k, h] of hits) if (h.reset < t) hits.delete(k); db.sessions = db.sessions.filter(s => s.exp > t); }, 300000).unref();

/* ---------- http plumbing ---------- */
function send(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
const fail = (res, code, error) => send(res, code, { error });
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > 4000000) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { reject(new Error("bad json")); } });
    req.on("error", reject);
  });
}
function cookies(req) { const o = {}; (req.headers.cookie || "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function sessionCookie(req, sid, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted;
  return `pl_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
function currentUser(req) {
  const sid = cookies(req).pl_sid; if (!sid) return null;
  const s = db.sessions.find(x => x.sid === sid && x.exp > now()); if (!s) return null;
  return db.users.find(u => u.id === s.userId) || null;
}
function startSession(req, res, user) {
  const sid = rid(32);
  db.sessions.push({ sid, userId: user.id, exp: now() + SESSION_DAYS * 864e5 });
  save();
  return { "Set-Cookie": sessionCookie(req, sid, SESSION_DAYS * 86400) };
}

/* ---------- page ---------- */
const PAGE_SRC = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
const PAGE = `<!doctype html><html lang="sr-Latn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="Online pozivnice za rođendane, venčanja i svaku proslavu, sa potvrdom dolaska."><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${PAGE_SRC}</body></html>`;
function sendPage(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
  res.end(PAGE);
}

/* ---------- api ---------- */
async function api(req, res, url) {
  const p = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  const m = req.method;
  let seg;

  if (p === "/health") return send(res, 200, { app: "paperlace", ok: true });

  if (p === "/auth/signup" && m === "POST") {
    if (limited(req, "auth", 20)) return fail(res, 429, M(req, "Too many attempts. Please wait a minute and try again."));
    const b = await readBody(req);
    const name = str(b.name, 80), email = str(b.email, 160).toLowerCase(), pw = String(b.password || "");
    if (!name) return fail(res, 400, M(req, "Please enter your name."));
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, M(req, "Please enter a valid email address."));
    if (pw.length < 8) return fail(res, 400, M(req, "Use at least 8 characters for your password."));
    if (db.users.some(u => u.email === email)) return fail(res, 409, M(req, "An account with this email already exists. Sign in instead."));
    const salt = rid(16);
    const user = { id: rid(12), name, email, salt, hash: hashPw(pw, salt), createdAt: now() };
    db.users.push(user); save();
    return send(res, 201, { user: publicUser(user) }, startSession(req, res, user));
  }
  if (p === "/auth/login" && m === "POST") {
    if (limited(req, "auth", 20)) return fail(res, 429, M(req, "Too many attempts. Please wait a minute and try again."));
    const b = await readBody(req);
    const user = db.users.find(u => u.email === str(b.email, 160).toLowerCase());
    if (!user || !checkPw(String(b.password || ""), user.salt, user.hash)) return fail(res, 401, M(req, "That email and password don't match. Try again."));
    return send(res, 200, { user: publicUser(user) }, startSession(req, res, user));
  }
  if (p === "/auth/logout" && m === "POST") {
    const sid = cookies(req).pl_sid;
    db.sessions = db.sessions.filter(s => s.sid !== sid); save();
    return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
  }
  if (p === "/config" && m === "GET") return send(res, 200, { payment: PAYMENT, prices: PRICES });
  if (p === "/me" && m === "GET") { const u = currentUser(req); return send(res, 200, { user: u ? publicUser(u) : null }); }

  /* public guest routes */
  if ((seg = p.match(/^\/public\/([A-Za-z0-9]{4,20})$/)) && m === "GET") {
    const inv = db.invites.find(i => i.slug === seg[1]);
    if (!inv) return fail(res, 404, M(req, "This invitation doesn't exist or was removed by the host."));
    if (statusOf(inv) !== "active") { const u = currentUser(req); if (!u || (u.id !== inv.ownerId && !isAdmin(u))) return send(res, 200, { inactive: true }); }
    inv.views = (inv.views || 0) + 1;
    const token = url.searchParams.get("g");
    const g = token ? db.guests.find(x => x.token === token && x.invitationId === inv.id) : null;
    if (g && !g.openedAt) g.openedAt = now();
    save();
    return send(res, 200, { invitation: { slug: inv.slug, templateId: inv.templateId, data: inv.data }, guest: g ? { name: g.name, status: g.status, count: g.count, note: g.note, token: g.token, source: g.source } : null });
  }
  if ((seg = p.match(/^\/public\/([A-Za-z0-9]{4,20})\/rsvp$/)) && m === "POST") {
    if (limited(req, "rsvp", 40)) return fail(res, 429, M(req, "Too many replies from this connection. Please wait a minute."));
    const inv = db.invites.find(i => i.slug === seg[1]);
    if (!inv) return fail(res, 404, M(req, "This invitation doesn't exist anymore."));
    if (statusOf(inv) !== "active") return fail(res, 403, M(req, "This invitation isn't active yet."));
    const b = await readBody(req);
    if (!["yes", "no"].includes(b.status)) return fail(res, 400, M(req, "Please choose whether you can attend."));
    let g = b.token ? db.guests.find(x => x.token === String(b.token) && x.invitationId === inv.id) : null;
    if (!g) {
      const name = str(b.name, 80);
      if (!name) return fail(res, 400, M(req, "Please tell the host your name."));
      if (db.guests.filter(x => x.invitationId === inv.id).length >= 2000) return fail(res, 400, M(req, "This invitation has reached its reply limit."));
      g = { id: rid(10), invitationId: inv.id, token: rid(12), name, contact: "", source: "link", createdAt: now(), openedAt: now() };
      db.guests.push(g);
    } else if (b.name && g.source === "link") g.name = str(b.name, 80) || g.name;
    g.status = b.status;
    g.count = b.status === "yes" ? Math.max(1, Math.min(20, Number(b.count) || 1)) : 0;
    g.note = str(b.note, 500);
    g.respondedAt = now();
    save();
    return send(res, 200, { token: g.token, guest: { name: g.name, status: g.status, count: g.count, note: g.note, token: g.token, source: g.source } });
  }

  if (p === "/requests" && m === "POST") {
    if (limited(req, "requests", 6)) return fail(res, 429, M(req, "Too many attempts. Please wait a minute and try again."));
    const b = await readBody(req);
    const name = str(b.name, 80), email = str(b.email, 160), message = str(b.message, 3000);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message) return fail(res, 400, M(req, "Please fill in your name, email and a short description."));
    const imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 3).filter(u => typeof u === "string" && u.length < 1100000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u));
    const link = /^https?:\/\//.test(String(b.link || "")) ? str(b.link, 500) : "";
    db.requests = db.requests || [];
    db.requests.push({ id: rid(10), name, email, phone: str(b.phone, 40), date: str(b.date, 20), occasion: str(b.occasion, 30), tier: str(b.tier, 20), message, link, images: imgs, lang: str(b.lang, 4), status: "new", createdAt: now() });
    save();
    return send(res, 201, { ok: true });
  }
  /* owner routes */
  const user = currentUser(req);
  if (!user) return fail(res, 401, M(req, "Please sign in to continue."));
  const own = id => db.invites.find(i => i.id === id && i.ownerId === user.id);

  /* site owner: orders and payments */
  if (p === "/admin/requests" && m === "GET") {
    if (!isAdmin(user)) return fail(res, 403, M(req, "Not found."));
    return send(res, 200, { requests: (db.requests || []).slice().reverse() });
  }
  if ((seg = p.match(/^\/admin\/requests\/([A-Za-z0-9]+)\/status$/)) && m === "POST") {
    if (!isAdmin(user)) return fail(res, 403, M(req, "Not found."));
    const r = (db.requests || []).find(x => x.id === seg[1]);
    if (!r) return fail(res, 404, M(req, "Not found."));
    const b = await readBody(req); r.status = b.status === "done" ? "done" : "new"; save();
    return send(res, 200, { ok: true });
  }
  if (p === "/admin/invitations" && m === "GET") {
    if (!isAdmin(user)) return fail(res, 403, M(req, "Not found."));
    const users = Object.fromEntries(db.users.map(u => [u.id, u]));
    const list = db.invites.slice().sort((a, b) => b.createdAt - a.createdAt).map(i => {
      const data = Object.fromEntries(Object.entries(i.data || {}).filter(([k]) => !/^photo/.test(k)));
      return { id: i.id, slug: i.slug, templateId: i.templateId, tier: i.tier || TEMPLATE_TIERS[i.templateId] || null, status: statusOf(i), createdAt: i.createdAt, data, ownerName: users[i.ownerId]?.name || "", ownerEmail: users[i.ownerId]?.email || "" };
    });
    return send(res, 200, { invitations: list });
  }
  if ((seg = p.match(/^\/admin\/invitations\/([A-Za-z0-9]+)\/status$/)) && m === "POST") {
    if (!isAdmin(user)) return fail(res, 403, M(req, "Not found."));
    const inv = db.invites.find(i => i.id === seg[1]);
    if (!inv) return fail(res, 404, M(req, "We couldn't find that invitation."));
    const b = await readBody(req);
    if (!["active", "pending"].includes(b.status)) return fail(res, 400, M(req, "The request couldn't be read."));
    inv.status = b.status; if (b.status === "active") inv.paidAt = now();
    save();
    return send(res, 200, { ok: true });
  }

  if (p === "/invitations" && m === "GET") {
    const list = db.invites.filter(i => i.ownerId === user.id).sort((a, b) => b.createdAt - a.createdAt)
      .map(i => ({ ...i, stats: stats(db.guests.filter(g => g.invitationId === i.id)) }));
    return send(res, 200, { invitations: list });
  }
  if (p === "/invitations" && m === "POST") {
    const b = await readBody(req);
    if (!TEMPLATE_IDS.has(b.templateId)) return fail(res, 400, M(req, "Please choose a template."));
    if (db.invites.filter(i => i.ownerId === user.id).length >= 200) return fail(res, 400, M(req, "You've reached the limit of 200 invitations."));
    const tier = TEMPLATE_TIERS[b.templateId] || null;
    const inv = { id: rid(10), slug: rid(8), ownerId: user.id, templateId: b.templateId, data: cleanData(b.data), tier, status: tier ? "pending" : "active", price: tier ? PRICES[tier] : null, createdAt: now(), updatedAt: now(), views: 0 };
    db.invites.push(inv); save();
    return send(res, 201, { invitation: inv });
  }
  if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)$/))) {
    const inv = own(seg[1]);
    if (!inv) return fail(res, 404, M(req, "We couldn't find that invitation."));
    if (m === "GET") {
      const gs = db.guests.filter(g => g.invitationId === inv.id).sort((a, b) => a.createdAt - b.createdAt);
      return send(res, 200, { invitation: inv, guests: gs, stats: stats(gs) });
    }
    if (m === "PUT") {
      const b = await readBody(req);
      if (b.templateId && TEMPLATE_IDS.has(b.templateId) && b.templateId !== inv.templateId) {
        const nt = TEMPLATE_TIERS[b.templateId] || null;
        if (statusOf(inv) === "active" && inv.tier && nt !== inv.tier) return fail(res, 400, M(req, "To switch to a different package, please contact us."));
        inv.templateId = b.templateId; if (nt && statusOf(inv) === "pending") { inv.tier = nt; inv.price = PRICES[nt]; }
      }
      if (b.data) inv.data = cleanData(b.data);
      inv.updatedAt = now(); save();
      return send(res, 200, { invitation: inv });
    }
    if (m === "DELETE") {
      db.invites = db.invites.filter(i => i.id !== inv.id);
      db.guests = db.guests.filter(g => g.invitationId !== inv.id);
      save();
      return send(res, 200, { ok: true });
    }
  }
  if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)\/guests$/)) && m === "POST") {
    const inv = own(seg[1]);
    if (!inv) return fail(res, 404, M(req, "We couldn't find that invitation."));
    const b = await readBody(req);
    const name = str(b.name, 80);
    if (!name) return fail(res, 400, M(req, "Please enter the guest's name."));
    const g = { id: rid(10), invitationId: inv.id, token: rid(12), name, contact: str(b.contact, 80), status: "pending", count: 1, note: "", source: "personal", createdAt: now(), openedAt: null, respondedAt: null };
    db.guests.push(g); save();
    return send(res, 201, { guest: g });
  }
  if ((seg = p.match(/^\/invitations\/([A-Za-z0-9]+)\/guests\/([A-Za-z0-9]+)$/)) && m === "DELETE") {
    const inv = own(seg[1]);
    if (!inv) return fail(res, 404, M(req, "We couldn't find that invitation."));
    db.guests = db.guests.filter(g => !(g.id === seg[2] && g.invitationId === inv.id));
    save();
    return send(res, 200, { ok: true });
  }
  return fail(res, 404, M(req, "Not found."));
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return fail(res, 403, M(req, "Cross-site requests are not allowed."));
      }
      return await api(req, res, url);
    }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
    if (req.method === "GET" || req.method === "HEAD") return sendPage(res);
    res.writeHead(405); res.end();
  } catch (e) {
    if (!res.headersSent) fail(res, e.message === "bad json" ? 400 : 500, M(req, e.message === "bad json" ? "The request couldn't be read." : "Something went wrong on our side. Please try again."));
    if (e.message !== "bad json") console.error(e);
  }
}).listen(PORT, () => console.log(`Poziv na klik running on http://localhost:${PORT}`));
