import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, Copy, Eye, EyeOff, Gauge, NotebookPen, Play, RotateCw, Volume2 } from 'lucide-react'
import { analyzeConstraints } from '@shared/constraints'
import type { ProblemDetail, TestCase } from '@shared/types'
import { renderStatementMath } from '../../lib/math'
import { cx } from '../../lib/format'
import { Button, Spinner } from '../ui'
import { voice } from '../../voice/engine'

const SECTIONS = [
  { key: 'legend', label: 'Statement' },
  { key: 'input', label: 'Input' },
  { key: 'output', label: 'Output' },
  { key: 'examples', label: 'Examples' },
  { key: 'note', label: 'Note' }
] as const

/** Splits CF statement HTML so our interactive sample cards can sit between Output and Note. */
function splitHtml(html: string): { main: string; note: string } {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')!
  root.querySelectorAll('.sample-tests').forEach((e) => e.remove())
  const note = root.querySelector('.note')
  const noteHtml = note ? note.outerHTML : ''
  note?.remove()
  // Anchor the legend (first untitled block) so the section tabs can jump to it.
  const legend = Array.from(root.children).find((c) => !c.className)
  legend?.setAttribute('data-sec', 'legend')
  root.querySelector('.input-specification')?.setAttribute('data-sec', 'input')
  root.querySelector('.output-specification')?.setAttribute('data-sec', 'output')
  return { main: root.innerHTML, note: noteHtml }
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      title="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setDone(true)
        window.setTimeout(() => setDone(false), 1200)
      }}
      className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
    >
      {done ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function SampleCard({ n, test, onRun }: { n: number; test: TestCase; onRun: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">Example {n}</span>
        <div className="flex-1" />
        <button title="Read aloud" onClick={() => void voice.command(`read sample ${n}`)} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200">
          <Volume2 className="size-3.5" />
        </button>
        <button title="Run this example" onClick={onRun} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-emerald-200">
          <Play className="size-3" /> Run
        </button>
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
        {(
          [
            ['Input', test.input],
            ['Output', test.expected]
          ] as const
        ).map(([label, text]) => (
          <div key={label} className="min-w-0">
            <div className="flex items-center justify-between px-3 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {label}
              <CopyButton text={text} />
            </div>
            <pre className="max-h-60 overflow-auto px-3 pb-2.5 font-mono text-[12.5px] leading-[1.55] text-slate-200">{text}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface ProblemPaneProps {
  problem: ProblemDetail | null
  loadError: string
  tests: TestCase[]
  notes: string
  onNotes: (notes: string) => void
  onRetry: () => void
  onRunTest: (id: number) => void
}

export function ProblemPane({ problem, loadError, tests, notes, onNotes, onRetry, onRunTest }: ProblemPaneProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [showTags, setShowTags] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [active, setActive] = useState<string>('legend')
  const parts = useMemo(() => (problem ? splitHtml(renderStatementMath(problem.statementHtml)) : null), [problem])
  const facts = useMemo(() => (problem ? analyzeConstraints(problem.statementText) : null), [problem])
  const samples = tests.filter((t) => t.isSample)

  useEffect(() => setShowTags(false), [problem?.contestId, problem?.index])

  const jump = (key: string) => {
    setActive(key)
    scroller.current?.querySelector(`[data-sec="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-sm font-bold text-rose-200">Couldn't load the statement</div>
        <div className="max-w-sm text-xs text-slate-400">{loadError}</div>
        <Button size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Try again
        </Button>
      </div>
    )
  }
  if (!problem || !parts) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="ide-pane-head flex items-center gap-1 px-2">
        {SECTIONS.filter((s) => (s.key === 'note' ? !!parts.note : s.key === 'examples' ? samples.length > 0 : true)).map((s) => (
          <button
            key={s.key}
            onClick={() => jump(s.key)}
            className={cx(
              'rounded-md px-2 py-1 text-[11.5px] font-semibold transition',
              active === s.key ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:text-slate-200'
            )}
          >
            {s.label}
          </button>
        ))}
        <div className="flex-1" />
        <button title="Read the problem aloud" onClick={() => void voice.command('read the problem')} className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200">
          <Volume2 className="size-3.5" />
        </button>
        <button title="Ask Arjun to explain (voice)" onClick={() => void voice.askArjun('explain')} className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200">
          <BookOpen className="size-3.5" />
        </button>
        <button title="Re-download statement and samples" onClick={onRetry} className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200">
          <RotateCw className="size-3.5" />
        </button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {facts && facts.chips.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Gauge className="size-3.5 text-cyan-300/80" />
            {facts.chips.map((c) => (
              <span key={c} className="rounded-md border border-cyan-400/15 bg-cyan-400/[0.06] px-2 py-0.5 font-mono text-[11px] text-cyan-100/85">
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowTags(!showTags)}
            className="flex items-center gap-1 rounded-md border border-white/[0.07] px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
            title="Tags hint at the technique — they're a spoiler"
          >
            {showTags ? <EyeOff className="size-3" /> : <Eye className="size-3" />} {showTags ? 'Hide tags' : 'Reveal tags'}
          </button>
          {showTags &&
            problem.tags.map((t) => (
              <span key={t} className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-200">
                {t}
              </span>
            ))}
        </div>

        <div className="statement" dangerouslySetInnerHTML={{ __html: parts.main }} />

        {samples.length > 0 && (
          <div data-sec="examples" className="statement mt-2">
            <div className="section-title">Examples</div>
            <div className="flex flex-col gap-2.5">
              {samples.map((t, i) => (
                <SampleCard key={t.id} n={i + 1} test={t} onRun={() => onRunTest(t.id)} />
              ))}
            </div>
          </div>
        )}

        {parts.note && <div data-sec="note" className="statement" dangerouslySetInnerHTML={{ __html: parts.note }} />}
      </div>

      <div className="border-t border-white/[0.06]">
        <button onClick={() => setShowNotes(!showNotes)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-[11.5px] font-semibold text-slate-400 hover:text-slate-200">
          <NotebookPen className="size-3.5" /> Scratchpad {notes.trim() && !showNotes && <span className="truncate font-normal text-slate-600">— {notes.trim().split('\n')[0]}</span>}
        </button>
        {showNotes && (
          <textarea
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Observations, small cases, the idea…"
            rows={6}
            className="block w-full resize-none border-t border-white/[0.05] bg-black/20 px-4 py-2.5 font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
        )}
      </div>
    </div>
  )
}
