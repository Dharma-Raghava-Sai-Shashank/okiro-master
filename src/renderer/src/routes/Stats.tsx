import { useEffect, useMemo, useState } from 'react'
import type { MemoryNote, RatingPoint, StatsSummary } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { ratingColor, timeAgo } from '../lib/format'
import { Bar, Empty, Flame, Glass, Label, Spinner } from '../components/ui'

function RatingChart({ points }: { points: RatingPoint[] }) {
  const W = 760
  const H = 220
  const pad = { l: 40, r: 12, t: 12, b: 22 }
  const { path, dots, ys, minT, maxT } = useMemo(() => {
    if (!points.length) return { path: '', dots: [], ys: [], minT: 0, maxT: 1 }
    const minR = Math.min(...points.map((p) => p.newRating), 2100) - 100
    const maxR = Math.max(...points.map((p) => p.newRating), 2100) + 100
    const minT = points[0].time
    const maxT = points[points.length - 1].time || minT + 1
    const x = (t: number) => pad.l + ((t - minT) / Math.max(1, maxT - minT)) * (W - pad.l - pad.r)
    const y = (r: number) => pad.t + (1 - (r - minR) / (maxR - minR)) * (H - pad.t - pad.b)
    const dots = points.map((p) => ({ x: x(p.time), y: y(p.newRating), p }))
    const path = dots.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ')
    const ys = [1200, 1400, 1600, 1900, 2100, 2400].filter((r) => r > minR && r < maxR).map((r) => ({ r, y: y(r) }))
    return { path, dots, ys, minT, maxT }
  }, [points, pad.l, pad.r, pad.t, pad.b])
  if (!points.length) return <Empty title="No rated contests yet" />
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {ys.map(({ r, y }) => (
        <g key={r}>
          <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={r === 2100 ? '#fb923c66' : 'rgba(255,255,255,0.06)'} strokeDasharray={r === 2100 ? '5 4' : undefined} />
          <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill={ratingColor(r)}>
            {r}
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="rating-line" x1="0" x2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#rating-line)" strokeWidth={2.2} strokeLinejoin="round" />
      {dots.map((d) => (
        <circle key={d.p.contestId} cx={d.x} cy={d.y} r={3} fill={ratingColor(d.p.newRating)}>
          <title>{`${d.p.contestName}: ${d.p.newRating}`}</title>
        </circle>
      ))}
      <text x={pad.l} y={H - 4} fontSize="10" fill="#64748b">
        {new Date(minT).getFullYear()}
      </text>
      <text x={W - pad.r} y={H - 4} fontSize="10" fill="#64748b" textAnchor="end">
        {new Date(maxT).getFullYear()}
      </text>
    </svg>
  )
}

export function StatsPage() {
  const { dataVersion, user, settings } = useApp()
  const [s, setS] = useState<StatsSummary | null>(null)
  const [rating, setRating] = useState<RatingPoint[]>([])
  const [notes, setNotes] = useState<MemoryNote[]>([])

  useEffect(() => {
    void api.stats.summary().then(setS)
    void api.cf.ratingHistory().then(setRating)
    void api.coach.memory().then(setNotes)
  }, [dataVersion])

  if (!s)
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )

  const rm = s.roadmap
  const tiles = [
    { k: 'Roadmap', v: `${rm.contestsDone}/${rm.windowContests}`, sub: `${rm.contestsLeft} contests to go` },
    { k: `Problems ≤ ${settings?.ratingCap}`, v: `${rm.problemsDone}/${rm.problemsTotal}`, sub: `${Math.round((rm.problemsDone / Math.max(1, rm.problemsTotal)) * 100)}% of the window` },
    { k: 'Total solved', v: String(s.totalSolved), sub: 'on Codeforces' },
    { k: 'Rating', v: user?.rating != null ? String(user.rating) : '—', sub: user?.rating != null ? `${Math.max(0, 2100 - user.rating)} to Master` : 'unrated', color: ratingColor(user?.rating) }
  ]
  const maxTag = Math.max(1, ...s.byTag.map((t) => t.solved))

  return (
    <div className="h-full overflow-y-auto px-6 pb-6">
      <div className="grid grid-cols-5 gap-4">
        {tiles.map((t) => (
          <Glass key={t.k} className="p-4">
            <Label>{t.k}</Label>
            <div className="mt-1 text-[26px] font-extrabold tabular-nums" style={{ color: t.color ?? '#f1f5f9' }}>
              {t.v}
            </div>
            <div className="text-[11px] text-slate-500">{t.sub}</div>
          </Glass>
        ))}
        <Glass className="flex items-center gap-3 p-4">
          <Flame className="size-10" />
          <div>
            <div className="text-[26px] font-extrabold tabular-nums text-slate-100">{s.streak}</div>
            <div className="text-[11px] text-slate-500">day streak · best {s.bestStreak}</div>
          </div>
        </Glass>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        <Glass className="p-5">
          <div className="mb-3">
            <Label>Rating history</Label>
          </div>
          <RatingChart points={rating} />
        </Glass>
        <Glass className="p-5">
          <div className="mb-3">
            <Label>By level (target problems in the window)</Label>
          </div>
          <div className="flex flex-col gap-2.5">
            {s.byLevel.map((l) => (
              <div key={l.level} className="flex items-center gap-3">
                <div className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-[12px] font-black text-slate-200">{l.level}</div>
                <div className="flex-1">
                  <Bar value={l.solved} max={l.total} />
                </div>
                <div className="w-20 text-right text-[11px] tabular-nums text-slate-400">
                  {l.solved}/{l.total}
                </div>
              </div>
            ))}
            {!s.byLevel.length && <Empty title="No data yet" />}
          </div>
        </Glass>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Glass className="p-5">
          <div className="mb-3">
            <Label>By rating</Label>
          </div>
          <div className="flex h-44 items-end gap-1.5">
            {s.byRating.map((r) => (
              <div key={r.rating} className="flex flex-1 flex-col items-center gap-1" title={`${r.rating}: ${r.solved}/${r.total}`}>
                <div className="relative flex h-36 w-full items-end overflow-hidden rounded-md bg-white/[0.04]">
                  <div className="w-full rounded-md" style={{ height: `${(r.solved / Math.max(1, r.total)) * 100}%`, background: ratingColor(r.rating) }} />
                </div>
                <div className="text-[9px] tabular-nums text-slate-500">{r.rating / 100}</div>
              </div>
            ))}
          </div>
        </Glass>
        <Glass className="p-5">
          <div className="mb-3">
            <Label>Top tags solved</Label>
          </div>
          <div className="flex flex-col gap-2">
            {s.byTag.slice(0, 12).map((t) => (
              <div key={t.tag} className="flex items-center gap-2">
                <div className="w-36 truncate text-[12px] text-slate-300">{t.tag}</div>
                <div className="flex-1">
                  <Bar value={t.solved} max={maxTag} color="#8b5cf6" />
                </div>
                <div className="w-8 text-right text-[11px] tabular-nums text-slate-500">{t.solved}</div>
              </div>
            ))}
          </div>
        </Glass>
        <Glass className="p-5">
          <div className="mb-3">
            <Label>What Arjun remembers</Label>
          </div>
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {notes.length === 0 && <div className="text-xs text-slate-500">Arjun writes a note each time you get AC.</div>}
            {notes.map((n) => (
              <div key={n.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                <div className="text-[12px] leading-snug text-slate-200">{n.note}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {n.kind} · {timeAgo(n.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </Glass>
      </div>
    </div>
  )
}
