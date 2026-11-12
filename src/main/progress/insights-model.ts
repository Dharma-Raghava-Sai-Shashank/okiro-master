// Pure maths behind the Stats insights (unit-tested).

const WEEK = 7 * 86_400_000

export interface RatingSample {
  time: number
  rating: number
}

/**
 * Least-squares trend over the last `window` rated contests. Returns when the trend crosses
 * `target`, or null when the trend isn't upward. If already at/above target, returns `now`.
 */
export function projectRating(
  points: RatingSample[],
  target: number,
  now: number,
  window = 10
): { projectedAt: number | null; perContestSlope: number } {
  const pts = points.slice(-window)
  if (pts.length === 0) return { projectedAt: null, perContestSlope: 0 }
  const current = pts[pts.length - 1].rating
  const perContestSlope = pts.length > 1 ? (current - pts[0].rating) / (pts.length - 1) : 0
  if (current >= target) return { projectedAt: now, perContestSlope }
  if (pts.length < 3) return { projectedAt: null, perContestSlope }
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p.time, 0) / n
  const my = pts.reduce((s, p) => s + p.rating, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.time - mx) * (p.rating - my)
    den += (p.time - mx) ** 2
  }
  if (den === 0) return { projectedAt: null, perContestSlope }
  const slope = num / den
  if (slope <= 0) return { projectedAt: null, perContestSlope }
  const at = mx + (target - my) / slope
  // A projection years away isn't useful information.
  if (!Number.isFinite(at) || at - now > 5 * 365 * 86_400_000) return { projectedAt: null, perContestSlope }
  return { projectedAt: Math.max(now, Math.round(at)), perContestSlope }
}

export function startOfWeek(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** Weekly contest completions (last `weeks` weeks) with a running cumulative, the recent pace and an ETA. */
export function weeklyPace(
  completionTimes: number[],
  contestsLeft: number,
  now: number,
  weeks = 26
): { weekly: { weekStart: number; completed: number; cumulative: number }[]; perWeek4: number; etaAt: number | null } {
  const first = startOfWeek(now) - (weeks - 1) * WEEK
  const sorted = completionTimes.slice().sort((a, b) => a - b)
  let cumulative = sorted.filter((t) => t < first).length
  const weekly: { weekStart: number; completed: number; cumulative: number }[] = []
  for (let i = 0; i < weeks; i++) {
    const ws = first + i * WEEK
    const completed = sorted.filter((t) => t >= ws && t < ws + WEEK).length
    cumulative += completed
    weekly.push({ weekStart: ws, completed, cumulative })
  }
  const perWeek4 = sorted.filter((t) => t > now - 4 * WEEK && t <= now).length / 4
  const etaAt = contestsLeft === 0 ? now : perWeek4 > 0 ? Math.round(now + (contestsLeft / perWeek4) * WEEK) : null
  return { weekly, perWeek4, etaAt }
}

export interface TagStat {
  tag: string
  solved: number
  failed: number
  rate: number
}

/** Focus areas: tags with the most failed attempts relative to solves. Strong: high success with real volume. */
export function rankTags(tags: TagStat[]): { focus: TagStat[]; strong: TagStat[] } {
  const focus = tags
    .filter((t) => t.failed >= 2)
    .sort((a, b) => b.failed / (b.solved + 1) - a.failed / (a.solved + 1) || b.failed - a.failed)
    .slice(0, 5)
  const strong = tags
    .filter((t) => t.solved >= 3 && !focus.includes(t))
    .sort((a, b) => b.rate - a.rate || b.solved - a.solved)
    .slice(0, 5)
  return { focus, strong }
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = xs.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const VERDICT_SHORT: Record<string, string> = {
  OK: 'AC',
  WRONG_ANSWER: 'WA',
  TIME_LIMIT_EXCEEDED: 'TLE',
  RUNTIME_ERROR: 'RE',
  MEMORY_LIMIT_EXCEEDED: 'MLE',
  COMPILATION_ERROR: 'CE'
}

export function shortVerdict(v: string): string {
  return VERDICT_SHORT[v] ?? 'Other'
}

export interface ReadInput {
  ratingCurrent: number | null
  projectedAt: number | null
  perContestSlope: number
  perWeek4: number
  contestsLeft: number
  etaAt: number | null
  firstTryRate: number
  focus: TagStat[]
  avgWaRate: number
  streak: number
  now: number
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

/** "Arjun's read": a few plain sentences, computed deterministically so they're always true. */
export function readInsights(x: ReadInput): string[] {
  const out: string[] = []
  if (x.ratingCurrent !== null) {
    if (x.ratingCurrent >= 2100) out.push(`You're at ${x.ratingCurrent} — that's Master. Now we defend it.`)
    else if (x.projectedAt) out.push(`At your recent pace (${x.perContestSlope >= 0 ? '+' : ''}${Math.round(x.perContestSlope)} per contest) you reach 2100 around ${fmtDate(x.projectedAt)}.`)
    else out.push(`You're ${2100 - x.ratingCurrent} points from Master. The trend is flat right now — volume on ≤ 2000 problems is what moves it.`)
  }
  if (x.contestsLeft === 0) out.push('Every contest in your window is done. Raise the window or the cap.')
  else if (x.perWeek4 > 0 && x.etaAt) out.push(`You're clearing ${x.perWeek4.toFixed(1)} contests a week; the remaining ${x.contestsLeft} take until about ${fmtDate(x.etaAt)}.`)
  else out.push(`${x.contestsLeft} contests left on the roadmap and none finished in the last 4 weeks — one contest a day gets this moving.`)
  if (x.focus.length) {
    const f = x.focus[0]
    const rate = f.failed / Math.max(1, f.failed + f.solved)
    const ratio = x.avgWaRate > 0 ? rate / x.avgWaRate : 0
    out.push(
      ratio >= 1.4
        ? `Your failure rate on ${f.tag} is ${ratio.toFixed(1)}× your average. That's the focus area.`
        : `Most of your failed attempts are on ${f.tag} (${f.failed} misses for ${f.solved} solves). Worth a focused week.`
    )
  }
  out.push(
    x.firstTryRate >= 0.6
      ? `${Math.round(x.firstTryRate * 100)}% of your solves are first-try ACs — strong. Keep testing edge cases before submitting.`
      : `Only ${Math.round(x.firstTryRate * 100)}% of solves are first-try. Run the samples plus n = 1, all-equal and max values before you submit.`
  )
  if (x.streak >= 3) out.push(`${x.streak}-day streak. Don't break it today.`)
  return out
}
