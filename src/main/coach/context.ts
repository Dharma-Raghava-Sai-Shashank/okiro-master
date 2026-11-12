// Assembles everything Arjun should know for a turn, deterministically from the database,
// so the numbers he quotes are always real.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SPOILER_LEVELS, type CoachRequest, type ProblemDetail, type Settings } from '@shared/types'
import { get } from '../db'
import { resourcesDir } from '../paths'
import { dayStats, roadmap, submissionsFor, summary } from '../progress'
import { isoDate } from '../progress/model'
import { userInfo } from '../cf/sync'
import { getProblem } from '../cf/scraper'
import { lastRuns } from '../workspace'
import { recentNotes } from './memory'
import { searchKb } from './kb'
import { summarizeRun } from './tools'

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s)

let persona: string | null = null

export function personaText(s: Settings): string {
  if (s.personaOverride.trim()) return s.personaOverride
  persona ??= readFileSync(join(resourcesDir(), 'persona', 'arjun.md'), 'utf8')
  return persona
}

const SPOILER_RULES = [
  'Nudge: only ask guiding questions and point at what to look at. No techniques, no approach.',
  'Hint: give ONE key observation or idea at a time, as small as possible. Never the full approach.',
  'Approach: you may describe the approach in words (technique, key steps, complexity) once the student has tried. No code.',
  'Pseudocode: you may give the full approach and pseudocode or small code fragments. No complete solution.',
  'Full solution: you may explain everything and give complete code if the student asks.'
]

async function progressBlock(s: Settings): Promise<string> {
  const [user, rm, stats] = [await userInfo(), roadmap(), summary()]
  const today = isoDate(new Date())
  const [day] = dayStats(today, today)
  const lines = [
    `Date: ${new Date().toDateString()}`,
    user
      ? `Student: ${user.handle}, rating ${user.rating ?? 'unrated'} (max ${user.maxRating ?? '—'}, ${user.rank ?? 'unranked'}). Goal: Master (2100).`
      : 'Student handle not set yet. Goal: Master (2100).',
    `Training rule: in each contest solve every problem rated ≤ ${s.ratingCap}.`,
    `Roadmap: ${rm.contestsDone}/${rm.windowContests} contests complete, ${rm.contestsLeft} left; ${rm.problemsDone}/${rm.problemsTotal} target problems solved.`,
    rm.current
      ? `Current position: ${rm.current.contest.name} (id ${rm.current.contest.id}), ${rm.current.targetSolved}/${rm.current.targetTotal} done; next problem ${rm.current.contest.id}${rm.current.problem.index} "${rm.current.problem.name}" (${rm.current.problem.rating ?? 'unrated'}).`
      : 'Current position: every contest in the window is complete.',
    rm.nextUp.length
      ? `Next contests: ${rm.nextUp
          .slice(0, 3)
          .map((n) => `${n.contest.name} (${n.remaining.length} left)`)
          .join('; ')}`
      : '',
    `Today: solved ${day?.solved ?? 0}, contests completed ${day?.contestsCompleted ?? 0}. Daily goal: ${s.dailyContestGoal} contest or ${s.dailyProblemGoal} problems${day?.goalMet ? ' — MET' : ''}.`,
    `Solve streak: ${stats.streak} days (best ${stats.bestStreak}). Total solved on Codeforces: ${stats.totalSolved}.`
  ]
  return lines.filter(Boolean).join('\n')
}

function problemBlock(p: ProblemDetail, showTags: boolean): string {
  return [
    `${p.contestId}${p.index} — ${p.name} (rating ${p.rating ?? 'unrated'})${showTags && p.tags.length ? ` — tags (spoiler): ${p.tags.join(', ')}` : ''}`,
    `Time limit ${p.timeLimitMs / 1000} s, memory ${p.memoryMb} MB${p.interactive ? ', INTERACTIVE problem' : ''}${p.anyCase ? ', YES/NO in any case accepted' : ''}.`,
    '',
    clip(p.statementText, 9000)
  ].join('\n')
}

export interface TurnContext {
  system: string
  problem?: ProblemDetail
}

export async function buildContext(req: CoachRequest, s: Settings): Promise<TurnContext> {
  const parts: string[] = [personaText(s)]
  parts.push(`# Progress (facts from the database — quote exactly)\n${await progressBlock(s)}`)

  const notes = recentNotes(8)
  if (notes.length) parts.push(`# What you remember about the student\n${notes.map((n) => `- ${n.note}`).join('\n')}`)

  let problem: ProblemDetail | undefined
  if (req.problem) {
    try {
      problem = await getProblem(req.problem, false)
      parts.push(`# Current problem\n${problemBlock(problem, true)}`)
    } catch (e) {
      parts.push(
        `# Current problem\n${req.problem.contestId}${req.problem.index} — the statement could not be loaded (${e instanceof Error ? e.message : String(e)}). Tell the student and work from what they describe.`
      )
    }

    const code = req.code ?? ''
    if (code.trim()) parts.push(`# Student's current code\n\`\`\`cpp\n${clip(code, 9000)}\n\`\`\``)

    const run = req.lastRun ?? lastRuns.get(`${req.problem.contestId}${req.problem.index}`)
    if (run) parts.push(`# Latest local test run\n${clip(summarizeRun(run), 3500)}`)

    const subs = submissionsFor(req.problem).slice(0, 6)
    if (subs.length) {
      parts.push(
        `# Codeforces submissions for this problem (newest first)\n${subs
          .map((x) => `- ${x.verdict}${x.verdict !== 'OK' ? ` on test ${x.passedTests + 1}` : ''} at ${new Date(x.createdAt).toLocaleString()}`)
          .join('\n')}`
      )
    }

    const query = problem ? `${problem.name}\n${problem.tags.join(' ')}\n${problem.statementText.slice(0, 1500)}\n${req.text}` : req.text
    const kb = await searchKb(query, 4, problem?.tags ?? [])
    if (kb.length) parts.push(`# Reference notes (your knowledge base)\n${kb.map((k) => clip(k.text, 2200)).join('\n\n---\n\n')}`)

    const ed = get<{ text: string; exact: number }>('SELECT text, exact FROM editorials WHERE contest_id = ? AND idx = ?', req.problem.contestId, req.problem.index)
    if (ed?.text) {
      parts.push(
        `# HIDDEN EDITORIAL — for you only. Never quote it; reveal only what the spoiler level allows.\n${ed.exact ? '' : '(Section boundaries were unclear; parts of the contest editorial.)\n'}${clip(ed.text, 6000)}`
      )
    } else {
      parts.push('# Editorial\nNot loaded yet. Call get_editorial if you need to confirm the intended solution.')
    }
  } else if (req.text.trim()) {
    const kb = await searchKb(req.text, 3)
    if (kb.length) parts.push(`# Reference notes (your knowledge base)\n${kb.map((k) => clip(k.text, 2000)).join('\n\n---\n\n')}`)
  }

  const level = Math.max(0, Math.min(4, s.spoilerLevel))
  parts.push(`# Spoiler level: ${level} — ${SPOILER_LEVELS[level]}\n${SPOILER_RULES[level]}\nIf the student explicitly asks for more ("just tell me", "show the solution"), you may go one level further and say that you're doing so.`)

  return { system: parts.join('\n\n'), problem }
}
