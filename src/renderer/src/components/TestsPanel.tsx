import { useState } from 'react'
import { ChevronDown, Play, Plus, Trash2 } from 'lucide-react'
import type { RunResponse, TestCase, TestResult, Verdict } from '@shared/types'
import { cx } from '../lib/format'
import { Button } from './ui'

const VERDICT_STYLE: Record<Verdict, string> = {
  AC: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  WA: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  TLE: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  RE: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
  CE: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  SKIP: 'bg-slate-500/15 text-slate-300 border-slate-400/30'
}

function Field({
  label,
  value,
  onChange,
  tone
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  tone?: 'bad' | 'good'
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      {onChange ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          rows={Math.min(8, Math.max(2, value.split('\n').length))}
          className="resize-y rounded-lg border border-white/[0.07] bg-black/40 p-2 font-mono text-[12px] text-slate-200 focus:border-blue-400/40 focus:outline-none"
        />
      ) : (
        <pre
          className={cx(
            'max-h-48 min-h-[44px] overflow-auto whitespace-pre-wrap rounded-lg border bg-black/40 p-2 font-mono text-[12px]',
            tone === 'bad' ? 'border-rose-400/25 text-rose-100' : tone === 'good' ? 'border-emerald-400/20 text-slate-200' : 'border-white/[0.07] text-slate-200'
          )}
        >
          {value || ' '}
        </pre>
      )}
    </div>
  )
}

function TestRow({
  n,
  test,
  result,
  running,
  onRun,
  onSave,
  onDelete
}: {
  n: number
  test: TestCase
  result?: TestResult
  running: boolean
  onRun: () => void
  onSave: (input: string, expected: string) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(result ? result.verdict !== 'AC' : false)
  const [input, setInput] = useState(test.input)
  const [expected, setExpected] = useState(test.expected)
  const dirty = input !== test.input || expected !== test.expected
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left">
          <ChevronDown className={cx('size-3.5 text-slate-500 transition', !open && '-rotate-90')} />
          <span className="text-[12px] font-bold text-slate-300">
            {test.isSample ? 'Sample' : 'Test'} {n}
          </span>
          {result && (
            <span className={cx('rounded-md border px-1.5 py-px text-[10px] font-black', VERDICT_STYLE[result.verdict])}>{result.verdict}</span>
          )}
          {result && <span className="text-[10.5px] tabular-nums text-slate-500">{result.timeMs} ms</span>}
          {result?.message && result.verdict !== 'AC' && <span className="truncate text-[10.5px] text-slate-500">{result.message}</span>}
        </button>
        <button title="Run this test" onClick={onRun} disabled={running} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200">
          <Play className="size-3.5" />
        </button>
        <button title="Delete test" onClick={onDelete} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-rose-300">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 border-t border-white/[0.05] p-2.5">
          <div className="flex gap-2">
            <Field label="Input" value={input} onChange={setInput} />
            <Field label="Expected" value={expected} onChange={setExpected} />
          </div>
          {dirty && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => onSave(input, expected)}>
                Save test
              </Button>
            </div>
          )}
          {result && (
            <div className="flex gap-2">
              <Field label="Your output" value={result.output} tone={result.verdict === 'AC' ? 'good' : 'bad'} />
              {result.stderr && <Field label="Stderr" value={result.stderr} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TestsPanel({
  tests,
  run,
  running,
  onRunAll,
  onRunOne,
  onAdd,
  onSave,
  onDelete
}: {
  tests: TestCase[]
  run: RunResponse | null
  running: boolean
  onRunAll: () => void
  onRunOne: (id: number) => void
  onAdd: () => void
  onSave: (id: number, input: string, expected: string) => void
  onDelete: (id: number) => void
}) {
  const results = new Map(run?.results.map((r) => [r.testId, r]))
  const passed = run?.results.filter((r) => r.verdict === 'AC').length ?? 0
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="text-[12px] font-extrabold text-slate-200">Tests</span>
        {run && !run.compileError && (
          <span className={cx('text-[11px] font-bold tabular-nums', passed === run.results.length ? 'text-emerald-300' : 'text-rose-300')}>
            {passed}/{run.results.length} passed
          </span>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onAdd}>
          <Plus className="size-3.5" /> Add
        </Button>
        <Button size="sm" onClick={onRunAll} loading={running} title="Run all tests (⌘↵)">
          {!running && <Play className="size-3.5" />} Run all
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
        {run?.compileError && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-rose-400/25 bg-rose-500/[0.08] p-2.5 font-mono text-[11.5px] text-rose-100">
            {run.compileError}
          </pre>
        )}
        {tests.length === 0 && <div className="py-6 text-center text-xs text-slate-500">No tests yet — samples load with the statement.</div>}
        {tests.map((t, i) => (
          <TestRow
            key={`${t.id}-${t.input.length}-${t.expected.length}`}
            n={i + 1}
            test={t}
            result={results.get(t.id)}
            running={running}
            onRun={() => onRunOne(t.id)}
            onSave={(input, expected) => onSave(t.id, input, expected)}
            onDelete={() => onDelete(t.id)}
          />
        ))}
      </div>
    </div>
  )
}
