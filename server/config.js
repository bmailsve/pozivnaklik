// Settings come from environment variables (Netlify: Project configuration → Environment variables,
// with a different value per deploy context), with payment details optionally in config.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// next to this file in the repository; in the working directory inside a Netlify Function bundle
let fileCfg = {};
for (const f of [fileURLToPath(new URL("../config.json", import.meta.url)), join(process.cwd(), "config.json")]) {
  try { fileCfg = JSON.parse(readFileSync(f, "utf8")); break; } catch (e) { /* optional */ }
}

// Netlify deploy context → environment name, used when APP_ENV isn't set
const CONTEXT_ENV = { production: "production", "branch-deploy": "staging", "deploy-preview": "preview", dev: "development" };

export function loadConfig({ platform, deployContext, env = process.env } = {}) {
  const appEnv = env.APP_ENV || (platform === "netlify" ? CONTEXT_ENV[deployContext] || CONTEXT_ENV[env.CONTEXT] : "") || "development";
  const pay = fileCfg.payment || {};
  return {
    platform,
    appEnv,
    databaseUrl: env.DATABASE_URL || env.NETLIFY_DATABASE_URL || "",
    pgliteDir: env.PGLITE_DIR ?? ".data/pglite",
    mediaDir: env.MEDIA_DIR || ".data/media",
    blobs: { siteID: env.NETLIFY_SITE_ID || "", token: env.NETLIFY_AUTH_TOKEN || "" },
    adminEmails: new Set(String(env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean)),
    // Payments are switched off for now: every invitation is active right away. PAYMENTS=on brings them back.
    payments: String(env.PAYMENTS || "").toLowerCase() === "on",
    payment: {
      recipient: env.PAY_RECIPIENT || pay.recipient || "",
      account: env.PAY_ACCOUNT || pay.account || "",
      bank: env.PAY_BANK || pay.bank || "",
      phone: env.PAY_PHONE || pay.phone || "",
      note: env.PAY_NOTE || pay.note || ""
    }
  };
}
