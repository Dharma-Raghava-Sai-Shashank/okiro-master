import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Brain, CalendarClock, Crown, Target, TrendingUp, Trophy, Volume2 } from 'lucide-react'
import type { Insights, MemoryNote, StatsSummary } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { cx, rankName, ratingColor, timeAgo } from '../lib/format'
import { Bar, Flame, Glass, Label, ProgressRing, RatingPill, Spinner } from '../components/ui'
import { AreaChart, Bars, C, DivergingTags, Donut, Heatmap, RatingChart } from '../components/charts'
import { voice } from '../voice/engine'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

function Card({ title, icon, children, className, right }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <Glass className={cx('p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <Label>{title}</Label>
        <div className="flex-1" />
        {right}
      </div>
      {children}
    </Glass>
  )
}

/** Semi-circle gauge from 1200 to 2400 with a 2100 marker. */
function RatingGauge({ rating, max }: { rating: number | null; max: number | null }) {
  const lo = 1000
  const hi = 2400
  const v = Math.max(lo, Math.min(hi, rating ?? lo))
  const ang = (x: number) => Math.PI * (1 - (x - lo) / (hi - lo))
  const R = 78
  const cx0 = 100
  const cy0 = 96
  const pt = (x: number, r = R) => [cx0 + r * Math.cos(ang(x)), cy0 - r * Math.sin(ang(x))]
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a)
    const [x2, y2] = pt(b)
    return `M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`
  }
  const [mx, my] = pt(2100, R + 12)
  const [m1x, m1y] = pt(2100, R - 9)
  const [m2x, m2y] = pt(2100, R + 9)
  return (
    <svg viewBox="0 0 200 112" className="w-full max-w-[220px]">
      <path d={arc(lo, hi)} stroke="rgba(255,255,255,0.08)" strokeWidth={12} fill="none" strokeLinecap="round" />
      <path d={arc(lo, v)} stroke={ratingColor(rating)} strokeWidth={12} fill="none" strokeLinecap="round" />
      <line x1={m1x} y1={m1y} x2={m2x} y2={m2y} stroke="#fb923c" strokeWidth={2.5} />
      <text x={mx} y={my} textAnchor="middle" fontSize="8.5" fill="#fdba74" fontWeight="700">
        2100
      </text>
      <text x={cx0} y={cy0 - 12} textAnchor="middle" fontSize="28" fontWeight="800" fill={ratingColor(rating)}>
        {rating ?? '—'}
      </text>
      <text x={cx0} y={cy0 + 6} textAnchor="middle" fontSize="9.5" fill={C.muted}>
        {rankName(rating)}
        {max ? ` · max ${max}` : ''}
      </text>
    </svg>
  )
}

export function StatsPage() {
  const { dataVersion, settings } = useApp()
  const nav = useNavigate()
  const [ins, setIns] = useState<Insights | null>(null)
  const [sum, setSum] = useState<StatsSummary | null>(null)
  const [notes, setNotes] = useState<MemoryNote[]>([])

  useEffect(() => {
    void api.stats.insights().then(setIns)
    void api.stats.summary().then(setSum)
    void api.coach.memory().then(setNotes)
  }, [dataVersion])

  const paceSeries = useMemo(
    () =>
      (ins?.pace.weekly ?? []).map((w) => ({
        label: new Date(`${w.weekStart}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        value: w.cumulative,
        extra: `week of ${new Date(`${w.weekStart}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · +${w.completed}`
      })),
    [ins]
  )

  if (!ins || !sum) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  const rm = sum.roadmap
  const today = ins.heatmap[ins.heatmap.length - 1]
  const tagRows = [
    ...ins.focusTags.map((t) => ({ ...t, focus: true })),
    ...ins.strongTags.map((t) => ({ ...t, focus: false }))
  ]
  const fastest = ins.byHour.indexOf(Math.max(...ins.byHour))

  return (
    <div className="h-full overflow-y-auto px-6 pb-24">
      {/* Hero row */}
      <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-4">
        <Glass className="flex flex-col items-center justify-center p-4">
          <RatingGauge rating={ins.rating.current} max={ins.rating.max} />
          <div className="mt-1 text-center text-[11.5px] text-slate-400">
            {ins.rating.current !== null && ins.rating.current >= 2100 ? (
              <span className="font-bold text-orange-300">Master reached</span>
            ) : ins.rating.projectedMasterAt ? (
              <>
                2100 projected <b className="text-slate-100">{fmtMonth(ins.rating.projectedMasterAt)}</b>
              </>
            ) : (
              'Trend flat — keep the volume up'
            )}
            {ins.rating.delta30d !== 0 && (
              <span className={cx('ml-2 font-bold', ins.rating.delta30d > 0 ? 'text-emerald-300' : 'text-rose-300')}>
                {ins.rating.delta30d > 0 ? '+' : ''}
                {ins.rating.delta30d} in 30d
              </span>
            )}
          </div>
        </Glass>
        <Glass className="flex items-center gap-4 p-5">
          <ProgressRing value={rm.contestsDone} max={rm.windowContests} size={96} stroke={9}>
            <div className="text-lg font-extrabold tabular-nums text-slate-100">{Math.round((rm.contestsDone / Math.max(1, rm.windowContests)) * 100)}%</div>
          </ProgressRing>
          <div>
            <Label>Roadmap</Label>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-slate-100">
              {rm.contestsDone}
              <span className="text-base text-slate-500">/{rm.windowContests}</span>
            </div>
            <div className="text-[11.5px] text-slate-400">
              {ins.pace.perWeek4.toFixed(1)}/week{ins.pace.etaAt ? ` · done ~${fmtMonth(ins.pace.etaAt)}` : ''}
            </div>
          </div>
        </Glass>
        <Glass className="flex items-center gap-4 p-5">
          <Flame className="size-14" />
          <div>
            <Label>Streak</Label>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-slate-100">
              {sum.streak} <span className="text-base text-slate-500">days</span>
            </div>
            <div className="text-[11.5px] text-slate-400">best {ins.bests.longestStreak} days</div>
          </div>
        </Glass>
        <Glass className="flex items-center gap-4 p-5">
          <div className={cx('grid size-14 place-items-center rounded-2xl border', today?.goalMet ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' : 'border-blue-400/25 bg-blue-500/10 text-blue-200')}>
            <Target className="size-7" />
          </div>
          <div>
            <Label>Today</Label>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-slate-100">
              {today?.solved ?? 0}
              <span className="text-base text-slate-500">/{settings?.dailyProblemGoal ?? 4}</span>
            </div>
            <div className="text-[11.5px] text-slate-400">{today?.goalMet ? 'Goal met 🎯' : `${today?.contestsCompleted ?? 0} contests completed`}</div>
          </div>
        </Glass>
      </div>

      {/* Arjun's read */}
      <Glass className="relative mt-4 overflow-hidden p-5">
        <div className="hud-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex items-start gap-4">
          <div className="accent-grad accent-glow grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-black text-white">A</div>
          <div className="min-w-0 flex-1">
            <div className="hud-font mb-1.5 text-[10.5px] uppercase tracking-[0.24em] text-cyan-400/80">Arjun's read</div>
            <ul className="flex flex-col gap-1">
              {ins.read.map((r) => (
                <li key={r} className="text-[13.5px] leading-relaxed text-slate-200">
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => void voice.command('how am I doing')}
            title="Hear it from Arjun"
            className="flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-1.5 text-[12px] font-semibold text-cyan-100 hover:bg-cyan-400/15"
          >
            <Volume2 className="size-4" /> Hear it
          </button>
        </div>
      </Glass>

      <div className="mt-4 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4">
        <Card title="Rating history" icon={<TrendingUp className="size-3.5 text-blue-300" />}>
          <RatingChart points={ins.rating.history} />
        </Card>
        <Card title="Roadmap pace (contests completed)" icon={<CalendarClock className="size-3.5 text-blue-300" />}>
          <AreaChart series={paceSeries} />
          <div className="mt-2 text-[11.5px] text-slate-400">
            Last 4 weeks: <b className="text-slate-200">{ins.pace.perWeek4.toFixed(1)}</b> contests/week · {rm.contestsLeft} left
          </div>
        </Card>
      </div>

      <Card title="Last 12 months" className="mt-4">
        <Heatmap days={ins.heatmap} goal={settings?.dailyProblemGoal ?? 4} />
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card title="Verdicts" right={<span className="text-[11px] text-slate-400">first-try AC {Math.round(ins.firstTryRate * 100)}%</span>}>
          <Donut data={ins.verdicts} />
        </Card>
        <Card title={`Target problems by rating (≤ ${settings?.ratingCap})`}>
          <Bars
            data={ins.bands.map((b) => ({
              label: String(b.rating / 100),
              value: b.solved,
              track: b.total,
              tip: (
                <span>
                  <b>{b.rating}</b> · {b.solved}/{b.total} solved · first-try {Math.round(b.firstTry * 100)}% · {b.avgAttempts.toFixed(1)} tries/solve
                </span>
              )
            }))}
          />
          <div className="mt-2 text-[11px] text-slate-500">Bar = solved, track = available in your window. Rating ÷ 100.</div>
        </Card>
        <Card title="By level">
          <div className="flex flex-col gap-2.5">
            {sum.byLevel.map((l) => (
              <div key={l.level} className="flex items-center gap-3">
                <div className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-[12px] font-black text-slate-200">{l.level}</div>
                <div className="flex-1">
                  <Bar value={l.solved} max={l.total} color={C.blue} />
                </div>
                <div className="w-20 text-right text-[11px] tabular-nums text-slate-400">
                  {l.solved}/{l.total}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
        <Card title="Tags: focus areas vs strengths" icon={<Brain className="size-3.5 text-violet-300" />}>
          {tagRows.length ? <DivergingTags tags={tagRows} /> : <div className="py-6 text-center text-xs text-slate-500">Solve a few more problems to see patterns.</div>}
          {ins.focusTags.length > 0 && <div className="mt-3 text-[11.5px] text-rose-200/80">⚑ = focus area (most failed attempts relative to solves)</div>}
        </Card>
        <Card title="Median solve time by rating (minutes)">
          {ins.solveTime.length ? (
            <Bars
              showValues
              data={ins.solveTime.map((s) => ({
                label: String(s.rating / 100),
                value: s.medianMin,
                tip: (
                  <span>
                    <b>{s.rating}</b> · median {s.medianMin} min · {s.samples} problem{s.samples > 1 ? 's' : ''}
                  </span>
                )
              }))}
            />
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">Solve problems inside Okiro to measure your time.</div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card title="When you solve (hour)" right={ins.byHour.some(Boolean) ? <span className="text-[11px] text-slate-400">peak {fastest}:00</span> : undefined}>
          <Bars
            height={110}
            data={ins.byHour.map((v, h) => ({ label: h % 6 === 0 ? `${h}h` : '', value: v, tip: <span>{h}:00–{h + 1}:00 · {v} ACs</span> }))}
          />
        </Card>
        <Card title="By weekday">
          <Bars height={110} data={ins.byWeekday.map((v, i) => ({ label: WEEKDAYS[i], value: v, tip: <span>{WEEKDAYS[i]} · {v} ACs</span> }))} />
        </Card>
        <Card title="Personal bests" icon={<Crown className="size-3.5 text-amber-300" />}>
          <div className="flex flex-col gap-3 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Most in a day</span>
              <span className="font-bold text-slate-100">
                {ins.bests.mostInDay}
                {ins.bests.mostInDayDate && <span className="ml-1 font-normal text-slate-500">({new Date(`${ins.bests.mostInDayDate}T00:00:00`).toLocaleDateString()})</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Longest streak</span>
              <span className="font-bold text-slate-100">{ins.bests.longestStreak} days</span>
            </div>
            {ins.bests.hardest && (
              <button
                className="flex items-center justify-between gap-2 text-left hover:underline"
                onClick={() => nav(`/problem/${ins.bests.hardest!.contestId}/${ins.bests.hardest!.index}`)}
              >
                <span className="text-slate-400">Hardest solved</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-slate-200">{ins.bests.hardest.name}</span>
                  <RatingPill rating={ins.bests.hardest.rating} />
                </span>
              </button>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Total solved</span>
              <span className="font-bold text-slate-100">{sum.totalSolved}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title="Recent ACs" icon={<Trophy className="size-3.5 text-emerald-300" />}>
          <div className="flex flex-col gap-1">
            {ins.recentAcs.length === 0 && <div className="text-xs text-slate-500">No accepted solutions yet.</div>}
            {ins.recentAcs.map((a) => (
              <button
                key={`${a.contestId}${a.index}`}
                onClick={() => nav(`/problem/${a.contestId}/${a.index}`)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]"
              >
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="w-14 font-mono text-[11.5px] text-slate-400">
                  {a.contestId}
                  {a.index}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-200">{a.name}</span>
                <RatingPill rating={a.rating} />
                <span className="w-14 text-right text-[10.5px] text-slate-500">{timeAgo(a.at)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="What Arjun remembers">
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
        </Card>
      </div>
    </div>
  )
}
