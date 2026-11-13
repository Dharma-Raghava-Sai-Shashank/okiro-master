import { randomUUID } from 'node:crypto'
import type { ChatMessage, CoachAction, CoachEvent, CoachRequest, ProblemRef, ToolTrace } from '@shared/types'
import { problemScope } from '@shared/api'
import { all, run } from '../db'
import { getClaudeKey, getSettings } from '../settings'
import { ClaudeProvider } from '../llm/claude'
import { OllamaProvider } from '../llm/ollama'
import { modelInfo } from '../llm/ollama-lifecycle'
import type { LlmMessage, LlmProvider, LlmToolCall } from '../llm/types'
import { buildContext } from './context'
import { runTool, TOOL_NAMES, toolDefs } from './tools'
import { addNote, recordSolve } from './memory'
import { looksLikeToolCallJson, parseToolCallJson } from './toolcall-json'

const MAX_TOOL_ROUNDS = 6

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
      'Review my current code and approach. Restate my idea in one line, then try hard to break it: complexity vs constraints, edge cases, overflow, multitest resets, output format.'
  },
  'why-wa': {
    label: 'Why is this failing?',
    prompt:
      "My solution is failing (see the latest test run and Codeforces submissions). Help me find the bug without just handing me fixed code. Point me at the first failing test and what differs."
  }
}

const PLAIN_WORDS = 'Answer in plain words — not JSON, not a function call.'
const RETRY_NUDGE = 'Reply to me directly in plain spoken words. Do not output JSON or call functions.'

const turns = new Map<string, AbortController>()

interface TurnSetup {
  llm: LlmProvider
  label: string
  tools: boolean
  compact: boolean
  historyLimit: number
}

/** Pick the provider and how to talk to it, based on what the selected model can actually do. */
async function setup(req: CoachRequest): Promise<TurnSetup> {
  const s = getSettings()
  const deep = req.action === 'explain' || req.action === 'hint' || req.action === 'review' || req.action === 'why-wa'
  const effort = req.voice ? (deep ? 'medium' : s.voiceEffort) : s.reasoningEffort
  if (req.provider === 'claude') {
    const key = getClaudeKey()
    if (!key) throw new Error('Add your Anthropic API key in Settings to ask Claude.')
    const llm = new ClaudeProvider(key, s.claudeModel, effort)
    return { llm, label: llm.label, tools: true, compact: false, historyLimit: 14 }
  }
  const info = await modelInfo(s.ollamaModel)
  const caps = info?.capabilities ?? []
  const compact = !info || (info.billions > 0 && info.billions <= 8)
  let think: string | boolean | undefined
  if (caps.includes('thinking')) {
    // Voice never thinks: reasoning tokens are pure dead air before the first spoken word.
    if (req.voice) think = s.ollamaModel.startsWith('gpt-oss') ? 'low' : false
    else think = s.ollamaModel.startsWith('gpt-oss') ? effort : effort !== 'low'
  }
  const llm = new OllamaProvider(s.ollamaHost, s.ollamaModel, {
    think,
    numCtx: compact ? 8192 : s.ollamaModel.startsWith('gpt-oss') ? 24576 : 16384,
    keepAlive: -1,
    numPredict: req.voice ? (deep ? 384 : 192) : undefined,
    temperature: 0.7
  })
  return { llm, label: llm.label, tools: caps.includes('tools'), compact, historyLimit: req.voice ? 6 : compact ? 8 : 14 }
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

/**
 * Earlier turns as plain text. Reasoning and tool calls are not replayed, and replies that were a
 * tool call written as JSON are skipped so a small model doesn't learn to keep answering in JSON.
 */
function priorMessages(scope: string, limit: number): LlmMessage[] {
  const rows = all<MsgRow>('SELECT * FROM chat_messages WHERE scope = ? ORDER BY id DESC LIMIT ?', scope, limit * 2).reverse()
  const out: LlmMessage[] = []
  for (const r of rows) {
    if (r.role === 'assistant' && looksLikeToolCallJson(r.content)) {
      if (out[out.length - 1]?.role === 'user') out.pop()
      continue
    }
    let content = r.content
    const thinkEnd = content.indexOf('</think>')
    if (thinkEnd !== -1) content = content.slice(thinkEnd + 8).trim()
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (content) {
      out.push({ role: r.role as 'user' | 'assistant', content: content.slice(0, 4000) })
    }
  }
  const trimmed = out.slice(-limit)
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift()
  return trimmed
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

/**
 * Streams text to the UI, but holds back a reply that starts like JSON until it is complete, so a
 * tool call written as text never flashes on screen (or gets spoken).
 */
class TextGate {
  private held = ''
  private open = false
  shown = ''
  constructor(private emitText: (d: string) => void) {}

  push(d: string): void {
    if (this.open) {
      this.shown += d
      this.emitText(d)
      return
    }
    this.held += d
    const head = this.held.trimStart()
    if (!head) return
    if (head.startsWith('{') || head.startsWith('```json') || (head.startsWith('```') && head.length < 8)) return
    this.release()
  }

  /** The held text, if the reply was held back to the end. */
  heldText(): string {
    return this.open ? '' : this.held
  }

  release(): void {
    if (this.open) return
    this.open = true
    if (this.held) {
      this.shown += this.held
      this.emitText(this.held)
    }
    this.held = ''
  }

  reset(): void {
    this.held = ''
  }

  /** Start gating again for a new model reply. */
  arm(): void {
    this.open = false
    this.held = ''
  }
}

async function runTurn(turnId: string, req: CoachRequest, signal: AbortSignal, emit: (e: CoachEvent) => void): Promise<void> {
  const { scope } = req
  const base = { turnId, scope }
  const action = req.action === 'chat' ? null : ACTION_PROMPTS[req.action]
  const shown = req.text.trim() || action?.label || ''
  let reasoning = ''
  const traces: ToolTrace[] = []
  let label = ''
  const gate = new TextGate((d) => emit({ ...base, type: 'text', delta: d }))
  try {
    const s = getSettings()
    const t = await setup(req)
    label = t.label
    const lead = t.tools ? '' : `${PLAIN_WORDS}\n\n`
    const llmText = action ? `${lead}${action.prompt}${req.text.trim() ? `\n\nAlso: ${req.text.trim()}` : ''}` : `${lead}${req.text}`
    const prior = priorMessages(scope, t.historyLimit)
    saveMessage(scope, 'user', shown)
    emit({ ...base, type: 'start', model: label })
    const ctx = await buildContext(req, s, { compact: t.compact, tools: t.tools })
    const messages: LlmMessage[] = [...prior, { role: 'user', content: llmText }]
    const tools = t.tools ? toolDefs(!!req.problem) : []
    let retried = false
    for (let round = 0; ; round++) {
      const last = round >= MAX_TOOL_ROUNDS
      gate.arm()
      const res = await t.llm.chat({
        system: ctx.system,
        messages,
        tools,
        signal,
        onText: (d) => gate.push(d),
        onThinking: (d) => {
          reasoning += d
          emit({ ...base, type: 'reasoning', delta: d })
        }
      })
      let calls: LlmToolCall[] = res.toolCalls
      const held = gate.heldText()
      if (!calls.length && held) {
        // The whole reply was held back because it looked like JSON.
        const parsed = parseToolCallJson(held)
        if (parsed && TOOL_NAMES.has(parsed.name) && tools.length) {
          gate.reset()
          calls = [{ id: `text_${round}`, name: parsed.name, args: parsed.args }]
        } else if (parsed && !retried) {
          // A made-up "function" (e.g. {"name": "explain"}): ask again for plain words, once.
          retried = true
          gate.reset()
          messages.push({ role: 'assistant', content: 'Let me just say it plainly.' }, { role: 'user', content: RETRY_NUDGE })
          continue
        } else if (parsed) {
          gate.reset()
          gate.release()
          gate.push("Sorry, I got tangled up there. Ask me that again in different words and I'll answer properly.")
          break
        } else {
          gate.release()
        }
      }
      gate.release()
      if (!calls.length || last) break
      const native = calls === res.toolCalls
      messages.push({ role: 'assistant', content: native ? res.content : '', toolCalls: calls, raw: native ? res.raw : undefined })
      for (const call of calls) {
        const args = JSON.stringify(call.args)
        emit({ ...base, type: 'tool-start', name: call.name, args })
        const result = await runTool(call.name, call.args, { problem: req.problem, code: req.code })
        traces.push({ name: call.name, args, result })
        emit({ ...base, type: 'tool-end', name: call.name, result })
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result })
      }
      // A text-written tool call has no native call id; tell the model the results in plain text too.
      if (!native) {
        messages.push({ role: 'user', content: `Tool results:\n${traces.slice(-calls.length).map((x) => `${x.name}: ${x.result}`).join('\n\n')}\n\n${RETRY_NUDGE}` })
      }
      if (gate.shown && !gate.shown.endsWith('\n')) gate.push('\n\n')
    }
    let content = gate.shown.trim()
    if (!content && traces.length) content = 'I used up my tool steps for this turn — say "continue" and I\'ll pick up from there.'
    const msg = saveMessage(scope, 'assistant', content || '(no reply)', reasoning, traces, label)
    emit({ ...base, type: 'done', message: msg })
  } catch (e) {
    console.error('[Coach Error]', e)
    const aborted = signal.aborted
    const content = gate.shown.trim()
    if (aborted) {
      const finalContent = content && !looksLikeToolCallJson(content) ? `${content}\n\n*(stopped)*` : '*(stopped)*'
      const msg = saveMessage(scope, 'assistant', finalContent, reasoning, traces, label)
      emit({ ...base, type: 'done', message: msg })
    } else {
      if (content && !looksLikeToolCallJson(content)) {
        const msg = saveMessage(scope, 'assistant', content, reasoning, traces, label)
        emit({ ...base, type: 'done', message: msg })
      }
      emit({ ...base, type: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }
}

/** After an AC: remember the solve, and (best effort) distil the chat into a one-line lesson. */
export async function onAccepted(ref: ProblemRef): Promise<void> {
  recordSolve(ref)
  const chat = history(problemScope(ref))
  if (chat.length < 2) return
  try {
    const s = getSettings()
    const llm = new OllamaProvider(s.ollamaHost, s.ollamaModel, { numCtx: 4096, keepAlive: '5m' })
    const transcript = chat
      .slice(-16)
      .map((m) => `${m.role === 'user' ? 'Student' : 'Arjun'}: ${m.content.slice(0, 800)}`)
      .join('\n')
    const res = await llm.chat({
      system:
        'You write one-line training notes about a competitive programmer. Reply with exactly one line: "<tag>: <lesson>" (max 25 words) capturing the key insight they needed or the mistake they made. No preamble, no JSON.',
      messages: [{ role: 'user', content: `Problem ${ref.contestId}${ref.index}. Coaching chat:\n${transcript}` }],
      tools: [],
      signal: AbortSignal.timeout(120_000)
    })
    const line = res.content.trim().split('\n')[0]
    const m = /^([^:]{1,40}):\s*(.+)$/.exec(line)
    if (m && !looksLikeToolCallJson(line)) addNote('lesson', m[1].trim().toLowerCase(), `${ref.contestId}${ref.index}: ${m[2].trim()}`, ref)
  } catch {
    // Lessons are a nice-to-have; the deterministic solve note is already saved.
  }
}
