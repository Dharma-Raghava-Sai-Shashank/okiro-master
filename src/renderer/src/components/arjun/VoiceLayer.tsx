import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { Maximize2, MessageSquareText, Mic, MicOff, Square, X } from 'lucide-react'
import { problemScope } from '@shared/api'
import type { Roadmap } from '@shared/types'
import { api } from '../../lib/api'
import { useApp } from '../../lib/store'
import { cx } from '../../lib/format'
import { voice } from '../../voice/engine'
import { useVoice, type VoiceState } from '../../voice/store'
import { useBridge } from '../../voice/bridge'
import { ChatPanel } from '../ChatPanel'
import { ArjunCore } from './ArjunCore'

export const STATE_LABEL: Record<VoiceState, string> = {
  off: 'Tap or press ⌥Space to talk',
  loading: 'Waking up…',
  listening: 'Listening',
  transcribing: 'Hearing you…',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  error: 'Something went wrong'
}

export const SUGGESTIONS = ['Open the next problem', 'Explain this problem', 'Run the tests', 'How am I doing?', 'Show my stats', 'Read the problem']

/** One line of live captions: what you said, then what Arjun is saying. */
export function Captions({ big }: { big?: boolean }) {
  const { state, captionUser, captionArjun, error, loadProgress, loadLabel, pendingConfirm } = useVoice()
  const arjun = state === 'error' ? error : loadProgress != null ? `${loadLabel} · ${Math.round(loadProgress * 100)}%` : captionArjun
  return (
    <div className={cx('flex min-w-0 flex-col', big ? 'items-center gap-3 text-center' : 'gap-0.5')}>
      {captionUser && state !== 'off' && (
        <div className={cx('hud-font truncate text-slate-400', big ? 'max-w-2xl text-sm' : 'max-w-[420px] text-[11px]')}>
          <span className="text-slate-500">YOU ›</span> {captionUser}
        </div>
      )}
      <div
        className={cx(
          'hud-font',
          big ? 'max-w-3xl text-[19px] leading-relaxed' : 'max-w-[420px] truncate text-[12.5px]',
          state === 'error' ? 'text-amber-300' : 'arc-glow-text'
        )}
      >
        {arjun || STATE_LABEL[state]}
        {pendingConfirm && <span className="ml-2 text-amber-200">(yes / no)</span>}
      </div>
    </div>
  )
}

function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = useVoice.getState()
      if (e.code === 'Space' && e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        if (!useApp.getState().settings?.voiceEnabled) return
        if (e.shiftKey) v.set({ hudOpen: !v.hudOpen })
        else voice.toggle()
      } else if (e.key === 'Escape') {
        if (v.state === 'speaking' || v.state === 'thinking') {
          voice.interrupt()
          v.set({ state: voice.active ? 'listening' : 'off' })
        } else if (v.hudOpen) v.set({ hudOpen: false })
        else if (v.chatOpen) v.set({ chatOpen: false })
      } else if (e.key.toLowerCase() === 'j' && e.metaKey) {
        e.preventDefault()
        v.set({ chatOpen: !v.chatOpen })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

function Dock() {
  const { state, loadProgress, set } = useVoice()
  const on = state !== 'off' && state !== 'error'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
      <div className="glass-strong pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-2 hud-in">
        <ArjunCore size={46} state={state} progress={loadProgress} detailed={false} onClick={() => voice.toggle()} />
        <div className="min-w-[220px] max-w-[440px]">
          <Captions />
        </div>
        <div className="flex items-center gap-0.5">
          <DockButton title={on ? 'End conversation' : 'Start talking (⌥Space)'} onClick={() => voice.toggle()}>
            {on ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          </DockButton>
          {state === 'speaking' && (
            <DockButton title="Stop speaking (Esc)" onClick={() => voice.interrupt()}>
              <Square className="size-3 fill-current" />
            </DockButton>
          )}
          <DockButton title="Transcript (⌘J)" onClick={() => set({ chatOpen: !useVoice.getState().chatOpen })}>
            <MessageSquareText className="size-3.5" />
          </DockButton>
          <DockButton title="Full screen (⌥⇧Space)" onClick={() => set({ hudOpen: true })}>
            <Maximize2 className="size-3.5" />
          </DockButton>
        </div>
      </div>
    </div>
  )
}

function DockButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.08] hover:text-cyan-200">
      {children}
    </button>
  )
}

function Readout({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="hud-panel rounded-lg px-4 py-3">
      <div className="hud-font text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">{label}</div>
      <div className="hud-font mt-1 truncate text-[15px] font-bold text-cyan-50">{value}</div>
      {sub && <div className="hud-font truncate text-[10.5px] text-slate-400">{sub}</div>}
    </div>
  )
}

function Hud() {
  const { state, loadProgress, set, sttDevice, ttsDevice, systemVoice } = useVoice()
  const { settings, user, provider } = useApp()
  const ws = useBridge((b) => b.workspace)
  const [rm, setRm] = useState<Roadmap | null>(null)
  useEffect(() => {
    void api.cf.roadmap().then(setRm)
  }, [])
  return (
    <div className="hud-in fixed inset-0 z-50 flex flex-col bg-[#02060e]/92 backdrop-blur-xl">
      <div className="hud-grid pointer-events-none absolute inset-0" />
      <div className="hud-scan pointer-events-none absolute inset-0" />
      <div className="drag relative flex h-14 items-center justify-between px-8">
        <div className="hud-font pl-16 text-[11px] uppercase tracking-[0.3em] text-cyan-400/80">Arjun · {provider === 'claude' ? settings?.claudeModel : settings?.ollamaModel}</div>
        <button onClick={() => set({ hudOpen: false })} className="no-drag rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white" title="Close (Esc)">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative grid flex-1 grid-cols-[260px_1fr_260px] items-center gap-8 px-10 pb-10">
        <div className="flex flex-col gap-3">
          <Readout
            label="Roadmap"
            value={rm ? `${rm.contestsDone} / ${rm.windowContests}` : '—'}
            sub={rm ? `${rm.contestsLeft} contests left` : undefined}
          />
          <Readout
            label="Up next"
            value={rm?.current ? `${rm.current.contest.id}${rm.current.problem.index} · ${rm.current.problem.rating ?? '—'}` : '—'}
            sub={rm?.current?.problem.name}
          />
          {ws?.problem && <Readout label="Open problem" value={`${ws.ref.contestId}${ws.ref.index} · ${ws.problem.rating ?? '—'}`} sub={ws.problem.name} />}
        </div>
        <div className="flex flex-col items-center gap-8">
          <ArjunCore size={360} state={state} progress={loadProgress} onClick={() => voice.toggle()} />
          <Captions big />
          <div className="flex max-w-2xl flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void voice.command(s)}
                className="hud-font rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-[11.5px] text-cyan-100/80 transition hover:border-cyan-300/50 hover:text-cyan-50"
              >
                “{s}”
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Readout label="Rating" value={user?.rating != null ? String(user.rating) : '—'} sub={user?.rating != null ? `${Math.max(0, 2100 - user.rating)} to Master` : undefined} />
          <Readout label="Voice" value={systemVoice ? 'macOS voice' : settings?.ttsVoice ?? '—'} sub={`ears ${sttDevice || '—'} · voice ${systemVoice ? 'system' : ttsDevice || '—'}`} />
          <Readout label="Status" value={STATE_LABEL[state]} sub="Esc to interrupt · ⌥Space to start/stop" />
        </div>
      </div>
    </div>
  )
}

function ChatDrawer() {
  const { chatOpen, set } = useVoice()
  const ws = useBridge((b) => b.workspace)
  if (!chatOpen) return null
  const scope = ws ? problemScope(ws.ref) : 'home'
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={() => set({ chatOpen: false })}>
      <div className="glass-strong hud-in m-3 flex w-[440px] flex-col overflow-hidden rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <ChatPanel key={scope} scope={scope} problem={ws?.ref} getCode={() => ws?.getCode() ?? ''} getLastRun={() => ws?.lastRun()} />
      </div>
    </div>
  )
}

/** Mounted once in the Shell: dock, HUD, transcript drawer and hotkeys. */
export function VoiceLayer() {
  useHotkeys()
  const loc = useLocation()
  const { hudOpen } = useVoice()
  const enabled = useApp((s) => s.settings?.voiceEnabled ?? true)
  const onHome = loc.pathname === '/'
  return (
    <>
      {enabled && !onHome && !hudOpen && <Dock />}
      {hudOpen && <Hud />}
      <ChatDrawer />
    </>
  )
}
