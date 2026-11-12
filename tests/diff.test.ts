import { describe, expect, it } from 'vitest'
import { diffOutputs } from '../src/renderer/src/lib/diff'
import { splitStatement } from '../src/renderer/src/lib/statement'

describe('diffOutputs', () => {
  it('marks the first differing token', () => {
    const d = diffOutputs('1 2\n3 4\n', '1 2\n3 5\n')
    expect(d.map((l) => l.status)).toEqual(['same', 'diff'])
    expect(d[1].firstBadToken).toBe(1)
  })
  it('ignores spacing inside a line', () => {
    expect(diffOutputs('1  2', '1 2')[0].status).toBe('same')
  })
  it('reports missing and extra lines', () => {
    expect(diffOutputs('1\n2', '1').map((l) => l.status)).toEqual(['same', 'missing'])
    expect(diffOutputs('1', '1\n2').map((l) => l.status)).toEqual(['same', 'extra'])
  })
})

describe('splitStatement', () => {
  it('splits the Codeforces sections', () => {
    const p = splitStatement('Legend text\nInput\nThe first line\nOutput\nPrint it\nExamples\n1\nNote\nExplained')
    expect(p.legend).toBe('Legend text')
    expect(p.input).toBe('The first line')
    expect(p.output).toBe('Print it')
    expect(p.note).toBe('Explained')
  })
})
