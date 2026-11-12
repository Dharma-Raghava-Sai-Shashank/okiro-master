// Line-by-line comparison of expected vs actual output, with the first differing token marked.
// Whitespace-insensitive within a line, like the checker. Pure; unit-tested.

export type LineStatus = 'same' | 'diff' | 'missing' | 'extra'

export interface DiffLine {
  n: number
  expected: string | null
  got: string | null
  status: LineStatus
  /** Index of the first differing whitespace-separated token on a 'diff' line. */
  firstBadToken: number
}

const tokens = (s: string) => s.trim().split(/\s+/).filter(Boolean)

export function diffOutputs(expected: string, got: string, anyCase = false): DiffLine[] {
  const norm = (s: string) => s.replace(/\r/g, '').replace(/\s+$/, '')
  const e = norm(expected).split('\n')
  const g = norm(got).split('\n')
  if (e.length === 1 && e[0] === '') e.length = 0
  if (g.length === 1 && g[0] === '') g.length = 0
  const out: DiffLine[] = []
  for (let i = 0; i < Math.max(e.length, g.length); i++) {
    const ex = i < e.length ? e[i] : null
    const gt = i < g.length ? g[i] : null
    if (ex === null) {
      out.push({ n: i + 1, expected: null, got: gt, status: 'extra', firstBadToken: 0 })
      continue
    }
    if (gt === null) {
      out.push({ n: i + 1, expected: ex, got: null, status: 'missing', firstBadToken: 0 })
      continue
    }
    const a = tokens(ex)
    const b = tokens(gt)
    let bad = -1
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      const x = a[k]
      const y = b[k]
      if (x === y || (anyCase && x !== undefined && y !== undefined && x.toLowerCase() === y.toLowerCase())) continue
      bad = k
      break
    }
    out.push({ n: i + 1, expected: ex, got: gt, status: bad < 0 ? 'same' : 'diff', firstBadToken: Math.max(0, bad) })
  }
  return out
}

export function firstDiffLine(lines: DiffLine[]): DiffLine | null {
  return lines.find((l) => l.status !== 'same') ?? null
}
