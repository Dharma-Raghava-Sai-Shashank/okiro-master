import type { Insights } from '@shared/types'
import { all } from '../db'
import { getSettings } from '../settings'
import { ratingHistory, userInfo } from '../cf/sync'
import { bestStreakOf, computeRoadmap, isoDate, streakOf } from './model'
import { contestCompletions, dayStats, firstSolves, lastOpenedByContest, snapshot } from './index'
import { median, projectRating, rankTags, readInsights, shortVerdict, weeklyPace, type TagStat } from './insights-model'

const DAY = 86_400_000

export async function insights(): Promise<Insights> {
  const s = getSettings()
  const now = Date.now()
  const [user, history] = [await userInfo(), await ratingHistory()]
  const { rows, subs, problems } = snapshot()
  const info = new Map(problems.map((p) => [`${p.contestId}${p.index}`, p]))
  const solves = firstSolves(subs)
  const rm = computeRoadmap(rows, s.windowSize, lastOpenedByContest())

  // Rating
  const proj = projectRating(
    history.map((h) => ({ time: h.time, rating: h.newRating })),
    2100,
    now
  )
  const before30 = [...history].reverse().find((h) => h.time <= now - 30 * DAY)
  const current = user?.rating ?? history[history.length - 1]?.newRating ?? null
  const delta30d = current !== null && before30 ? current - before30.newRating : 0

  // Roadmap pace
  const completions = [...contestCompletions(rows, solves, s.windowSize).values()]
  const pace = weeklyPace(completions, rm.contestsLeft, now)

  // Verdicts and attempts per solved problem
  const verdictCounts = new Map<string, number>()
  const attempts = new Map<string, { tries: number; firstOk: boolean | null }>()
  for (const sub of subs) {
    if (sub.verdict === 'TESTING') continue
    const v = shortVerdict(sub.verdict)
    verdictCounts.set(v, (verdictCounts.get(v) ?? 0) + 1)
    const k = `${sub.contest_id}${sub.idx}`
    const a = attempts.get(k) ?? { tries: 0, firstOk: null }
    if (a.firstOk === null) a.firstOk = sub.verdict === 'OK'
    // Count tries up to (and including) the first AC; compilation errors don't count.
    if (!solves.has(k) || sub.created_at <= solves.get(k)!) if (sub.verdict !== 'COMPILATION_ERROR') a.tries++
    attempts.set(k, a)
  }
  const solvedKeys = [...solves.keys()]
  const firstTry = solvedKeys.filter((k) => attempts.get(k)?.firstOk).length
  const firstTryRate = solvedKeys.length ? firstTry / solvedKeys.length : 0

  // Rating bands over the roadmap window's target problems
  const window = rows.filter((r) => r.targetTotal > 0).slice(0, s.windowSize)
  const bands = new Map<number, { solved: number; total: number; firstTry: number; tries: number }>()
  for (const r of window) {
    for (const p of r.problems) {
      if (!p.inTarget || p.rating === null) continue
      const b = bands.get(p.rating) ?? { solved: 0, total: 0, firstTry: 0, tries: 0 }
      b.total++
      if (p.status === 'solved') {
        b.solved++
        const a = attempts.get(`${p.contestId}${p.index}`)
        if (a?.firstOk) b.firstTry++
        b.tries += Math.max(1, a?.tries ?? 1)
      }
      bands.set(p.rating, b)
    }
  }

  // Tags
  const tagMap = new Map<string, TagStat>()
  for (const sub of subs) {
    const p = info.get(`${sub.contest_id}${sub.idx}`)
    if (!p || sub.verdict === 'TESTING' || sub.verdict === 'COMPILATION_ERROR') continue
    for (const tag of p.tags) {
      const t = tagMap.get(tag) ?? { tag, solved: 0, failed: 0, rate: 0 }
      if (sub.verdict === 'OK') {
        if (solves.get(`${sub.contest_id}${sub.idx}`) === sub.created_at) t.solved++
      } else t.failed++
      tagMap.set(tag, t)
    }
  }
  const tags = [...tagMap.values()].map((t) => ({ ...t, rate: t.solved / Math.max(1, t.solved + t.failed) })).sort((a, b) => b.solved - a.solved)
  const { focus, strong } = rankTags(tags)
  const totalFailed = tags.reduce((x, t) => x + t.failed, 0)
  const totalTagged = tags.reduce((x, t) => x + t.failed + t.solved, 0)

  // Solve time: focused time in the workspace, else first-open → AC (if under 6 h)
  const work = all<{ contest_id: number; idx: string; active_ms: number; first_opened: number | null }>(
    'SELECT contest_id, idx, active_ms, first_opened FROM problem_state'
  )
  const timeByBand = new Map<number, number[]>()
  for (const w of work) {
    const k = `${w.contest_id}${w.idx}`
    const at = solves.get(k)
    const rating = info.get(k)?.rating
    if (!at || !rating) continue
    let ms = w.active_ms
    if (!ms && w.first_opened && at > w.first_opened && at - w.first_opened < 6 * 3600_000) ms = at - w.first_opened
    if (!ms) continue
    const band = Math.floor(rating / 100) * 100
    timeByBand.set(band, [...(timeByBand.get(band) ?? []), ms / 60_000])
  }

  // When you solve
  const byHour = Array.from({ length: 24 }, () => 0)
  const byWeekday = Array.from({ length: 7 }, () => 0)
  for (const t of solves.values()) {
    const d = new Date(t)
    byHour[d.getHours()]++
    byWeekday[(d.getDay() + 6) % 7]++
  }

  // Bests
  const perDay = new Map<string, number>()
  for (const t of solves.values()) perDay.set(isoDate(new Date(t)), (perDay.get(isoDate(new Date(t))) ?? 0) + 1)
  let mostInDay = 0
  let mostInDayDate: string | null = null
  for (const [d, n] of perDay)
    if (n > mostInDay) {
      mostInDay = n
      mostInDayDate = d
    }
  let hardest: Insights['bests']['hardest'] = null
  for (const k of solvedKeys) {
    const p = info.get(k)
    if (p?.rating && (!hardest || p.rating > hardest.rating)) hardest = { name: p.name, rating: p.rating, contestId: p.contestId, index: p.index }
  }
  const days = new Set(perDay.keys())
  const streak = streakOf(days, isoDate(new Date()))

  const recentAcs = [...solves.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, at]) => {
      const p = info.get(k)
      return { contestId: p?.contestId ?? 0, index: p?.index ?? '', name: p?.name ?? k, rating: p?.rating ?? null, at }
    })

  const from = new Date(now - 364 * DAY)
  const heatmap = dayStats(isoDate(from), isoDate(new Date(now)))

  return {
    rating: {
      current,
      max: user?.maxRating ?? null,
      delta30d,
      projectedMasterAt: proj.projectedAt,
      perContestSlope: proj.perContestSlope,
      history
    },
    pace: {
      weekly: pace.weekly.map((w) => ({ weekStart: isoDate(new Date(w.weekStart)), completed: w.completed, cumulative: w.cumulative })),
      perWeek4: pace.perWeek4,
      etaAt: pace.etaAt
    },
    verdicts: [...verdictCounts.entries()].map(([verdict, count]) => ({ verdict, count })).sort((a, b) => b.count - a.count),
    firstTryRate,
    bands: [...bands.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rating, b]) => ({
        rating,
        solved: b.solved,
        total: b.total,
        firstTry: b.solved ? b.firstTry / b.solved : 0,
        avgAttempts: b.solved ? b.tries / b.solved : 0
      })),
    tags,
    focusTags: focus,
    strongTags: strong,
    solveTime: [...timeByBand.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rating, xs]) => ({ rating, medianMin: Math.round(median(xs)), samples: xs.length })),
    byHour,
    byWeekday,
    bests: { mostInDay, mostInDayDate, longestStreak: bestStreakOf(days), hardest },
    recentAcs,
    heatmap,
    read: readInsights({
      ratingCurrent: current,
      projectedAt: proj.projectedAt,
      perContestSlope: proj.perContestSlope,
      perWeek4: pace.perWeek4,
      contestsLeft: rm.contestsLeft,
      etaAt: pace.etaAt,
      firstTryRate,
      focus,
      avgWaRate: totalTagged ? totalFailed / totalTagged : 0,
      streak,
      now
    })
  }
}
