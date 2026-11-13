import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Maximize2, MessageSquareText, Target, Trophy } from 'lucide-react'
import type { DayStat, Roadmap } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { greeting, isoDate, rankName, ratingColor } from '../lib/format'
import { Button, Glass, Label, ProgressRing, RatingPill } from '../components/ui'
import { ArjunCore } from '../components/arjun/ArjunCore'
import { Captions, SUGGESTIONS } from '../components/arjun/VoiceLayer'
import { voice } from '../voice/engine'
import { useVoice } from '../voice/store'

export function HomePage() {
  const { settings, user, dataVersion, llm } = useApp()
  const { state, loadProgress, set: setVoice } = useVoice()
  const nav = useNavigate()
  const [rm, setRm] = useState<Roadmap | null>(null)
  const [today, setToday] = useState<DayStat | null>(null)

  useEffect(() => {
    void api.cf.roadmap().then(setRm)
    const d = isoDate(new Date())
    void api.stats.days(d, d).then((w) => setToday(w[w.length - 1] ?? null))
  }, [dataVersion])

  const toMaster = user?.rating != null ? Math.max(0, 2100 - user.rating) : null

  return (
    <div className="relative flex h-full flex-col px-6 pb-6">
      <div className="hud-grid pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative flex justify-end gap-1">
        <button
          title="Transcript (⌘J)"
          onClick={() => setVoice({ chatOpen: true })}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200"
        >
          <MessageSquareText className="size-4" />
        </button>
        <button
          title="Full screen (⌥⇧Space)"
          onClick={() => setVoice({ hudOpen: true })}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-7">
        <div className="text-center">
          <div className="text-[15px] font-semibold text-slate-300">
            {greeting()}
            {settings?.handle && (
              <>
                , <span style={{ color: ratingColor(user?.rating) }}>{settings.handle}</span>
              </>
            )}
          </div>
          <div className="mt-1 text-[12.5px] text-slate-500">
            {user?.rating != null ? (
              <>
                {rankName(user.rating)} <b style={{ color: ratingColor(user.rating) }}>{user.rating}</b>
                {toMaster ? <> · {toMaster} to Master</> : ' · Master reached 🎉'}
              </>
            ) : (
              'Road to Master'
            )}
          </div>
        </div>

        <ArjunCore size={340} state={state} progress={loadProgress} onClick={() => voice.toggle()} />

        <div className="flex min-h-12 flex-col items-center justify-start gap-3">
          <Captions big />
          {llm && (!llm.ollamaRunning || !llm.chatModelReady) && (
            <div className="hud-font max-w-xs text-center text-[11px] text-amber-300/90">
              Arjun's brain isn't ready — start Ollama and pull a model in Settings.
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.slice(0, 4).map((t) => (
            <button
              key={t}
              onClick={() => void voice.command(t)}
              className="hud-font rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-2.5 py-1 text-[11px] text-cyan-100/75 transition hover:border-cyan-300/45 hover:text-cyan-50"
            >
              “{t}”
            </button>
          ))}
        </div>
      </div>

      <Glass className="relative grid shrink-0 grid-cols-3 divide-x divide-white/[0.06]">
        <div className="flex items-center gap-3 px-5 py-4">
          <ProgressRing value={rm?.contestsDone ?? 0} max={rm?.windowContests ?? 1} size={46} stroke={5}>
            <span className="text-[11px] font-extrabold tabular-nums text-slate-200">{rm?.contestsDone ?? '–'}</span>
          </ProgressRing>
          <div className="min-w-0">
            <Label>Road to Master</Label>
            <div className="mt-0.5 truncate text-[12.5px] text-slate-400">
              {rm ? (
                <>
                  <b className="text-slate-200">{rm.contestsLeft}</b> contests left · <b className="text-slate-200">{rm.problemsDone}</b>/
                  {rm.problemsTotal} problems
                </>
              ) : (
                '…'
              )}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <Label>Up next</Label>
            {rm?.current ? (
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-[12.5px] font-black text-blue-200">
                  {rm.current.contest.id}
                  {rm.current.problem.index}
                </span>
                <span className="truncate text-[12.5px] text-slate-300">{rm.current.problem.name}</span>
                <RatingPill rating={rm.current.problem.rating} />
              </div>
            ) : (
              <div className="mt-0.5 text-[12.5px] text-slate-500">
                {!rm ? '…' : rm.windowContests === 0 ? 'Hit Sync to pull contests' : 'Every contest is done 🏆'}
              </div>
            )}
          </div>
          {rm?.current && (
            <Button size="sm" variant="primary" onClick={() => nav(`/problem/${rm.current!.contest.id}/${rm.current!.problem.index}`)}>
              Solve <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Target className="size-3.5 text-blue-300" />
              <Label>Today</Label>
            </div>
            <div className="mt-0.5 text-[12.5px] text-slate-400">
              <b className="text-slate-200">{today?.solved ?? 0}</b>/{settings?.dailyProblemGoal ?? 4} problems ·{' '}
              <b className="text-slate-200">{today?.contestsCompleted ?? 0}</b>/{settings?.dailyContestGoal ?? 1} contests
            </div>
          </div>
          {today?.goalMet && (
            <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
              <Trophy className="size-3.5" /> Met
            </div>
          )}
        </div>
      </Glass>
    </div>
  )
}
