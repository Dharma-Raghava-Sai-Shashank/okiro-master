// Splits a knowledge-base Markdown file into retrievable "##" sections (pure; unit-tested).

export interface ParsedChunk {
  file: string
  topic: string
  heading: string
  tags: string[]
  text: string
}

export function parseKbFile(file: string, raw: string): ParsedChunk[] {
  let body = raw
  let topic = file.replace(/\.md$/, '')
  let tags: string[] = []
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw)
  if (fm) {
    body = raw.slice(fm[0].length)
    const t = /^topic:\s*(.+)$/m.exec(fm[1])
    if (t) topic = t[1].trim()
    const g = /^tags:\s*\[(.*)\]$/m.exec(fm[1])
    if (g) tags = g[1].split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  }
  const out: ParsedChunk[] = []
  const parts = body.split(/^## /m)
  const intro = parts.shift()?.replace(/^# .*\n/, '').trim()
  if (intro && intro.length > 80) out.push({ file, topic, heading: 'Overview', tags, text: `# ${topic}\n${intro}` })
  for (const part of parts) {
    const nl = part.indexOf('\n')
    const heading = (nl < 0 ? part : part.slice(0, nl)).trim()
    const content = nl < 0 ? '' : part.slice(nl + 1).trim()
    if (content.length < 40) continue
    out.push({ file, topic, heading, tags, text: `# ${topic} — ${heading}\n${content}` })
  }
  return out
}
