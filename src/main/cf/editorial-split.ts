// Split a contest editorial blog into per-problem sections (pure, unit-tested).

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface SplitProblem {
  index: string
  name: string
}

/** Earliest heading-like position of each problem in the text, or -1. */
function locate(text: string, contestId: number, p: SplitProblem): number {
  const candidates: number[] = []
  const byId = new RegExp(`\\b${contestId}\\s?${escape(p.index)}\\b`).exec(text)
  if (byId) candidates.push(byId.index)
  if (p.name.length >= 3) {
    const byName = new RegExp(`(^|\\n)[^\\n]{0,40}${escape(p.name)}`, 'i').exec(text)
    if (byName) candidates.push(byName.index + byName[1].length)
  }
  if (candidates.length === 0) {
    const byLetter = new RegExp(`(^|\\n)[ \\t]*(?:Problem[ \\t]+)?${escape(p.index)}[ \\t]*[.):\\-—][ \\t]*\\S`).exec(text)
    if (byLetter) candidates.push(byLetter.index + byLetter[1].length)
  }
  return candidates.length ? Math.min(...candidates) : -1
}

export function splitEditorial(text: string, contestId: number, problems: SplitProblem[]): Map<string, string> {
  const found = problems
    .map((p) => ({ index: p.index, pos: locate(text, contestId, p) }))
    .filter((x) => x.pos >= 0)
    .sort((a, b) => a.pos - b.pos)
  const out = new Map<string, string>()
  for (let i = 0; i < found.length; i++) {
    const end = i + 1 < found.length ? found[i + 1].pos : text.length
    const section = text.slice(found[i].pos, end).trim()
    if (section.length > 40) out.set(found[i].index, section)
  }
  return out
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? [])

/** Fallback when headings can't be found: the paragraphs that overlap most with the problem's own words. */
export function bestChunks(text: string, query: string, maxChars = 5000): string {
  const paras = text.split(/\n{2,}/)
  const chunks: string[] = []
  let cur = ''
  for (const p of paras) {
    if (cur.length + p.length > 1200 && cur) {
      chunks.push(cur)
      cur = ''
    }
    cur += (cur ? '\n\n' : '') + p
  }
  if (cur) chunks.push(cur)
  const q = words(query)
  const scored = chunks
    .map((c, i) => {
      let score = 0
      for (const w of words(c)) if (q.has(w)) score++
      return { c, i, score }
    })
    .sort((a, b) => b.score - a.score)
  const picked: { c: string; i: number }[] = []
  let total = 0
  for (const s of scored) {
    if (total + s.c.length > maxChars) {
      // Always return something: the best chunk, trimmed to fit.
      if (picked.length === 0) picked.push({ c: s.c.slice(0, maxChars), i: s.i })
      break
    }
    picked.push(s)
    total += s.c.length
  }
  return picked
    .sort((a, b) => a.i - b.i)
    .map((p) => p.c)
    .join('\n\n…\n\n')
}
