export interface LlmToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export type LlmMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: LlmToolCall[]; raw?: unknown }
  | { role: 'tool'; toolCallId: string; name: string; content: string }

export interface LlmTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatRequest {
  system: string
  messages: LlmMessage[]
  tools: LlmTool[]
  signal: AbortSignal
  onText?: (delta: string) => void
  onThinking?: (delta: string) => void
}

export interface ChatResult {
  content: string
  thinking: string
  toolCalls: LlmToolCall[]
  /** Provider-native assistant content, replayed verbatim inside a tool loop. */
  raw?: unknown
}

export interface LlmProvider {
  readonly label: string
  chat(req: ChatRequest): Promise<ChatResult>
}
