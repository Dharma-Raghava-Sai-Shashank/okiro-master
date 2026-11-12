import { useEffect, useState } from 'react'
import { ArrowRight, Check, Cpu, Download } from 'lucide-react'
import type { PullProgress } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { Button, Flame, Glass, Spinner } from '../components/ui'
import { cx } from '../lib/format'

export function ModelSetup({ compact }: { compact?: boolean }) {
  const { llm, refreshLlm, settings } = useApp()
  const [starting, setStarting] = useState(false)
  const [pulls, setPulls] = useState<Record<string, PullProgress>>({})
  const [kb, setKb] = useState<{ done: number; total: number; error?: string } | null>(null)

  useEffect(() => {
    const offs = [
      api.on('llm:pull', (p) => {
        setPulls((s) => ({ ...s, [p.model]: p }))
        if (p.done) void refreshLlm()
      }),
      api.on('kb:progress', (p) => {
        setKb(p)
        if (p.done === p.total) void refreshLlm()
      })
    ]
    return () => offs.forEach((o) => o())
  }, [refreshLlm])

  if (!llm || !settings) return <Spinner />

  const row = (ok: boolean, title: string, detail: string, action?: React.ReactNode) => (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <div className={cx('grid size-6 place-items-center rounded-full', ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-slate-500')}>
        {ok ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-slate-100">{title}</div>
        <div className="text-[11.5px] text-slate-400">{detail}</div>
      </div>
      {action}
    </div>
  )

  const pullButton = (model: string) => {
    const p = pulls[model]
    if (p && !p.done) {
      const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0
      return <span className="text-xs tabular-nums text-blue-200">{p.total ? `${pct}%` : p.status}</span>
    }
    return (
      <Button size="sm" variant="primary" onClick={() => void api.llm.pull(model)}>
        <Download className="size-3.5" /> Download
      </Button>
    )
  }

  return (
    <div className={cx('flex flex-col', compact ? 'gap-2' : 'gap-2.5')}>
      {row(
        llm.ollamaInstalled,
        'Ollama installed',
        llm.ollamaInstalled ? 'Local model runtime found.' : 'Install it once: run  brew install ollama  in Terminal (or get it from ollama.com), then re-check.',
        !llm.ollamaInstalled && (
          <Button size="sm" onClick={() => void refreshLlm()}>
            Re-check
          </Button>
        )
      )}
      {row(
        llm.ollamaRunning,
        'Ollama running',
        llm.ollamaRunning ? 'Listening on 127.0.0.1 only.' : 'Okiro can start it for you.',
        llm.ollamaInstalled && !llm.ollamaRunning && (
          <Button
            size="sm"
            loading={starting}
            onClick={async () => {
              setStarting(true)
              await api.llm.start()
              await refreshLlm()
              setStarting(false)
            }}
          >
            Start
          </Button>
        )
      )}
      {row(
        llm.chatModelReady,
        `Arjun's brain · ${settings.ollamaModel}`,
        llm.chatModelReady ? 'Downloaded.' : 'About 13 GB. Runs fully on your Mac.',
        llm.ollamaRunning && !llm.chatModelReady && pullButton(settings.ollamaModel)
      )}
      {row(
        llm.embedModelReady,
        `Knowledge search · ${settings.embedModel}`,
        llm.embedModelReady ? 'Downloaded.' : 'About 300 MB. Lets Arjun search his technique notes.',
        llm.ollamaRunning && !llm.embedModelReady && pullButton(settings.embedModel)
      )}
      {row(
        llm.kbChunks > 0 && llm.kbEmbedded === llm.kbChunks,
        'Knowledge base indexed',
        kb?.error
          ? `Indexing failed: ${kb.error}`
          : kb && kb.done < kb.total
            ? `Indexing ${kb.done}/${kb.total} notes…`
            : `${llm.kbEmbedded}/${llm.kbChunks} notes embedded.`,
        llm.embedModelReady && (
          <Button size="sm" onClick={() => void api.llm.indexKb()}>
            {llm.kbEmbedded === llm.kbChunks && llm.kbChunks > 0 ? 'Re-index' : 'Index'}
          </Button>
        )
      )}
    </div>
  )
}

export function Onboarding() {
  const { updateSettings, settings } = useApp()
  const [step, setStep] = useState(0)
  const [handle, setHandle] = useState(settings?.handle ?? '')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  async function saveHandle() {
    setChecking(true)
    setError('')
    await updateSettings({ handle: handle.trim() })
    const user = await api.cf.user()
    setChecking(false)
    if (!user) {
      setError("Couldn't find that handle on Codeforces.")
      return
    }
    useApp.setState({ user })
    void useApp.getState().sync(false)
    setStep(1)
  }

  return (
    <div className="app-bg drag grid h-full place-items-center p-6">
      <Glass strong className="no-drag w-full max-w-xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
            <Flame className="size-7" />
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-tight text-slate-100">Okiro CF</div>
            <div className="text-xs text-slate-400">rise · solve · master</div>
          </div>
        </div>
        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-lg font-bold text-slate-100">What's your Codeforces handle?</div>
              <div className="mt-1 text-[13px] text-slate-400">
                Okiro pulls your solved problems so the roadmap knows where you are. The road: every problem rated ≤ 2000 in the last 300
                contests, until you hit Master.
              </div>
            </div>
            <input
              autoFocus
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handle.trim() && void saveHandle()}
              placeholder="tourist"
              className="rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-[15px] font-semibold text-slate-100 placeholder:text-slate-600 focus:border-blue-400/50 focus:outline-none"
            />
            {error && <div className="text-xs text-rose-300">{error}</div>}
            <Button variant="primary" disabled={!handle.trim()} loading={checking} onClick={() => void saveHandle()}>
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-slate-100">
                <Cpu className="size-5 text-blue-300" /> Set up Arjun, your local coach
              </div>
              <div className="mt-1 text-[13px] text-slate-400">
                Arjun runs on an open model (gpt-oss-20b) on your own Mac through Ollama. Nothing you type leaves the machine unless you switch a
                chat to Claude.
              </div>
            </div>
            <ModelSetup />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => void updateSettings({ onboarded: true })}>
                Skip for now
              </Button>
              <Button variant="primary" onClick={() => void updateSettings({ onboarded: true })}>
                Let's go <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Glass>
    </div>
  )
}
