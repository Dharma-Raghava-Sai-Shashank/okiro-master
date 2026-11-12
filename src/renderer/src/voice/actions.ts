// Executes app actions requested by voice commands or by Arjun's app_action tool.
import type { RunResponse, UiAction } from '@shared/types'
import { SPOILER_LEVELS } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../lib/store'
import { splitStatement } from '../lib/statement'
import { useBridge } from './bridge'
import { useVoice } from './store'

export interface ActionContext {
  /** Speak long-form content (statement reading, stats summary). */
  speakLong: (text: string) => void
  /** True when the request came from a spoken conversation (confirmations happen by voice). */
  voice: boolean
}

const go = (path: string) => {
  window.location.hash = `#${path}`
}

const VERDICT_WORDS: Record<string, string> = {
  WA: 'wrong answer',
  TLE: 'time limit exceeded',
  RE: 'runtime error',
  CE: 'compilation error',
  SKIP: 'no expected output'
}

export function describeRun(r: RunResponse): string {
  if (r.compileError) {
    const d = r.diagnostics?.find((x) => x.severity === 'error')
    return d ? `It doesn't compile. Line ${d.line}: ${d.message}.` : "It doesn't compile. The errors are on screen."
  }
  if (!r.results.length) return 'There are no tests to run yet.'
  const passed = r.results.filter((x) => x.verdict === 'AC').length
  if (passed === r.results.length) {
    const max = Math.max(...r.results.map((x) => x.timeMs))
    return r.results.length === 1 ? `The test passes in ${max} milliseconds.` : `All ${r.results.length} tests pass. Slowest was ${max} milliseconds.`
  }
  const firstBad = r.results.findIndex((x) => x.verdict !== 'AC')
  const bad = r.results[firstBad]
  return `${passed} of ${r.results.length} pass. Test ${firstBad + 1} gives ${VERDICT_WORDS[bad.verdict] ?? bad.verdict}${bad.message && bad.verdict === 'WA' ? ` — ${bad.message.toLowerCase()}` : ''}.`
}

export async function executeAction(action: UiAction, ctx: ActionContext): Promise<string> {
  const ws = useBridge.getState().workspace
  switch (action.type) {
    case 'navigate':
      go(action.page === 'home' ? '/' : `/${action.page}`)
      return `Opened ${action.page}.`
    case 'show_calendar':
      go(`/calendar?view=${action.view}`)
      return `Showing the calendar by ${action.view}.`
    case 'open_problem': {
      if (action.next || !action.contestId || !action.index) {
        const rm = await api.cf.roadmap()
        if (!rm.current) return 'Every contest in your window is done.'
        const { contest, problem } = rm.current
        go(`/problem/${contest.id}/${problem.index}`)
        return `Opening ${contest.name}, problem ${problem.index}: ${problem.name}${problem.rating ? `, rated ${problem.rating}` : ''}.`
      }
      go(`/problem/${action.contestId}/${action.index}`)
      return `Opening ${action.contestId} ${action.index}.`
    }
    case 'run_tests': {
      if (!ws) return 'Open a problem first, then I can run its tests.'
      let ids: number[] | null = null
      if (action.test) {
        const t = ws.tests()[action.test - 1]
        if (!t) return `There is no test ${action.test}.`
        ids = [t.id]
      }
      return describeRun(await ws.runTests(ids))
    }
    case 'submit': {
      if (!ws) return 'Open a problem first.'
      const label = `${ws.ref.contestId} ${ws.ref.index}`
      if (!action.confirmed) {
        if (ctx.voice) {
          useVoice.getState().set({ pendingConfirm: { type: 'submit', confirmed: true } })
          return `Submit ${label} to Codeforces? Say yes or no.`
        }
        if (!window.confirm(`Submit ${label} to Codeforces?`)) return 'The student cancelled the submission.'
      }
      await ws.submit()
      return `Submitted ${label}. I'll tell you the verdict.`
    }
    case 'set_spoiler': {
      const cur = useApp.getState().settings?.spoilerLevel ?? 1
      const level = Math.max(0, Math.min(4, action.level ?? cur + (action.delta ?? 0)))
      await useApp.getState().updateSettings({ spoilerLevel: level })
      return `Spoiler level is now ${SPOILER_LEVELS[level]}.`
    }
    case 'set_provider':
      useApp.getState().setProvider(action.provider)
      return action.provider === 'claude' ? 'Switched to Claude.' : 'Switched to the local model.'
    case 'open_chat':
      useVoice.getState().set({ chatOpen: action.open })
      return action.open ? 'Opened the transcript.' : 'Closed the transcript.'
    case 'focus_mode':
      if (!ws) return 'Focus mode works in the workspace.'
      ws.toggleFocus(action.on)
      return 'Toggled focus mode.'
    case 'read_problem': {
      if (!ws?.problem) return 'Open a problem first.'
      if (action.part === 'sample') {
        const samples = ws.tests().filter((t) => t.isSample)
        const s = samples[(action.sample ?? 1) - 1]
        if (!s) return `There is no sample ${action.sample ?? 1}.`
        if (ctx.voice) ctx.speakLong(`Sample ${action.sample ?? 1}. Input: ${s.input.trim().split('\n').join('. ')}. Expected output: ${s.expected.trim().split('\n').join('. ')}.`)
        return 'Reading the sample.'
      }
      const parts = splitStatement(ws.problem.statementText)
      const text = { statement: parts.legend, input: parts.input, output: parts.output || parts.interaction, note: parts.note }[action.part]
      if (!text) return `This problem has no ${action.part} section.`
      if (ctx.voice) ctx.speakLong(action.part === 'statement' ? `${ws.problem.name}. ${text}` : text)
      return `Reading the ${action.part}.`
    }
    case 'stats_summary': {
      const ins = await api.stats.insights()
      if (ctx.voice) ctx.speakLong(ins.read.join(' '))
      return ins.read.join(' ')
    }
    case 'stop_speaking':
    case 'stop_listening':
      return ''
  }
}
