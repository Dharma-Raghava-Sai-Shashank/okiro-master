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
  voiceEnabled: boolean
  sttModel: string
  ttsVoice: string
  ttsSpeed: number
  voiceEffort: 'low' | 'medium' | 'high'
  autoListen: boolean
  /** Arjun buffers speech through pauses and only replies once this word is said. Empty = send on every pause. */
  endWord: string
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
  lastSyncAt: 0,
  voiceEnabled: true,
  sttModel: 'onnx-community/whisper-small.en',
  ttsVoice: 'af_heart',
  ttsSpeed: 1,
  voiceEffort: 'low',
  autoListen: true,
  endWord: 'okiro'
}

export const TTS_VOICES: { id: string; label: string }[] = [
  { id: 'af_heart', label: 'Heart (US) ★' },
  { id: 'af_bella', label: 'Bella (US)' },
  { id: 'af_nicole', label: 'Nicole (US, soft)' },
  { id: 'bf_emma', label: 'Emma (UK)' },
  { id: 'am_michael', label: 'Michael (US)' },
  { id: 'system', label: 'macOS system voice' }
]

export const STT_MODELS: { id: string; label: string }[] = [
  { id: 'onnx-community/whisper-small.en', label: 'Whisper small (accurate) ★' },
  { id: 'onnx-community/moonshine-base-ONNX', label: 'Moonshine (fastest)' },
  { id: 'onnx-community/whisper-base.en', label: 'Whisper base' }
]

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

export interface CompileDiagnostic {
  line: number
  col: number
  severity: 'error' | 'warning' | 'note'
  message: string
}

export interface RunResponse {
  compileError?: string
  diagnostics?: CompileDiagnostic[]
  results: TestResult[]
}

export interface CustomRunResult {
  compileError?: string
  diagnostics?: CompileDiagnostic[]
  stdout: string
  stderr: string
  timeMs: number
  exitCode: number | null
  timedOut: boolean
}

export interface StressRecord {
  input: string
  expected: string
  got: string
  verdict: string
  iterations: number
  at: number
}

export interface ProblemWork {
  code: string
  notes: string
  activeMs: number
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
  /** Spoken conversation: short spoken-style replies, faster effort. */
  voice?: boolean
}

export type AppPage = 'home' | 'contests' | 'calendar' | 'stats' | 'settings'
export type CalendarView = 'day' | 'week' | 'month' | 'year'

/** Things Arjun (or a voice command) can do in the app. */
export type UiAction =
  | { type: 'navigate'; page: AppPage }
  | { type: 'open_problem'; contestId?: number; index?: string; next?: boolean }
  | { type: 'run_tests'; test?: number }
  | { type: 'submit'; confirmed?: boolean }
  | { type: 'show_calendar'; view: CalendarView }
  | { type: 'set_spoiler'; level?: number; delta?: number }
  | { type: 'open_chat'; open: boolean }
  | { type: 'read_problem'; part: 'statement' | 'input' | 'output' | 'note' | 'sample'; sample?: number }
  | { type: 'set_provider'; provider: ProviderId }
  | { type: 'focus_mode'; on?: boolean }
  | { type: 'stats_summary' }
  | { type: 'stop_speaking' }
  | { type: 'stop_listening' }

export interface UiActionRequest {
  id: string
  action: UiAction
}

export type CoachEvent =
  | { turnId: string; scope: string; type: 'start'; model: string }
  | { turnId: string; scope: string; type: 'reasoning'; delta: string }
  | { turnId: string; scope: string; type: 'text'; delta: string }
  | { turnId: string; scope: string; type: 'tool-start'; name: string; args: string }
  | { turnId: string; scope: string; type: 'tool-end'; name: string; result: string }
  | { turnId: string; scope: string; type: 'done'; message: ChatMessage }
  | { turnId: string; scope: string; type: 'error'; error: string }

export interface ModelInfo {
  name: string
  capabilities: string[]
  parameterSize: string
  /** Billions of parameters, parsed from parameterSize (0 when unknown). */
  billions: number
  family: string
}

export interface LlmStatus {
  totalMemGb: number
  recommendedModel: string
  chatModelInfo: ModelInfo | null
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

export interface Insights {
  rating: {
    current: number | null
    max: number | null
    delta30d: number
    /** Projected time (ms) to reach 2100 from the recent trend, or null when not trending up. */
    projectedMasterAt: number | null
    perContestSlope: number
    history: RatingPoint[]
  }
  pace: {
    weekly: { weekStart: string; completed: number; cumulative: number }[]
    perWeek4: number
    etaAt: number | null
  }
  verdicts: { verdict: string; count: number }[]
  firstTryRate: number
  bands: { rating: number; solved: number; total: number; firstTry: number; avgAttempts: number }[]
  tags: { tag: string; solved: number; failed: number; rate: number }[]
  focusTags: { tag: string; solved: number; failed: number; rate: number }[]
  strongTags: { tag: string; solved: number; failed: number; rate: number }[]
  solveTime: { rating: number; medianMin: number; samples: number }[]
  byHour: number[]
  byWeekday: number[]
  bests: { mostInDay: number; mostInDayDate: string | null; longestStreak: number; hardest: { name: string; rating: number; contestId: number; index: string } | null }
  recentAcs: { contestId: number; index: string; name: string; rating: number | null; at: number }[]
  heatmap: DayStat[]
  read: string[]
}
