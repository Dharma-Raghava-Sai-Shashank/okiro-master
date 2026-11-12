import { describe, expect, it } from 'vitest'
import { matchConfirm, matchIntent } from '../src/renderer/src/voice/intents'

describe('matchIntent', () => {
  it.each([
    ['Open the next problem.', { type: 'open_problem', next: true }],
    ['Go to stats', { type: 'navigate', page: 'stats' }],
    ['run the tests', { type: 'run_tests' }],
    ['Run sample 2', { type: 'run_tests', test: 2 }],
    ['open problem 1950 C', { type: 'open_problem', contestId: 1950, index: 'C' }],
    ['submit it', { type: 'submit' }],
    ['stop listening', { type: 'stop_listening' }],
    ['Stop.', { type: 'stop_speaking' }],
    ['show calendar year view', { type: 'show_calendar', view: 'year' }],
    ['How am I doing?', { type: 'stats_summary' }],
    ['read the problem', { type: 'read_problem', part: 'statement' }]
  ])('%s', (text, action) => {
    expect(matchIntent(text)?.action).toEqual(action)
  })

  it('leaves real questions to Arjun', () => {
    expect(matchIntent('How do I use a segment tree for range minimum queries here?')).toBeNull()
    expect(matchIntent('I think we should sort the array first and then use two pointers')).toBeNull()
  })
})

describe('matchConfirm', () => {
  it('understands yes / no', () => {
    expect(matchConfirm('Yes, please.')).toBe(true)
    expect(matchConfirm('no')).toBe(false)
    expect(matchConfirm('maybe later')).toBeNull()
  })
})
