import type {
  ChatMessage,
  CoachEvent,
  CoachRequest,
  ContestFilter,
  CustomRunResult,
  Insights,
  ModelInfo,
  ProblemWork,
  StressRecord,
  UiActionRequest,
  ContestRow,
  DayEvent,
  DayStat,
  LlmStatus,
  MemoryNote,
  ProblemDetail,
  ProblemRef,
  PullProgress,
  RatingPoint,
  Roadmap,
  RunResponse,
  Settings,
  StatsSummary,
  Submission,
  SubmitEvent,
  SyncResult,
  TestCase,
  UserInfo
} from './types'

export interface OkiroApi {
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
    setClaudeKey(key: string): Promise<void>
    clearClaudeKey(): Promise<void>
  }
  cf: {
    sync(force: boolean): Promise<SyncResult>
    contests(filter: ContestFilter): Promise<ContestRow[]>
    roadmap(): Promise<Roadmap>
    problem(ref: ProblemRef, refetch: boolean): Promise<ProblemDetail>
    user(): Promise<UserInfo | null>
    ratingHistory(): Promise<RatingPoint[]>
    openLogin(): Promise<boolean>
    openExternal(url: string): Promise<void>
    submissions(ref: ProblemRef): Promise<Submission[]>
  }
  workspace: {
    getCode(ref: ProblemRef): Promise<string>
    saveCode(ref: ProblemRef, code: string): Promise<void>
    tests(ref: ProblemRef): Promise<TestCase[]>
    addTest(ref: ProblemRef, input: string, expected: string): Promise<TestCase>
    updateTest(id: number, input: string, expected: string): Promise<void>
    deleteTest(id: number): Promise<void>
    run(ref: ProblemRef, code: string, testIds: number[] | null): Promise<RunResponse>
    submit(ref: ProblemRef, code: string): Promise<void>
    filePath(ref: ProblemRef): Promise<string>
    work(ref: ProblemRef): Promise<ProblemWork>
    saveNotes(ref: ProblemRef, notes: string): Promise<void>
    addActiveTime(ref: ProblemRef, ms: number): Promise<number>
    runCustom(ref: ProblemRef, code: string, input: string): Promise<CustomRunResult>
    lastStress(ref: ProblemRef): Promise<StressRecord | null>
    addTestFromStress(ref: ProblemRef): Promise<TestCase | null>
  }
  coach: {
    send(req: CoachRequest): Promise<string>
    stop(turnId: string): Promise<void>
    history(scope: string): Promise<ChatMessage[]>
    clear(scope: string): Promise<void>
    memory(): Promise<MemoryNote[]>
    uiResult(id: string, result: string): Promise<void>
  }
  llm: {
    status(): Promise<LlmStatus>
    start(): Promise<LlmStatus>
    pull(model: string): Promise<void>
    indexKb(): Promise<void>
    modelInfo(model: string): Promise<ModelInfo | null>
  }
  voice: {
    requestMic(): Promise<boolean>
  }
  stats: {
    days(from: string, to: string): Promise<DayStat[]>
    dayEvents(date: string): Promise<DayEvent[]>
    summary(): Promise<StatsSummary>
    insights(): Promise<Insights>
  }
  lsp: {
    start(): Promise<{ workDir: string } | null>
    send(message: string): void
  }
  on<K extends keyof OkiroEvents>(channel: K, cb: (payload: OkiroEvents[K]) => void): () => void
}

export interface OkiroEvents {
  'coach:event': CoachEvent
  'submit:event': SubmitEvent
  'llm:pull': PullProgress
  'lsp:message': string
  'sync:done': SyncResult
  'kb:progress': { done: number; total: number; error?: string }
  'coach:ui-action': UiActionRequest
}

/** Invoke-style methods per group; preload generates bridges and main registers handlers from this list. */
export const API_METHODS = {
  settings: ['get', 'update', 'setClaudeKey', 'clearClaudeKey'],
  cf: ['sync', 'contests', 'roadmap', 'problem', 'user', 'ratingHistory', 'openLogin', 'openExternal', 'submissions'],
  workspace: [
    'getCode',
    'saveCode',
    'tests',
    'addTest',
    'updateTest',
    'deleteTest',
    'run',
    'submit',
    'filePath',
    'work',
    'saveNotes',
    'addActiveTime',
    'runCustom',
    'lastStress',
    'addTestFromStress'
  ],
  coach: ['send', 'stop', 'history', 'clear', 'memory', 'uiResult'],
  llm: ['status', 'start', 'pull', 'indexKb', 'modelInfo'],
  voice: ['requestMic'],
  stats: ['days', 'dayEvents', 'summary', 'insights'],
  lsp: ['start']
} as const

export const EVENT_CHANNELS: (keyof OkiroEvents)[] = [
  'coach:event',
  'submit:event',
  'llm:pull',
  'lsp:message',
  'sync:done',
  'kb:progress',
  'coach:ui-action'
]

export const problemKey = (ref: ProblemRef): string => `${ref.contestId}${ref.index}`
export const problemScope = (ref: ProblemRef): string => `problem:${ref.contestId}${ref.index}`
