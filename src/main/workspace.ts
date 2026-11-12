import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CustomRunResult, ProblemRef, ProblemWork, RunResponse, StressRecord, TestCase } from '@shared/types'
import { all, get, run } from './db'
import { resourcesDir, workDir } from './paths'
import { runCustom, runTests } from './runner'

let template: string | null = null

function defaultCode(): string {
  template ??= readFileSync(join(resourcesDir(), 'snippets', 'template.cpp'), 'utf8')
  return template
}

/** The on-disk path clangd sees for this problem's buffer. */
export function problemFile(ref: ProblemRef): string {
  const dir = join(workDir(), `${ref.contestId}${ref.index}`)
  mkdirSync(dir, { recursive: true })
  return join(dir, 'main.cpp')
}

export function getCode(ref: ProblemRef): string {
  const row = get<{ code: string }>('SELECT code FROM problem_state WHERE contest_id = ? AND idx = ?', ref.contestId, ref.index)
  const now = Date.now()
  run(
    `INSERT INTO problem_state (contest_id, idx, code, first_opened, last_opened) VALUES (?, ?, '', ?, ?)
     ON CONFLICT(contest_id, idx) DO UPDATE SET last_opened = excluded.last_opened`,
    ref.contestId,
    ref.index,
    now,
    now
  )
  return row?.code || defaultCode()
}

export function saveCode(ref: ProblemRef, code: string): void {
  run(
    `INSERT INTO problem_state (contest_id, idx, code, first_opened, last_opened) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(contest_id, idx) DO UPDATE SET code = excluded.code`,
    ref.contestId,
    ref.index,
    code,
    Date.now(),
    Date.now()
  )
  writeFileSync(problemFile(ref), code)
}

export function currentCode(ref: ProblemRef): string {
  return get<{ code: string }>('SELECT code FROM problem_state WHERE contest_id = ? AND idx = ?', ref.contestId, ref.index)?.code ?? ''
}

export function listTests(ref: ProblemRef): TestCase[] {
  return all<{ id: number; input: string; expected: string; is_sample: number }>(
    'SELECT id, input, expected, is_sample FROM tests WHERE contest_id = ? AND idx = ? ORDER BY is_sample DESC, id ASC',
    ref.contestId,
    ref.index
  ).map((t) => ({ id: t.id, input: t.input, expected: t.expected, isSample: t.is_sample === 1 }))
}

export function addTest(ref: ProblemRef, input: string, expected: string): TestCase {
  const r = run('INSERT INTO tests (contest_id, idx, input, expected, is_sample) VALUES (?, ?, ?, ?, 0)', ref.contestId, ref.index, input, expected)
  return { id: r.lastInsertRowid, input, expected, isSample: false }
}

export function updateTest(id: number, input: string, expected: string): void {
  run('UPDATE tests SET input = ?, expected = ? WHERE id = ?', input, expected, id)
}

export function deleteTest(id: number): void {
  run('DELETE FROM tests WHERE id = ?', id)
}

export function limitsOf(ref: ProblemRef): { timeLimitMs: number; anyCase: boolean } {
  const d = get<{ time_limit_ms: number; any_case: number }>(
    'SELECT time_limit_ms, any_case FROM problem_details WHERE contest_id = ? AND idx = ?',
    ref.contestId,
    ref.index
  )
  return { timeLimitMs: d?.time_limit_ms ?? 2000, anyCase: d?.any_case === 1 }
}

export async function runProblemTests(ref: ProblemRef, code: string, testIds: number[] | null): Promise<RunResponse> {
  const tests = listTests(ref).filter((t) => !testIds || testIds.includes(t.id))
  const res = await runTests(code, tests, limitsOf(ref))
  lastRuns.set(`${ref.contestId}${ref.index}`, res)
  return res
}

/** Most recent local run per problem, so Arjun can see what the student just saw. */
export const lastRuns = new Map<string, RunResponse>()

export function getWork(ref: ProblemRef): ProblemWork {
  const code = getCode(ref)
  const row = get<{ notes: string; active_ms: number }>(
    'SELECT notes, active_ms FROM problem_state WHERE contest_id = ? AND idx = ?',
    ref.contestId,
    ref.index
  )
  return { code, notes: row?.notes ?? '', activeMs: row?.active_ms ?? 0 }
}

export function saveNotes(ref: ProblemRef, notes: string): void {
  run('UPDATE problem_state SET notes = ? WHERE contest_id = ? AND idx = ?', notes, ref.contestId, ref.index)
}

/** Adds focused time to the problem's timer and returns the new total (ms). */
export function addActiveTime(ref: ProblemRef, ms: number): number {
  const add = Math.max(0, Math.min(ms, 10 * 60 * 1000))
  run('UPDATE problem_state SET active_ms = active_ms + ? WHERE contest_id = ? AND idx = ?', add, ref.contestId, ref.index)
  return get<{ active_ms: number }>('SELECT active_ms FROM problem_state WHERE contest_id = ? AND idx = ?', ref.contestId, ref.index)?.active_ms ?? 0
}

export function runProblemCustom(ref: ProblemRef, code: string, input: string): Promise<CustomRunResult> {
  return runCustom(code, input, limitsOf(ref).timeLimitMs)
}

export function saveStress(ref: ProblemRef, rec: StressRecord): void {
  run(
    `INSERT OR REPLACE INTO stress_records (contest_id, idx, input, expected, got, verdict, iterations, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ref.contestId,
    ref.index,
    rec.input,
    rec.expected,
    rec.got,
    rec.verdict,
    rec.iterations,
    rec.at
  )
}

export function lastStress(ref: ProblemRef): StressRecord | null {
  const r = get<{ input: string; expected: string; got: string; verdict: string; iterations: number; at: number }>(
    'SELECT input, expected, got, verdict, iterations, at FROM stress_records WHERE contest_id = ? AND idx = ?',
    ref.contestId,
    ref.index
  )
  return r ?? null
}

export function addTestFromStress(ref: ProblemRef): TestCase | null {
  const r = lastStress(ref)
  return r ? addTest(ref, r.input, r.expected) : null
}
