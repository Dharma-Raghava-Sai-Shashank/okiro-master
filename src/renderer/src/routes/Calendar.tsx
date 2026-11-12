import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Trophy, XCircle, CheckCircle2 } from 'lucide-react'
import type { DayEvent, DayStat } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { cx, isoDate, parseIso, VERDICT_LABEL } from '../lib/format'
import { Empty, Glass, Label, RatingPill, Segmented } from '../components/ui'

type View = 'day' | 'week' | 'month' | 'year'

const startOfWeek = (d: Date) => {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function rangeFor(view: View, anchor: Date): { from: Date; to: Date } {
  if (view === 'day') return { from: anchor, to: anchor }
  if (view === 'week') {
    const s = startOfWeek(anchor)
    return { from: s, to: addDays(s, 6) }
  }
  if (view === 'month') {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const s = startOfWeek(first)
    return { from: s, to: addDays(s, 41) }
  }
  const s = startOfWeek(new Date(anchor.getFullYear(), 0, 1))
  return { from: s, to: new Date(anchor.getFullYear(), 11, 31) }
}

function shift(view: View, anchor: Date, dir: number): Date {
  const x = new Date(anchor)
  if (view === 'day') x.setDate(x.getDate() + dir)
  else if (view === 'week') x.setDate(x.getDate() + 7 * dir)
  else if (view === 'month') x.setMonth(x.getMonth() + dir)
  else x.setFullYear(x.getFullYear() + dir)
  return x
}

function heat(d: DayStat | undefined, goal: number): string {
  if (!d || d.solved === 0) return 'rgba(255,255,255,0.035)'
  const t = Math.min(1, d.solved / Math.max(1, goal))
  return `rgba(59,130,246,${0.18 + t * 0.62})`
}

function EventList({ events }: { events: DayEvent[] }) {
  const nav = useNavigate()
  if (!events.length) return <div className="py-3 text-center text-[11px] text-slate-600">Nothing yet</div>
  return (
    <div className="flex flex-col gap-1.5">
      {events.map((e, i) =>
        e.kind === 'contest-complete' ? (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-2 text-[12px] font-bold text-emerald-200">
            <Trophy className="size-3.5 shrink-0" /> <span className="truncate">Completed {e.name}</span>
          </div>
        ) : (
          <button
            key={i}
            onClick={() => nav(`/problem/${e.contestId}/${e.index}`)}
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-left hover:bg-white/[0.06]"
          >
            {e.kind === 'solved' ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-300" /> : <XCircle className="size-3.5 shrink-0 text-rose-300" />}
            <span className="text-[10.5px] tabular-nums text-slate-500">
              {new Date(e.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-200">
              {e.contestId}
              {e.index} · {e.name}
            </span>
            {e.kind === 'attempted' && e.verdict && <span className="text-[10px] text-rose-300/80">{VERDICT_LABEL[e.verdict] ?? e.verdict}</span>}
            <RatingPill rating={e.rating} />
          </button>
        )
      )}
    </div>
  )
}

export function CalendarPage() {
  const { settings, dataVersion } = useApp()
  const [params] = useSearchParams()
  const [view, setView] = useState<View>('month')
  useEffect(() => {
    const v = params.get('view')
    if (v === 'day' || v === 'week' || v === 'month' || v === 'year') setView(v)
  }, [params])
  const [anchor, setAnchor] = useState(() => new Date())
  const [days, setDays] = useState<DayStat[]>([])
  const [events, setEvents] = useState<Record<string, DayEvent[]>>({})
  const goal = settings?.dailyProblemGoal ?? 4
  const { from, to } = useMemo(() => rangeFor(view, anchor), [view, anchor])

  useEffect(() => {
    void api.stats.days(isoDate(from), isoDate(to)).then(setDays)
    if (view === 'day' || view === 'week') {
      const dates = view === 'day' ? [isoDate(from)] : Array.from({ length: 7 }, (_, i) => isoDate(addDays(from, i)))
      void Promise.all(dates.map((d) => api.stats.dayEvents(d).then((ev) => [d, ev] as const))).then((pairs) => setEvents(Object.fromEntries(pairs)))
    }
  }, [from, to, view, dataVersion])

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const today = isoDate(new Date())
  const totalSolved = days.filter((d) => parseIso(d.date) >= from && parseIso(d.date) <= to).reduce((s, d) => s + d.solved, 0)
  const goalDays = days.filter((d) => d.goalMet).length

  const title =
    view === 'day'
      ? anchor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : view === 'month'
          ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
          : String(anchor.getFullYear())

  return (
    <div className="flex h-full flex-col gap-4 px-6 pb-20">
      <Glass className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor(shift(view, anchor, -1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setAnchor(shift(view, anchor, 1))} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="text-[17px] font-extrabold tracking-tight text-slate-100">{title}</div>
        <button onClick={() => setAnchor(new Date())} className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/[0.06]">
          Today
        </button>
        <div className="flex-1" />
        <div className="text-xs text-slate-400">
          <b className="text-slate-200">{totalSolved}</b> solved · <b className="text-emerald-300">{goalDays}</b> goal days
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' }
          ]}
        />
      </Glass>

      <Glass className="min-h-0 flex-1 overflow-auto p-5">
        {view === 'day' && (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Solved', byDate.get(isoDate(anchor))?.solved ?? 0],
                ['Attempted', byDate.get(isoDate(anchor))?.attempted ?? 0],
                ['Contests done', byDate.get(isoDate(anchor))?.contestsCompleted ?? 0]
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <Label>{k}</Label>
                  <div className="mt-1 text-3xl font-extrabold tabular-nums text-slate-100">{v}</div>
                </div>
              ))}
            </div>
            <EventList events={events[isoDate(anchor)] ?? []} />
          </div>
        )}

        {view === 'week' && (
          <div className="grid h-full grid-cols-7 gap-3">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(from, i)
              const key = isoDate(d)
              const stat = byDate.get(key)
              return (
                <div key={key} className={cx('flex min-h-0 flex-col gap-2 rounded-2xl border p-2.5', key === today ? 'border-blue-400/40 bg-blue-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02]')}>
                  <button
                    onClick={() => {
                      setAnchor(d)
                      setView('day')
                    }}
                    className="flex items-baseline justify-between text-left"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <span className={cx('text-lg font-extrabold', key === today ? 'text-blue-200' : 'text-slate-200')}>{d.getDate()}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="tabular-nums">{stat?.solved ?? 0} solved</span>
                    {stat?.goalMet && <Trophy className="size-3 text-emerald-300" />}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <EventList events={events[key] ?? []} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'month' && (
          <div className="flex h-full flex-col gap-2">
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-2">
              {Array.from({ length: 42 }, (_, i) => {
                const d = addDays(from, i)
                const key = isoDate(d)
                const stat = byDate.get(key)
                const inMonth = d.getMonth() === anchor.getMonth()
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setAnchor(d)
                      setView('day')
                    }}
                    className={cx(
                      'relative flex min-h-[72px] flex-col rounded-2xl border p-2.5 text-left transition hover:brightness-125',
                      key === today ? 'border-blue-400/50' : stat?.goalMet ? 'border-emerald-400/35' : 'border-white/[0.06]',
                      !inMonth && 'opacity-30'
                    )}
                    style={{ background: heat(stat, goal) }}
                  >
                    <span className={cx('text-[13px] font-extrabold', key === today ? 'text-blue-100' : 'text-slate-300')}>{d.getDate()}</span>
                    {stat && stat.solved > 0 && (
                      <span className="mt-auto text-[11px] font-bold text-white/90">
                        {stat.solved} solved{stat.contestsCompleted ? ` · ${stat.contestsCompleted}🏆` : ''}
                      </span>
                    )}
                    {stat?.goalMet && <span className="absolute right-2 top-2 size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {view === 'year' && (
          <YearHeatmap year={anchor.getFullYear()} from={from} byDate={byDate} goal={goal} onPick={(d) => (setAnchor(d), setView('day'))} />
        )}

        {view !== 'year' && days.length === 0 && <Empty title="No data">Sync with Codeforces to fill your calendar.</Empty>}
      </Glass>
    </div>
  )
}

function YearHeatmap({ year, from, byDate, goal, onPick }: { year: number; from: Date; byDate: Map<string, DayStat>; goal: number; onPick: (d: Date) => void }) {
  const weeks = 53
  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1))
  const monthTotals = months.map((m) => {
    let solved = 0
    let goals = 0
    for (const [k, v] of byDate) {
      const d = parseIso(k)
      if (d.getFullYear() === year && d.getMonth() === m.getMonth()) {
        solved += v.solved
        if (v.goalMet) goals++
      }
    }
    return { m, solved, goals }
  })
  const max = Math.max(1, ...monthTotals.map((t) => t.solved))
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <div className="inline-grid grid-flow-col gap-[4px]" style={{ gridTemplateRows: 'repeat(7, 15px)', gridAutoColumns: '15px' }}>
          {Array.from({ length: weeks * 7 }, (_, i) => {
            const d = addDays(from, i)
            const key = isoDate(d)
            const stat = byDate.get(key)
            if (d.getFullYear() !== year) return <div key={key} />
            return (
              <button
                key={key}
                onClick={() => onPick(d)}
                title={`${d.toDateString()}: ${stat?.solved ?? 0} solved${stat?.goalMet ? ' · goal met' : ''}`}
                className={cx('rounded-[4px] border', stat?.goalMet ? 'border-emerald-400/60' : 'border-transparent')}
                style={{ background: heat(stat, goal) }}
              />
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-12 gap-2">
        {monthTotals.map((t) => (
          <div key={t.m.getMonth()} className="flex flex-col items-center gap-1.5">
            <div className="flex h-28 w-full items-end overflow-hidden rounded-xl bg-white/[0.03]">
              <div className="accent-grad w-full rounded-xl" style={{ height: `${(t.solved / max) * 100}%` }} />
            </div>
            <div className="text-[10.5px] font-bold uppercase text-slate-500">{t.m.toLocaleDateString(undefined, { month: 'short' })}</div>
            <div className={cx('text-[11px] font-bold tabular-nums', t.solved > 0 ? 'text-blue-300' : 'text-slate-600')}>
              {t.solved}
            </div>
            <div className="text-[10px] text-emerald-300/80">{t.goals}🏆</div>
          </div>
        ))}
      </div>
    </div>
  )
}
