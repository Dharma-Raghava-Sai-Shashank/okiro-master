import { describe, expect, it } from 'vitest'
import { median, projectRating, rankTags, readInsights, weeklyPace } from '../src/main/progress/insights-model'

const DAY = 86_400_000

describe('projectRating', () => {
  const pts = [1500, 1600, 1700, 1800, 1900].map((r, i) => ({ time: i * DAY, rating: r }))
  it('projects an upward trend to the target', () => {
    const p = projectRating(pts, 2100, 4 * DAY)
    expect(p.projectedAt).toBe(6 * DAY)
    expect(p.perContestSlope).toBe(100)
  })
  it('returns null for a flat or falling trend', () => {
    const flat = [1600, 1590, 1600, 1580].map((r, i) => ({ time: i * DAY, rating: r }))
    expect(projectRating(flat, 2100, 3 * DAY).projectedAt).toBeNull()
  })
  it('returns now when already at the target', () => {
    expect(projectRating([{ time: 0, rating: 2150 }], 2100, 123).projectedAt).toBe(123)
  })
})

describe('weeklyPace', () => {
  it('computes recent pace and an ETA', () => {
    const now = new Date(2026, 10, 13, 12).getTime()
    const p = weeklyPace([now - 3 * DAY, now - 10 * DAY], 10, now)
    expect(p.perWeek4).toBe(0.5)
    expect(p.etaAt).toBe(now + 20 * 7 * DAY)
    expect(p.weekly).toHaveLength(26)
    expect(p.weekly[p.weekly.length - 1].cumulative).toBe(2)
  })
})

describe('rankTags', () => {
  it('puts the most-failed tags first and keeps strengths separate', () => {
    const t = (tag: string, solved: number, failed: number) => ({ tag, solved, failed, rate: solved / Math.max(1, solved + failed) })
    const { focus, strong } = rankTags([t('greedy', 2, 6), t('dp', 10, 1), t('math', 5, 2), t('graphs', 1, 0)])
    expect(focus.map((x) => x.tag)).toEqual(['greedy', 'math'])
    expect(strong.map((x) => x.tag)).toEqual(['dp'])
  })
})

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('readInsights', () => {
  it('mentions the projection and the focus area', () => {
    const lines = readInsights({
      ratingCurrent: 1712,
      projectedAt: new Date(2027, 5, 1).getTime(),
      perContestSlope: 25,
      perWeek4: 3,
      contestsLeft: 240,
      etaAt: new Date(2028, 0, 1).getTime(),
      firstTryRate: 0.4,
      focus: [{ tag: 'greedy', solved: 2, failed: 6, rate: 0.25 }],
      avgWaRate: 0.3,
      streak: 4,
      now: Date.now()
    })
    expect(lines.join(' ')).toContain('2100')
    expect(lines.join(' ')).toContain('greedy')
    expect(lines.join(' ')).toContain('4-day streak')
  })
})
