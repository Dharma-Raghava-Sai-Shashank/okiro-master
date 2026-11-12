import { describe, expect, it } from 'vitest'
import { SentenceChunker, toSpeakable } from '../src/renderer/src/voice/speech'

describe('toSpeakable', () => {
  it('strips markdown and inline code', () => {
    expect(toSpeakable('Use **two pointers** on `a`.')).toBe('Use two pointers on a.')
  })
  it('makes math speakable', () => {
    expect(toSpeakable('n ≤ 2·10^5, so O(n log n).')).toBe('n at most two times ten to the five, so O of n log n.')
    expect(toSpeakable('a_i')).toBe('a i')
  })
  it('never reads code blocks aloud', () => {
    expect(toSpeakable('Try this:\n```cpp\nint x;\n```\nDone.')).toBe('Try this: I have put the code on screen. Done.')
  })
})

describe('SentenceChunker', () => {
  it('emits whole sentences as they complete', () => {
    const c = new SentenceChunker()
    expect(c.push('Hello there friend. How are')).toEqual(['Hello there friend.'])
    expect(c.push(' you?')).toEqual([])
    expect(c.flush()).toEqual(['How are you?'])
  })
  it('does not split decimals', () => {
    const c = new SentenceChunker()
    expect(c.push('It takes 1.5 seconds. Next')).toEqual(['It takes 1.5 seconds.'])
  })
  it('holds an open code fence until it closes', () => {
    const c = new SentenceChunker()
    expect(c.push('Look:\n```cpp\nint main() {')).toEqual([])
    expect(c.push('}\n```\nNice work there.')).toEqual(['Look: I have put the code on screen.'])
    expect(c.flush()).toEqual(['Nice work there.'])
  })
})
