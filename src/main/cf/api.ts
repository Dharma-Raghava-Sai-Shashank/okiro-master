// Thin client for the public Codeforces API (https://codeforces.com/apiHelp).
// Codeforces asks for at most one request every two seconds, so calls are serialized.

const BASE = 'https://codeforces.com/api/'
const MIN_GAP_MS = 2100

let chain: Promise<unknown> = Promise.resolve()
let lastCall = 0

export interface CfContest {
  id: number
  name: string
  type: string
  phase: string
  durationSeconds: number
  startTimeSeconds?: number
}

export interface CfProblem {
  contestId?: number
  index: string
  name: string
  rating?: number
  tags: string[]
}

export interface CfProblemStat {
  contestId?: number
  index: string
  solvedCount: number
}

export interface CfSubmission {
  id: number
  contestId?: number
  creationTimeSeconds: number
  problem: CfProblem
  verdict?: string
  passedTestCount: number
  timeConsumedMillis: number
}

export interface CfUser {
  handle: string
  rating?: number
  maxRating?: number
  rank?: string
  titlePhoto?: string
}

export interface CfRatingChange {
  contestId: number
  contestName: string
  ratingUpdateTimeSeconds: number
  newRating: number
}

async function rawCall<T>(method: string, params: Record<string, string | number>): Promise<T> {
  const wait = lastCall + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const res = await fetch(`${BASE}${method}?${qs}`, { signal: AbortSignal.timeout(60_000) })
  const body = (await res.json().catch(() => null)) as { status: string; result?: T; comment?: string } | null
  if (!body) throw new Error(`Codeforces ${method}: HTTP ${res.status}`)
  if (body.status !== 'OK') throw new Error(`Codeforces ${method}: ${body.comment ?? body.status}`)
  return body.result as T
}

function call<T>(method: string, params: Record<string, string | number> = {}): Promise<T> {
  const p = chain.then(() => rawCall<T>(method, params))
  chain = p.catch(() => undefined)
  return p
}

export const cfApi = {
  contests: () => call<CfContest[]>('contest.list', { gym: 'false' }),
  problemset: () => call<{ problems: CfProblem[]; problemStatistics: CfProblemStat[] }>('problemset.problems'),
  userStatus: (handle: string, count?: number) =>
    call<CfSubmission[]>('user.status', count ? { handle, from: 1, count } : { handle }),
  userInfo: (handle: string) => call<CfUser[]>('user.info', { handles: handle }),
  userRating: (handle: string) => call<CfRatingChange[]>('user.rating', { handle })
}
