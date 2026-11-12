import { describe, expect, it } from 'vitest'
import { check } from '../src/main/runner/checker'

const opts = { anyCase: false, epsilon: 1e-6 }

describe('checker', () => {
  it('ignores whitespace layout', () => {
    expect(check('1 2\n3\n', '1\n2 3', opts).ok).toBe(true)
  })
  it('reports the first differing token', () => {
    const r = check('1 2 4', '1 2 3', opts)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('Token 3')
  })
  it('detects missing and extra output', () => {
    expect(check('1', '1 2', opts).ok).toBe(false)
    expect(check('1 2', '1', opts).ok).toBe(false)
  })
  it('compares floats with tolerance', () => {
    expect(check('0.3333333', '0.333333333', opts).ok).toBe(true)
    expect(check('0.34', '0.333333333', opts).ok).toBe(false)
  })
  it('does not apply tolerance to integers', () => {
    expect(check('1000000000000000001', '1000000000000000000', opts).ok).toBe(false)
  })
  it('accepts any case only when the problem allows it', () => {
    expect(check('yes', 'YES', opts).ok).toBe(false)
    expect(check('yes', 'YES', { ...opts, anyCase: true }).ok).toBe(true)
  })
})
