import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { ArrowLeft, ArrowRight, Clock, ExternalLink, LogIn, PanelLeftClose, PanelLeftOpen, Play, Send } from 'lucide-react'
import { problemScope } from '@shared/api'
import type { ProblemDetail, ProblemRef, ProblemWork, Roadmap, RunResponse, StressRecord, Submission, SubmitEvent, TestCase } from '@shared/types'
import { api } from '../lib/api'
import { useApp, useCoach } from '../lib/store'
import { cx, timeAgo, VERDICT_LABEL } from '../lib/format'
import { Button, RatingPill } from '../components/ui'
import { ProblemPane } from '../components/workspace/ProblemPane'
import { EditorPane } from '../components/workspace/EditorPane'
import { RunPane } from '../components/workspace/RunPane'
import type { EditorApi } from '../components/CodeEditor'
import { useBridge } from '../voice/bridge'
import { voice } from '../voice/engine'

function Handle() {
  return (
    <PanelResizeHandle className="group relative w-px bg-white/[0.07] transition hover:bg-cyan-400/50 data-[resize-handle-state=drag]:bg-cyan-400/70">
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </PanelResizeHandle>
  )
}

function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
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
  const [notes, setNotes] = useState('')
  const [activeMs, setActiveMs] = useState(0)
  const [tests, setTests] = useState<TestCase[]>([])
  const [run, setRun] = useState<RunResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [compileInfo, setCompileInfo] = useState('')
  const [submitState, setSubmitState] = useState<SubmitEvent | null>(null)
  const [subs, setSubs] = useState<Submission[]>([])
  const [stress, setStress] = useState<StressRecord | null>(null)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [focus, setFocus] = useState(false)
  const code = useRef('')
  const saveTimer = useRef<number | null>(null)
  const notesTimer = useRef<number | null>(null)
  const lastRun = useRef<RunResponse | undefined>(undefined)
  const testsRef = useRef<TestCase[]>([])
  const editorApi = useRef<EditorApi | null>(null)
  const problemPanel = useRef<ImperativePanelHandle>(null)
  testsRef.current = tests

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
    setStress(null)
    setCompileInfo('')
    lastRun.current = undefined
    void (async () => {
      const [w, p] = await Promise.all([api.workspace.work(ref), api.workspace.filePath(ref)])
      const work: ProblemWork = w
      code.current = work.code
      setPath(p)
      setNotes(work.notes)
      setActiveMs(work.activeMs)
      setInitial(work.code)
    })()
    void loadProblem(false)
    void api.workspace.lastStress(ref).then(setStress)
  }, [ref, loadProblem])

  useEffect(() => {
    void api.cf.submissions(ref).then(setSubs)
    void api.cf.roadmap().then(setRoadmap)
  }, [ref, dataVersion])

  // Problem timer: counts time while the app window is focused and visible.
  useEffect(() => {
    let pending = 0
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return
      pending += 1000
      setActiveMs((m) => m + 1000)
      if (pending >= 15_000) {
        void api.workspace.addActiveTime(ref, pending)
        pending = 0
      }
    }, 1000)
    return () => {
      window.clearInterval(tick)
      if (pending) void api.workspace.addActiveTime(ref, pending)
    }
  }, [ref])

  const runTests = useCallback(
    async (ids: number[] | null): Promise<RunResponse> => {
      setRunning(true)
      const t0 = performance.now()
      try {
        await api.workspace.saveCode(ref, code.current)
        const r = await api.workspace.run(ref, code.current, ids)
        let next = r
        if (ids && lastRun.current && !r.compileError) {
          // Merge single-test runs into the previous full run.
          const merged = new Map(lastRun.current.results.map((x) => [x.testId, x]))
          for (const x of r.results) merged.set(x.testId, x)
          next = { results: testsRef.current.map((t) => merged.get(t.id)).filter((x) => !!x) }
        }
        setRun(next)
        lastRun.current = next
        setCompileInfo(r.compileError ? '' : `Built & ran in ${Math.round(performance.now() - t0)} ms`)
        return next
      } finally {
        setRunning(false)
      }
    },
    [ref]
  )

  const submit = useCallback(async () => {
    await api.workspace.saveCode(ref, code.current)
    setSubmitState({ ...ref, phase: 'opening' })
    await api.workspace.submit(ref, code.current)
  }, [ref])

  const toggleFocus = useCallback((on?: boolean) => {
    setFocus((f) => {
      const next = on ?? !f
      if (next) problemPanel.current?.collapse()
      else problemPanel.current?.expand()
      return next
    })
  }, [])

  // Expose this workspace to voice commands and Arjun's app_action tool.
  useEffect(() => {
    useBridge.getState().register({
      ref,
      problem,
      tests: () => testsRef.current,
      getCode: () => code.current,
      lastRun: () => lastRun.current,
      runTests,
      submit,
      toggleFocus
    })
    return () => useBridge.getState().register(null)
  }, [ref, problem, runTests, submit, toggleFocus])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '.') {
        e.preventDefault()
        toggleFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFocus])

  useEffect(
    () =>
      api.on('submit:event', (e) => {
        if (e.contestId !== ref.contestId || e.index !== ref.index) return
        setSubmitState(e)
        if (e.phase === 'done' && e.submission) {
          void api.cf.submissions(ref).then(setSubs)
          const verdict = e.submission.verdict
          const text =
            verdict === 'OK'
              ? 'I just got Accepted on Codeforces!'
              : `Codeforces verdict: ${VERDICT_LABEL[verdict] ?? verdict} on test ${e.submission.passedTests + 1}.`
          // Arjun reacts to the verdict: out loud when a voice conversation is on, else in the transcript.
          if (voice.active) void voice.askArjun(verdict === 'OK' ? 'chat' : 'why-wa', text)
          else
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

  // Stress counterexamples come from Arjun's tool calls; refresh when a turn on this problem ends.
  useEffect(
    () =>
      api.on('coach:event', (e) => {
        if (e.scope === scope && e.type === 'tool-end' && e.name === 'stress_test') void api.workspace.lastStress(ref).then(setStress)
      }),
    [ref, scope]
  )

  const onChange = useCallback(
    (c: string) => {
      code.current = c
      setSaving(true)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void api.workspace.saveCode(ref, c).then(() => setSaving(false)), 500)
    },
    [ref]
  )

  const onNotes = (n: string) => {
    setNotes(n)
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    notesTimer.current = window.setTimeout(() => void api.workspace.saveNotes(ref, n), 500)
  }

  const refreshTests = async () => setTests(await api.workspace.tests(ref))
  const busySubmitting = !!submitState && !['done', 'error'].includes(submitState.phase)
  const solved = subs.some((s) => s.verdict === 'OK')
  const next = roadmap?.current
  const nextIsOther = next && (next.contest.id !== ref.contestId || next.problem.index !== ref.index)
  const last = subs[0]

  return (
    <div className="flex h-full flex-col px-4 pb-20">
      <div className="ide-frame flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-3">
          <button onClick={() => nav(-1)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200" title="Back">
            <ArrowLeft className="size-4" />
          </button>
          <div className="grid size-7 place-items-center rounded-lg border border-blue-400/25 bg-blue-500/10 text-[12px] font-black text-blue-200">{ref.index}</div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-extrabold text-slate-100">{problem?.name ?? `${ref.contestId}${ref.index}`}</span>
            {problem && <RatingPill rating={problem.rating} />}
            {problem && (
              <span className="hidden shrink-0 text-[11px] text-slate-500 xl:inline">
                {ref.contestId}
                {ref.index} · {problem.timeLimitMs / 1000}s · {problem.memoryMb} MB{problem.interactive ? ' · interactive' : ''}
              </span>
            )}
            {solved && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">SOLVED</span>}
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] tabular-nums text-slate-400" title="Time spent on this problem">
            <Clock className="size-3" /> {fmtClock(activeMs)}
          </span>
          <div className="flex-1" />
          {last && (
            <span className={cx('hidden max-w-[260px] truncate rounded-md border px-2 py-0.5 text-[11px] font-bold lg:inline', verdictTone(last.verdict))} title="Last Codeforces submission">
              {VERDICT_LABEL[last.verdict] ?? last.verdict}
              {last.verdict !== 'OK' && last.verdict !== 'TESTING' ? ` · test ${last.passedTests + 1}` : ''} · {timeAgo(last.createdAt)}
            </span>
          )}
          <button onClick={() => toggleFocus()} title="Focus mode (⌘.)" className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">
            {focus ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
          {problem && (
            <button onClick={() => void api.cf.openExternal(problem.url)} title="Open on Codeforces" className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">
              <ExternalLink className="size-4" />
            </button>
          )}
          <button onClick={() => void api.cf.openLogin()} title="Log in to Codeforces (for submitting)" className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">
            <LogIn className="size-4" />
          </button>
          <Button size="sm" variant="soft" onClick={() => void runTests(null)} loading={running} disabled={initial === null} title="Run all tests (⌘↵)">
            {!running && <Play className="size-3.5" />} Run
          </Button>
          <Button size="sm" variant="primary" onClick={() => void submit()} disabled={busySubmitting || initial === null} loading={busySubmitting} title="Submit to Codeforces (⌘⇧↵)">
            {!busySubmitting && <Send className="size-3.5" />} Submit
          </Button>
          {solved && nextIsOther && (
            <Button size="sm" variant="success" onClick={() => nav(`/problem/${next.contest.id}/${next.problem.index}`)}>
              Next <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>

        <PanelGroup direction="horizontal" autoSaveId="okiro-ide" className="min-h-0 flex-1">
          <Panel ref={problemPanel} defaultSize={34} minSize={20} collapsible collapsedSize={0} onCollapse={() => setFocus(true)} onExpand={() => setFocus(false)}>
            <ProblemPane
              problem={problem}
              loadError={loadError}
              tests={tests}
              notes={notes}
              onNotes={onNotes}
              onRetry={() => void loadProblem(true)}
              onRunTest={(id) => void runTests([id])}
            />
          </Panel>
          <Handle />
          <Panel defaultSize={42} minSize={28}>
            <EditorPane
              fileName={`${ref.contestId}${ref.index}.cpp`}
              path={path}
              initial={initial}
              diagnostics={run?.diagnostics}
              saving={saving}
              compileInfo={compileInfo}
              onChange={onChange}
              onRun={() => void runTests(null)}
              onSubmit={() => void submit()}
              onApi={(a) => {
                editorApi.current = a
              }}
            />
          </Panel>
          <Handle />
          <Panel defaultSize={24} minSize={18}>
            <RunPane
              tests={tests}
              run={run}
              running={running}
              limitMs={problem?.timeLimitMs ?? 2000}
              subs={subs}
              submitState={submitState}
              stress={stress}
              onRunAll={() => void runTests(null)}
              onRunOne={(id) => void runTests([id])}
              onAdd={async (input = '', expected = '') => {
                await api.workspace.addTest(ref, input, expected)
                await refreshTests()
              }}
              onSave={async (id, input, expected) => {
                await api.workspace.updateTest(id, input, expected)
                await refreshTests()
              }}
              onDelete={async (id) => {
                await api.workspace.deleteTest(id)
                await refreshTests()
              }}
              onRunCustom={async (input) => {
                await api.workspace.saveCode(ref, code.current)
                return api.workspace.runCustom(ref, code.current, input)
              }}
              onAddStress={async () => {
                await api.workspace.addTestFromStress(ref)
                await refreshTests()
              }}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
