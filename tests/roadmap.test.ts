import { describe, expect, it } from 'vitest'
import type { Contest } from '@shared/types'
import { bestStreakOf, buildRows, computeRoadmap, computeStatus, streakOf, type RawProblem } from '../src/main/progress/model'

const contest = (id: number, t: number): Contest => ({ id, name: `Round ${id}`, type: 'div2', startTime: t, duration: 7200 })
const prob = (contestId: number, index: string, rating: number | null, name = `${contestId}${index}`): RawProblem => ({
  contestId,
  index,
  name,
  rating,
  tags: []
})

// Newest first, like the database query.
const contests = [contest(300, 3000), contest(200, 2000), contest(100, 1000)]
const problems = [
  prob(300, 'A', 800),
  prob(300, 'B', 1200),
  prob(300, 'C', 2400),
  prob(200, 'A', 900),
  prob(200, 'B', 1900),
  prob(100, 'A', 2500)
]

describe('computeStatus', () => {
  it('marks solved over attempted and shares solves across parallel rounds', () => {
    const ps = [prob(10, 'C', 1500, 'Shared'), prob(11, 'A', 1500, 'Shared'), prob(50, 'A', 800, 'Shared')]
    const st = computeStatus(
      [
        { contestId: 10, index: 'C', verdict: 'WRONG_ANSWER' },
        { contestId: 10, index: 'C', verdict: 'OK' }
      ],
      ps
    )
    expect(st.get('10C')).toBe('solved')
    expect(st.get('11A')).toBe('solved')
    expect(st.get('50A')).toBeUndefined()
  })
})

describe('roadmap', () => {
  it('counts target problems by rating cap and finds the current problem', () => {
    const status = computeStatus([{ contestId: 300, index: 'A', verdict: 'OK' }, { contestId: 300, index: 'B', verdict: 'OK' }], problems)
    const rows = buildRows(contests, problems, status, 2000, false)
    expect(rows[0].targetTotal).toBe(2)
    expect(rows[0].targetSolved).toBe(2)
    const rm = computeRoadmap(rows, 300, new Map())
    // Contest 100 has no problem ≤ 2000, so it is outside the window.
    expect(rm.windowContests).toBe(2)
    expect(rm.contestsDone).toBe(1)
    expect(rm.current?.contest.id).toBe(200)
    expect(rm.current?.problem.index).toBe('A')
    expect(rm.problemsDone).toBe(2)
    expect(rm.problemsTotal).toBe(4)
  })

  it('resumes the contest opened most recently', () => {
    const extra = [...problems, prob(250, 'A', 1000)]
    const cs = [contests[0], contest(250, 2500), contests[1], contests[2]]
    const rows = buildRows(cs, extra, new Map(), 2000, false)
    const rm = computeRoadmap(rows, 300, new Map([[200, 5]]))
    expect(rm.current?.contest.id).toBe(200)
    expect(computeRoadmap(rows, 300, new Map()).current?.contest.id).toBe(300)
  })

  it('respects the window size', () => {
    const rows = buildRows(contests, problems, new Map(), 3000, false)
    expect(computeRoadmap(rows, 2, new Map()).windowContests).toBe(2)
  })
})

describe('streaks', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(streakOf(new Set(['2026-11-11', '2026-11-12', '2026-11-13']), '2026-11-13')).toBe(3)
    expect(streakOf(new Set(['2026-11-11', '2026-11-12']), '2026-11-13')).toBe(2)
    expect(streakOf(new Set(['2026-11-10']), '2026-11-13')).toBe(0)
  })
  it('finds the best streak', () => {
    expect(bestStreakOf(new Set(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07']))).toBe(3)
  })
})
