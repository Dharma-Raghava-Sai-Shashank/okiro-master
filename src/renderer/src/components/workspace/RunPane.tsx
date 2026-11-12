import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ClipboardPaste, Copy, FlaskConical, History, Play, Plus, Save, TerminalSquare, Trash2, Wand2 } from 'lucide-react'
import type { CustomRunResult, RunResponse, StressRecord, Submission, SubmitEvent, TestCase, TestResult, Verdict } from '@shared/types'
import { diffOutputs, type DiffLine } from '../../lib/diff'
import { cx, timeAgo, VERDICT_LABEL } from '../../lib/format'
import { Button, Spinner } from '../ui'

type Tab = 'tests' | 'custom' | 'submissions' | 'stress'

const STRIP: Record<Verdict, string> = {
  AC: 'bg-emerald-400',
  WA: 'bg-rose-400',
  TLE: 'bg-amber-400',
  RE: 'bg-orange-400',
  CE: 'bg-rose-400',
  SKIP: 'bg-slate-500'
}
const BADGE: Record<Verdict, string> = {
  AC: 'text-emerald-300 bg-emerald-500/12 border-emerald-400/25',
  WA: 'text-rose-300 bg-rose-500/12 border-rose-400/25',
  TLE: 'text-amber-300 bg-amber-500/12 border-amber-400/25',
  RE: 'text-orange-300 bg-orange-500/12 border-orange-400/25',
  CE: 'text-rose-300 bg-rose-500/12 border-rose-400/25',
  SKIP: 'text-slate-300 bg-slate-500/12 border-slate-400/25'
}

function Lines({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\n$/, '').split('\n')
  return (
    <pre className={cx('max-h-56 overflow-auto rounded-lg border border-white/[0.06] bg-black/35 py-1.5 font-mono text-[12px] leading-[1.55]', className)}>
      {lines.map((l, i) => (
        <div key={i} className="flex">
          <span className="w-8 shrink-0 select-none pr-2 text-right text-slate-600">{i + 1}</span>
          <span className="whitespace-pre-wrap pr-2 text-slate-200">{l || ' '}</span>
        </div>
      ))}
    </pre>
  )
}

function Tokens({ line, bad, tone }: { line: string; bad: number; tone: 'exp' | 'got' }) {
  let k = -1
  return (
    <>
      {line.split(/(\s+)/).map((part, i) => {
        if (!part.trim()) return <span key={i}>{part}</span>
        k++
        const hit = k === bad
        return (
          <span key={i} className={hit ? (tone === 'got' ? 'rounded bg-rose-500/35 px-0.5 text-rose-50' : 'rounded bg-emerald-500/25 px-0.5 text-emerald-50') : undefined}>
            {part}
          </span>
        )
      })}
    </>
  )
}

function DiffView({ expected, got }: { expected: string; got: string }) {
  const lines = useMemo(() => diffOutputs(expected, got), [expected, got])
  const row = (l: DiffLine, side: 'exp' | 'got') => {
    const text = side === 'exp' ? l.expected : l.got
    const bg =
      l.status === 'same' ? '' : l.status === 'diff' ? (side === 'got' ? 'bg-rose-500/[0.09]' : 'bg-emerald-500/[0.06]') : text === null ? 'bg-white/[0.02]' : 'bg-rose-500/[0.09]'
    return (
      <div key={`${side}${l.n}`} className={cx('flex', bg)}>
        <span className="w-7 shrink-0 select-none pr-2 text-right text-slate-600">{text === null ? '' : l.n}</span>
        <span className="whitespace-pre-wrap pr-2">{text === null ? <span className="text-slate-600">·</span> : l.status === 'diff' ? <Tokens line={text} bad={l.firstBadToken} tone={side} /> : text || ' '}</span>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['exp', 'got'] as const).map((side) => (
        <div key={side} className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{side === 'exp' ? 'Expected' : 'Your output'}</div>
          <pre className="max-h-56 overflow-auto rounded-lg border border-white/[0.06] bg-black/35 py-1.5 font-mono text-[12px] leading-[1.55] text-slate-200">
            {lines.map((l) => row(l, side))}
            {lines.length === 0 && <div className="px-3 text-slate-600">(empty)</div>}
          </pre>
        </div>
      ))}
    </div>
  )
}

function TestCard({
  n,
  test,
  result,
  limitMs,
  running,
  onRun,
  onSave,
  onDelete
}: {
  n: number
  test: TestCase
  result?: TestResult
  limitMs: number
  running: boolean
  onRun: () => void
  onSave: (input: string, expected: string) => void
  onDelete: () => void
}) {
  const failing = !!result && result.verdict !== 'AC'
  const [open, setOpen] = useState(failing)
  const [input, setInput] = useState(test.input)
  const [expected, setExpected] = useState(test.expected)
  useEffect(() => {
    if (failing) setOpen(true)
  }, [failing, result])
  const dirty = input !== test.input || expected !== test.expected
  const pct = result ? Math.min(100, (result.timeMs / limitMs) * 100) : 0
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div className={cx('absolute inset-y-0 left-0 w-[3px]', result ? STRIP[result.verdict] : 'bg-white/10')} />
      <div className="flex items-center gap-2 py-1.5 pl-3.5 pr-2">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className={cx('size-3.5 shrink-0 text-slate-500 transition', !open && '-rotate-90')} />
          <span className="text-[12px] font-bold text-slate-200">
            {test.isSample ? 'Example' : 'Test'} {n}
          </span>
          {result && <span className={cx('rounded-md border px-1.5 py-px text-[10px] font-black', BADGE[result.verdict])}>{result.verdict}</span>}
          {result && (
            <span className="flex items-center gap-1.5 text-[10.5px] tabular-nums text-slate-500">
              {result.timeMs} ms
              <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.07]">
                <span className={cx('block h-full rounded-full', pct > 80 ? 'bg-amber-400' : 'bg-cyan-400/70')} style={{ width: `${pct}%` }} />
              </span>
            </span>
          )}
        </button>
        <button title="Run this test" onClick={onRun} disabled={running} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-emerald-200 disabled:opacity-40">
          <Play className="size-3.5" />
        </button>
        <button title="Copy input" onClick={() => void navigator.clipboard.writeText(test.input)} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200">
          <Copy className="size-3.5" />
        </button>
        <button title="Delete test" onClick={onDelete} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-rose-300">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {result?.message && result.verdict !== 'AC' && !open && <div className="truncate px-3.5 pb-1.5 text-[11px] text-slate-500">{result.message}</div>}
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-white/[0.05] px-3.5 py-2.5">
          {result?.message && result.verdict !== 'AC' && (
            <div className="flex items-start gap-1.5 text-[11.5px] text-rose-200/90">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {result.message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['Input', input, setInput],
                ['Expected', expected, setExpected]
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="flex min-w-0 flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
                <textarea
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  spellCheck={false}
                  rows={Math.min(8, Math.max(2, value.split('\n').length))}
                  className="resize-y rounded-lg border border-white/[0.06] bg-black/35 p-2 font-mono text-[12px] text-slate-200 focus:border-cyan-400/40 focus:outline-none"
                />
              </label>
            ))}
          </div>
          {dirty && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => onSave(input, expected)}>
                <Save className="size-3.5" /> Save test
              </Button>
            </div>
          )}
          {result && result.verdict !== 'CE' && (
            <>
              {result.expected.trim() ? <DiffView expected={result.expected} got={result.output} /> : <Lines text={result.output} />}
              {!test.isSample && result.verdict !== 'AC' && result.output.trim() && (
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => onSave(input, result.output)}>
                    Use this output as expected
                  </Button>
                </div>
              )}
              {result.stderr && (
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Stderr</div>
                  <Lines text={result.stderr} className="text-amber-100" />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export interface RunPaneProps {
  tests: TestCase[]
  run: RunResponse | null
  running: boolean
  limitMs: number
  subs: Submission[]
  submitState: SubmitEvent | null
  stress: StressRecord | null
  onRunAll: () => void
  onRunOne: (id: number) => void
  onAdd: (input?: string, expected?: string) => void
  onSave: (id: number, input: string, expected: string) => void
  onDelete: (id: number) => void
  onRunCustom: (input: string) => Promise<CustomRunResult>
  onAddStress: () => void
}

export function RunPane(p: RunPaneProps) {
  const [tab, setTab] = useState<Tab>('tests')
  const [stdin, setStdin] = useState('')
  const [custom, setCustom] = useState<CustomRunResult | null>(null)
  const [customRunning, setCustomRunning] = useState(false)
  const results = new Map(p.run?.results.map((r) => [r.testId, r]))
  const total = p.run?.results.length ?? 0
  const passed = p.run?.results.filter((r) => r.verdict === 'AC').length ?? 0
  const maxMs = Math.max(0, ...(p.run?.results.map((r) => r.timeMs) ?? [0]))

  useEffect(() => {
    if (p.submitState && p.submitState.phase !== 'done') setTab('submissions')
  }, [p.submitState])

  const TABS: { key: Tab; label: string; icon: typeof Play; badge?: string }[] = [
    { key: 'tests', label: 'Tests', icon: FlaskConical, badge: p.run && !p.run.compileError ? `${passed}/${total}` : undefined },
    { key: 'custom', label: 'Custom', icon: TerminalSquare },
    { key: 'submissions', label: 'Submits', icon: History, badge: p.subs.length ? String(p.subs.length) : undefined },
    { key: 'stress', label: 'Stress', icon: Wand2, badge: p.stress ? '1' : undefined }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="ide-pane-head flex items-center gap-0.5 px-1.5">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cx(
              'flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold transition',
              tab === key ? 'bg-white/[0.08] text-slate-100' : 'text-slate-500 hover:text-slate-200'
            )}
          >
            <Icon className="size-3.5" /> {label}
            {badge && <span className="rounded bg-white/[0.08] px-1 text-[9.5px] tabular-nums">{badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'tests' && (
        <>
          <div className="flex items-center gap-3 border-b border-white/[0.05] px-3 py-2.5">
            {p.run && !p.run.compileError && total > 0 ? (
              <div className="flex items-center gap-2.5">
                <div className={cx('grid size-10 place-items-center rounded-full border-2 text-[11px] font-black tabular-nums', passed === total ? 'border-emerald-400/70 text-emerald-200' : 'border-rose-400/70 text-rose-200')}>
                  {passed}/{total}
                </div>
                <div>
                  <div className={cx('text-[12.5px] font-bold', passed === total ? 'text-emerald-200' : 'text-rose-200')}>{passed === total ? 'All passing' : `${total - passed} failing`}</div>
                  <div className="text-[10.5px] tabular-nums text-slate-500">
                    max {maxMs} ms / {p.limitMs} ms
                  </div>
                </div>
              </div>
            ) : p.run?.compileError ? (
              <div className="text-[12.5px] font-bold text-rose-200">Compilation error</div>
            ) : (
              <div className="text-[12px] text-slate-500">{p.tests.length} test{p.tests.length === 1 ? '' : 's'} · not run yet</div>
            )}
            <div className="flex-1" />
            <Button size="sm" onClick={p.onRunAll} loading={p.running} variant="primary" title="Run all (⌘↵)">
              {!p.running && <Play className="size-3.5" />} Run all
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
            {p.run?.compileError && (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-rose-400/25 bg-rose-500/[0.07] p-2.5 font-mono text-[11.5px] text-rose-100">{p.run.compileError}</pre>
            )}
            {p.tests.map((t, i) => (
              <TestCard
                key={`${t.id}-${t.input.length}-${t.expected.length}`}
                n={i + 1}
                test={t}
                result={results.get(t.id)}
                limitMs={p.limitMs}
                running={p.running}
                onRun={() => p.onRunOne(t.id)}
                onSave={(input, expected) => p.onSave(t.id, input, expected)}
                onDelete={() => p.onDelete(t.id)}
              />
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => p.onAdd()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.1] py-2 text-[12px] font-semibold text-slate-500 hover:border-cyan-400/40 hover:text-cyan-200"
              >
                <Plus className="size-3.5" /> Add test
              </button>
              <button
                onClick={async () => p.onAdd(await navigator.clipboard.readText().catch(() => ''), '')}
                title="New test with the clipboard as input"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.1] px-3 py-2 text-[12px] font-semibold text-slate-500 hover:border-cyan-400/40 hover:text-cyan-200"
              >
                <ClipboardPaste className="size-3.5" /> From clipboard
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'custom' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">stdin</div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            spellCheck={false}
            rows={7}
            placeholder="Type any input and run your code on it"
            className="resize-y rounded-lg border border-white/[0.06] bg-black/35 p-2 font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={customRunning}
              onClick={async () => {
                setCustomRunning(true)
                try {
                  setCustom(await p.onRunCustom(stdin))
                } finally {
                  setCustomRunning(false)
                }
              }}
            >
              {!customRunning && <Play className="size-3.5" />} Run
            </Button>
            {custom && !custom.compileError && (
              <Button size="sm" onClick={() => p.onAdd(stdin, custom.stdout)}>
                <Plus className="size-3.5" /> Save as test
              </Button>
            )}
          </div>
          {custom && (
            <>
              {custom.compileError ? (
                <pre className="whitespace-pre-wrap rounded-lg border border-rose-400/25 bg-rose-500/[0.07] p-2.5 font-mono text-[11.5px] text-rose-100">{custom.compileError}</pre>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
                    <span className="font-bold uppercase tracking-wider">stdout</span>
                    <span className="tabular-nums">
                      {custom.timedOut ? 'timed out' : `${custom.timeMs} ms · exit ${custom.exitCode}`}
                    </span>
                  </div>
                  <Lines text={custom.stdout || ' '} />
                  {custom.stderr && <Lines text={custom.stderr} className="text-amber-100" />}
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'submissions' && (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
          {p.submitState && p.submitState.phase !== 'done' && (
            <div className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px]', p.submitState.phase === 'error' ? 'border-rose-400/25 bg-rose-500/10 text-rose-200' : 'border-blue-400/25 bg-blue-500/10 text-blue-100')}>
              {p.submitState.phase !== 'error' && <Spinner className="size-3.5" />}
              {p.submitState.phase === 'opening' && 'Opening Codeforces…'}
              {p.submitState.phase === 'login-required' && 'Log in to Codeforces in the window that opened'}
              {p.submitState.phase === 'submitting' && 'Submitting…'}
              {p.submitState.phase === 'judging' && (p.submitState.message ?? 'Judging…')}
              {p.submitState.phase === 'error' && p.submitState.message}
            </div>
          )}
          {p.subs.length === 0 && <div className="py-8 text-center text-xs text-slate-500">No Codeforces submissions for this problem yet.</div>}
          {p.subs.map((s) => {
            const ok = s.verdict === 'OK'
            const testing = s.verdict === 'TESTING'
            return (
              <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <span className={cx('size-2 shrink-0 rounded-full', ok ? 'bg-emerald-400' : testing ? 'blink-dot bg-blue-400' : 'bg-rose-400')} />
                <div className="min-w-0 flex-1">
                  <div className={cx('truncate text-[12.5px] font-semibold', ok ? 'text-emerald-200' : testing ? 'text-blue-200' : 'text-rose-200')}>
                    {VERDICT_LABEL[s.verdict] ?? s.verdict}
                    {!ok && !testing ? ` on test ${s.passedTests + 1}` : ''}
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    #{s.id} · {timeAgo(s.createdAt)}
                    {s.fromApp ? ' · from Okiro' : ''}
                  </div>
                </div>
                <span className="text-[10.5px] tabular-nums text-slate-500">{s.timeMs} ms</span>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'stress' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
          {!p.stress ? (
            <div className="m-auto max-w-[260px] text-center text-xs leading-relaxed text-slate-500">
              No counterexample yet. Say “why is this failing?” — Arjun can write a brute force and a random generator, and stress-test your code to find a small failing input.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={cx('rounded-md border px-1.5 py-px text-[10px] font-black', BADGE[(p.stress.verdict as Verdict) in BADGE ? (p.stress.verdict as Verdict) : 'WA'])}>{p.stress.verdict}</span>
                <span className="text-[11px] text-slate-500">
                  found after {p.stress.iterations} random tests · {timeAgo(p.stress.at)}
                </span>
                <div className="flex-1" />
                <Button size="sm" variant="primary" onClick={p.onAddStress}>
                  <Plus className="size-3.5" /> Add as test
                </Button>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Failing input</div>
              <Lines text={p.stress.input} />
              <DiffView expected={p.stress.expected} got={p.stress.got} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
