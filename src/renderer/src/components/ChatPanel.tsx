import { useEffect, useRef, useState } from 'react'
import { Brain, ChevronDown, Cloud, Cpu, Lightbulb, Bug, ScanSearch, BookOpen, Square, Trash2, Wrench, ArrowUp } from 'lucide-react'
import { SPOILER_LEVELS, type CoachAction, type ProblemRef, type RunResponse } from '@shared/types'
import { useApp, useCoach, type ToolCallView } from '../lib/store'
import { Markdown } from '../lib/markdown'
import { cx } from '../lib/format'
import { Spinner } from './ui'

const TOOL_LABEL: Record<string, string> = {
  run_tests: 'Ran your tests',
  run_code: 'Ran code',
  stress_test: 'Stress tested',
  search_knowledge: 'Checked notes',
  get_editorial: 'Read the editorial (hidden)',
  get_user_history: 'Looked at your history'
}

function Avatar() {
  return (
    <div className="accent-grad accent-glow grid size-7 shrink-0 place-items-center rounded-xl text-[12px] font-black text-white">A</div>
  )
}

function Reasoning({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false)
  if (!text.trim()) return null
  return (
    <div className="mb-1.5">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] font-semibold text-violet-300/80 hover:text-violet-200">
        <Brain className={cx('size-3', live && 'animate-pulse')} />
        {live ? 'Thinking…' : 'Thought process'}
        <ChevronDown className={cx('size-3 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-violet-400/10 bg-violet-500/[0.05] p-2.5 text-[11.5px] leading-relaxed text-slate-400">
          {text}
        </div>
      )}
    </div>
  )
}

function Tools({ tools }: { tools: ToolCallView[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!tools.length) return null
  return (
    <div className="mb-1.5 flex flex-col gap-1">
      {tools.map((t, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
          >
            {t.result === undefined ? <Spinner className="size-3" /> : <Wrench className="size-3 text-blue-300" />}
            {TOOL_LABEL[t.name] ?? t.name}
            <ChevronDown className={cx('size-3 transition', open === i && 'rotate-180')} />
          </button>
          {open === i && (
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/40 p-2 font-mono text-[11px] text-slate-400">
              {t.result ?? 'running…'}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

export interface ChatPanelProps {
  scope: string
  problem?: ProblemRef
  getCode?: () => string
  getLastRun?: () => RunResponse | undefined
  autoGreet?: boolean
  className?: string
}

export function ChatPanel({ scope, problem, getCode, getLastRun, autoGreet, className }: ChatPanelProps) {
  const { messages, streams, errors, load, send, stop, clear } = useCoach()
  const { provider, setProvider, settings, updateSettings, llm } = useApp()
  const [text, setText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const greeted = useRef(false)
  const list = messages[scope]
  const stream = streams[scope]
  const error = errors[scope]

  useEffect(() => {
    void load(scope)
  }, [scope, load])

  useEffect(() => {
    if (!autoGreet || greeted.current || !list || stream) return
    greeted.current = true
    const last = list[list.length - 1]
    const today = new Date().toDateString()
    if (!last || new Date(last.createdAt).toDateString() !== today) void ask('greet', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGreet, list])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [list?.length, stream?.text, stream?.reasoning, stream?.tools.length])

  async function ask(action: CoachAction, body: string) {
    if (stream) return
    await send({ scope, problem, text: body, action, code: getCode?.(), provider, lastRun: getLastRun?.() })
  }

  function submit() {
    const t = text.trim()
    if (!t) return
    setText('')
    void ask('chat', t)
  }

  const claudeReady = !!llm?.claudeKeySet
  const localReady = !!llm?.ollamaRunning && !!llm?.chatModelReady
  const spoiler = settings?.spoilerLevel ?? 1

  return (
    <div className={cx('flex h-full min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <Avatar />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-slate-100">Arjun</div>
          <div className="truncate text-[10.5px] text-slate-500">
            {provider === 'claude' ? `Claude · ${settings?.claudeModel}` : `Local · ${settings?.ollamaModel}`}
            {provider === 'ollama' && !localReady && ' · not ready (see Settings)'}
          </div>
        </div>
        <div className="flex rounded-xl border border-white/[0.07] bg-black/30 p-0.5">
          <button
            title="Local model (private, offline)"
            onClick={() => setProvider('ollama')}
            className={cx('rounded-lg p-1.5', provider === 'ollama' ? 'bg-blue-500/25 text-blue-200' : 'text-slate-500 hover:text-slate-300')}
          >
            <Cpu className="size-3.5" />
          </button>
          <button
            title={claudeReady ? 'Ask Claude (online)' : 'Add an Anthropic API key in Settings to use Claude'}
            disabled={!claudeReady}
            onClick={() => setProvider('claude')}
            className={cx('rounded-lg p-1.5 disabled:opacity-30', provider === 'claude' ? 'bg-violet-500/25 text-violet-200' : 'text-slate-500 hover:text-slate-300')}
          >
            <Cloud className="size-3.5" />
          </button>
        </div>
        <button title="Clear this conversation" onClick={() => void clear(scope)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {list?.length === 0 && !stream && (
          <div className="m-auto max-w-xs text-center text-xs leading-relaxed text-slate-500">
            {problem
              ? 'Ask Arjun to explain the problem, brainstorm an approach, review your code, or figure out a WA.'
              : 'Say hi to Arjun. He knows where you are on the road to Master.'}
          </div>
        )}
        {list?.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-10 self-end rounded-2xl rounded-br-md border border-blue-400/20 bg-blue-500/15 px-3.5 py-2 text-[13px] leading-relaxed text-slate-100">
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <Avatar />
              <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-200">
                <Reasoning text={m.reasoning} />
                <Tools tools={m.tools} />
                <Markdown text={m.content} />
              </div>
            </div>
          )
        )}
        {stream && (
          <div className="flex gap-2.5">
            <Avatar />
            <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-200">
              <Reasoning text={stream.reasoning} live={!stream.text} />
              <Tools tools={stream.tools} />
              {stream.text ? (
                <div className="caret">
                  <Markdown text={stream.text} />
                </div>
              ) : (
                !stream.reasoning && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Spinner className="size-3.5" /> Arjun is thinking…
                  </div>
                )
              )}
            </div>
          </div>
        )}
        {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        {problem && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {(
              [
                ['explain', 'Explain', BookOpen],
                ['hint', 'Hint', Lightbulb],
                ['review', 'Review code', ScanSearch],
                ['why-wa', 'Why failing?', Bug]
              ] as const
            ).map(([action, label, Icon]) => (
              <button
                key={action}
                disabled={!!stream}
                onClick={() => void ask(action, '')}
                className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-40"
              >
                <Icon className="size-3" /> {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5" title="How much Arjun is allowed to give away">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Spoilers</span>
              <input
                type="range"
                min={0}
                max={4}
                value={spoiler}
                onChange={(e) => void updateSettings({ spoilerLevel: Number(e.target.value) })}
                className="h-1 w-20 accent-blue-500"
              />
              <span className="w-[74px] text-[11px] font-semibold text-blue-200">{SPOILER_LEVELS[spoiler]}</span>
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-black/30 p-1.5 focus-within:border-blue-400/40">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={Math.min(6, Math.max(1, text.split('\n').length))}
            placeholder={problem ? 'Tell Arjun your idea, or ask anything…' : 'Talk to Arjun…'}
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          {stream ? (
            <button onClick={() => stop(scope)} title="Stop" className="grid size-9 place-items-center rounded-xl bg-rose-500/20 text-rose-200 hover:bg-rose-500/30">
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim()}
              title="Send (Enter)"
              className="accent-grad accent-glow grid size-9 place-items-center rounded-xl text-white disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
