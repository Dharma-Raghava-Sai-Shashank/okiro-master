import { describe, expect, it } from 'vitest'
import { bestChunks, splitEditorial } from '../src/main/cf/editorial-split'

const blog = `Thanks for participating!

1950A - Stair, Peak, or Neither?
Just compare a, b and c directly.
Solution code here.

1950B - Upscaling
Each cell becomes a 2x2 block; the colour alternates with (i + j) parity.

1950C - Clock Conversion
Convert the hour: h % 12, and 0 becomes 12. AM if h < 12.
`

const problems = [
  { index: 'A', name: 'Stair, Peak, or Neither?' },
  { index: 'B', name: 'Upscaling' },
  { index: 'C', name: 'Clock Conversion' }
]

describe('splitEditorial', () => {
  it('splits by contest-id headings', () => {
    const s = splitEditorial(blog, 1950, problems)
    expect(s.get('B')).toContain('2x2 block')
    expect(s.get('B')).not.toContain('Clock')
    expect(s.get('C')).toContain('h % 12')
  })
  it('falls back to "Problem X." headings', () => {
    const text = 'Problem A. Something\nIdea for A goes here and is long enough.\n\nProblem B. Other\nIdea for B goes here and is long enough too.'
    const s = splitEditorial(text, 1, [
      { index: 'A', name: 'zz' },
      { index: 'B', name: 'yy' }
    ])
    expect(s.get('A')).toContain('Idea for A')
    expect(s.get('B')).toContain('Idea for B')
  })
})

describe('bestChunks', () => {
  it('prefers paragraphs sharing words with the problem', () => {
    const filler = (w: string) => `${w} `.repeat(120).trim()
    const text = [filler('stairs peak'), filler('upscaling pixels'), `Convert the hour first. ${filler('clock conversion')}`].join('\n\n')
    const out = bestChunks(text, 'clock conversion hour', 900)
    expect(out).toContain('Convert the hour')
    expect(out).not.toContain('upscaling')
  })

  it('returns a trimmed chunk even when the best one is too long', () => {
    expect(bestChunks(blog, 'clock conversion hour', 100).length).toBe(100)
  })
})
