// Local models through Ollama's HTTP API (bound to 127.0.0.1). https://github.com/ollama/ollama/blob/main/docs/api.md
import type { ChatRequest, ChatResult, LlmMessage, LlmProvider, LlmToolCall } from './types'

interface OllamaChunk {
  message?: {
    content?: string
    thinking?: string
    tool_calls?: { function: { name: string; arguments: Record<string, unknown> | string } }[]
  }
  done?: boolean
  error?: string
}

/** Read an NDJSON response body line by line. */
export async function* ndjson<T>(res: Response): AsyncGenerator<T> {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) yield JSON.parse(line) as T
    }
  }
  if (buf.trim()) yield JSON.parse(buf) as T
}

function toOllama(system: string, messages: LlmMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }]
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content })
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args } })) } : {})
      })
    } else out.push({ role: 'tool', tool_name: m.name, content: m.content })
  }
  return out
}

export interface OllamaOptions {
  /** Ollama's `think` value: an effort string for gpt-oss, true/false for other thinking models, omitted otherwise. */
  think?: string | boolean
  numCtx?: number
  keepAlive?: string
}

export class OllamaProvider implements LlmProvider {
  readonly label: string

  constructor(
    private host: string,
    private model: string,
    private opts: OllamaOptions = {}
  ) {
    this.label = model
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toOllama(req.system, req.messages),
      stream: true,
      keep_alive: this.opts.keepAlive ?? '5m',
      options: { num_ctx: this.opts.numCtx ?? 16384 }
    }
    if (req.tools.length) {
      body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
    }
    if (this.opts.think !== undefined) body.think = this.opts.think
    const res = await fetch(`${this.host}/api/chat`, { method: 'POST', body: JSON.stringify(body), signal: req.signal })
    if (!res.ok) throw new Error(`Ollama: ${(await res.text()).slice(0, 300)}`)
    let content = ''
    let thinking = ''
    let inThink = false
    const toolCalls: LlmToolCall[] = []
    for await (const chunk of ndjson<OllamaChunk>(res)) {
      if (chunk.error) throw new Error(`Ollama: ${chunk.error}`)
      const m = chunk.message
      if (m?.thinking) {
        thinking += m.thinking
        req.onThinking?.(m.thinking)
      }
      if (m?.content) {
        let text = m.content
        if (text.includes('<think>')) {
          inThink = true
          text = text.replace('<think>', '')
        }
        if (inThink) {
          const endIdx = text.indexOf('</think>')
          if (endIdx !== -1) {
            const thinkPart = text.slice(0, endIdx)
            if (thinkPart) {
              thinking += thinkPart
              req.onThinking?.(thinkPart)
            }
            inThink = false
            text = text.slice(endIdx + 8).trimStart()
          } else {
            thinking += text
            req.onThinking?.(text)
            text = ''
          }
        } else if (text.includes('</think>')) {
          const endIdx = text.indexOf('</think>')
          const thinkPart = text.slice(0, endIdx)
          if (thinkPart) {
            thinking += thinkPart
            req.onThinking?.(thinkPart)
          }
          text = text.slice(endIdx + 8).trimStart()
        }
        if (text) {
          content += text
          req.onText?.(text)
        }
      }
      for (const c of m?.tool_calls ?? []) {
        const args = typeof c.function.arguments === 'string' ? safeJson(c.function.arguments) : c.function.arguments
        toolCalls.push({ id: `call_${toolCalls.length}_${Date.now()}`, name: c.function.name, args: args ?? {} })
      }
    }
    return { content, thinking, toolCalls }
  }
}

function safeJson(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    return null
  }
}
