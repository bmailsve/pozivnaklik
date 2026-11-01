// Database schema, applied in order and recorded in schema_migrations.
// Never edit a migration that has shipped: add a new [version, sql] pair instead, written so it can run twice.
export const MIGRATIONS = [
  [1, `
CREATE TABLE IF NOT EXISTS app_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  salt       text NOT NULL,
  hash       text NOT NULL,
  created_at bigint NOT NULL,
  last_login bigint
);

-- sid_hash is sha256 of the cookie value, so a copy of the database can't be used to sign in
CREATE TABLE IF NOT EXISTS sessions (
  sid_hash text PRIMARY KEY,
  user_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exp      bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS invites (
  id          text PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  owner_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  tier        text,
  status      text NOT NULL DEFAULT 'active',
  price       jsonb,
  og          jsonb,
  views       integer NOT NULL DEFAULT 0,
  paid_at     bigint,
  created_at  bigint NOT NULL,
  updated_at  bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS invites_owner ON invites(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS guests (
  id            text PRIMARY KEY,
  invitation_id text NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE,
  name          text NOT NULL,
  contact       text NOT NULL DEFAULT '',
  source        text NOT NULL DEFAULT 'personal',
  status        text NOT NULL DEFAULT 'pending',
  count         integer NOT NULL DEFAULT 1,
  note          text NOT NULL DEFAULT '',
  created_at    bigint NOT NULL,
  opened_at     bigint,
  responded_at  bigint
);
CREATE INDEX IF NOT EXISTS guests_invite ON guests(invitation_id, created_at);

CREATE TABLE IF NOT EXISTS requests (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL,
  phone      text NOT NULL DEFAULT '',
  date       text NOT NULL DEFAULT '',
  occasion   text NOT NULL DEFAULT '',
  tier       text NOT NULL DEFAULT '',
  message    text NOT NULL,
  link       text NOT NULL DEFAULT '',
  images     jsonb NOT NULL DEFAULT '[]'::jsonb,
  lang       text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'new',
  created_at bigint NOT NULL
)`]
];
