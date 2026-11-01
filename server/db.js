// Postgres access. Online (Netlify) it connects to DATABASE_URL (Neon / Netlify DB / any Postgres);
// on a computer without DATABASE_URL it runs an embedded Postgres (PGlite) that keeps data in .data/pglite.
import { MIGRATIONS } from "./schema.js";

let ready = null;

export function connect(cfg) {
  if (!ready) ready = open(cfg).catch(e => { ready = null; throw e; });
  return ready;
}

async function open(cfg) {
  const db = cfg.databaseUrl ? await pgDb(cfg.databaseUrl) : await pgliteDb(cfg.pgliteDir);
  await migrate(db);
  await checkEnvironment(db, cfg.appEnv);
  return db;
}

async function pgDb(url) {
  const { default: pg } = await import("pg");
  pg.types.setTypeParser(20, v => Number(v)); // bigint columns hold millisecond timestamps
  const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
  pool.on("error", e => console.error("postgres pool", e.message));
  return {
    kind: "postgres",
    query: async (text, params) => (await pool.query(text, params)).rows,
    exec: text => pool.query(text),
    close: () => pool.end()
  };
}

async function pgliteDb(dir) {
  // (a variable name keeps the online bundle from including the embedded database)
  const local = "@electric-sql/pglite";
  const { PGlite } = await import(local);
  if (dir) (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir || undefined, { parsers: { 20: v => Number(v) } });
  await pg.waitReady;
  return {
    kind: "pglite",
    query: async (text, params) => (await pg.query(text, params)).rows,
    exec: text => pg.exec(text),
    close: () => pg.close()
  };
}

async function migrate(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await db.query("SELECT version FROM schema_migrations")).map(r => r.version));
  for (const [version, sql] of MIGRATIONS) {
    if (done.has(version)) continue;
    // the lock makes two cold starts that migrate at the same moment take turns; every migration is idempotent
    await db.exec(`BEGIN; SELECT pg_advisory_xact_lock(727274); ${sql}; INSERT INTO schema_migrations (version) VALUES (${Number(version)}) ON CONFLICT DO NOTHING; COMMIT;`);
  }
}

// A database remembers which environment created it. A staging site pointed at the production
// database (or the other way round) refuses to start instead of mixing test data with real guests.
async function checkEnvironment(db, appEnv) {
  await db.query("INSERT INTO app_meta (key, value) VALUES ('env', $1) ON CONFLICT (key) DO NOTHING", [appEnv]);
  const [row] = await db.query("SELECT value FROM app_meta WHERE key = 'env'");
  if (row.value !== appEnv) {
    const e = new Error(`This database belongs to the "${row.value}" environment, but this site runs as "${appEnv}". Check DATABASE_URL and APP_ENV.`);
    e.code = "ENV_MISMATCH";
    throw e;
  }
}

export function resetForTests() { ready = null; }
