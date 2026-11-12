import type { RatingPoint, SyncResult, UserInfo } from '@shared/types'
import { get, run, tx } from '../db'
import { getSettings, updateSettings } from '../settings'
import { cfApi, type CfSubmission } from './api'
import { classifyContest } from './classify'

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000
let inflight: Promise<SyncResult> | null = null

export function sync(force: boolean): Promise<SyncResult> {
  inflight ??= doSync(force).finally(() => {
    inflight = null
  })
  return inflight
}

async function doSync(force: boolean): Promise<SyncResult> {
  const s = getSettings()
  const result: SyncResult = { contests: 0, problems: 0, submissions: 0, at: Date.now() }
  try {
    const catalogEmpty = !get<{ n: number }>('SELECT 1 AS n FROM problems LIMIT 1')
    if (force || catalogEmpty || Date.now() - s.lastSyncAt > CATALOG_TTL_MS) {
      const [contests, problemset] = [await cfApi.contests(), await cfApi.problemset()]
      const solvedCounts = new Map(problemset.problemStatistics.map((p) => [`${p.contestId}${p.index}`, p.solvedCount]))
      tx(() => {
        for (const c of contests) {
          if (c.phase !== 'FINISHED' || !c.startTimeSeconds) continue
          run(
            `INSERT INTO contests (id, name, type, start_time, duration, phase) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type, phase = excluded.phase`,
            c.id,
            c.name,
            classifyContest(c.name),
            c.startTimeSeconds * 1000,
            c.durationSeconds,
            c.phase
          )
          result.contests++
        }
        for (const p of problemset.problems) {
          if (!p.contestId) continue
          run(
            `INSERT INTO problems (contest_id, idx, name, rating, tags, solved_count) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(contest_id, idx) DO UPDATE SET name = excluded.name, rating = excluded.rating,
               tags = excluded.tags, solved_count = excluded.solved_count`,
            p.contestId,
            p.index,
            p.name,
            p.rating ?? null,
            JSON.stringify(p.tags),
            solvedCounts.get(`${p.contestId}${p.index}`) ?? 0
          )
          result.problems++
        }
      })
      updateSettings({ lastSyncAt: Date.now() })
    }
    if (s.handle) result.submissions = saveSubmissions(await cfApi.userStatus(s.handle), false)
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
  }
  return result
}

export function saveSubmissions(subs: CfSubmission[], fromApp: boolean): number {
  let n = 0
  tx(() => {
    for (const x of subs) {
      if (!x.contestId || x.contestId >= 100000) continue
      run(
        `INSERT INTO submissions (id, contest_id, idx, verdict, passed_tests, time_ms, created_at, from_app)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET verdict = excluded.verdict, passed_tests = excluded.passed_tests,
           time_ms = excluded.time_ms, from_app = MAX(from_app, excluded.from_app)`,
        x.id,
        x.contestId,
        x.problem.index,
        x.verdict ?? 'TESTING',
        x.passedTestCount,
        x.timeConsumedMillis,
        x.creationTimeSeconds * 1000,
        fromApp ? 1 : 0
      )
      n++
    }
  })
  return n
}

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const row = get<{ value: string; fetched_at: number }>('SELECT value, fetched_at FROM kv_cache WHERE key = ?', key)
  if (row && Date.now() - row.fetched_at < ttlMs) return Promise.resolve(JSON.parse(row.value) as T)
  return load()
    .then((v) => {
      run(
        'INSERT INTO kv_cache (key, value, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at',
        key,
        JSON.stringify(v),
        Date.now()
      )
      return v
    })
    .catch((e) => {
      if (row) return JSON.parse(row.value) as T
      throw e
    })
}

export async function userInfo(): Promise<UserInfo | null> {
  const { handle } = getSettings()
  if (!handle) return null
  return cached(`user:${handle}`, 60 * 60 * 1000, async () => {
    const [u] = await cfApi.userInfo(handle)
    return {
      handle: u.handle,
      rating: u.rating ?? null,
      maxRating: u.maxRating ?? null,
      rank: u.rank ?? null,
      avatar: u.titlePhoto ?? null
    }
  }).catch(() => null)
}

export async function ratingHistory(): Promise<RatingPoint[]> {
  const { handle } = getSettings()
  if (!handle) return []
  return cached(`rating:${handle}`, 6 * 60 * 60 * 1000, async () =>
    (await cfApi.userRating(handle)).map((r) => ({
      contestId: r.contestId,
      contestName: r.contestName,
      time: r.ratingUpdateTimeSeconds * 1000,
      newRating: r.newRating
    }))
  ).catch(() => [])
}
