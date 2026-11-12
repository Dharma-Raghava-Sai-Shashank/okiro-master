// What Arjun remembers about the student across sessions.
import type { MemoryNote, ProblemRef } from '@shared/types'
import { all, get, run } from '../db'

export function addNote(kind: MemoryNote['kind'], tag: string, note: string, ref?: ProblemRef): void {
  run(
    'INSERT INTO user_memory (kind, tag, note, contest_id, idx, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    kind,
    tag,
    note,
    ref?.contestId ?? null,
    ref?.index ?? null,
    Date.now()
  )
}

export function recentNotes(limit: number): MemoryNote[] {
  return all<{ id: number; kind: string; tag: string; note: string; created_at: number }>(
    'SELECT id, kind, tag, note, created_at FROM user_memory ORDER BY id DESC LIMIT ?',
    limit
  ).map((r) => ({ id: r.id, kind: r.kind as MemoryNote['kind'], tag: r.tag, note: r.note, createdAt: r.created_at }))
}

/** Deterministic note written when a problem gets accepted. */
export function recordSolve(ref: ProblemRef): void {
  if (get('SELECT 1 FROM user_memory WHERE kind = ? AND contest_id = ? AND idx = ?', 'solve', ref.contestId, ref.index)) return
  const p = get<{ name: string; rating: number | null; tags: string }>(
    'SELECT name, rating, tags FROM problems WHERE contest_id = ? AND idx = ?',
    ref.contestId,
    ref.index
  )
  const fails = all<{ verdict: string; n: number }>(
    "SELECT verdict, COUNT(*) AS n FROM submissions WHERE contest_id = ? AND idx = ? AND verdict NOT IN ('OK', 'TESTING') GROUP BY verdict",
    ref.contestId,
    ref.index
  )
  const tags = p ? (JSON.parse(p.tags) as string[]) : []
  const failText = fails.length ? ` after ${fails.map((f) => `${f.verdict.replace(/_/g, ' ').toLowerCase()} ×${f.n}`).join(', ')}` : ' first try'
  addNote('solve', tags[0] ?? '', `Solved ${ref.contestId}${ref.index} ${p?.name ?? ''} (${p?.rating ?? '?'}; ${tags.join(', ')})${failText}.`, ref)
}
