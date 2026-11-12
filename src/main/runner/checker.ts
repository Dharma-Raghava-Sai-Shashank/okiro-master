export interface CheckOptions {
  anyCase: boolean
  epsilon: number
}

const isNumber = (s: string) => /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)

/** Token-wise comparison that ignores whitespace layout, like Codeforces' default checkers. */
export function check(output: string, expected: string, opts: CheckOptions): { ok: boolean; message?: string } {
  const got = output.split(/\s+/).filter(Boolean)
  const want = expected.split(/\s+/).filter(Boolean)
  for (let i = 0; i < Math.max(got.length, want.length); i++) {
    const g = got[i]
    const w = want[i]
    if (g === undefined) return { ok: false, message: `Output ended early: expected token ${i + 1} "${w}"` }
    if (w === undefined) return { ok: false, message: `Extra output starting at token ${i + 1} "${g}"` }
    if (g === w) continue
    if (opts.anyCase && g.toLowerCase() === w.toLowerCase()) continue
    if (isNumber(g) && isNumber(w) && (/[.eE]/.test(g) || /[.eE]/.test(w))) {
      const a = parseFloat(g)
      const b = parseFloat(w)
      if (Math.abs(a - b) <= opts.epsilon * Math.max(1, Math.abs(b))) continue
    }
    return { ok: false, message: `Token ${i + 1}: expected "${w}", got "${g}"` }
  }
  return { ok: true }
}
