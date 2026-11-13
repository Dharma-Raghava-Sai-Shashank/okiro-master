import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Search, X } from 'lucide-react'
import { CONTEST_TYPE_LABELS, type ContestRow, type ContestType, type ProblemCell } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { cx, ratingColor } from '../lib/format'
import { Chip, Empty, Glass, Segmented, Spinner } from '../components/ui'

const TYPES = Object.keys(CONTEST_TYPE_LABELS) as ContestType[]
const LIMITS = [50, 100, 300, 500, 1000]

type RowState = 'done' | 'progress' | 'todo' | 'none'
type Show = 'all' | 'todo' | 'progress' | 'done'

function rowState(r: ContestRow): RowState {
  if (r.targetTotal === 0) return 'none'
  if (r.targetSolved === r.targetTotal) return 'done'
  const touched = r.problems.some((p) => p.inTarget && p.status !== 'untouched')
  return touched ? 'progress' : 'todo'
}

const ROW_BADGE: Record<RowState, { label: string; cls: string }> = {
  done: { label: 'DONE', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  progress: { label: 'IN PROGRESS', cls: 'bg-amber-500/12 text-amber-200 border-amber-400/25' },
  todo: { label: 'TO DO', cls: 'bg-blue-500/10 text-blue-200 border-blue-400/20' },
  none: { label: 'ABOVE CAP', cls: 'bg-white/[0.03] text-slate-500 border-white/[0.08]' }
}

function MiniRing({ value, max, done }: { value: number; max: number; done: boolean }) {
  const r = 13
  const c = 2 * Math.PI * r
  const pct = max ? value / max : 0
  return (
    <div className="relative grid size-9 shrink-0 place-items-center">
      <svg width={36} height={36} className="-rotate-90">
        <circle cx={18} cy={18} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={3} fill="none" />
        <circle cx={18} cy={18} r={r} stroke={done ? '#34d399' : '#60a5fa'} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className={cx('absolute text-[10px] font-black tabular-nums', done ? 'text-emerald-200' : 'text-slate-200')}>
        {done ? <Check className="size-3.5" /> : `${value}/${max}`}
      </span>
    </div>
  )
}

function Cell({ p, onOpen }: { p: ProblemCell; onOpen: () => void }) {
  const color = ratingColor(p.rating)
  const solved = p.status === 'solved'
  const tried = p.status === 'attempted'
  const above = !p.inTarget
  return (
    <button
      onClick={onOpen}
      title={`${p.index}. ${p.name}${p.rating ? ` · ${p.rating}` : ''} — ${solved ? 'solved' : tried ? 'tried, not solved yet' : above ? 'above your rating cap (optional)' : 'to do'}`}
      className={cx(
        'group relative flex h-[54px] min-w-0 flex-col justify-center overflow-hidden rounded-xl border px-2.5 text-left transition hover:-translate-y-px',
        solved && 'border-emerald-400/45 bg-emerald-500/[0.16] hover:bg-emerald-500/25',
        tried && 'border-rose-400/55 bg-rose-500/[0.08] hover:bg-rose-500/[0.14]',
        !solved && !tried && !above && 'border-white/[0.09] bg-white/[0.035] hover:border-blue-400/40 hover:bg-white/[0.07]',
        !solved && !tried && above && 'above-cap border-dashed border-white/[0.08] opacity-45 hover:opacity-80'
      )}
    >
      {!solved && !tried && !above && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />}
      <div className="flex items-center gap-1.5">
        {solved ? (
          <Check className="size-3.5 shrink-0 text-emerald-300" strokeWidth={3} />
        ) : tried ? (
          <X className="size-3.5 shrink-0 text-rose-300" strokeWidth={3} />
        ) : null}
        <span className={cx('text-[12px] font-black', solved ? 'text-emerald-200' : tried ? 'text-rose-200' : above ? 'text-slate-500' : 'text-slate-100')}>{p.index}</span>
        <span className="ml-auto text-[10.5px] font-bold tabular-nums" style={{ color: above && !solved ? '#64748b' : color }}>
          {p.rating ?? '—'}
        </span>
      </div>
      <div className={cx('truncate text-[11px]', solved ? 'text-emerald-100/70' : 'text-slate-400 group-hover:text-slate-200')}>{p.name}</div>
    </button>
  )
}

function Legend() {
  const item = (box: string, label: string, extra?: React.ReactNode) => (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className={cx('grid h-4 w-6 place-items-center rounded-md border', box)}>{extra}</span>
      {label}
    </span>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {item('border-emerald-400/45 bg-emerald-500/20', 'Solved', <Check className="size-2.5 text-emerald-300" strokeWidth={3} />)}
      {item('border-rose-400/55 bg-rose-500/10', 'Tried', <X className="size-2.5 text-rose-300" strokeWidth={3} />)}
      {item('border-white/15 bg-white/[0.05] border-l-[3px] border-l-blue-400', 'To do (≤ cap)')}
      {item('above-cap border-dashed border-white/15 opacity-60', 'Above cap (optional)')}
    </div>
  )
}

export function ContestsPage() {
  const { settings, dataVersion, updateSettings } = useApp()
  const nav = useNavigate()
  const [rows, setRows] = useState<ContestRow[] | null>(null)
  const [types, setTypes] = useState<ContestType[]>(settings?.contestTypes ?? TYPES)
  const [limit, setLimit] = useState(settings?.windowSize ?? 300)
  const [search, setSearch] = useState('')
  const [show, setShow] = useState<Show>('all')
  const cap = settings?.ratingCap ?? 2000

  useEffect(() => {
    let live = true
    void api.cf.contests({ types, ratingCap: cap, limit, search, hideCompleted: false }).then((r) => live && setRows(r))
    return () => {
      live = false
    }
  }, [types, cap, limit, search, dataVersion])

  const counts = useMemo(() => {
    const c = { done: 0, progress: 0, todo: 0, none: 0, solved: 0, target: 0 }
    for (const r of rows ?? []) {
      c[rowState(r)]++
      c.solved += r.targetSolved
      c.target += r.targetTotal
    }
    return c
  }, [rows])

  const visible = useMemo(() => (rows ?? []).filter((r) => show === 'all' || rowState(r) === show), [rows, show])
  const maxCols = useMemo(() => Math.max(6, ...visible.map((r) => r.problems.length)), [visible])

  const toggle = (t: ContestType) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t]
    setTypes(next)
    void updateSettings({ contestTypes: next })
  }

  return (
    <div className="flex h-full flex-col gap-4 px-6 pb-20">
      <Glass className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map((t) => (
            <Chip key={t} active={types.includes(t)} onClick={() => toggle(t)}>
              {CONTEST_TYPE_LABELS[t]}
            </Chip>
          ))}
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Rating cap
            <input
              type="number"
              step={100}
              min={800}
              max={3500}
              value={cap}
              onChange={(e) => void updateSettings({ ratingCap: Number(e.target.value) || 2000 })}
              className="w-[70px] rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1 text-xs font-bold tabular-nums text-slate-100 focus:outline-none"
            />
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-slate-200 focus:outline-none"
          >
            {LIMITS.map((l) => (
              <option key={l} value={l}>
                Last {l}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/30 px-2.5 py-1.5">
            <Search className="size-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contests"
              className="w-40 bg-transparent text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-3">
          <Segmented
            value={show}
            onChange={setShow}
            options={[
              { value: 'all', label: `All ${rows?.length ?? ''}` },
              { value: 'todo', label: `To do ${counts.todo}` },
              { value: 'progress', label: `In progress ${counts.progress}` },
              { value: 'done', label: `Done ${counts.done}` }
            ]}
          />
          <div className="text-[12px] text-slate-400">
            <b className="text-emerald-300">{counts.solved}</b> / {counts.target} problems ≤ {cap} solved
          </div>
          <div className="flex-1" />
          <Legend />
        </div>
      </Glass>

      <Glass className="min-h-0 flex-1 overflow-hidden">
        {!rows ? (
          <div className="grid h-full place-items-center">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <Empty title={show === 'done' ? 'Nothing completed here yet' : 'No contests match'}>Try other filters, or Sync to pull contests from Codeforces.</Empty>
        ) : (
          <div className="h-full overflow-auto p-3">
            <div className="flex flex-col gap-1.5">
              {visible.map((r) => {
                const st = rowState(r)
                return (
                  <div
                    key={r.contest.id}
                    className={cx(
                      'relative grid items-center gap-1.5 rounded-2xl py-1.5 pl-2 pr-1.5 transition',
                      st === 'done' ? 'bg-emerald-500/[0.06]' : st === 'progress' ? 'bg-amber-500/[0.035]' : 'hover:bg-white/[0.02]'
                    )}
                    style={{ gridTemplateColumns: `290px repeat(${maxCols}, minmax(96px, 1fr))` }}
                  >
                    {st === 'done' && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-emerald-400" />}
                    <div className="flex min-w-0 items-center gap-2.5 pl-1.5 pr-2">
                      {r.targetTotal > 0 ? <MiniRing value={r.targetSolved} max={r.targetTotal} done={st === 'done'} /> : <div className="size-9 shrink-0" />}
                      <div className="min-w-0">
                        <div className={cx('truncate text-[12.5px] font-semibold', st === 'done' ? 'text-emerald-100' : 'text-slate-200')} title={r.contest.name}>
                          {r.contest.name.replace('Codeforces ', '')}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={cx('rounded border px-1 py-px text-[9px] font-black tracking-wider', ROW_BADGE[st].cls)}>{ROW_BADGE[st].label}</span>
                          <span className="text-[10px] text-slate-500">
                            {r.contest.id} · {new Date(r.contest.startTime).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {r.problems.map((p) => (
                      <Cell key={p.index} p={p} onOpen={() => nav(`/problem/${p.contestId}/${p.index}`)} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Glass>
    </div>
  )
}
