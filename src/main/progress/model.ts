// Pure progress logic: solved status, contest rows and the road-to-Master queue.
// Kept free of DB/Electron imports so it can be unit-tested directly.
import type { Contest, ContestRow, ProblemCell, ProblemStatus, Roadmap, RoadmapStep } from '@shared/types'
import { compareIndex } from '../cf/classify'

export interface RawProblem {
  contestId: number
  index: string
  name: string
  rating: number | null
  tags: string[]
}

export interface RawSubmission {
  contestId: number
  index: string
  verdict: string
}

const key = (contestId: number, index: string) => `${contestId}${index}`

/**
 * Solved/attempted status per problem. Div. 1 and Div. 2 rounds held together share problems under
 * adjacent contest ids, so a solve in one also counts for the same-named problem in the neighbour.
 */
export function computeStatus(subs: RawSubmission[], problems: RawProblem[]): Map<string, ProblemStatus> {
  const status = new Map<string, ProblemStatus>()
  for (const s of subs) {
    const k = key(s.contestId, s.index)
    if (s.verdict === 'OK') status.set(k, 'solved')
    else if (!status.has(k)) status.set(k, 'attempted')
  }
  const byName = new Map<string, RawProblem[]>()
  for (const p of problems) {
    const list = byName.get(p.name)
    if (list) list.push(p)
    else byName.set(p.name, [p])
  }
  for (const list of byName.values()) {
    if (list.length < 2) continue
    for (const a of list) {
      if (status.get(key(a.contestId, a.index)) !== 'solved') continue
      for (const b of list) {
        if (b !== a && Math.abs(b.contestId - a.contestId) <= 1) status.set(key(b.contestId, b.index), 'solved')
      }
    }
  }
  return status
}

export function isInTarget(rating: number | null, cap: number, includeUnrated: boolean): boolean {
  return rating === null ? includeUnrated : rating <= cap
}

/** Contests must be sorted newest first; the result keeps that order. */
export function buildRows(
  contests: Contest[],
  problems: RawProblem[],
  status: Map<string, ProblemStatus>,
  cap: number,
  includeUnrated: boolean
): ContestRow[] {
  const byContest = new Map<number, RawProblem[]>()
  for (const p of problems) {
    const list = byContest.get(p.contestId)
    if (list) list.push(p)
    else byContest.set(p.contestId, [p])
  }
  const rows: ContestRow[] = []
  for (const contest of contests) {
    const list = (byContest.get(contest.id) ?? []).slice().sort((a, b) => compareIndex(a.index, b.index))
    if (list.length === 0) continue
    const cells: ProblemCell[] = list.map((p) => ({
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating,
      tags: p.tags,
      status: status.get(key(p.contestId, p.index)) ?? 'untouched',
      inTarget: isInTarget(p.rating, cap, includeUnrated)
    }))
    const target = cells.filter((c) => c.inTarget)
    rows.push({
      contest,
      problems: cells,
      targetTotal: target.length,
      targetSolved: target.filter((c) => c.status === 'solved').length
    })
  }
  return rows
}

const isComplete = (r: ContestRow) => r.targetSolved === r.targetTotal

/**
 * The queue walks the last `windowSize` contests that have at least one target problem, newest to oldest.
 * The current position is the incomplete contest opened most recently (so an in-progress contest is
 * resumed), otherwise the newest incomplete one; within it, the lowest-index unsolved target problem.
 */
export function computeRoadmap(rows: ContestRow[], windowSize: number, lastOpened: Map<number, number>): Roadmap {
  const window = rows.filter((r) => r.targetTotal > 0).slice(0, windowSize)
  const incomplete = window.filter((r) => !isComplete(r))
  let current: ContestRow | undefined
  let best = 0
  for (const r of incomplete) {
    const t = lastOpened.get(r.contest.id) ?? 0
    if (t > best) {
      best = t
      current = r
    }
  }
  current ??= incomplete[0]
  const remainingOf = (r: ContestRow) => r.problems.filter((p) => p.inTarget && p.status !== 'solved')
  const nextUp: RoadmapStep[] = incomplete
    .filter((r) => r !== current)
    .slice(0, 5)
    .map((r) => ({ contest: r.contest, remaining: remainingOf(r), targetTotal: r.targetTotal }))
  return {
    windowContests: window.length,
    contestsDone: window.length - incomplete.length,
    contestsLeft: incomplete.length,
    problemsDone: window.reduce((s, r) => s + r.targetSolved, 0),
    problemsTotal: window.reduce((s, r) => s + r.targetTotal, 0),
    current: current
      ? {
          contest: current.contest,
          problem: remainingOf(current)[0],
          targetTotal: current.targetTotal,
          targetSolved: current.targetSolved
        }
      : null,
    nextUp
  }
}

/** Consecutive days (ending today or yesterday) on which the predicate held. */
export function streakOf(dates: Set<string>, today: string): number {
  const d = new Date(`${today}T00:00:00`)
  if (!dates.has(today)) d.setDate(d.getDate() - 1)
  let n = 0
  while (dates.has(isoDate(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function bestStreakOf(dates: Set<string>): number {
  const sorted = [...dates].sort()
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const s of sorted) {
    const d = new Date(`${s}T00:00:00`)
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
