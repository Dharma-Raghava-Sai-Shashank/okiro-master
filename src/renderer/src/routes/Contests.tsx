import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { CONTEST_TYPE_LABELS, type ContestRow, type ContestType, type ProblemCell } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { cx, ratingColor } from '../lib/format'
import { Chip, Empty, Glass, Spinner } from '../components/ui'

const TYPES = Object.keys(CONTEST_TYPE_LABELS) as ContestType[]
const LIMITS = [50, 100, 300, 500, 1000]

function Cell({ p, onOpen }: { p: ProblemCell; onOpen: () => void }) {
  const color = ratingColor(p.rating)
  const solved = p.status === 'solved'
  const attempted = p.status === 'attempted'
  return (
    <button
      onClick={onOpen}
      title={`${p.index}. ${p.name}${p.rating ? ` (${p.rating})` : ''}${p.inTarget ? '' : ' — above your cap'}`}
      className={cx(
        'group relative flex h-[52px] min-w-0 flex-col justify-center rounded-xl border px-2.5 text-left transition hover:-translate-y-px',
        solved
          ? 'border-emerald-400/30 bg-emerald-500/[0.13] hover:bg-emerald-500/20'
          : attempted
            ? 'border-rose-400/30 bg-rose-500/[0.1] hover:bg-rose-500/[0.16]'
            : 'border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.06]',
        !p.inTarget && 'opacity-35'
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cx('text-[11px] font-black', solved ? 'text-emerald-300' : attempted ? 'text-rose-300' : 'text-slate-300')}>{p.index}</span>
        {p.rating && (
          <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
            {p.rating}
          </span>
        )}
      </div>
      <div className="truncate text-[11px] text-slate-400 group-hover:text-slate-200">{p.name}</div>
    </button>
  )
}

export function ContestsPage() {
  const { settings, dataVersion, updateSettings } = useApp()
  const nav = useNavigate()
  const [rows, setRows] = useState<ContestRow[] | null>(null)
  const [types, setTypes] = useState<ContestType[]>(settings?.contestTypes ?? TYPES)
  const [limit, setLimit] = useState(settings?.windowSize ?? 300)
  const [search, setSearch] = useState('')
  const [hideCompleted, setHideCompleted] = useState(false)
  const cap = settings?.ratingCap ?? 2000

  useEffect(() => {
    let live = true
    void api.cf.contests({ types, ratingCap: cap, limit, search, hideCompleted }).then((r) => live && setRows(r))
    return () => {
      live = false
    }
  }, [types, cap, limit, search, hideCompleted, dataVersion])

  const maxCols = useMemo(() => Math.max(6, ...(rows ?? []).map((r) => r.problems.length)), [rows])
  const totals = useMemo(() => {
    const done = (rows ?? []).filter((r) => r.targetTotal > 0 && r.targetSolved === r.targetTotal).length
    return { done, total: rows?.length ?? 0 }
  }, [rows])

  const toggle = (t: ContestType) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t]
    setTypes(next)
    void updateSettings({ contestTypes: next })
  }

  return (
    <div className="flex h-full flex-col gap-4 px-6 pb-6">
      <Glass className="flex flex-wrap items-center gap-2 px-4 py-3">
        {TYPES.map((t) => (
          <Chip key={t} active={types.includes(t)} onClick={() => toggle(t)}>
            {CONTEST_TYPE_LABELS[t]}
          </Chip>
        ))}
        <div className="mx-2 h-5 w-px bg-white/10" />
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          Cap
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
        <Chip active={hideCompleted} onClick={() => setHideCompleted(!hideCompleted)}>
          Hide completed
        </Chip>
        <div className="flex-1" />
        <span className="text-xs tabular-nums text-slate-500">
          {totals.done}/{totals.total} complete
        </span>
        <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/30 px-2.5 py-1.5">
          <Search className="size-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contests"
            className="w-44 bg-transparent text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </Glass>

      <Glass className="min-h-0 flex-1 overflow-hidden">
        {!rows ? (
          <div className="grid h-full place-items-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <Empty title="No contests match">Try other filters, or Sync to pull contests from Codeforces.</Empty>
        ) : (
          <div className="h-full overflow-auto p-3">
            <div className="flex flex-col gap-1.5">
              {rows.map((r) => {
                const complete = r.targetTotal > 0 && r.targetSolved === r.targetTotal
                return (
                  <div key={r.contest.id} className="grid items-center gap-1.5" style={{ gridTemplateColumns: `260px repeat(${maxCols}, minmax(92px, 1fr))` }}>
                    <div className="flex min-w-0 items-center gap-2 pr-2">
                      <div
                        className={cx(
                          'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums',
                          complete ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-slate-400'
                        )}
                      >
                        {r.targetSolved}/{r.targetTotal}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-slate-200" title={r.contest.name}>
                          {r.contest.name.replace('Codeforces ', '')}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {r.contest.id} · {new Date(r.contest.startTime).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
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
