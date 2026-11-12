import { describe, expect, it } from 'vitest'
import { parseKbFile } from '../src/main/coach/kb-parse'

const md = `---
topic: Binary search on the answer
tags: [binary search, greedy]
---
# Binary search on the answer

## Recognize it
- "minimize the maximum" or "maximize the minimum" with a monotone feasibility check.

## Core idea
Guess the answer x, check feasibility in O(n), and binary search on x because feasibility is monotone.

## Tiny
x
`

describe('parseKbFile', () => {
  it('reads front matter and splits by ## sections', () => {
    const chunks = parseKbFile('05-binary-search.md', md)
    expect(chunks.map((c) => c.heading)).toEqual(['Recognize it', 'Core idea'])
    expect(chunks[0].topic).toBe('Binary search on the answer')
    expect(chunks[0].tags).toEqual(['binary search', 'greedy'])
    expect(chunks[1].text.startsWith('# Binary search on the answer — Core idea')).toBe(true)
  })
})
