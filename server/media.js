// Uploaded pictures (hosts' photos, custom-design references, link-preview images).
// Online they live in Netlify Blobs, one store per environment; on a computer in .data/media.
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$/;
export const keyOk = k => KEY_RE.test(k) && !k.includes("..");

export async function mediaStore(cfg) {
  // scripts run on a computer reach a site's Blobs with NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN
  const remote = cfg.blobs && cfg.blobs.siteID && cfg.blobs.token;
  if (cfg.platform === "netlify" || remote) {
    const { getStore } = await import("@netlify/blobs");
    const name = `pk-media-${cfg.appEnv}`;
    const store = getStore(remote ? { name, siteID: cfg.blobs.siteID, token: cfg.blobs.token } : { name, consistency: "strong" });
    return {
      put: (key, buf, type) => store.set(key, buf, { metadata: { type } }),
      async get(key) {
        const r = await store.getWithMetadata(key, { type: "arrayBuffer" });
        return r ? { body: Buffer.from(r.data), type: r.metadata?.type || "application/octet-stream" } : null;
      },
      async removePrefix(prefix) {
        const { blobs } = await store.list({ prefix });
        await Promise.all(blobs.map(b => store.delete(b.key)));
      }
    };
  }
  const root = cfg.mediaDir;
  const path = key => { const p = normalize(join(root, key)); if (!p.startsWith(normalize(root))) throw new Error("bad key"); return p; };
  return {
    async put(key, buf, type) { const p = path(key); await mkdir(dirname(p), { recursive: true }); await writeFile(p, buf); await writeFile(p + ".type", type); },
    async get(key) {
      try { return { body: await readFile(path(key)), type: await readFile(path(key) + ".type", "utf8") }; }
      catch (e) { return null; }
    },
    removePrefix: prefix => rm(path(prefix), { recursive: true, force: true })
  };
}
