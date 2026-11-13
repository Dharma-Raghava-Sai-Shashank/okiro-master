import { useEffect, useState } from 'react'
import { Brain, Target, TrendingUp, Volume2 } from 'lucide-react'
import type { Insights, StatsSummary } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { cx, rankName, ratingColor } from '../lib/format'
import { Card, Flame, Glass, Label, ProgressRing, Spinner } from '../components/ui'
import { C, DivergingTags, Donut, Heatmap, RatingChart } from '../components/charts'
import { voice } from '../voice/engine'

const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

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
  const [ins, setIns] = useState<Insights | null>(null)
  const [sum, setSum] = useState<StatsSummary | null>(null)

  useEffect(() => {
    void api.stats.insights().then(setIns)
    void api.stats.summary().then(setSum)
  }, [dataVersion])

  if (!ins || !sum) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  const rm = sum.roadmap
  const today = ins.heatmap[ins.heatmap.length - 1]
  const tagRows = [...ins.focusTags.map((t) => ({ ...t, focus: true })), ...ins.strongTags.map((t) => ({ ...t, focus: false }))]

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

      <Card title="Rating history" icon={<TrendingUp className="size-3.5 text-blue-300" />} className="mt-4">
        <RatingChart points={ins.rating.history} />
      </Card>

      <Card title="Last 12 months" className="mt-4">
        <Heatmap days={ins.heatmap} goal={settings?.dailyProblemGoal ?? 4} />
      </Card>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
        <Card title="Verdicts" right={<span className="text-[11px] text-slate-400">first-try AC {Math.round(ins.firstTryRate * 100)}%</span>}>
          <Donut data={ins.verdicts} />
        </Card>
        <Card title="Tags: focus areas vs strengths" icon={<Brain className="size-3.5 text-violet-300" />}>
          {tagRows.length ? <DivergingTags tags={tagRows} /> : <div className="py-6 text-center text-xs text-slate-500">Solve a few more problems to see patterns.</div>}
          {ins.focusTags.length > 0 && <div className="mt-3 text-[11.5px] text-rose-200/80">⚑ = focus area (most failed attempts relative to solves)</div>}
        </Card>
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
    </div>
  )
}
