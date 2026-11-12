// Optional online escalation through the Anthropic API (official SDK).
import Anthropic from '@anthropic-ai/sdk'
import type { ChatRequest, ChatResult, LlmMessage, LlmProvider, LlmToolCall } from './types'

type Param = Anthropic.Beta.BetaMessageParam

function toClaude(messages: LlmMessage[]): Param[] {
  const out: Param[] = []
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content })
    else if (m.role === 'assistant') {
      // Inside a tool loop the raw blocks (thinking + tool_use) are replayed unchanged.
      out.push({ role: 'assistant', content: (m.raw as Param['content']) ?? m.content })
    } else {
      const block: Anthropic.Beta.BetaToolResultBlockParam = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }
      const last = out[out.length - 1]
      // All results for one assistant turn go back in a single user message.
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) {
        last.content.push(block)
      } else out.push({ role: 'user', content: [block] })
    }
  }
  return out
}

export class ClaudeProvider implements LlmProvider {
  readonly label: string
  private client: Anthropic

  constructor(
    apiKey: string,
    private model: string,
    private effort: 'low' | 'medium' | 'high'
  ) {
    this.client = new Anthropic({ apiKey })
    this.label = model
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 64000,
        system: req.system,
        messages: toClaude(req.messages),
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort: this.effort },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        ...(req.tools.length
          ? {
              tools: req.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
                eager_input_streaming: true
              }))
            }
          : {})
      },
      { signal: req.signal }
    )
    for await (const ev of stream) {
      if (ev.type !== 'content_block_delta') continue
      if (ev.delta.type === 'text_delta') req.onText?.(ev.delta.text)
      else if (ev.delta.type === 'thinking_delta') req.onThinking?.(ev.delta.thinking)
    }
    const msg = await stream.finalMessage()
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined this request')
    let content = ''
    let thinking = ''
    const toolCalls: LlmToolCall[] = []
    for (const b of msg.content) {
      if (b.type === 'text') content += b.text
      else if (b.type === 'thinking') thinking += b.thinking
      else if (b.type === 'tool_use') toolCalls.push({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> })
    }
    if (msg.stop_reason === 'max_tokens' && toolCalls.length) throw new Error('Claude ran out of tokens mid tool call')
    return { content, thinking, toolCalls, raw: msg.content }
  }
}
