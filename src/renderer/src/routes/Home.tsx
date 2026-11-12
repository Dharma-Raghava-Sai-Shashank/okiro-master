import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Target, Trophy } from 'lucide-react'
import type { DayStat, Roadmap } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { cx, greeting, isoDate, rankName, ratingColor } from '../lib/format'
import { Button, Empty, Glass, Label, ProgressRing, RatingPill, Spinner } from '../components/ui'
import { ArjunCore } from '../components/arjun/ArjunCore'
import { Captions, SUGGESTIONS } from '../components/arjun/VoiceLayer'
import { voice } from '../voice/engine'
import { useVoice } from '../voice/store'
import { MessageSquareText, Maximize2 } from 'lucide-react'

function lastNDays(n: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (n - 1))
  return { from: isoDate(from), to: isoDate(to) }
}

export function HomePage() {
  const { settings, user, dataVersion, llm } = useApp()
  const { state, loadProgress, set: setVoice } = useVoice()
  const nav = useNavigate()
  const [rm, setRm] = useState<Roadmap | null>(null)
  const [week, setWeek] = useState<DayStat[]>([])

  useEffect(() => {
    void api.cf.roadmap().then(setRm)
    const { from, to } = lastNDays(7)
    void api.stats.days(from, to).then(setWeek)
  }, [dataVersion])

  const today = week[week.length - 1]
  const toMaster = user?.rating != null ? Math.max(0, 2100 - user.rating) : null

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(380px,460px)] gap-5 px-6 pb-6">
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
        <Glass className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative flex items-center gap-6">
            <ProgressRing value={rm?.contestsDone ?? 0} max={rm?.windowContests ?? 1} size={132} stroke={11}>
              <div>
                <div className="text-2xl font-extrabold tabular-nums text-slate-100">{rm?.contestsDone ?? '–'}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">of {rm?.windowContests ?? '–'}</div>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-400">
                {greeting()}, <span style={{ color: ratingColor(user?.rating) }}>{settings?.handle}</span>
              </div>
              <div className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-slate-50">
                Road to <span className="text-grad">Master</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-400">
                <span>
                  {rm ? (
                    <>
                      <b className="text-slate-200">{rm.contestsLeft}</b> contests left · <b className="text-slate-200">{rm.problemsDone}</b>/
                      {rm.problemsTotal} problems ≤ {settings?.ratingCap}
                    </>
                  ) : (
                    'Loading roadmap…'
                  )}
                </span>
                {user?.rating != null && (
                  <span>
                    {rankName(user.rating)} · <b style={{ color: ratingColor(user.rating) }}>{user.rating}</b>
                    {toMaster ? <> · {toMaster} to 2100</> : ' · Master reached 🎉'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Glass>

        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5">
          <Glass className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <Label>Up next</Label>
              {rm?.current && (
                <span className="text-[11px] text-slate-500">
                  {rm.current.targetSolved}/{rm.current.targetTotal} done in this contest
                </span>
              )}
            </div>
            {!rm ? (
              <Spinner />
            ) : rm.current ? (
              <div className="flex flex-col gap-3">
                <div className="text-[13px] font-semibold text-slate-400">{rm.current.contest.name}</div>
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl border border-blue-400/25 bg-blue-500/10 text-lg font-black text-blue-200">
                    {rm.current.problem.index}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[17px] font-bold text-slate-100">{rm.current.problem.name}</div>
                    <RatingPill rating={rm.current.problem.rating} />
                  </div>
                  <Button variant="primary" onClick={() => nav(`/problem/${rm.current!.contest.id}/${rm.current!.problem.index}`)}>
                    Solve <ArrowRight className="size-4" />
                  </Button>
                </div>
                {rm.nextUp.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3">
                    {rm.nextUp.slice(0, 4).map((n) => (
                      <button
                        key={n.contest.id}
                        onClick={() => nav(`/problem/${n.contest.id}/${n.remaining[0]?.index ?? 'A'}`)}
                        className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-300">{n.contest.name}</span>
                        <span className="text-[11px] tabular-nums text-slate-500">{n.remaining.length} left</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : rm.windowContests === 0 ? (
              <Empty title="No contests yet">Hit Sync in the top bar to pull contests from Codeforces.</Empty>
            ) : (
              <Empty title="Every contest in the window is done 🏆">Raise the window size or the rating cap in Settings.</Empty>
            )}
          </Glass>

          <Glass className="p-5">
            <div className="mb-3 flex items-center gap-1.5">
              <Target className="size-3.5 text-blue-300" />
              <Label>Today</Label>
            </div>
            <div className="flex items-end gap-6">
              <div>
                <div className="text-3xl font-extrabold tabular-nums text-slate-100">{today?.solved ?? 0}</div>
                <div className="text-[11px] text-slate-500">solved / {settings?.dailyProblemGoal} goal</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold tabular-nums text-slate-100">{today?.contestsCompleted ?? 0}</div>
                <div className="text-[11px] text-slate-500">contests / {settings?.dailyContestGoal} goal</div>
              </div>
              {today?.goalMet && (
                <div className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                  <Trophy className="size-3.5" /> Goal met
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-between gap-1.5">
              {week.map((d) => {
                const intensity = Math.min(1, d.solved / Math.max(1, settings?.dailyProblemGoal ?? 4))
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className={cx('h-14 w-full rounded-xl border', d.goalMet ? 'border-emerald-400/40' : 'border-white/[0.06]')}
                      style={{ background: d.solved ? `rgba(59,130,246,${0.15 + intensity * 0.6})` : 'rgba(255,255,255,0.03)' }}
                      title={`${d.date}: ${d.solved} solved`}
                    />
                    <div className="text-[10px] font-bold text-slate-500">
                      {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </div>
                  </div>
                )
              })}
            </div>
          </Glass>
        </div>
      </div>

      <Glass className="relative flex min-h-0 flex-col items-center overflow-hidden px-6 pb-6 pt-5">
        <div className="hud-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex w-full items-center justify-between">
          <div className="hud-font text-[10.5px] uppercase tracking-[0.28em] text-cyan-400/80">Arjun</div>
          <div className="flex gap-1">
            <button title="Transcript (⌘J)" onClick={() => setVoice({ chatOpen: true })} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200">
              <MessageSquareText className="size-4" />
            </button>
            <button title="Full screen (⌥⇧Space)" onClick={() => setVoice({ hudOpen: true })} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200">
              <Maximize2 className="size-4" />
            </button>
          </div>
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6">
          <ArjunCore size={300} state={state} progress={loadProgress} onClick={() => voice.toggle()} />
          <Captions big />
          {llm && (!llm.ollamaRunning || !llm.chatModelReady) && (
            <div className="hud-font max-w-xs text-center text-[11px] text-amber-300/90">Arjun's brain isn't ready — start Ollama and pull a model in Settings.</div>
          )}
        </div>
        <div className="relative flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.slice(0, 5).map((t) => (
            <button
              key={t}
              onClick={() => void voice.command(t)}
              className="hud-font rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-2.5 py-1 text-[11px] text-cyan-100/75 transition hover:border-cyan-300/45 hover:text-cyan-50"
            >
              “{t}”
            </button>
          ))}
        </div>
      </Glass>
    </div>
  )
}
