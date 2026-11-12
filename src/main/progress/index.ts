import type {
  Contest,
  ContestFilter,
  ContestRow,
  ContestType,
  DayEvent,
  DayStat,
  ProblemRef,
  Roadmap,
  StatsSummary,
  Submission
} from '@shared/types'
import { all } from '../db'
import { getSettings } from '../settings'
import { levelOf } from '../cf/classify'
import { bestStreakOf, buildRows, computeRoadmap, computeStatus, isoDate, streakOf, type RawProblem } from './model'

interface ContestRowDb {
  id: number
  name: string
  type: string
  start_time: number
  duration: number
}

interface ProblemRowDb {
  contest_id: number
  idx: string
  name: string
  rating: number | null
  tags: string
}

interface SubRowDb {
  id: number
  contest_id: number
  idx: string
  verdict: string
  passed_tests: number
  time_ms: number
  created_at: number
  from_app: number
}

function loadContests(): Contest[] {
  return all<ContestRowDb>('SELECT id, name, type, start_time, duration FROM contests ORDER BY start_time DESC, id DESC').map(
    (c) => ({ id: c.id, name: c.name, type: c.type as ContestType, startTime: c.start_time, duration: c.duration })
  )
}

function loadProblems(): RawProblem[] {
  return all<ProblemRowDb>('SELECT contest_id, idx, name, rating, tags FROM problems').map((p) => ({
    contestId: p.contest_id,
    index: p.idx,
    name: p.name,
    rating: p.rating,
    tags: JSON.parse(p.tags) as string[]
  }))
}

function loadSubs(): SubRowDb[] {
  return all<SubRowDb>('SELECT * FROM submissions ORDER BY created_at ASC')
}

interface Snapshot {
  rows: ContestRow[]
  subs: SubRowDb[]
  problems: RawProblem[]
}

/** All rows for the enabled contest types with the configured cap, newest first. */
function snapshot(types?: ContestType[], cap?: number): Snapshot {
  const s = getSettings()
  const enabled = new Set(types ?? s.contestTypes)
  const problems = loadProblems()
  const subs = loadSubs()
  const status = computeStatus(
    subs.map((x) => ({ contestId: x.contest_id, index: x.idx, verdict: x.verdict })),
    problems
  )
  const contests = loadContests().filter((c) => enabled.has(c.type))
  return { rows: buildRows(contests, problems, status, cap ?? s.ratingCap, s.includeUnrated), subs, problems }
}

export function contestRows(filter: ContestFilter): ContestRow[] {
  const { rows } = snapshot(filter.types, filter.ratingCap)
  const q = filter.search.trim().toLowerCase()
  return rows
    .filter((r) => !q || r.contest.name.toLowerCase().includes(q) || String(r.contest.id).includes(q))
    .filter((r) => !filter.hideCompleted || r.targetSolved < r.targetTotal)
    .slice(0, filter.limit)
}

function lastOpenedByContest(): Map<number, number> {
  const rows = all<{ contest_id: number; t: number }>(
    'SELECT contest_id, MAX(last_opened) AS t FROM problem_state WHERE last_opened IS NOT NULL GROUP BY contest_id'
  )
  return new Map(rows.map((r) => [r.contest_id, r.t]))
}

export function roadmap(): Roadmap {
  const { rows } = snapshot()
  return computeRoadmap(rows, getSettings().windowSize, lastOpenedByContest())
}

export function submissionsFor(ref: ProblemRef): Submission[] {
  return all<SubRowDb>('SELECT * FROM submissions WHERE contest_id = ? AND idx = ? ORDER BY created_at DESC', ref.contestId, ref.index).map(
    toSubmission
  )
}

export function toSubmission(s: SubRowDb): Submission {
  return {
    id: s.id,
    contestId: s.contest_id,
    index: s.idx,
    verdict: s.verdict,
    passedTests: s.passed_tests,
    timeMs: s.time_ms,
    createdAt: s.created_at,
    fromApp: s.from_app === 1
  }
}

/** First accepted time per problem (ms). */
function firstSolves(subs: SubRowDb[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of subs) {
    if (s.verdict !== 'OK') continue
    const k = `${s.contest_id}${s.idx}`
    if (!out.has(k)) out.set(k, s.created_at)
  }
  return out
}

/** When each window contest became complete (time of its last first-solve), by contest id. */
function contestCompletions(rows: ContestRow[], solves: Map<string, number>, windowSize: number): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of rows.filter((x) => x.targetTotal > 0).slice(0, windowSize)) {
    if (r.targetSolved !== r.targetTotal) continue
    let t = 0
    for (const p of r.problems) {
      if (!p.inTarget) continue
      t = Math.max(t, solves.get(`${p.contestId}${p.index}`) ?? 0)
    }
    if (t > 0) out.set(r.contest.id, t)
  }
  return out
}

const dayOf = (ms: number) => isoDate(new Date(ms))

export function dayStats(from: string, to: string): DayStat[] {
  const s = getSettings()
  const { rows, subs } = snapshot()
  const solves = firstSolves(subs)
  const completions = contestCompletions(rows, solves, s.windowSize)
  const solvedByDay = new Map<string, number>()
  for (const t of solves.values()) solvedByDay.set(dayOf(t), (solvedByDay.get(dayOf(t)) ?? 0) + 1)
  const attemptedByDay = new Map<string, Set<string>>()
  for (const sub of subs) {
    if (sub.verdict === 'OK') continue
    const k = `${sub.contest_id}${sub.idx}`
    const d = dayOf(sub.created_at)
    const solvedAt = solves.get(k)
    if (solvedAt && dayOf(solvedAt) === d) continue
    const set = attemptedByDay.get(d) ?? new Set<string>()
    set.add(k)
    attemptedByDay.set(d, set)
  }
  const contestsByDay = new Map<string, number>()
  for (const t of completions.values()) contestsByDay.set(dayOf(t), (contestsByDay.get(dayOf(t)) ?? 0) + 1)

  const out: DayStat[] = []
  const d = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (d <= end) {
    const date = isoDate(d)
    const solved = solvedByDay.get(date) ?? 0
    const contestsCompleted = contestsByDay.get(date) ?? 0
    out.push({
      date,
      solved,
      attempted: attemptedByDay.get(date)?.size ?? 0,
      contestsCompleted,
      goalMet:
        (s.dailyContestGoal > 0 && contestsCompleted >= s.dailyContestGoal) ||
        (s.dailyProblemGoal > 0 && solved >= s.dailyProblemGoal)
    })
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function dayEvents(date: string): DayEvent[] {
  const s = getSettings()
  const { rows, subs, problems } = snapshot()
  const info = new Map(problems.map((p) => [`${p.contestId}${p.index}`, p]))
  const solves = firstSolves(subs)
  const events: DayEvent[] = []
  const seenAttempt = new Set<string>()
  for (const sub of subs) {
    if (dayOf(sub.created_at) !== date) continue
    const k = `${sub.contest_id}${sub.idx}`
    const p = info.get(k)
    const base = { contestId: sub.contest_id, index: sub.idx, name: p?.name ?? k, rating: p?.rating ?? null }
    if (sub.verdict === 'OK' && solves.get(k) === sub.created_at) {
      events.push({ ...base, time: sub.created_at, kind: 'solved', verdict: 'OK' })
    } else if (sub.verdict !== 'OK' && !seenAttempt.has(k)) {
      seenAttempt.add(k)
      events.push({ ...base, time: sub.created_at, kind: 'attempted', verdict: sub.verdict })
    }
  }
  const byId = new Map(rows.map((r) => [r.contest.id, r.contest]))
  for (const [cid, t] of contestCompletions(rows, solves, s.windowSize)) {
    if (dayOf(t) !== date) continue
    events.push({ time: t, kind: 'contest-complete', contestId: cid, index: '', name: byId.get(cid)?.name ?? String(cid), rating: null })
  }
  return events.sort((a, b) => a.time - b.time)
}

export function summary(): StatsSummary {
  const s = getSettings()
  const { rows, subs, problems } = snapshot()
  const solves = firstSolves(subs)
  const window = rows.filter((r) => r.targetTotal > 0).slice(0, s.windowSize)
  const levels = new Map<string, { solved: number; total: number }>()
  const ratings = new Map<number, { solved: number; total: number }>()
  let targetSolved = 0
  for (const r of window) {
    for (const p of r.problems) {
      if (!p.inTarget) continue
      const solved = p.status === 'solved' ? 1 : 0
      targetSolved += solved
      const lv = levels.get(levelOf(p.index)) ?? { solved: 0, total: 0 }
      lv.solved += solved
      lv.total++
      levels.set(levelOf(p.index), lv)
      if (p.rating !== null) {
        const rt = ratings.get(p.rating) ?? { solved: 0, total: 0 }
        rt.solved += solved
        rt.total++
        ratings.set(p.rating, rt)
      }
    }
  }
  const tagCounts = new Map<string, number>()
  const info = new Map(problems.map((p) => [`${p.contestId}${p.index}`, p]))
  for (const k of solves.keys()) {
    for (const t of info.get(k)?.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
  const days = new Set([...solves.values()].map(dayOf))
  return {
    totalSolved: solves.size,
    targetSolved,
    byLevel: [...levels.entries()].map(([level, v]) => ({ level, ...v })).sort((a, b) => a.level.localeCompare(b.level)),
    byRating: [...ratings.entries()].map(([rating, v]) => ({ rating, ...v })).sort((a, b) => a.rating - b.rating),
    byTag: [...tagCounts.entries()].map(([tag, solved]) => ({ tag, solved })).sort((a, b) => b.solved - a.solved),
    streak: streakOf(days, isoDate(new Date())),
    bestStreak: bestStreakOf(days),
    roadmap: computeRoadmap(rows, s.windowSize, lastOpenedByContest())
  }
}

/** Per-tag solve/attempt history, used by Arjun's get_user_history tool. */
export function tagHistory(tag?: string): { tag: string; solved: number; failedAttempts: number }[] {
  const { subs, problems } = snapshot()
  const info = new Map(problems.map((p) => [`${p.contestId}${p.index}`, p]))
  const solves = firstSolves(subs)
  const out = new Map<string, { solved: number; failedAttempts: number }>()
  for (const sub of subs) {
    const p = info.get(`${sub.contest_id}${sub.idx}`)
    for (const t of p?.tags ?? []) {
      if (tag && t !== tag) continue
      const e = out.get(t) ?? { solved: 0, failedAttempts: 0 }
      if (sub.verdict === 'OK') {
        if (solves.get(`${sub.contest_id}${sub.idx}`) === sub.created_at) e.solved++
      } else if (sub.verdict !== 'TESTING' && sub.verdict !== 'COMPILATION_ERROR') e.failedAttempts++
      out.set(t, e)
    }
  }
  return [...out.entries()].map(([t, v]) => ({ tag: t, ...v })).sort((a, b) => b.failedAttempts - a.failedAttempts)
}
