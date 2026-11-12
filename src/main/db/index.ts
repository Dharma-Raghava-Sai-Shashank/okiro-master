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
