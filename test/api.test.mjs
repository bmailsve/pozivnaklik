// API tests against an in-memory Postgres (PGlite): npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../server/config.js";
import { createApp } from "../server/api.js";
import { connect, resetForTests } from "../server/db.js";

const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let app, mediaDir;

before(async () => {
  mediaDir = await mkdtemp(join(tmpdir(), "pk-media-"));
  resetForTests();
  app = createApp(loadConfig({ platform: "node", env: { APP_ENV: "test", PGLITE_DIR: "", MEDIA_DIR: mediaDir, ADMIN_EMAILS: "owner@example.com" } }));
});

// a tiny browser: keeps the session cookie between calls
function client() {
  let cookie = "";
  return async (method, path, body, headers = {}) => {
    const req = new Request("http://localhost" + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const res = path.startsWith("/api") ? await app.handle(req, "1.2.3.4") : await app.file(req);
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = res.headers.get("content-type") || "";
    return { status: res.status, body: type.includes("json") ? await res.json() : await res.arrayBuffer(), headers: res.headers };
  };
}

test("accounts: sign up, stay signed in, wrong password, duplicate email, sign out", async () => {
  const c = client();
  let r = await c("POST", "/api/auth/signup", { name: "Ana", email: "Ana@Example.com", password: "password1" });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, "ana@example.com");
  assert.equal((await c("GET", "/api/me")).body.user.name, "Ana");
  assert.equal((await c("POST", "/api/auth/signup", { name: "Ana", email: "ana@example.com", password: "password1" })).status, 409);
  assert.equal((await client()("POST", "/api/auth/login", { email: "ana@example.com", password: "nope-nope" })).status, 401);
  r = await client()("POST", "/api/auth/login", { email: "ana@example.com", password: "password1" }, { "x-lang": "en" });
  assert.equal(r.status, 200);
  await c("POST", "/api/auth/logout");
  assert.equal((await c("GET", "/api/me")).body.user, null);
});

test("invitations: create with a photo, guests reply, host sees the numbers", async () => {
  const host = client();
  await host("POST", "/api/auth/signup", { name: "Marko", email: "marko@example.com", password: "password1" });
  let r = await host("POST", "/api/invitations", { templateId: "p_bow", data: { partner1: "Marko", photo: PHOTO, "bad key!": "x" } });
  assert.equal(r.status, 201);
  const inv = r.body.invitation;
  assert.equal(inv.tier, "premium");
  assert.equal(inv.status, "active");
  assert.match(inv.data.photo, /^\/media\/inv\/[A-Za-z0-9]+\/photo-[0-9a-f]{12}\.png$/);
  assert.equal(inv.data["bad key!"], undefined);

  // the photo is served as a file
  const pic = await host("GET", inv.data.photo);
  assert.equal(pic.status, 200);
  assert.equal(pic.headers.get("content-type"), "image/png");

  // saving again keeps the stored photo link
  r = await host("PUT", `/api/invitations/${inv.id}`, { data: { ...inv.data, partner1: "Marko M." } });
  assert.equal(r.body.invitation.data.photo, inv.data.photo);
  assert.equal(r.body.invitation.data.partner1, "Marko M.");

  // a guest from the shared link
  const guest = client();
  r = await guest("GET", `/api/public/${inv.slug}`);
  assert.equal(r.body.invitation.templateId, "p_bow");
  assert.equal(r.body.guest, null);
  assert.equal((await guest("POST", `/api/public/${inv.slug}/rsvp`, { status: "yes", count: 3 })).status, 400); // no name
  r = await guest("POST", `/api/public/${inv.slug}/rsvp`, { status: "yes", count: 3, name: "Jelena", note: "Vegetarijanka" });
  assert.equal(r.status, 200);
  const token = r.body.token;
  r = await guest("POST", `/api/public/${inv.slug}/rsvp`, { token, status: "no", count: 3 });
  assert.equal(r.body.guest.count, 0);
  assert.equal(r.body.guest.name, "Jelena");

  // a personal link
  r = await host("POST", `/api/invitations/${inv.id}/guests`, { name: "Petar" });
  const petar = r.body.guest;
  r = await guest("GET", `/api/public/${inv.slug}?g=${petar.token}`);
  assert.equal(r.body.guest.name, "Petar");
  await guest("POST", `/api/public/${inv.slug}/rsvp`, { token: petar.token, status: "yes", count: 2 });

  r = await host("GET", `/api/invitations/${inv.id}`);
  assert.deepEqual(r.body.stats, { invited: 2, opened: 2, yes: 1, no: 1, pending: 0, people: 2 });
  assert.ok(r.body.guests[1].openedAt);
  r = await host("GET", "/api/invitations");
  assert.equal(r.body.invitations[0].views, 2);
  assert.equal(r.body.invitations[0].stats.people, 2);

  // other people can't see or change it
  const stranger = client();
  await stranger("POST", "/api/auth/signup", { name: "X", email: "x@example.com", password: "password1" });
  assert.equal((await stranger("GET", `/api/invitations/${inv.id}`)).status, 404);
  assert.equal((await stranger("GET", "/api/admin/users")).status, 403);

  // deleting removes guests and the link stops working
  await host("DELETE", `/api/invitations/${inv.id}`);
  assert.equal((await guest("GET", `/api/public/${inv.slug}`)).status, 404);
  assert.equal((await host("GET", inv.data.photo)).status, 404);
});

test("site owner: custom requests, users, password reset", async () => {
  const visitor = client();
  let r = await visitor("POST", "/api/requests", { name: "Iva", email: "iva@example.com", message: "Cvetna pozivnica", images: [PHOTO], link: "javascript:alert(1)" });
  assert.equal(r.status, 201);
  const owner = client();
  await owner("POST", "/api/auth/signup", { name: "Owner", email: "owner@example.com", password: "password1" });
  r = await owner("GET", "/api/admin/requests");
  const req = r.body.requests.find(x => x.email === "iva@example.com");
  assert.equal(req.link, "");
  assert.match(req.images[0], /^\/media\/req\//);
  assert.equal((await owner("POST", `/api/admin/requests/${req.id}/status`, { status: "done" })).status, 200);
  r = await owner("GET", "/api/admin/users");
  const ana = r.body.users.find(u => u.email === "ana@example.com");
  r = await owner("POST", `/api/admin/users/${ana.id}/password`);
  assert.equal((await client()("POST", "/api/auth/login", { email: "ana@example.com", password: r.body.password })).status, 200);
});

test("requests from other websites are refused", async () => {
  const r = await app.handle(new Request("http://localhost/api/auth/login", { method: "POST", headers: { origin: "https://evil.example", host: "localhost", "content-type": "application/json" }, body: "{}" }));
  assert.equal(r.status, 403);
});

test("guest link page gets the invitation's title and colour", async () => {
  const host = client();
  await host("POST", "/api/auth/signup", { name: "Mia", email: "mia@example.com", password: "password1" });
  const inv = (await host("POST", "/api/invitations", { templateId: "p_disco", data: {} })).body.invitation;
  await host("POST", `/api/invitations/${inv.id}/preview`, { image: "data:image/jpeg;base64,/9j/4AAQ", title: "Mia & <Leo>", desc: "Dođite" });
  const shell = '<head><meta charset="utf-8"><meta name="theme-color" content="#FBF5F0"><!--boot-meta--><title>Poziv na klik</title><meta property="og:title" content="x"></head>';
  const html = await app.invitePage(shell, inv.slug, "https://pozivnaklik.com");
  assert.match(html, /<meta name="theme-color" content="#09090A">/);
  assert.match(html, /<title>Mia &amp; &lt;Leo&gt;<\/title>/);
  assert.match(html, /og:image" content="https:\/\/pozivnaklik.com\/og\/[A-Za-z0-9]+\.jpg\?v=\d+"/);
  assert.equal((html.match(/og:title/g) || []).length, 1);
  const og = await host("GET", `/og/${inv.slug}.jpg`);
  assert.equal(og.headers.get("content-type"), "image/jpeg");
});

test("a database made for one environment refuses another", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pk-db-"));
  resetForTests();
  const db = await connect(loadConfig({ platform: "node", env: { APP_ENV: "staging", PGLITE_DIR: dir } }));
  await db.close();
  resetForTests();
  await assert.rejects(connect(loadConfig({ platform: "node", env: { APP_ENV: "production", PGLITE_DIR: dir } })), /belongs to the "staging" environment/);
  resetForTests();
});
