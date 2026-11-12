// Instant voice commands handled locally (no LLM round-trip). Pure; unit-tested.
import type { AppPage, CalendarView, UiAction } from '@shared/types'

export interface Intent {
  action: UiAction
  /** Spoken acknowledgement; executors may replace it with a result ("3 of 4 passed"). */
  ack: string
}

const PAGES: [RegExp, AppPage, string][] = [
  [/\b(home|dashboard|main page|start page)\b/, 'home', 'Going home.'],
  [/\b(contests?|contest list|problem ?set|problem list|grid)\b/, 'contests', 'Here are your contests.'],
  [/\b(stats|statistics|analytics|progress page|insights)\b/, 'stats', 'Opening your stats.'],
  [/\b(settings|preferences)\b/, 'settings', 'Opening settings.'],
  [/\b(calendar|schedule)\b/, 'calendar' as AppPage, 'Opening the calendar.']
]

const VIEWS: CalendarView[] = ['day', 'week', 'month', 'year']

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, first: 1, second: 2, third: 3, fourth: 4 }

function num(s: string | undefined): number | undefined {
  if (!s) return undefined
  return /^\d+$/.test(s) ? parseInt(s, 10) : WORD_NUMBERS[s]
}

export function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'’]/g, '')
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/^(hey |ok |okay |so |um |uh |please |arjun )+/g, '')
    .replace(/\s+(please|arjun|now|for me)$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchIntent(raw: string): Intent | null {
  const t = normalizeUtterance(raw)
  if (!t) return null
  const words = t.split(' ').length

  if (/\b(stop|end|quit|pause) (listening|the conversation|talking)\b|^(goodbye|bye|bye bye|thats all|that is all)$/.test(t)) {
    return { action: { type: 'stop_listening' }, ack: 'Okay, catch you later.' }
  }
  if (/^(stop|quiet|be quiet|shut up|enough|wait|hold on|ok stop|okay stop|pause)$/.test(t)) {
    return { action: { type: 'stop_speaking' }, ack: '' }
  }
  if (/\bhow am i doing\b|\bhow is my progress\b|\bmy progress\b|\bhow far (am i|have i come)\b/.test(t)) {
    return { action: { type: 'stats_summary' }, ack: '' }
  }

  // Everything below is a short command; longer sentences go to Arjun.
  if (words > 9) return null

  const prob = /\b(\d{3,4}) ?([a-h])(\d)?\b/.exec(t)
  if (prob && /\b(open|go to|show|load|problem|start)\b/.test(t)) {
    const index = `${prob[2].toUpperCase()}${prob[3] ?? ''}`
    return { action: { type: 'open_problem', contestId: parseInt(prob[1], 10), index }, ack: `Opening ${prob[1]} ${index}.` }
  }
  if (/\b(next|another|new) (problem|question|one)\b|\bwhats next\b|\bwhat is next\b|\bmove on\b/.test(t)) {
    return { action: { type: 'open_problem', next: true }, ack: 'Next one coming up.' }
  }
  if (/\bsubmit\b/.test(t)) {
    return { action: { type: 'submit' }, ack: '' }
  }
  const sample = /\b(run|test) (sample|test|example) (\d+|one|two|three|four|five|first|second|third)\b/.exec(t)
  if (sample) {
    const n = num(sample[3])
    return { action: { type: 'run_tests', test: n }, ack: '' }
  }
  if (/^(run|run it|test it|run the code|compile)$|\b(run|execute|check) (the |my |all )?(tests?|samples?|examples?|code|solution)\b/.test(t)) {
    return { action: { type: 'run_tests' }, ack: '' }
  }
  const readSample = /\bread (?:the )?(?:sample|example) (\d+|one|two|three|first|second|third)\b/.exec(t)
  if (readSample) return { action: { type: 'read_problem', part: 'sample', sample: num(readSample[1]) }, ack: '' }
  const read = /\bread (?:me )?(?:out )?(?:the )?(problem|statement|question|input|output|note)\b/.exec(t)
  if (read) {
    const part = read[1] === 'input' ? 'input' : read[1] === 'output' ? 'output' : read[1] === 'note' ? 'note' : 'statement'
    return { action: { type: 'read_problem', part }, ack: '' }
  }
  if (/\b(use|switch to|ask|talk to) claude\b/.test(t)) return { action: { type: 'set_provider', provider: 'claude' }, ack: 'Switching to Claude.' }
  if (/\b(use|switch to|back to) (local|offline|the local model)\b/.test(t)) {
    return { action: { type: 'set_provider', provider: 'ollama' }, ack: 'Back to the local model.' }
  }
  if (/\b(more|bigger|stronger) (hints?|spoilers?)\b/.test(t)) return { action: { type: 'set_spoiler', delta: 1 }, ack: 'Okay, I will give away a bit more.' }
  if (/\b(fewer|less|smaller|no more) (hints?|spoilers?)\b/.test(t)) return { action: { type: 'set_spoiler', delta: -1 }, ack: 'Got it, fewer spoilers.' }
  const level = /\bspoiler level (\d|zero|one|two|three|four)\b/.exec(t)
  if (level) return { action: { type: 'set_spoiler', level: level[1] === 'zero' ? 0 : num(level[1]) }, ack: 'Spoiler level set.' }
  if (/\b(open|show) (the )?(chat|transcript)\b/.test(t)) return { action: { type: 'open_chat', open: true }, ack: '' }
  if (/\b(close|hide) (the )?(chat|transcript)\b/.test(t)) return { action: { type: 'open_chat', open: false }, ack: '' }
  if (/\bfocus mode\b/.test(t)) return { action: { type: 'focus_mode' }, ack: '' }

  if (/\b(go|take me|open|show|switch|navigate)\b/.test(t) || words <= 3) {
    for (const v of VIEWS) {
      if (new RegExp(`\\b(${v}|${v}ly) view\\b|\\b(this|the) ${v}\\b|\\bcalendar (by )?${v}\\b`).test(t) && /\bcalendar|view\b/.test(t)) {
        return { action: { type: 'show_calendar', view: v }, ack: `Here is your ${v}.` }
      }
    }
    for (const [re, page, ack] of PAGES) if (re.test(t)) return { action: { type: 'navigate', page }, ack }
  }
  return null
}

/** Yes/no answers while a confirmation (e.g. submit) is pending. */
export function matchConfirm(raw: string): boolean | null {
  const t = normalizeUtterance(raw)
  if (/^(yes|yeah|yep|yup|sure|do it|go ahead|confirm|submit|submit it|ok|okay|haan|ha)( please| it| now)?$/.test(t)) return true
  if (/^(no|nope|nah|cancel|dont|do not|wait|not yet|stop)( please| it| now)?$/.test(t)) return false
  return null
}
