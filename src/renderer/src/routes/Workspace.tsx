import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ArrowLeft, ArrowRight, ExternalLink, LogIn, RotateCw, Send } from 'lucide-react'
import { problemScope } from '@shared/api'
import type { ProblemDetail, ProblemRef, RunResponse, Roadmap, Submission, SubmitEvent, TestCase } from '@shared/types'
import { api } from '../lib/api'
import { useApp, useCoach } from '../lib/store'
import { renderStatementMath } from '../lib/math'
import { cx, timeAgo, VERDICT_LABEL } from '../lib/format'
import { Button, Glass, RatingPill, Spinner } from '../components/ui'
import { CodeEditor } from '../components/CodeEditor'
import { TestsPanel } from '../components/TestsPanel'
import { ChatPanel } from '../components/ChatPanel'

function Handle({ vertical }: { vertical?: boolean }) {
  return (
    <PanelResizeHandle className={cx('group relative flex items-center justify-center', vertical ? 'h-2.5' : 'w-2.5')}>
      <div className={cx('rounded-full bg-white/[0.06] transition group-hover:bg-blue-400/50', vertical ? 'h-1 w-10' : 'h-10 w-1')} />
    </PanelResizeHandle>
  )
}

function verdictTone(v?: string): string {
  if (!v || v === 'TESTING') return 'text-blue-200 border-blue-400/30 bg-blue-500/10'
  if (v === 'OK') return 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10'
  return 'text-rose-200 border-rose-400/30 bg-rose-500/10'
}

export function WorkspacePage() {
  const params = useParams()
  const nav = useNavigate()
  const ref = useMemo<ProblemRef>(() => ({ contestId: Number(params.contestId), index: String(params.index) }), [params.contestId, params.index])
  const scope = problemScope(ref)
  const { dataVersion } = useApp()

  const [problem, setProblem] = useState<ProblemDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [path, setPath] = useState('')
  const [initial, setInitial] = useState<string | null>(null)
  const [tests, setTests] = useState<TestCase[]>([])
  const [run, setRun] = useState<RunResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitEvent | null>(null)
  const [subs, setSubs] = useState<Submission[]>([])
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const code = useRef('')
  const saveTimer = useRef<number | null>(null)
  const lastRun = useRef<RunResponse | undefined>(undefined)

  const loadProblem = useCallback(
    async (refetch: boolean) => {
      setLoadError('')
      try {
        setProblem(await api.cf.problem(ref, refetch))
        setTests(await api.workspace.tests(ref))
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    },
    [ref]
  )

  useEffect(() => {
    setProblem(null)
    setInitial(null)
    setRun(null)
    setSubmitState(null)
    lastRun.current = undefined
    void (async () => {
      const [c, p] = await Promise.all([api.workspace.getCode(ref), api.workspace.filePath(ref)])
      code.current = c
      setPath(p)
      setInitial(c)
    })()
    void loadProblem(false)
  }, [ref, loadProblem])

  useEffect(() => {
    void api.cf.submissions(ref).then(setSubs)
    void api.cf.roadmap().then(setRoadmap)
  }, [ref, dataVersion])

  useEffect(
    () =>
      api.on('submit:event', (e) => {
        if (e.contestId !== ref.contestId || e.index !== ref.index) return
        setSubmitState(e)
        if (e.phase === 'done' && e.submission) {
          // Let Arjun react to the verdict right away.
          const verdict = e.submission.verdict
          const text =
            verdict === 'OK'
              ? 'I just got Accepted on Codeforces!'
              : `Codeforces verdict: ${VERDICT_LABEL[verdict] ?? verdict} on test ${e.submission.passedTests + 1}.`
          void useCoach.getState().send({
            scope,
            problem: ref,
            text,
            action: verdict === 'OK' ? 'chat' : 'why-wa',
            code: code.current,
            provider: useApp.getState().provider,
            lastRun: lastRun.current
          })
        }
      }),
    [ref, scope]
  )

  const onChange = useCallback(
    (c: string) => {
      code.current = c
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void api.workspace.saveCode(ref, c), 500)
    },
    [ref]
  )

  const runTests = useCallback(
    async (ids: number[] | null) => {
      setRunning(true)
      try {
        await api.workspace.saveCode(ref, code.current)
        const r = await api.workspace.run(ref, code.current, ids)
        if (ids && run) {
          // Merge single-test runs into the previous full run.
          const merged = new Map(run.results.map((x) => [x.testId, x]))
          for (const x of r.results) merged.set(x.testId, x)
          const next = { compileError: r.compileError, results: tests.map((t) => merged.get(t.id)).filter((x) => !!x) }
          setRun(next)
          lastRun.current = next
        } else {
          setRun(r)
          lastRun.current = r
        }
      } finally {
        setRunning(false)
      }
    },
    [ref, run, tests]
  )

  const submit = useCallback(async () => {
    await api.workspace.saveCode(ref, code.current)
    setSubmitState({ ...ref, phase: 'opening' })
    await api.workspace.submit(ref, code.current)
  }, [ref])

  const statementHtml = useMemo(() => (problem ? renderStatementMath(problem.statementHtml) : ''), [problem])
  const busySubmitting = submitState && !['done', 'error'].includes(submitState.phase)
  const solved = subs.some((s) => s.verdict === 'OK')
  const next = roadmap?.current
  const nextIsOther = next && (next.contest.id !== ref.contestId || next.problem.index !== ref.index)

  return (
    <div className="flex h-full flex-col gap-3 px-6 pb-6">
      <Glass className="flex items-center gap-3 px-4 py-2.5">
        <button onClick={() => nav(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200" title="Back">
          <ArrowLeft className="size-4" />
        </button>
        <div className="grid size-9 place-items-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-sm font-black text-blue-200">{ref.index}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-extrabold text-slate-100">{problem?.name ?? `${ref.contestId}${ref.index}`}</span>
            {problem && <RatingPill rating={problem.rating} />}
            {solved && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">SOLVED</span>}
          </div>
          {problem && (
            <div className="text-[11px] text-slate-500">
              {ref.contestId}
              {ref.index} · {problem.timeLimitMs / 1000}s · {problem.memoryMb} MB{problem.interactive ? ' · interactive' : ''}
            </div>
          )}
        </div>
        <div className="flex-1" />
        {subs[0] && (
          <span className={cx('rounded-lg border px-2 py-1 text-[11px] font-bold', verdictTone(subs[0].verdict))} title="Last Codeforces submission">
            {VERDICT_LABEL[subs[0].verdict] ?? subs[0].verdict}
            {subs[0].verdict !== 'OK' && subs[0].verdict !== 'TESTING' ? ` · test ${subs[0].passedTests + 1}` : ''} · {timeAgo(subs[0].createdAt)}
          </span>
        )}
        {submitState && (
          <span className={cx('max-w-[340px] truncate rounded-lg border px-2 py-1 text-[11px] font-bold', submitState.phase === 'error' ? verdictTone('WA') : verdictTone(submitState.submission?.verdict))}>
            {submitState.phase === 'opening' && 'Opening Codeforces…'}
            {submitState.phase === 'login-required' && 'Log in to Codeforces in the new window'}
            {submitState.phase === 'submitting' && 'Submitting…'}
            {submitState.phase === 'judging' && (submitState.message ?? 'Judging…')}
            {submitState.phase === 'done' && (VERDICT_LABEL[submitState.submission?.verdict ?? ''] ?? submitState.submission?.verdict)}
            {submitState.phase === 'error' && submitState.message}
          </span>
        )}
        {problem && (
          <Button size="sm" variant="ghost" onClick={() => void api.cf.openExternal(problem.url)} title="Open on Codeforces">
            <ExternalLink className="size-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => void api.cf.openLogin()} title="Log in to Codeforces (for submitting)">
          <LogIn className="size-3.5" />
        </Button>
        <Button size="sm" variant="primary" onClick={() => void submit()} disabled={!!busySubmitting || initial === null} loading={!!busySubmitting} title="Submit to Codeforces (⌘⇧↵)">
          {!busySubmitting && <Send className="size-3.5" />} Submit
        </Button>
        {solved && nextIsOther && (
          <Button size="sm" variant="success" onClick={() => nav(`/problem/${next.contest.id}/${next.problem.index}`)}>
            Next <ArrowRight className="size-3.5" />
          </Button>
        )}
      </Glass>

      <PanelGroup direction="horizontal" autoSaveId="okiro-workspace" className="min-h-0 flex-1">
        <Panel defaultSize={30} minSize={18}>
          <Glass className="h-full overflow-hidden">
            {loadError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="text-sm font-bold text-rose-200">Couldn't load the statement</div>
                <div className="text-xs text-slate-400">{loadError}</div>
                <Button size="sm" onClick={() => void loadProblem(true)}>
                  <RotateCw className="size-3.5" /> Try again
                </Button>
              </div>
            ) : !problem ? (
              <div className="grid h-full place-items-center">
                <Spinner />
              </div>
            ) : (
              <div className="h-full overflow-y-auto px-5 py-4">
                <div className="mb-2 flex justify-end">
                  <button onClick={() => void loadProblem(true)} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300" title="Re-download statement and samples">
                    <RotateCw className="size-3" /> Refresh
                  </button>
                </div>
                <div className="statement" dangerouslySetInnerHTML={{ __html: statementHtml }} />
              </div>
            )}
          </Glass>
        </Panel>
        <Handle />
        <Panel defaultSize={42} minSize={28}>
          <PanelGroup direction="vertical" autoSaveId="okiro-editor">
            <Panel defaultSize={64} minSize={25}>
              <Glass className="h-full overflow-hidden">
                {initial === null || !path ? (
                  <div className="grid h-full place-items-center">
                    <Spinner />
                  </div>
                ) : (
                  <CodeEditor path={path} initial={initial} onChange={onChange} onRun={() => void runTests(null)} onSubmit={() => void submit()} />
                )}
              </Glass>
            </Panel>
            <Handle vertical />
            <Panel defaultSize={36} minSize={15}>
              <Glass className="h-full overflow-hidden">
                <TestsPanel
                  tests={tests}
                  run={run}
                  running={running}
                  onRunAll={() => void runTests(null)}
                  onRunOne={(id) => void runTests([id])}
                  onAdd={async () => {
                    await api.workspace.addTest(ref, '', '')
                    setTests(await api.workspace.tests(ref))
                  }}
                  onSave={async (id, input, expected) => {
                    await api.workspace.updateTest(id, input, expected)
                    setTests(await api.workspace.tests(ref))
                  }}
                  onDelete={async (id) => {
                    await api.workspace.deleteTest(id)
                    setTests(await api.workspace.tests(ref))
                  }}
                />
              </Glass>
            </Panel>
          </PanelGroup>
        </Panel>
        <Handle />
        <Panel defaultSize={28} minSize={20}>
          <Glass className="h-full overflow-hidden">
            <ChatPanel key={scope} scope={scope} problem={ref} getCode={() => code.current} getLastRun={() => lastRun.current} />
          </Glass>
        </Panel>
      </PanelGroup>
    </div>
  )
}
