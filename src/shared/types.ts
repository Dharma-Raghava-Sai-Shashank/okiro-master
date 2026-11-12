export type ContestType = 'div1' | 'div2' | 'div3' | 'div4' | 'edu' | 'global' | 'div12' | 'other'

export const CONTEST_TYPE_LABELS: Record<ContestType, string> = {
  div1: 'Div 1',
  div2: 'Div 2',
  div3: 'Div 3',
  div4: 'Div 4',
  edu: 'Educational',
  global: 'Global',
  div12: 'Div 1+2',
  other: 'Other'
}

export type ProviderId = 'ollama' | 'claude'

export interface Settings {
  handle: string
  ratingCap: number
  includeUnrated: boolean
  contestTypes: ContestType[]
  windowSize: number
  dailyContestGoal: number
  dailyProblemGoal: number
  ollamaHost: string
  ollamaModel: string
  embedModel: string
  claudeModel: string
  reasoningEffort: 'low' | 'medium' | 'high'
  spoilerLevel: number
  compilerPath: string
  cppStd: string
  extraFlags: string
  submitLanguage: string
  personaOverride: string
  onboarded: boolean
  lastSyncAt: number
}

export const DEFAULT_SETTINGS: Settings = {
  handle: '',
  ratingCap: 2000,
  includeUnrated: false,
  contestTypes: ['div1', 'div2', 'div3', 'div4', 'edu', 'global', 'div12'],
  windowSize: 300,
  dailyContestGoal: 1,
  dailyProblemGoal: 4,
  ollamaHost: 'http://127.0.0.1:11434',
  ollamaModel: 'gpt-oss:20b',
  embedModel: 'nomic-embed-text',
  claudeModel: 'claude-opus-5-5',
  reasoningEffort: 'high',
  spoilerLevel: 1,
  compilerPath: 'clang++',
  cppStd: 'c++20',
  extraFlags: '-O2',
  submitLanguage: 'G++20',
  personaOverride: '',
  onboarded: false,
  lastSyncAt: 0
}

export const SPOILER_LEVELS = ['Nudge', 'Hint', 'Approach', 'Pseudocode', 'Full solution'] as const

export interface Contest {
  id: number
  name: string
  type: ContestType
  startTime: number
  duration: number
}

export type ProblemStatus = 'untouched' | 'attempted' | 'solved'

export interface ProblemCell {
  contestId: number
  index: string
  name: string
  rating: number | null
  tags: string[]
  status: ProblemStatus
  inTarget: boolean
}

export interface ContestRow {
  contest: Contest
  problems: ProblemCell[]
  targetTotal: number
  targetSolved: number
}

export interface ContestFilter {
  types: ContestType[]
  ratingCap: number
  limit: number
  search: string
  hideCompleted: boolean
}

export interface ProblemRef {
  contestId: number
  index: string
}

export interface RoadmapStep {
  contest: Contest
  remaining: ProblemCell[]
  targetTotal: number
}

export interface Roadmap {
  windowContests: number
  contestsDone: number
  contestsLeft: number
  problemsDone: number
  problemsTotal: number
  current: { contest: Contest; problem: ProblemCell; targetTotal: number; targetSolved: number } | null
  nextUp: RoadmapStep[]
}

export interface ProblemDetail {
  contestId: number
  index: string
  name: string
  rating: number | null
  tags: string[]
  statementHtml: string
  statementText: string
  timeLimitMs: number
  memoryMb: number
  interactive: boolean
  anyCase: boolean
  url: string
}

export interface TestCase {
  id: number
  input: string
  expected: string
  isSample: boolean
}

export type Verdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | 'SKIP'

export interface TestResult {
  testId: number
  verdict: Verdict
  timeMs: number
  output: string
  stderr: string
  expected: string
  input: string
  message?: string
}

export interface RunResponse {
  compileError?: string
  results: TestResult[]
}

export interface Submission {
  id: number
  contestId: number
  index: string
  verdict: string
  passedTests: number
  timeMs: number
  createdAt: number
  fromApp: boolean
}

export type SubmitPhase = 'opening' | 'login-required' | 'submitting' | 'judging' | 'done' | 'error'

export interface SubmitEvent {
  contestId: number
  index: string
  phase: SubmitPhase
  message?: string
  submission?: Submission
}

export type ChatRole = 'user' | 'assistant'

export interface ToolTrace {
  name: string
  args: string
  result: string
}

export interface ChatMessage {
  id: number
  scope: string
  role: ChatRole
  content: string
  reasoning: string
  tools: ToolTrace[]
  model: string
  createdAt: number
}

export type CoachAction = 'greet' | 'explain' | 'hint' | 'review' | 'why-wa' | 'chat'

export interface CoachRequest {
  scope: string
  problem?: ProblemRef
  text: string
  action: CoachAction
  code?: string
  provider: ProviderId
  lastRun?: RunResponse
}

export type CoachEvent =
  | { turnId: string; scope: string; type: 'start'; model: string }
  | { turnId: string; scope: string; type: 'reasoning'; delta: string }
  | { turnId: string; scope: string; type: 'text'; delta: string }
  | { turnId: string; scope: string; type: 'tool-start'; name: string; args: string }
  | { turnId: string; scope: string; type: 'tool-end'; name: string; result: string }
  | { turnId: string; scope: string; type: 'done'; message: ChatMessage }
  | { turnId: string; scope: string; type: 'error'; error: string }

export interface LlmStatus {
  ollamaInstalled: boolean
  ollamaRunning: boolean
  models: string[]
  chatModelReady: boolean
  embedModelReady: boolean
  kbChunks: number
  kbEmbedded: number
  claudeKeySet: boolean
}

export interface PullProgress {
  model: string
  status: string
  completed: number
  total: number
  done: boolean
  error?: string
}

export interface SyncResult {
  contests: number
  problems: number
  submissions: number
  at: number
  error?: string
}

export interface UserInfo {
  handle: string
  rating: number | null
  maxRating: number | null
  rank: string | null
  avatar: string | null
}

export interface RatingPoint {
  contestId: number
  contestName: string
  time: number
  newRating: number
}

export interface DayEvent {
  time: number
  kind: 'solved' | 'attempted' | 'contest-complete'
  contestId: number
  index: string
  name: string
  rating: number | null
  verdict?: string
}

export interface DayStat {
  date: string
  solved: number
  attempted: number
  contestsCompleted: number
  goalMet: boolean
}

export interface StatsSummary {
  totalSolved: number
  targetSolved: number
  byLevel: { level: string; solved: number; total: number }[]
  byRating: { rating: number; solved: number; total: number }[]
  byTag: { tag: string; solved: number }[]
  streak: number
  bestStreak: number
  roadmap: Roadmap
}

export interface MemoryNote {
  id: number
  kind: 'solve' | 'lesson' | 'struggle'
  tag: string
  note: string
  createdAt: number
}
