// Reads constraints out of a Codeforces statement ("1 ≤ n ≤ 2·10^5", "sum of n does not exceed …")
// and turns them into a complexity budget. Pure; used by the Problem pane chips and by Arjun's context.

export interface Bound {
  variable: string
  max: number
  label: string
}

export interface ConstraintFacts {
  bounds: Bound[]
  multiTest: boolean
  sumBound: Bound | null
  /** Short chips for the UI, e.g. "n ≤ 2·10^5 → O(n log n)". */
  chips: string[]
  /** One-paragraph complexity budget for the LLM. */
  budget: string
}

const SIZE_VARS = ['n', 'm', 'k', 'q', 's', 'l', 'h', 'w', 'r', 'c']

/** Parse a TeX-ish number: "2 \cdot 10^5", "10^{9}", "200\,000", "2·10^5", "1e9". */
export function parseTexNumber(raw: string): number | null {
  const s = raw
    .replace(/\\,|\\;|\\!|~|\s/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\cdot|\\times|·|×|\*/g, '*')
    .replace(/,/g, '')
    .replace(/\.+$/, '')
  let m = /^(\d+(?:\.\d+)?)\*10\^(\d+)$/.exec(s)
  if (m) return parseFloat(m[1]) * 10 ** parseInt(m[2], 10)
  m = /^10\^(\d+)$/.exec(s)
  if (m) return 10 ** parseInt(m[1], 10)
  m = /^2\^(\d+)$/.exec(s)
  if (m) return 2 ** parseInt(m[1], 10)
  m = /^(\d+(?:\.\d+)?)e(\d+)$/i.exec(s)
  if (m) return parseFloat(m[1]) * 10 ** parseInt(m[2], 10)
  m = /^(\d+)(?:-1)?$/.exec(s)
  if (m) return parseInt(m[1], 10)
  return null
}

export function formatPow(n: number): string {
  if (n < 10000) return String(n)
  const exp = Math.floor(Math.log10(n))
  const mant = n / 10 ** exp
  if (Math.abs(mant - Math.round(mant)) < 1e-9) {
    const r = Math.round(mant)
    return r === 1 ? `10^${exp}` : `${r}·10^${exp}`
  }
  return n.toLocaleString('en-US')
}

function normalizeVar(v: string): string {
  return v
    .replace(/\\mathit|\\text|\\mathrm/g, '')
    .replace(/[{}\s$]/g, '')
    .replace(/\\/g, '')
}

export function budgetFor(n: number): string {
  if (n <= 12) return 'O(n!) / brute force'
  if (n <= 25) return 'O(2^n · n)'
  if (n <= 100) return 'O(n^4)'
  if (n <= 500) return 'O(n^3)'
  if (n <= 5000) return 'O(n^2)'
  if (n <= 1_000_000) return 'O(n log n)'
  if (n <= 100_000_000) return 'O(n) tight'
  return 'O(√n) / O(log n) / math'
}

export function analyzeConstraints(statement: string): ConstraintFacts {
  const text = statement.replace(/\$\$?/g, ' ').replace(/≤/g, '\\le ').replace(/≥/g, '\\ge ')
  const bounds = new Map<string, Bound>()
  // lo ≤ var(, var2) ≤ hi
  const re = /(-?\d(?:\d|\\,|\s|[{}^·.])*)\s*\\leq?\s*([a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?)?(?:\s*,\s*[a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?)?)*)\s*\\leq?\s*((?:\d|\\,|\s|[{}^·.])+(?:\\cdot\s*10\^\{?\d+\}?)?)/g
  for (const m of text.matchAll(re)) {
    const max = parseTexNumber(m[3])
    if (max === null || max < 1) continue
    for (const v of m[2].split(',')) {
      const variable = normalizeVar(v)
      if (!variable) continue
      const prev = bounds.get(variable)
      if (!prev || prev.max < max) bounds.set(variable, { variable, max, label: `${variable} ≤ ${formatPow(max)}` })
    }
  }
  let sumBound: Bound | null = null
  const sum = /sum of (?:the values of |all )?\s*([a-zA-Z])\b[^.]{0,80}?(?:does not exceed|not exceed|at most|\\le)\s*((?:\d|\\,|\s|[{}^·.])+(?:\\cdot\s*10\^\{?\d+\}?)?)/i.exec(text)
  if (sum) {
    const max = parseTexNumber(sum[2])
    if (max) sumBound = { variable: sum[1], max, label: `Σ${sum[1]} ≤ ${formatPow(max)}` }
  }
  const list = [...bounds.values()]
  const multiTest = bounds.has('t') || /test cases/i.test(statement)
  const sizes = list.filter((b) => SIZE_VARS.includes(b.variable))
  const main = sumBound ?? sizes.sort((a, b) => b.max - a.max)[0] ?? null
  const values = list.filter((b) => !SIZE_VARS.includes(b.variable) && b.variable !== 't')
  const bigValue = values.find((b) => b.max >= 1e9) ?? null
  const chips: string[] = []
  const budget: string[] = []
  if (main) {
    chips.push(`${main.label} → ${budgetFor(main.max)}`)
    budget.push(`Input size: ${main.label}${sumBound ? ' (summed over all test cases)' : ''}, so aim for ${budgetFor(main.max)}.`)
  }
  for (const b of sizes) if (b !== main && b.variable !== main?.variable) chips.push(b.label)
  if (multiTest) {
    chips.push('multi-test → reset state')
    budget.push('There are multiple test cases: reset all global state per test, and per-test work must be proportional to that test, not to the max bound.')
  }
  const sumsOverflow = bigValue || (main && values.some((v) => v.max * main.max > 2_147_483_647))
  if (bigValue) chips.push(`${bigValue.label} → long long`)
  if (sumsOverflow) budget.push('Sums or products can exceed 2^31 − 1: use long long.')
  return { bounds: list, multiTest, sumBound, chips, budget: budget.join(' ') }
}
