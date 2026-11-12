// Tools Arjun can call. Arguments are validated with zod before anything runs.
import { z } from 'zod'
import type { ProblemRef, RunResponse } from '@shared/types'
import type { LlmTool } from '../llm/types'
import { exec, compile, stressTest } from '../runner'
import { currentCode, limitsOf, runProblemTests, saveStress } from '../workspace'
import { getEditorial } from '../cf/scraper'
import { searchKb } from './kb'
import { tagHistory } from '../progress'
import { recentNotes } from './memory'
import { requestUiAction } from './ui-bridge'
import type { UiAction } from '@shared/types'

export interface ToolContext {
  problem?: ProblemRef
  code?: string
}

interface ToolSpec<S extends z.ZodTypeAny> {
  def: LlmTool
  schema: S
  needsProblem: boolean
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<string>
}

const tool = <S extends z.ZodTypeAny>(spec: ToolSpec<S>): ToolSpec<S> => spec

const clip = (s: string, n = 3000) => (s.length > n ? `${s.slice(0, n)}\n…(${s.length - n} more chars)` : s)

export function summarizeRun(r: RunResponse): string {
  if (r.compileError) return `Compilation error:\n${clip(r.compileError, 2500)}`
  if (!r.results.length) return 'No tests to run.'
  return r.results
    .map((t, i) => {
      const head = `Test ${i + 1}: ${t.verdict} (${t.timeMs} ms)${t.message ? ` — ${t.message}` : ''}`
      if (t.verdict === 'AC') return head
      return `${head}\nInput:\n${clip(t.input, 600)}\nExpected:\n${clip(t.expected, 400)}\nGot:\n${clip(t.output, 400)}${t.stderr ? `\nStderr:\n${clip(t.stderr, 400)}` : ''}`
    })
    .join('\n\n')
}

const tools = {
  run_tests: tool({
    def: {
      name: 'run_tests',
      description:
        "Compile C++ code and run it on this problem's sample and custom tests. Omit `code` to test the student's current code.",
      parameters: { type: 'object', properties: { code: { type: 'string', description: 'Full C++ source (optional)' } }, required: [] }
    },
    schema: z.object({ code: z.string().optional() }),
    needsProblem: true,
    run: async (a, ctx) => summarizeRun(await runProblemTests(ctx.problem!, a.code ?? ctx.code ?? currentCode(ctx.problem!), null))
  }),

  run_code: tool({
    def: {
      name: 'run_code',
      description: 'Compile C++ code and run it on a custom input. Use it to check a hypothesis or a small counterexample.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Full C++ source. Use "current" to run the student\'s current code.' },
          input: { type: 'string', description: 'stdin contents' }
        },
        required: ['code', 'input']
      }
    },
    schema: z.object({ code: z.string(), input: z.string() }),
    needsProblem: false,
    run: async (a, ctx) => {
      const source = a.code.trim() === 'current' ? (ctx.code ?? (ctx.problem ? currentCode(ctx.problem) : '')) : a.code
      const c = await compile(source)
      if (!c.binary) return `Compilation error:\n${clip(c.error ?? '', 2500)}`
      const r = await exec(c.binary, [], a.input.endsWith('\n') ? a.input : `${a.input}\n`, 5000)
      if (r.timedOut) return 'Timed out after 5 s.'
      return `Exit code ${r.code}${r.signal ? ` (${r.signal})` : ''}, ${Math.round(r.timeMs)} ms\nStdout:\n${clip(r.stdout, 2000)}${r.stderr ? `\nStderr:\n${clip(r.stderr, 800)}` : ''}`
    }
  }),

  stress_test: tool({
    def: {
      name: 'stress_test',
      description:
        "Find a failing input by random testing: compares a solution (default: the student's current code) with your brute force on inputs from your generator. The generator reads a seed from argv[1] and prints ONE complete test (including the test-count line if the format has one). Keep generated tests tiny (n ≤ 8, small values).",
      parameters: {
        type: 'object',
        properties: {
          brute: { type: 'string', description: 'Obviously-correct slow C++ solution' },
          generator: { type: 'string', description: 'C++ generator using mt19937 seeded from atoi(argv[1])' },
          solution: { type: 'string', description: "C++ solution to test (optional, defaults to the student's code)" },
          iterations: { type: 'number', description: 'Max random tests (default 300)' }
        },
        required: ['brute', 'generator']
      }
    },
    schema: z.object({
      brute: z.string(),
      generator: z.string(),
      solution: z.string().optional(),
      iterations: z.number().int().positive().max(2000).optional()
    }),
    needsProblem: true,
    run: async (a, ctx) => {
      const solution = a.solution ?? ctx.code ?? currentCode(ctx.problem!)
      const r = await stressTest(solution, a.brute, a.generator, a.iterations ?? 300, limitsOf(ctx.problem!))
      if (r.error) return r.error
      if (r.ok) return `No difference found in ${r.iterations} random tests.`
      const ce = r.counterexample!
      saveStress(ctx.problem!, { ...ce, iterations: r.iterations, at: Date.now() })
      return `Found a failing input after ${r.iterations} tests (${ce.verdict}).\nInput:\n${clip(ce.input, 1500)}\nBrute force output:\n${clip(ce.expected, 800)}\nSolution output:\n${clip(ce.got, 800)}`
    }
  }),

  search_knowledge: tool({
    def: {
      name: 'search_knowledge',
      description: 'Search your competitive-programming technique notes (recognition signals, templates, pitfalls, classic problems).',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    schema: z.object({ query: z.string().min(2) }),
    needsProblem: false,
    run: async (a) => {
      const hits = await searchKb(a.query, 3)
      return hits.length ? hits.map((h) => clip(h.text, 2500)).join('\n\n---\n\n') : 'No notes found.'
    }
  }),

  get_editorial: tool({
    def: {
      name: 'get_editorial',
      description: 'Load the official editorial section for the current problem (hidden from the student; respect the spoiler level).',
      parameters: { type: 'object', properties: {}, required: [] }
    },
    schema: z.object({}),
    needsProblem: true,
    run: async (_a, ctx) => {
      const e = await getEditorial(ctx.problem!)
      if (!e) return 'No editorial found for this contest.'
      return `${e.exact ? '' : "(Could not isolate this problem's section; these are the most relevant parts.)\n"}${clip(e.text, 6000)}`
    }
  }),

  app_action: tool({
    def: {
      name: 'app_action',
      description:
        'Do something in the app for the student: open a page, open a problem (or the next one on the roadmap), run the tests, start a submission (the student confirms), change the calendar view or spoiler level, or open the chat transcript. Use it only when the student asks for it.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['navigate', 'open_problem', 'open_next_problem', 'run_tests', 'submit', 'show_calendar', 'set_spoiler', 'open_chat', 'read_problem']
          },
          page: { type: 'string', enum: ['home', 'contests', 'calendar', 'stats', 'settings'] },
          contestId: { type: 'number' },
          index: { type: 'string', description: 'Problem letter, e.g. "C" or "D1"' },
          view: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
          level: { type: 'number', description: 'Spoiler level 0-4' }
        },
        required: ['action']
      }
    },
    schema: z.object({
      action: z.enum(['navigate', 'open_problem', 'open_next_problem', 'run_tests', 'submit', 'show_calendar', 'set_spoiler', 'open_chat', 'read_problem']),
      page: z.enum(['home', 'contests', 'calendar', 'stats', 'settings']).optional(),
      contestId: z.number().int().positive().optional(),
      index: z
        .string()
        .regex(/^[A-Za-z][0-9]?$/)
        .optional(),
      view: z.enum(['day', 'week', 'month', 'year']).optional(),
      level: z.number().int().min(0).max(4).optional()
    }),
    needsProblem: false,
    run: async (a) => {
      const action = toUiAction(a)
      if (!action) return 'Missing details for that action (e.g. which page or problem).'
      return requestUiAction(action)
    }
  }),

  get_user_history: tool({
    def: {
      name: 'get_user_history',
      description: "The student's solved counts and failed attempts per tag, plus your saved notes about them.",
      parameters: { type: 'object', properties: { tag: { type: 'string', description: 'Codeforces tag (optional)' } }, required: [] }
    },
    schema: z.object({ tag: z.string().optional() }),
    needsProblem: false,
    run: async (a) => {
      const hist = tagHistory(a.tag)
        .slice(0, 15)
        .map((h) => `${h.tag}: solved ${h.solved}, failed attempts ${h.failedAttempts}`)
      const notes = recentNotes(10).map((n) => `- ${n.note}`)
      return `Per tag:\n${hist.join('\n') || 'no data'}\n\nNotes:\n${notes.join('\n') || 'none'}`
    }
  })
}

function toUiAction(a: {
  action: string
  page?: 'home' | 'contests' | 'calendar' | 'stats' | 'settings'
  contestId?: number
  index?: string
  view?: 'day' | 'week' | 'month' | 'year'
  level?: number
}): UiAction | null {
  switch (a.action) {
    case 'navigate':
      return a.page ? { type: 'navigate', page: a.page } : null
    case 'open_problem':
      return a.contestId && a.index ? { type: 'open_problem', contestId: a.contestId, index: a.index.toUpperCase() } : { type: 'open_problem', next: true }
    case 'open_next_problem':
      return { type: 'open_problem', next: true }
    case 'run_tests':
      return { type: 'run_tests' }
    case 'submit':
      return { type: 'submit' }
    case 'show_calendar':
      return { type: 'show_calendar', view: a.view ?? 'month' }
    case 'set_spoiler':
      return a.level !== undefined ? { type: 'set_spoiler', level: a.level } : null
    case 'open_chat':
      return { type: 'open_chat', open: true }
    case 'read_problem':
      return { type: 'read_problem', part: 'statement' }
    default:
      return null
  }
}

type ToolName = keyof typeof tools

export const TOOL_NAMES = new Set<string>()

for (const k of Object.keys(tools)) TOOL_NAMES.add(k)

export function toolDefs(hasProblem: boolean): LlmTool[] {
  return Object.values(tools)
    .filter((t) => hasProblem || !t.needsProblem)
    .map((t) => t.def)
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const spec = tools[name as ToolName] as unknown as ToolSpec<z.ZodTypeAny> | undefined
  if (!spec) return `Unknown tool "${name}".`
  if (spec.needsProblem && !ctx.problem) return 'This tool needs an open problem.'
  const parsed = spec.schema.safeParse(args)
  if (!parsed.success) return `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
  try {
    return await spec.run(parsed.data, ctx)
  } catch (e) {
    return `Tool failed: ${e instanceof Error ? e.message : String(e)}`
  }
}
