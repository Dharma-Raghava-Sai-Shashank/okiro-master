// Custom SVG charts for the Stats page (dark surface). Single-hue sequential blue for magnitude,
// the fixed status palette for verdicts, blue↔red diverging with a gray axis for tag strength.
// Every chart has a hover tooltip; identity is never color alone (labels / legend accompany it).
import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { DayStat, RatingPoint } from '@shared/types'
import { ratingColor } from '../../lib/format'

export const C = {
  blue: '#3987e5',
  blueLight: '#6da7ec',
  red: '#d03b3b',
  grid: 'rgba(148,163,184,0.10)',
  axis: '#64748b',
  ink: '#e2e8f0',
  muted: '#94a3b8',
  seq: ['rgba(255,255,255,0.045)', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4']
}

/** Verdict colors from the fixed status palette, ordered so similar hues never touch. */
export const VERDICT_COLORS: Record<string, string> = { AC: '#0ca30c', TLE: '#fab219', WA: '#d03b3b', RE: '#ec835a', MLE: '#ec835a', CE: '#8b95a7', Other: '#8b95a7' }
export const VERDICT_ORDER = ['AC', 'TLE', 'WA', 'RE', 'MLE', 'CE', 'Other']

interface Tip {
  x: number
  y: number
  content: ReactNode
}

function useTip() {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const show = (e: React.MouseEvent, content: ReactNode) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content })
  }
  const node = tip && (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-white/10 bg-[#0b1222]/95 px-2.5 py-1.5 text-[11.5px] text-slate-200 shadow-xl"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  )
  return { box, show, hide: () => setTip(null), node }
}

// ── Rating history ─────────────────────────────────────────────────────────
const BANDS = [0, 1200, 1400, 1600, 1900, 2100, 2300, 2400, 4000]

export function RatingChart({ points }: { points: RatingPoint[] }) {
  const W = 760
  const H = 230
  const pad = { l: 42, r: 16, t: 14, b: 24 }
  const t = useTip()
  const [hover, setHover] = useState<number | null>(null)
  const g = useMemo(() => {
    if (!points.length) return null
    const lo = Math.min(...points.map((p) => p.newRating), 2100) - 120
    const hi = Math.max(...points.map((p) => p.newRating), 2100) + 120
    const t0 = points[0].time
    const t1 = points[points.length - 1].time || t0 + 1
    const x = (v: number) => pad.l + ((v - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r)
    const y = (r: number) => pad.t + (1 - (r - lo) / (hi - lo)) * (H - pad.t - pad.b)
    const pts = points.map((p) => ({ x: x(p.time), y: y(p.newRating), p }))
    return { lo, hi, y, pts, t0, t1, path: pts.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ') }
  }, [points, pad.l, pad.r, pad.t, pad.b])
  if (!g) return <div className="py-12 text-center text-xs text-slate-500">No rated contests yet</div>
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < g.pts.length; i++) if (Math.abs(g.pts[i].x - mx) < Math.abs(g.pts[best].x - mx)) best = i
    setHover(best)
    const p = g.pts[best].p
    const prev = g.pts[best - 1]?.p.newRating
    t.show(
      e,
      <>
        <div className="font-bold" style={{ color: ratingColor(p.newRating) }}>
          {p.newRating}
          {prev !== undefined && <span className="ml-1.5 text-slate-400">{p.newRating - prev >= 0 ? `+${p.newRating - prev}` : p.newRating - prev}</span>}
        </div>
        <div className="text-slate-400">{p.contestName}</div>
        <div className="text-slate-500">{new Date(p.time).toLocaleDateString()}</div>
      </>
    )
  }
  const hp = hover !== null ? g.pts[hover] : null
  return (
    <div ref={t.box} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseMove={onMove} onMouseLeave={() => (setHover(null), t.hide())}>
        {BANDS.slice(0, -1).map((b, i) => {
          const top = Math.min(g.hi, BANDS[i + 1])
          const bot = Math.max(g.lo, b)
          if (top <= bot) return null
          return <rect key={b} x={pad.l} width={W - pad.l - pad.r} y={g.y(top)} height={g.y(bot) - g.y(top)} fill={ratingColor(b)} opacity={0.055} />
        })}
        {[1200, 1400, 1600, 1900, 2100, 2400]
          .filter((r) => r > g.lo && r < g.hi)
          .map((r) => (
            <g key={r}>
              <line x1={pad.l} x2={W - pad.r} y1={g.y(r)} y2={g.y(r)} stroke={r === 2100 ? '#fb923c' : C.grid} strokeDasharray={r === 2100 ? '6 4' : undefined} strokeWidth={r === 2100 ? 1.5 : 1} />
              <text x={pad.l - 6} y={g.y(r) + 3} textAnchor="end" fontSize="10" fill={C.muted}>
                {r}
              </text>
            </g>
          ))}
        <text x={W - pad.r} y={g.y(2100) - 5} textAnchor="end" fontSize="10" fill="#fdba74" fontWeight="700">
          Master 2100
        </text>
        <path d={g.path} fill="none" stroke={C.blueLight} strokeWidth={2} strokeLinejoin="round" />
        {g.pts.map((d) => (
          <circle key={d.p.contestId} cx={d.x} cy={d.y} r={2.5} fill={C.blueLight} />
        ))}
        {hp && (
          <>
            <line x1={hp.x} x2={hp.x} y1={pad.t} y2={H - pad.b} stroke="rgba(226,232,240,0.25)" />
            <circle cx={hp.x} cy={hp.y} r={5} fill={C.blueLight} stroke="#0d1322" strokeWidth={2} />
          </>
        )}
        <text x={pad.l} y={H - 6} fontSize="10" fill={C.axis}>
          {new Date(g.t0).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="10" fill={C.axis} textAnchor="end">
          {new Date(g.t1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
        </text>
      </svg>
      {t.node}
    </div>
  )
}

// ── Cumulative area (roadmap contests completed) ───────────────────────────
export function AreaChart({ series }: { series: { label: string; value: number; extra: string }[] }) {
  const W = 560
  const H = 170
  const pad = { l: 34, r: 10, t: 12, b: 22 }
  const t = useTip()
  const [hover, setHover] = useState<number | null>(null)
  if (!series.length) return null
  const max = Math.max(1, ...series.map((s) => s.value))
  const x = (i: number) => pad.l + (i / Math.max(1, series.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  return (
    <div ref={t.box} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const i = Math.round((((e.clientX - r.left) / r.width) * W - pad.l) / ((W - pad.l - pad.r) / Math.max(1, series.length - 1)))
          const k = Math.max(0, Math.min(series.length - 1, i))
          setHover(k)
          t.show(
            e,
            <>
              <div className="font-bold text-slate-100">{series[k].value} contests done</div>
              <div className="text-slate-400">{series[k].extra}</div>
            </>
          )
        }}
        onMouseLeave={() => (setHover(null), t.hide())}
      >
        <defs>
          <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity={0.45} />
            <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke={C.grid} />
            <text x={pad.l - 6} y={y(max * f) + 3} textAnchor="end" fontSize="10" fill={C.muted}>
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke={C.grid} />
        <path d={area} fill="url(#area-fill)" />
        <path d={line} fill="none" stroke={C.blueLight} strokeWidth={2} />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="rgba(226,232,240,0.25)" />
            <circle cx={x(hover)} cy={y(series[hover].value)} r={4.5} fill={C.blueLight} stroke="#0d1322" strokeWidth={2} />
          </>
        )}
        <text x={pad.l} y={H - 5} fontSize="10" fill={C.axis}>
          {series[0].label}
        </text>
        <text x={W - pad.r} y={H - 5} fontSize="10" fill={C.axis} textAnchor="end">
          {series[series.length - 1].label}
        </text>
      </svg>
      {t.node}
    </div>
  )
}

// ── Year heatmap ───────────────────────────────────────────────────────────
export function Heatmap({ days, goal }: { days: DayStat[]; goal: number }) {
  const t = useTip()
  const cell = 12
  const gap = 3
  if (!days.length) return null
  const first = new Date(`${days[0].date}T00:00:00`)
  const offset = (first.getDay() + 6) % 7
  const level = (n: number) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / Math.max(1, goal)) * 4)))
  const weeks = Math.ceil((days.length + offset) / 7)
  const W = weeks * (cell + gap) + 24
  const H = 7 * (cell + gap) + 18
  const months: { x: number; label: string }[] = []
  days.forEach((d, i) => {
    const dt = new Date(`${d.date}T00:00:00`)
    if (dt.getDate() === 1) months.push({ x: 24 + Math.floor((i + offset) / 7) * (cell + gap), label: dt.toLocaleDateString(undefined, { month: 'short' }) })
  })
  return (
    <div ref={t.box} className="relative overflow-x-auto">
      <svg width={W} height={H} onMouseLeave={t.hide}>
        {months.map((m) => (
          <text key={m.x} x={m.x} y={9} fontSize="9.5" fill={C.muted}>
            {m.label}
          </text>
        ))}
        {['Mon', 'Wed', 'Fri'].map((d, i) => (
          <text key={d} x={0} y={18 + (i * 2 + 1) * (cell + gap) - 3} fontSize="9" fill={C.axis}>
            {d}
          </text>
        ))}
        {days.map((d, i) => {
          const k = i + offset
          return (
            <rect
              key={d.date}
              x={24 + Math.floor(k / 7) * (cell + gap)}
              y={14 + (k % 7) * (cell + gap)}
              width={cell}
              height={cell}
              rx={3}
              fill={C.seq[level(d.solved)]}
              stroke={d.goalMet ? '#34d399' : 'none'}
              strokeWidth={d.goalMet ? 1.5 : 0}
              onMouseMove={(e) =>
                t.show(
                  e,
                  <>
                    <div className="font-bold text-slate-100">
                      {d.solved} solved{d.contestsCompleted ? ` · ${d.contestsCompleted} contest${d.contestsCompleted > 1 ? 's' : ''} done` : ''}
                    </div>
                    <div className="text-slate-400">
                      {new Date(`${d.date}T00:00:00`).toDateString()}
                      {d.goalMet ? ' · goal met' : ''}
                    </div>
                  </>
                )
              }
            />
          )
        })}
      </svg>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
        Less
        {C.seq.map((c) => (
          <span key={c} className="size-2.5 rounded-[3px]" style={{ background: c }} />
        ))}
        More
        <span className="ml-3 flex items-center gap-1">
          <span className="size-2.5 rounded-[3px] border-[1.5px] border-emerald-400" /> goal met
        </span>
      </div>
      {t.node}
    </div>
  )
}

// ── Verdict donut ──────────────────────────────────────────────────────────
export function Donut({ data }: { data: { verdict: string; count: number }[] }) {
  const t = useTip()
  const ordered = VERDICT_ORDER.map((v) => data.find((d) => d.verdict === v)).filter((d): d is { verdict: string; count: number } => !!d && d.count > 0)
  const total = ordered.reduce((s, d) => s + d.count, 0)
  const R = 62
  const r = 42
  const size = 150
  let acc = 0
  const arcs = ordered.map((d) => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2
    acc += d.count
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2
    const gapA = ordered.length > 1 ? 0.025 : 0
    const s = a0 + gapA / 2
    const e = a1 - gapA / 2
    const large = e - s > Math.PI ? 1 : 0
    const p = (rad: number, ang: number) => `${size / 2 + rad * Math.cos(ang)},${size / 2 + rad * Math.sin(ang)}`
    return { d, path: `M${p(R, s)} A${R},${R} 0 ${large} 1 ${p(R, e)} L${p(r, e)} A${r},${r} 0 ${large} 0 ${p(r, s)} Z` }
  })
  const ac = data.find((d) => d.verdict === 'AC')?.count ?? 0
  if (!total) return <div className="py-8 text-center text-xs text-slate-500">No submissions yet</div>
  return (
    <div ref={t.box} className="relative flex items-center gap-5">
      <svg width={size} height={size} onMouseLeave={t.hide}>
        {arcs.map(({ d, path }) => (
          <path
            key={d.verdict}
            d={ordered.length === 1 ? `M${size / 2},${size / 2 - R} A${R},${R} 0 1 1 ${size / 2 - 0.01},${size / 2 - R} L${size / 2 - 0.01},${size / 2 - r} A${r},${r} 0 1 0 ${size / 2},${size / 2 - r} Z` : path}
            fill={VERDICT_COLORS[d.verdict]}
            onMouseMove={(e) =>
              t.show(
                e,
                <span>
                  <b>{d.verdict}</b> · {d.count} ({Math.round((d.count / total) * 100)}%)
                </span>
              )
            }
          />
        ))}
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="20" fontWeight="800" fill={C.ink}>
          {Math.round((ac / total) * 100)}%
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="10" fill={C.muted}>
          accepted
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {ordered.map((d) => (
          <div key={d.verdict} className="flex items-center gap-2 text-[12px]">
            <span className="size-2.5 rounded-sm" style={{ background: VERDICT_COLORS[d.verdict] }} />
            <span className="w-10 font-bold text-slate-200">{d.verdict}</span>
            <span className="tabular-nums text-slate-400">{d.count}</span>
          </div>
        ))}
      </div>
      {t.node}
    </div>
  )
}

// ── Vertical bars (bands, hours, weekdays, solve time) ─────────────────────
export interface BarDatum {
  label: string
  value: number
  /** Optional track (e.g. total available), drawn behind the bar. */
  track?: number
  tip: ReactNode
  color?: string
}

export function Bars({ data, height = 150, showValues = false }: { data: BarDatum[]; height?: number; showValues?: boolean }) {
  const t = useTip()
  const max = Math.max(1, ...data.map((d) => d.track ?? d.value))
  return (
    <div ref={t.box} className="relative">
      <div className="flex items-end gap-[2px]" style={{ height }} onMouseLeave={t.hide}>
        {data.map((d) => (
          <div key={d.label} className="relative flex h-full flex-1 items-end" onMouseMove={(e) => t.show(e, d.tip)}>
            {d.track !== undefined && <div className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-white/[0.05]" style={{ height: `${(d.track / max) * 100}%` }} />}
            <div className="relative w-full rounded-t-[4px] transition-all" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, background: d.color ?? C.blue }} />
            {showValues && d.value > 0 && (
              <div className="absolute inset-x-0 text-center text-[9.5px] font-bold tabular-nums text-slate-300" style={{ bottom: `calc(${(d.value / max) * 100}% + 3px)` }}>
                {d.value}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {data.map((d) => (
          <div key={d.label} className="flex-1 truncate text-center text-[9.5px] tabular-nums text-slate-500">
            {d.label}
          </div>
        ))}
      </div>
      {t.node}
    </div>
  )
}

// ── Diverging tag chart: failed attempts (red, left) vs solves (blue, right) ─
export function DivergingTags({ tags }: { tags: { tag: string; solved: number; failed: number; focus?: boolean }[] }) {
  const t = useTip()
  const max = Math.max(1, ...tags.flatMap((x) => [x.solved, x.failed]))
  return (
    <div ref={t.box} className="relative flex flex-col gap-1.5" onMouseLeave={t.hide}>
      <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm" style={{ background: C.red }} /> failed attempts
        </span>
        <span className="flex items-center gap-1">
          solves <span className="size-2 rounded-sm" style={{ background: C.blue }} />
        </span>
      </div>
      {tags.map((x) => (
        <div
          key={x.tag}
          className="grid items-center gap-2"
          style={{ gridTemplateColumns: '1fr 120px 1fr' }}
          onMouseMove={(e) =>
            t.show(
              e,
              <span>
                <b>{x.tag}</b> · {x.solved} solved · {x.failed} failed · {Math.round((x.solved / Math.max(1, x.solved + x.failed)) * 100)}% success
              </span>
            )
          }
        >
          <div className="flex justify-end">
            <div className="h-3 rounded-l-[4px]" style={{ width: `${(x.failed / max) * 100}%`, background: C.red }} />
          </div>
          <div className={x.focus ? 'truncate text-center text-[11.5px] font-bold text-rose-200' : 'truncate text-center text-[11.5px] text-slate-300'}>
            {x.focus ? '⚑ ' : ''}
            {x.tag}
          </div>
          <div className="flex border-l border-slate-500/40">
            <div className="h-3 rounded-r-[4px]" style={{ width: `${(x.solved / max) * 100}%`, background: C.blue }} />
          </div>
        </div>
      ))}
      {t.node}
    </div>
  )
}
