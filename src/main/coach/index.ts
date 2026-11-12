import { randomUUID } from 'node:crypto'
import type { ChatMessage, CoachAction, CoachEvent, CoachRequest, ProblemRef, ToolTrace } from '@shared/types'
import { problemScope } from '@shared/api'
import { all, run } from '../db'
import { getClaudeKey, getSettings } from '../settings'
import { ClaudeProvider } from '../llm/claude'
import { OllamaProvider } from '../llm/ollama'
import type { LlmMessage, LlmProvider } from '../llm/types'
import { buildContext } from './context'
import { runTool, toolDefs } from './tools'
import { addNote, recordSolve } from './memory'

const MAX_TOOL_ROUNDS = 6
const HISTORY_MESSAGES = 14

export const ACTION_PROMPTS: Record<Exclude<CoachAction, 'chat'>, { label: string; prompt: string }> = {
  greet: {
    label: 'Hey Arjun 👋',
    prompt:
      "(Session start.) Greet me like a friend, tell me exactly where we are on the road to Master (contests done/left, today's progress, streak) and what we're doing next. Keep it short and end with one question."
  },
  explain: {
    label: 'Explain this problem',
    prompt:
      "Explain this problem to me: the story in one line, the input, what he wants, the output format, then walk me through the first sample by hand. End with one question to get me thinking. Don't give the solution."
  },
  hint: {
    label: 'Give me a hint',
    prompt: 'Give me the next hint — one step only, at the current spoiler level.'
  },
  review: {
    label: 'Review my code',
    prompt:
      'Review my current code and approach. Restate my idea in one line, then try hard to break it: complexity vs constraints, edge cases, overflow, multitest resets, output format. Verify with a tool if it helps.'
  },
  'why-wa': {
    label: 'Why is this failing?',
    prompt:
      "My solution is failing (see the latest test run and Codeforces submissions). Help me find the bug without just handing me fixed code. If it isn't obvious, write a brute force and generator and use stress_test to find a small failing input."
  }
}

const turns = new Map<string, AbortController>()

function provider(id: CoachRequest['provider']): LlmProvider {
  const s = getSettings()
  if (id === 'claude') {
    const key = getClaudeKey()
    if (!key) throw new Error('Add your Anthropic API key in Settings to ask Claude.')
    return new ClaudeProvider(key, s.claudeModel, s.reasoningEffort)
  }
  return new OllamaProvider(s.ollamaHost, s.ollamaModel, s.reasoningEffort)
}

interface MsgRow {
  id: number
  scope: string
  role: string
  content: string
  reasoning: string
  tools: string
  model: string
  created_at: number
}

const toMessage = (r: MsgRow): ChatMessage => ({
  id: r.id,
  scope: r.scope,
  role: r.role as ChatMessage['role'],
  content: r.content,
  reasoning: r.reasoning,
  tools: JSON.parse(r.tools) as ToolTrace[],
  model: r.model,
  createdAt: r.created_at
})

export function history(scope: string): ChatMessage[] {
  return all<MsgRow>('SELECT * FROM chat_messages WHERE scope = ? ORDER BY id ASC', scope).map(toMessage)
}

export function clearHistory(scope: string): void {
  run('DELETE FROM chat_messages WHERE scope = ?', scope)
}

function saveMessage(scope: string, role: ChatMessage['role'], content: string, reasoning = '', tools: ToolTrace[] = [], model = ''): ChatMessage {
  const now = Date.now()
  const r = run(
    'INSERT INTO chat_messages (scope, role, content, reasoning, tools, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    scope,
    role,
    content,
    reasoning,
    JSON.stringify(tools),
    model,
    now
  )
  return { id: r.lastInsertRowid, scope, role, content, reasoning, tools, model, createdAt: now }
}

/** Earlier turns, as plain text (reasoning and tool calls are not replayed across turns). */
function priorMessages(scope: string): LlmMessage[] {
  const rows = all<MsgRow>('SELECT * FROM chat_messages WHERE scope = ? ORDER BY id DESC LIMIT ?', scope, HISTORY_MESSAGES).reverse()
  const out: LlmMessage[] = rows.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content.slice(0, 4000) }))
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

export function send(req: CoachRequest, emit: (e: CoachEvent) => void): string {
  const turnId = randomUUID()
  const controller = new AbortController()
  turns.set(turnId, controller)
  void runTurn(turnId, req, controller.signal, emit).finally(() => turns.delete(turnId))
  return turnId
}

export function stop(turnId: string): void {
  turns.get(turnId)?.abort()
}

async function runTurn(turnId: string, req: CoachRequest, signal: AbortSignal, emit: (e: CoachEvent) => void): Promise<void> {
  const { scope } = req
  const base = { turnId, scope }
  const action = req.action === 'chat' ? null : ACTION_PROMPTS[req.action]
  const shown = req.text.trim() || action?.label || ''
  const llmText = action ? `${action.prompt}${req.text.trim() ? `\n\nAlso: ${req.text.trim()}` : ''}` : req.text
  let content = ''
  let reasoning = ''
  const traces: ToolTrace[] = []
  let label = ''
  try {
    const s = getSettings()
    const llm = provider(req.provider)
    label = llm.label
    const prior = priorMessages(scope)
    saveMessage(scope, 'user', shown)
    emit({ ...base, type: 'start', model: label })
    const ctx = await buildContext(req, s)
    const messages: LlmMessage[] = [...prior, { role: 'user', content: llmText }]
    const tools = toolDefs(!!req.problem)
    for (let round = 0; ; round++) {
      const last = round >= MAX_TOOL_ROUNDS
      const res = await llm.chat({
        system: ctx.system,
        messages,
        tools,
        signal,
        onText: (d) => {
          content += d
          emit({ ...base, type: 'text', delta: d })
        },
        onThinking: (d) => {
          reasoning += d
          emit({ ...base, type: 'reasoning', delta: d })
        }
      })
      if (!res.toolCalls.length || last) break
      messages.push({ role: 'assistant', content: res.content, toolCalls: res.toolCalls, raw: res.raw })
      for (const call of res.toolCalls) {
        const args = JSON.stringify(call.args)
        emit({ ...base, type: 'tool-start', name: call.name, args })
        const result = await runTool(call.name, call.args, { problem: req.problem, code: req.code })
        traces.push({ name: call.name, args, result })
        emit({ ...base, type: 'tool-end', name: call.name, result })
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result })
      }
      if (content && !content.endsWith('\n')) {
        content += '\n\n'
        emit({ ...base, type: 'text', delta: '\n\n' })
      }
    }
    if (!content.trim() && traces.length) content = 'I used up my tool steps for this turn — say "continue" and I\'ll pick up from there.'
    const msg = saveMessage(scope, 'assistant', content.trim() || '(no reply)', reasoning, traces, label)
    emit({ ...base, type: 'done', message: msg })
  } catch (e) {
    const aborted = signal.aborted
    if (content.trim()) {
      const msg = saveMessage(scope, 'assistant', `${content.trim()}${aborted ? '\n\n*(stopped)*' : ''}`, reasoning, traces, label)
      emit({ ...base, type: 'done', message: msg })
    }
    if (!aborted) emit({ ...base, type: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

/** After an AC: remember the solve, and (best effort) distil the chat into a one-line lesson. */
export async function onAccepted(ref: ProblemRef): Promise<void> {
  recordSolve(ref)
  const chat = history(problemScope(ref))
  if (chat.length < 2) return
  try {
    const s = getSettings()
    const llm = new OllamaProvider(s.ollamaHost, s.ollamaModel, 'low', 8192)
    const transcript = chat
      .slice(-16)
      .map((m) => `${m.role === 'user' ? 'Student' : 'Arjun'}: ${m.content.slice(0, 800)}`)
      .join('\n')
    const res = await llm.chat({
      system:
        'You write one-line training notes about a competitive programmer. Reply with exactly one line: "<tag>: <lesson>" (max 25 words) capturing the key insight they needed or the mistake they made. No preamble.',
      messages: [{ role: 'user', content: `Problem ${ref.contestId}${ref.index}. Coaching chat:\n${transcript}` }],
      tools: [],
      signal: AbortSignal.timeout(120_000)
    })
    const line = res.content.trim().split('\n')[0]
    const m = /^([^:]{1,40}):\s*(.+)$/.exec(line)
    if (m) addNote('lesson', m[1].trim().toLowerCase(), `${ref.contestId}${ref.index}: ${m[2].trim()}`, ref)
  } catch {
    // Lessons are a nice-to-have; the deterministic solve note is already saved.
  }
}
