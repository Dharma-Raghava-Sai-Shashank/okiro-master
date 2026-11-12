export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS contests (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  phase TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problems (
  contest_id INTEGER NOT NULL,
  idx TEXT NOT NULL,
  name TEXT NOT NULL,
  rating INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  solved_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, idx)
);

CREATE TABLE IF NOT EXISTS problem_details (
  contest_id INTEGER NOT NULL,
  idx TEXT NOT NULL,
  statement_html TEXT NOT NULL,
  statement_text TEXT NOT NULL,
  time_limit_ms INTEGER NOT NULL,
  memory_mb INTEGER NOT NULL,
  interactive INTEGER NOT NULL DEFAULT 0,
  any_case INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (contest_id, idx)
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL,
  idx TEXT NOT NULL,
  input TEXT NOT NULL,
  expected TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tests_problem ON tests (contest_id, idx);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  contest_id INTEGER NOT NULL,
  idx TEXT NOT NULL,
  verdict TEXT NOT NULL,
  passed_tests INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  from_app INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS submissions_problem ON submissions (contest_id, idx);
CREATE INDEX IF NOT EXISTS submissions_time ON submissions (created_at);

CREATE TABLE IF NOT EXISTS problem_state (
  contest_id INTEGER NOT NULL,
  idx TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  first_opened INTEGER,
  last_opened INTEGER,
  PRIMARY KEY (contest_id, idx)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  tools TEXT NOT NULL DEFAULT '[]',
  model TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_scope ON chat_messages (scope, id);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file TEXT NOT NULL,
  topic TEXT NOT NULL,
  heading TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  text TEXT NOT NULL,
  hash TEXT NOT NULL,
  embedding BLOB,
  embed_model TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_hash ON kb_chunks (hash);

CREATE TABLE IF NOT EXISTS editorials (
  contest_id INTEGER NOT NULL,
  idx TEXT NOT NULL,
  text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  exact INTEGER NOT NULL DEFAULT 1,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (contest_id, idx)
);

CREATE TABLE IF NOT EXISTS editorial_blogs (
  contest_id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  text TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  contest_id INTEGER,
  idx TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kv_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, fetched_at INTEGER NOT NULL);
`
