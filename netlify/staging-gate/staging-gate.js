// Password page in front of staging (and deploy previews). It is copied into the deploy only for
// non-production builds (scripts/prepare-deploy.mjs), so production never runs it.
// The password is the STAGING_PASSWORD environment variable; the browser keeps a cookie for 30 days.
const COOKIE = "pk_staging";

async function digest(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("pozivnaklik-staging:" + text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const page = (msg = "") => new Response(`<!doctype html><html lang="sr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Staging · Poziv na klik</title><style>
body{margin:0;min-height:100svh;display:grid;place-items:center;background:#FBF5F0;color:#3b2a24;font:16px/1.5 system-ui,sans-serif}
form{width:min(320px,86vw);display:grid;gap:12px;text-align:center}h1{font:600 20px/1.3 Georgia,serif;margin:0 0 4px}
p{margin:0;color:#8a6f62;font-size:14px}input,button{font:inherit;padding:12px 14px;border-radius:10px;border:1px solid #d9c6b8}
button{background:#3b2a24;color:#fff;border:0;cursor:pointer}.e{color:#b3261e}</style></head><body>
<form method="post" action="/__staging"><h1>Poziv na klik · staging</h1><p>Test verzija sajta. Unesite lozinku.</p>
${msg ? `<p class="e">${msg}</p>` : ""}<input type="password" name="password" autocomplete="current-password" required autofocus aria-label="Lozinka">
<button>Uđi</button></form></body></html>`,
  { status: 401, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });

export default async (request, context) => {
  if (context.deploy?.context === "production") return;
  const pw = Netlify.env.get("STAGING_PASSWORD");
  if (!pw) return page("Lozinka za staging nije podešena (STAGING_PASSWORD).");
  const want = await digest(pw);
  const url = new URL(request.url);
  if (url.pathname === "/__staging" && request.method === "POST") {
    const form = await request.formData();
    if (await digest(String(form.get("password") || "")) !== want) return page("Pogrešna lozinka.");
    context.cookies.set({ name: COOKIE, value: want, path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: 30 * 86400 });
    return new Response(null, { status: 303, headers: { location: "/", "cache-control": "no-store" } });
  }
  if (context.cookies.get(COOKIE) === want) return;
  return page();
};

export const config = { path: "/*" };
