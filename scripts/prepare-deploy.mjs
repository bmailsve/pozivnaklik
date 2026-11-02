// Runs before the Netlify build: puts the staging password page into the deploy for every
// non-production build (staging, previews). Production gets an empty edge-functions folder.
import { cp, mkdir, rm } from "node:fs/promises";

const out = new URL("../.netlify-edge/", import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
if (process.env.CONTEXT && process.env.CONTEXT !== "production") {
  await cp(new URL("../netlify/staging-gate/staging-gate.js", import.meta.url), new URL("staging-gate.js", out));
  console.log("staging password page: on");
} else console.log("staging password page: off");
