import { describe, expect, it } from 'vitest'
import { parseDiagnostics } from '../src/main/runner/diagnostics'
import { looksLikeToolCallJson, parseToolCallJson } from '../src/main/coach/toolcall-json'

describe('parseDiagnostics', () => {
  it('parses clang errors and warnings', () => {
    const out = [
      "main.cpp:12:5: error: use of undeclared identifier 'x'",
      '    x = 1;',
      '    ^',
      "/tmp/abc/main.cpp:3:1: warning: unused variable 'y'",
      '1 error generated.'
    ].join('\n')
    expect(parseDiagnostics(out)).toEqual([
      { line: 12, col: 5, severity: 'error', message: "use of undeclared identifier 'x'" },
      { line: 3, col: 1, severity: 'warning', message: "unused variable 'y'" }
    ])
  })
})

describe('tool-call JSON written as text', () => {
  it('detects it (the qwen2.5-coder:3b case)', () => {
    const t = '{\n  "name": "explain",\n  "arguments": {\n    "problem": { "name": "2261B" }\n  }\n}'
    expect(parseToolCallJson(t)).toEqual({ name: 'explain', args: { problem: { name: '2261B' } } })
    expect(looksLikeToolCallJson('```json\n{"name": "run_tests", "arguments": {}}\n```')).toBe(true)
  })
  it('ignores normal replies and other JSON', () => {
    expect(looksLikeToolCallJson('Sure! Sort the array first.')).toBe(false)
    expect(looksLikeToolCallJson('{"a": 1}')).toBe(false)
  })
})
