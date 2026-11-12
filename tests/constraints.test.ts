import { describe, expect, it } from 'vitest'
import { analyzeConstraints, budgetFor, formatPow, parseTexNumber } from '../src/shared/constraints'

const statement = [
  'The first line contains a single integer $t$ ($1 \\le t \\le 10^4$) — the number of test cases.',
  'The first line of each test case contains $n$ ($1 \\le n \\le 2 \\cdot 10^5$).',
  'The second line contains $a_1, a_2, \\ldots, a_n$ ($1 \\le a_i \\le 10^9$).',
  'It is guaranteed that the sum of $n$ over all test cases does not exceed $2 \\cdot 10^5$.'
].join('\n')

describe('parseTexNumber', () => {
  it.each([
    ['2 \\cdot 10^5', 200000],
    ['10^{9}', 1e9],
    ['200\\,000', 200000],
    ['1e9', 1e9],
    ['5000.', 5000],
    ['2·10^5', 200000]
  ])('%s → %d', (raw, n) => {
    expect(parseTexNumber(raw)).toBe(n)
  })
})

describe('formatPow / budgetFor', () => {
  it('formats powers of ten', () => {
    expect(formatPow(200000)).toBe('2·10^5')
    expect(formatPow(1e9)).toBe('10^9')
    expect(formatPow(5000)).toBe('5000')
  })
  it('maps sizes to complexity', () => {
    expect(budgetFor(20)).toBe('O(2^n · n)')
    expect(budgetFor(5000)).toBe('O(n^2)')
    expect(budgetFor(200000)).toBe('O(n log n)')
    expect(budgetFor(1e18)).toBe('O(√n) / O(log n) / math')
  })
})

describe('analyzeConstraints', () => {
  const f = analyzeConstraints(statement)
  it('finds bounds, the sum bound and multi-test', () => {
    expect(f.bounds.find((b) => b.variable === 'n')?.max).toBe(200000)
    expect(f.bounds.find((b) => b.variable === 'a_i')?.max).toBe(1e9)
    expect(f.sumBound?.max).toBe(200000)
    expect(f.multiTest).toBe(true)
  })
  it('produces chips and a budget', () => {
    expect(f.chips).toContain('Σn ≤ 2·10^5 → O(n log n)')
    expect(f.chips).toContain('multi-test → reset state')
    expect(f.chips).toContain('a_i ≤ 10^9 → long long')
    expect(f.budget).toContain('O(n log n)')
    expect(f.budget).toContain('long long')
  })
})
