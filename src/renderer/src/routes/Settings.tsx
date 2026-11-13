import { useEffect, useState, type ReactNode } from 'react'
import { KeyRound, LogIn, Volume2, Wrench, Brain, AlertTriangle, Download } from 'lucide-react'
import { CONTEST_TYPE_LABELS, SPOILER_LEVELS, STT_MODELS, TTS_VOICES, type ContestType, type Settings } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { cx } from '../lib/format'
import { Button, Chip, Glass, Label } from '../components/ui'
import { ModelSetup } from './Onboarding'
import { voice } from '../voice/engine'
import { useVoice } from '../voice/store'

function Section({ title, children, hint }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Glass className="p-6">
      <div className="mb-4">
        <div className="text-[15px] font-extrabold text-slate-100">{title}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Glass>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-56 shrink-0">
        <div className="text-[13px] font-semibold text-slate-200">{label}</div>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const input =
  'rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-blue-400/40 focus:outline-none'

/** Text field that saves on blur/Enter instead of on every keystroke. */
function Field<K extends keyof Settings>({ k, type = 'text', width = 'w-64', placeholder }: { k: K; type?: string; width?: string; placeholder?: string }) {
  const { settings, updateSettings } = useApp()
  const [v, setV] = useState(String(settings?.[k] ?? ''))
  useEffect(() => setV(String(settings?.[k] ?? '')), [settings, k])
  const commit = () => {
    const value = (type === 'number' ? Number(v) : v) as Settings[K]
    if (value !== settings?.[k]) void updateSettings({ [k]: value } as Partial<Settings>)
  }
  return (
    <input
      className={`${input} ${width}`}
      type={type}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}

export function SettingsPage() {
  const { settings, updateSettings, refreshLlm, llm } = useApp()
  const [key, setKey] = useState('')
  const [persona, setPersona] = useState(settings?.personaOverride ?? '')
  const [cfHandle, setCfHandle] = useState<string | null>(null)
  if (!settings) return null

  const toggleType = (t: ContestType) =>
    void updateSettings({ contestTypes: settings.contestTypes.includes(t) ? settings.contestTypes.filter((x) => x !== t) : [...settings.contestTypes, t] })

  return (
    <div className="h-full overflow-y-auto px-6 pb-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <Section title="Codeforces">
          <Row label="Handle" hint="Your solved problems come from this account">
            <Field k="handle" placeholder="tourist" />
          </Row>
          <Row label="Submitting" hint="Log in once inside Okiro; the session is kept in its own browser profile">
            <Button
              onClick={async () => {
                const ok = await api.cf.openLogin()
                setCfHandle(ok ? 'Logged in' : 'Login window closed')
              }}
            >
              <LogIn className="size-3.5" /> Log in to Codeforces
            </Button>
            {cfHandle && <span className="text-xs text-slate-400">{cfHandle}</span>}
          </Row>
          <Row label="Submit language" hint="Matched against Codeforces' compiler list">
            <Field k="submitLanguage" placeholder="G++20" width="w-48" />
          </Row>
        </Section>

        <Section title="Training plan" hint="The road to Master: solve every target problem in each contest of the window, newest to oldest.">
          <Row label="Rating cap" hint="Problems rated at or below this count">
            <Field k="ratingCap" type="number" width="w-28" />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={settings.includeUnrated} onChange={(e) => void updateSettings({ includeUnrated: e.target.checked })} className="accent-blue-500" />
              Include problems without a rating yet
            </label>
          </Row>
          <Row label="Contest window" hint="How many recent contests are on the roadmap">
            <Field k="windowSize" type="number" width="w-28" />
          </Row>
          <Row label="Contest types">
            {(Object.keys(CONTEST_TYPE_LABELS) as ContestType[]).map((t) => (
              <Chip key={t} active={settings.contestTypes.includes(t)} onClick={() => toggleType(t)}>
                {CONTEST_TYPE_LABELS[t]}
              </Chip>
            ))}
          </Row>
          <Row label="Daily goal" hint="A day counts when either is reached">
            <Field k="dailyContestGoal" type="number" width="w-20" />
            <span className="text-xs text-slate-400">contests, or</span>
            <Field k="dailyProblemGoal" type="number" width="w-20" />
            <span className="text-xs text-slate-400">problems</span>
          </Row>
        </Section>

        <Section title="Arjun · voice" hint="Talk to Arjun hands-free: ⌥Space starts and ends a conversation, Esc interrupts him, ⌥⇧Space opens the full-screen view, ⌘J shows the transcript.">
          <Row label="Voice assistant">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={settings.voiceEnabled} onChange={(e) => void updateSettings({ voiceEnabled: e.target.checked })} className="accent-cyan-500" />
              Enabled
            </label>
          </Row>
          <Row label="Arjun's voice" hint="Natural voice runs on this Mac (one-time ~325 MB download)">
            {TTS_VOICES.map((v) => (
              <Chip key={v.id} active={settings.ttsVoice === v.id} onClick={() => void updateSettings({ ttsVoice: v.id })}>
                {v.label}
              </Chip>
            ))}
            <Button size="sm" onClick={() => void voice.preview()}>
              <Volume2 className="size-3.5" /> Preview
            </Button>
          </Row>
          <Row label="Hearing" hint="How Arjun understands you (one-time download when switched)">
            {STT_MODELS.map((m) => (
              <Chip key={m.id} active={settings.sttModel === m.id} onClick={() => void updateSettings({ sttModel: m.id })}>
                {m.label}
              </Chip>
            ))}
          </Row>
          <Row label="Speaking speed">
            <input
              type="range"
              min={0.8}
              max={1.5}
              step={0.05}
              value={settings.ttsSpeed}
              onChange={(e) => void updateSettings({ ttsSpeed: Number(e.target.value) })}
              className="w-48 accent-cyan-500"
            />
            <span className="text-xs tabular-nums text-slate-400">{settings.ttsSpeed.toFixed(2)}×</span>
          </Row>
          <Row label="Send word" hint='Arjun listens through your pauses and only answers once you end with this word ("…what do you think, okiro?"). Clear it to send on every pause.'>
            <Field k="endWord" width="w-40" placeholder="okiro" />
          </Row>
          <Row label="Keep listening" hint="After Arjun answers, keep the mic open for your reply">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={settings.autoListen} onChange={(e) => void updateSettings({ autoListen: e.target.checked })} className="accent-cyan-500" />
              Hands-free conversation
            </label>
          </Row>
          <Row label="Thinking in voice chat" hint="Applies when Claude answers. The local model always replies instantly in voice.">
            {(['low', 'medium', 'high'] as const).map((e) => (
              <Chip key={e} active={settings.voiceEffort === e} onClick={() => void updateSettings({ voiceEffort: e })}>
                {e}
              </Chip>
            ))}
          </Row>
          <VoiceStatus />
        </Section>

        <Section title="Arjun · local model" hint="Runs on your Mac through Ollama. Private and offline.">
          <ModelSetup compact />
          <ModelAdvice />
          <Row label="Chat model" hint="Any model you've pulled in Ollama">
            <Field k="ollamaModel" width="w-56" />
            {llm?.models.length ? (
              <select
                className={`${input} w-56`}
                value=""
                onChange={(e) => e.target.value && void updateSettings({ ollamaModel: e.target.value }).then(refreshLlm)}
              >
                <option value="">Installed models…</option>
                {llm.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : null}
          </Row>
          <Row label="Embedding model">
            <Field k="embedModel" width="w-56" />
          </Row>
          <Row label="Reasoning effort" hint="Higher thinks longer before answering (text chat)">
            {(['low', 'medium', 'high'] as const).map((e) => (
              <Chip key={e} active={settings.reasoningEffort === e} onClick={() => void updateSettings({ reasoningEffort: e })}>
                {e}
              </Chip>
            ))}
          </Row>
          <Row label="Default spoiler level">
            {SPOILER_LEVELS.map((l, i) => (
              <Chip key={l} active={settings.spoilerLevel === i} onClick={() => void updateSettings({ spoilerLevel: i })}>
                {l}
              </Chip>
            ))}
          </Row>
        </Section>

        <Section title="Arjun · Claude (optional)" hint="For hard problems you can switch a chat to Claude. Only that chat's context is sent to Anthropic.">
          <Row label="Anthropic API key" hint="Stored encrypted in your macOS Keychain">
            <input className={`${input} w-80`} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={llm?.claudeKeySet ? '•••••••• (saved)' : 'sk-ant-…'} />
            <Button
              disabled={!key.trim()}
              onClick={async () => {
                await api.settings.setClaudeKey(key.trim())
                setKey('')
                await refreshLlm()
              }}
            >
              <KeyRound className="size-3.5" /> Save
            </Button>
            {llm?.claudeKeySet && (
              <Button
                variant="danger"
                onClick={async () => {
                  await api.settings.clearClaudeKey()
                  await refreshLlm()
                }}
              >
                Remove
              </Button>
            )}
          </Row>
          <Row label="Claude model">
            <Field k="claudeModel" width="w-56" />
          </Row>
        </Section>

        <Section title="Arjun · persona" hint="Leave empty to use the built-in Arjun persona. Anything you write here replaces it.">
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={8}
            placeholder="You are Arjun, my friend and a Codeforces Grandmaster…"
            className={`${input} font-mono text-[12px]`}
          />
          <div className="flex justify-end">
            <Button disabled={persona === settings.personaOverride} onClick={() => void updateSettings({ personaOverride: persona })}>
              Save persona
            </Button>
          </div>
        </Section>

        <Section title="Compiler" hint="Used for local tests and Arjun's stress tests. Okiro ships a bits/stdc++.h shim for Apple clang.">
          <Row label="Compiler" hint="clang++, or g++-14 from Homebrew for pbds">
            <Field k="compilerPath" width="w-56" />
          </Row>
          <Row label="C++ standard">
            {['c++17', 'c++20', 'c++23'].map((s) => (
              <Chip key={s} active={settings.cppStd === s} onClick={() => void updateSettings({ cppStd: s })}>
                {s}
              </Chip>
            ))}
          </Row>
          <Row label="Extra flags">
            <Field k="extraFlags" width="w-80" />
          </Row>
        </Section>

        <div className="flex items-center justify-between px-1 text-[11px] text-slate-600">
          <Label>Okiro CF</Label>
          <span>Data lives in ~/Library/Application Support/Okiro CF</span>
        </div>
      </div>
    </div>
  )
}

function VoiceStatus() {
  const { sttDevice, ttsDevice, systemVoice, loadProgress, loadLabel, error } = useVoice()
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] text-slate-400">
      {loadProgress != null ? (
        <span className="text-cyan-200">
          {loadLabel} · {Math.round(loadProgress * 100)}%
        </span>
      ) : sttDevice || ttsDevice ? (
        <span>
          Ears: Whisper on <b className="text-slate-200">{sttDevice || '—'}</b> · Voice: <b className="text-slate-200">{systemVoice ? 'macOS system voice' : `Kokoro on ${ttsDevice || '—'}`}</b>
        </span>
      ) : (
        <span>Speech models (~530 MB) download the first time you start a conversation, then stay cached on this Mac.</span>
      )}
      {error && <div className="mt-1 text-amber-300">{error}</div>}
    </div>
  )
}

function ModelAdvice() {
  const { llm, settings, updateSettings, refreshLlm } = useApp()
  if (!llm || !settings) return null
  const caps = llm.chatModelInfo?.capabilities ?? []
  const rec = llm.recommendedModel
  const hasRec = llm.models.some((m) => m === rec || m.startsWith(`${rec}`))
  return (
    <div className="flex flex-col gap-2">
      {llm.chatModelInfo && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
          <span className="font-mono text-slate-200">{settings.ollamaModel}</span>
          {llm.chatModelInfo.parameterSize && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">{llm.chatModelInfo.parameterSize}</span>}
          <span className={cx('flex items-center gap-1 rounded-md px-1.5 py-0.5', caps.includes('tools') ? 'bg-emerald-500/12 text-emerald-300' : 'bg-white/[0.04] text-slate-500 line-through')}>
            <Wrench className="size-3" /> tools
          </span>
          <span className={cx('flex items-center gap-1 rounded-md px-1.5 py-0.5', caps.includes('thinking') ? 'bg-violet-500/12 text-violet-300' : 'bg-white/[0.04] text-slate-500 line-through')}>
            <Brain className="size-3" /> thinking
          </span>
        </div>
      )}
      {llm.chatModelInfo && !caps.includes('tools') && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-[12px] text-amber-100/90">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          This model can't call tools, so Arjun can't run your tests, stress-test or open pages — just reason from what's on screen. Small coder models are also weak at coaching.
        </div>
      )}
      {settings.ollamaModel !== rec && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-[12px] text-cyan-100/90">
          Recommended for your {llm.totalMemGb} GB Mac: <b className="font-mono">{rec}</b>.
          <div className="flex-1" />
          {hasRec ? (
            <Button size="sm" onClick={() => void updateSettings({ ollamaModel: rec }).then(refreshLlm)}>
              Use it
            </Button>
          ) : (
            llm.ollamaRunning && (
              <Button size="sm" onClick={() => void api.llm.pull(rec)}>
                <Download className="size-3.5" /> Download
              </Button>
            )
          )}
        </div>
      )}
    </div>
  )
}
