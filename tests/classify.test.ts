import { describe, expect, it } from 'vitest'
import { classifyContest, compareIndex, levelOf } from '../src/main/cf/classify'

describe('classifyContest', () => {
  it.each([
    ['Codeforces Round 934 (Div. 2)', 'div2'],
    ['Codeforces Round 934 (Div. 1)', 'div1'],
    ['Codeforces Round 943 (Div. 3)', 'div3'],
    ['Codeforces Round 944 (Div. 4)', 'div4'],
    ['Educational Codeforces Round 164 (Rated for Div. 2)', 'edu'],
    ['Codeforces Global Round 25', 'global'],
    ['Codeforces Round 942 (Div. 1 + Div. 2)', 'div12'],
    ['CodeTON Round 8 (Div. 1 + Div. 2, Rated, Prizes!)', 'div12'],
    ['Kotlin Heroes: Episode 15', 'other']
  ])('%s → %s', (name, type) => {
    expect(classifyContest(name)).toBe(type)
  })
})

describe('problem indexes', () => {
  it('sorts like Codeforces', () => {
    expect(['C2', 'B', 'D', 'C1', 'A', 'F'].sort(compareIndex)).toEqual(['A', 'B', 'C1', 'C2', 'D', 'F'])
  })
  it('groups sub-problems into their level', () => {
    expect(levelOf('C1')).toBe('C')
    expect(levelOf('E')).toBe('E')
  })
})
