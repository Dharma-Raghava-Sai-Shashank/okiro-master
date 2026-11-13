import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { SCHEMA } from './schema'
import { looksLikeToolCallJson } from '../coach/toolcall-json'

let db: DatabaseSync | null = null

export function openDb(file: string): DatabaseSync {
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
  db.exec(SCHEMA)
  migrate(db)
  return db
}

function addColumn(d: DatabaseSync, table: string, column: string, def: string): void {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
}

/** Additive migrations for databases created by earlier versions. */
function migrate(d: DatabaseSync): void {
  addColumn(d, 'problem_state', 'notes', "TEXT NOT NULL DEFAULT ''")
  addColumn(d, 'problem_state', 'active_ms', 'INTEGER NOT NULL DEFAULT 0')
  // Small models sometimes answered with a tool call written as JSON text; those rows poison the
  // history the model sees, so drop them.
  const rows = d.prepare("SELECT id, content FROM chat_messages WHERE role = 'assistant' AND content LIKE '%\"name\"%'").all() as {
    id: number
    content: string
  }[]
  const del = d.prepare('DELETE FROM chat_messages WHERE id = ?')
  for (const r of rows) if (looksLikeToolCallJson(r.content)) del.run(r.id)
  // Voice v3: move old defaults to the new ones (never-thinking instruct model, female voice,
  // accurate STT). Runs once — later manual choices must stick.
  const MIGR = 'migr.voice-v3'
  if (!d.prepare('SELECT 1 FROM kv_cache WHERE key = ?').get(MIGR)) {
    const remap: [string, string, string][] = [
      ['ollamaModel', '"qwen3:4b"', '"qwen3:4b-instruct"'],
      ['ollamaModel', '"qwen2.5-coder:3b"', '"qwen3:4b-instruct"'],
      ['ttsVoice', '"am_michael"', '"af_heart"'],
      ['sttModel', '"onnx-community/whisper-base.en"', '"onnx-community/whisper-small.en"'],
      ['sttModel', '"onnx-community/moonshine-base-ONNX"', '"onnx-community/whisper-small.en"']
    ]
    const up = d.prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?')
    for (const [key, from, to] of remap) up.run(to, key, from)
    d.prepare('INSERT INTO kv_cache (key, value, fetched_at) VALUES (?, ?, ?)').run(MIGR, '1', Date.now())
  }
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not opened')
  return db
}

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return getDb().prepare(sql).all(...params) as T[]
}

export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined
}

export function run(sql: string, ...params: SQLInputValue[]): { changes: number; lastInsertRowid: number } {
  const r = getDb().prepare(sql).run(...params)
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }
}

export function tx<T>(fn: () => T): T {
  const d = getDb()
  d.exec('BEGIN')
  try {
    const out = fn()
    d.exec('COMMIT')
    return out
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}
