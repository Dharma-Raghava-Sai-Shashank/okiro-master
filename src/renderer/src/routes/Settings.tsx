import { useEffect, useState, type ReactNode } from 'react'
import { KeyRound, LogIn } from 'lucide-react'
import { CONTEST_TYPE_LABELS, SPOILER_LEVELS, type ContestType, type Settings } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { Button, Chip, Glass, Label } from '../components/ui'
import { ModelSetup } from './Onboarding'

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
    <div className="h-full overflow-y-auto px-6 pb-10">
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

        <Section title="Arjun · local model" hint="Runs on your Mac through Ollama. Private and offline.">
          <ModelSetup compact />
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
          <Row label="Reasoning effort" hint="Higher thinks longer before answering">
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
