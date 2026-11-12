import { create } from 'zustand'
import type { ChatMessage, CoachEvent, CoachRequest, LlmStatus, ProviderId, Settings, SyncResult, UserInfo } from '@shared/types'
import { api } from './api'

interface AppState {
  settings: Settings | null
  user: UserInfo | null
  llm: LlmStatus | null
  syncing: boolean
  lastSync: SyncResult | null
  /** Bumped whenever Codeforces data or verdicts change, so views refetch. */
  dataVersion: number
  provider: ProviderId
  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  refreshUser: () => Promise<void>
  refreshLlm: () => Promise<void>
  sync: (force: boolean) => Promise<void>
  bump: () => void
  setProvider: (p: ProviderId) => void
}

export const useApp = create<AppState>((set, get) => ({
  settings: null,
  user: null,
  llm: null,
  syncing: false,
  lastSync: null,
  dataVersion: 0,
  provider: 'ollama',
  loadSettings: async () => set({ settings: await api.settings.get() }),
  updateSettings: async (patch) => {
    const before = get().settings
    const settings = await api.settings.update(patch)
    set({ settings })
    if (patch.handle !== undefined && patch.handle !== before?.handle) void get().refreshUser()
    if (patch.ratingCap !== undefined || patch.contestTypes || patch.windowSize !== undefined || patch.includeUnrated !== undefined) get().bump()
  },
  refreshUser: async () => set({ user: await api.cf.user() }),
  refreshLlm: async () => set({ llm: await api.llm.status() }),
  sync: async (force) => {
    set({ syncing: true })
    try {
      const r = await api.cf.sync(force)
      set({ lastSync: r })
    } finally {
      set({ syncing: false })
    }
  },
  bump: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
  setProvider: (provider) => set({ provider })
}))

export interface ToolCallView {
  name: string
  args: string
  result?: string
}

export interface StreamState {
  turnId: string
  model: string
  text: string
  reasoning: string
  tools: ToolCallView[]
}

interface CoachState {
  messages: Record<string, ChatMessage[]>
  streams: Record<string, StreamState | undefined>
  errors: Record<string, string | undefined>
  load: (scope: string) => Promise<void>
  send: (req: CoachRequest) => Promise<void>
  stop: (scope: string) => void
  clear: (scope: string) => Promise<void>
  handle: (e: CoachEvent) => void
}

export const useCoach = create<CoachState>((set, get) => ({
  messages: {},
  streams: {},
  errors: {},
  load: async (scope) => {
    const msgs = await api.coach.history(scope)
    set((s) => ({ messages: { ...s.messages, [scope]: msgs } }))
  },
  send: async (req) => {
    const optimistic: ChatMessage = {
      id: -Date.now(),
      scope: req.scope,
      role: 'user',
      content: req.text.trim() || labelFor(req.action),
      reasoning: '',
      tools: [],
      model: '',
      createdAt: Date.now()
    }
    set((s) => ({
      messages: { ...s.messages, [req.scope]: [...(s.messages[req.scope] ?? []), optimistic] },
      errors: { ...s.errors, [req.scope]: undefined },
      streams: { ...s.streams, [req.scope]: { turnId: '', model: '', text: '', reasoning: '', tools: [] } }
    }))
    const turnId = await api.coach.send(req)
    set((s) => {
      const cur = s.streams[req.scope]
      return { streams: { ...s.streams, [req.scope]: cur ? { ...cur, turnId } : cur } }
    })
  },
  stop: (scope) => {
    const st = get().streams[scope]
    if (st?.turnId) void api.coach.stop(st.turnId)
  },
  clear: async (scope) => {
    await api.coach.clear(scope)
    set((s) => ({ messages: { ...s.messages, [scope]: [] }, errors: { ...s.errors, [scope]: undefined } }))
  },
  handle: (e) =>
    set((s) => {
      const cur = s.streams[e.scope] ?? { turnId: e.turnId, model: '', text: '', reasoning: '', tools: [] }
      switch (e.type) {
        case 'start':
          return { streams: { ...s.streams, [e.scope]: { ...cur, turnId: e.turnId, model: e.model } } }
        case 'text':
          return { streams: { ...s.streams, [e.scope]: { ...cur, text: cur.text + e.delta } } }
        case 'reasoning':
          return { streams: { ...s.streams, [e.scope]: { ...cur, reasoning: cur.reasoning + e.delta } } }
        case 'tool-start':
          return { streams: { ...s.streams, [e.scope]: { ...cur, tools: [...cur.tools, { name: e.name, args: e.args }] } } }
        case 'tool-end': {
          const tools = cur.tools.slice()
          const i = tools.map((t) => t.name).lastIndexOf(e.name)
          if (i >= 0) tools[i] = { ...tools[i], result: e.result }
          return { streams: { ...s.streams, [e.scope]: { ...cur, tools } } }
        }
        case 'done':
          return {
            messages: { ...s.messages, [e.scope]: [...(s.messages[e.scope] ?? []), e.message] },
            streams: { ...s.streams, [e.scope]: undefined }
          }
        case 'error':
          return { errors: { ...s.errors, [e.scope]: e.error }, streams: { ...s.streams, [e.scope]: undefined } }
      }
    })
}))

function labelFor(action: CoachRequest['action']): string {
  switch (action) {
    case 'greet':
      return 'Hey Arjun 👋'
    case 'explain':
      return 'Explain this problem'
    case 'hint':
      return 'Give me a hint'
    case 'review':
      return 'Review my code'
    case 'why-wa':
      return 'Why is this failing?'
    default:
      return ''
  }
}
