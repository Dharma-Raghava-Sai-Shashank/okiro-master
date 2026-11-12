import { safeStorage } from 'electron'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { all, get, run } from './db'
import { recommendedModel } from './llm/recommend'

export function getSettings(): Settings {
  const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings')
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  // Until the user picks one, the chat model follows this Mac's memory (gpt-oss-20b won't fit in 8 GB).
  out.ollamaModel = recommendedModel()
  for (const r of rows) {
    if (r.key in DEFAULT_SETTINGS) out[r.key] = JSON.parse(r.value)
  }
  return out as unknown as Settings
}

export function updateSettings(patch: Partial<Settings>): Settings {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue
    run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value))
  }
  return getSettings()
}

const CLAUDE_KEY = '__claude_key'

export function setClaudeKey(key: string): void {
  const enc = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key).toString('base64') : ''
  if (!enc) throw new Error('OS keychain encryption is not available')
  run('INSERT INTO kv_cache (key, value, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', CLAUDE_KEY, enc, Date.now())
}

export function clearClaudeKey(): void {
  run('DELETE FROM kv_cache WHERE key = ?', CLAUDE_KEY)
}

export function getClaudeKey(): string | null {
  const row = get<{ value: string }>('SELECT value FROM kv_cache WHERE key = ?', CLAUDE_KEY)
  if (!row) return process.env.ANTHROPIC_API_KEY ?? null
  try {
    return safeStorage.decryptString(Buffer.from(row.value, 'base64'))
  } catch {
    return null
  }
}
