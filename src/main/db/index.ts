import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { SCHEMA } from './schema'

let db: DatabaseSync | null = null

export function openDb(file: string): DatabaseSync {
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
  db.exec(SCHEMA)
  return db
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
