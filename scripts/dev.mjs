// Local development: the API (with an embedded Postgres in .data/) on :8788 and Vite on :5173
// with instant reloads. Open http://localhost:5173
import { spawn } from "node:child_process";

const run = (args, env = {}) => spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });
const api = run(["--watch-path=server", "server/node-server.mjs", "--api-only"], { APP_ENV: process.env.APP_ENV || "development" });
const vite = run(["node_modules/vite/bin/vite.js"]);
const stop = () => { api.kill(); vite.kill(); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", c => { if (c) console.error("API stopped with code", c); });
