// Creates or updates the database tables for DATABASE_URL (the site also does this on its own on first request).
//   DATABASE_URL=postgres://... APP_ENV=staging npm run migrate
import { loadConfig } from "../server/config.js";
import { connect } from "../server/db.js";

const cfg = loadConfig({ platform: "node" });
if (!cfg.databaseUrl) console.log("DATABASE_URL is not set: using the local database in", cfg.pgliteDir);
const db = await connect(cfg);
const [{ v }] = await db.query("SELECT max(version) AS v FROM schema_migrations");
console.log(`Database is ready for "${cfg.appEnv}" (schema version ${v}).`);
await db.close();
