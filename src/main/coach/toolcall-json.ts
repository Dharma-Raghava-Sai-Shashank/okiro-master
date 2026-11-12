// Small local models sometimes write a tool call as plain JSON text instead of using the
// tool-call channel. These helpers detect that (pure; unit-tested).

/** True when a whole reply is just a JSON tool call like {"name": "...", "arguments": {...}}. */
export function looksLikeToolCallJson(text: string): boolean {
  return parseToolCallJson(text) !== null
}

export function parseToolCallJson(text: string): { name: string; args: Record<string, unknown> } | null {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  if (!t.startsWith('{') || !t.endsWith('}')) return null
  try {
    const o = JSON.parse(t) as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : typeof o.function === 'string' ? o.function : null
    const args = (o.arguments ?? o.parameters ?? o.args ?? {}) as unknown
    if (!name || typeof args !== 'object' || args === null) return null
    return { name, args: args as Record<string, unknown> }
  } catch {
    return null
  }
}
