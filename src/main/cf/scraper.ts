import type { ProblemDetail, ProblemRef } from '@shared/types'
import { all, get, run, tx } from '../db'
import { scrape } from './browser'
import { extractBlogText, extractProblem, extractTutorialLinks, type ExtractedProblem } from './extractors'
import { bestChunks, splitEditorial } from './editorial-split'

interface DetailRow {
  statement_html: string
  statement_text: string
  time_limit_ms: number
  memory_mb: number
  interactive: number
  any_case: number
}

const problemUrl = (ref: ProblemRef) => `https://codeforces.com/contest/${ref.contestId}/problem/${ref.index}`

function parseSeconds(s: string): number {
  const m = s.match(/([\d.]+)\s*second/i)
  return m ? Math.round(parseFloat(m[1]) * 1000) : 2000
}

function parseMegabytes(s: string): number {
  const m = s.match(/(\d+)\s*megabyte/i)
  return m ? parseInt(m[1], 10) : 256
}

export async function getProblem(ref: ProblemRef, refetch: boolean): Promise<ProblemDetail> {
  const meta = get<{ name: string; rating: number | null; tags: string }>(
    'SELECT name, rating, tags FROM problems WHERE contest_id = ? AND idx = ?',
    ref.contestId,
    ref.index
  )
  let row = get<DetailRow>('SELECT * FROM problem_details WHERE contest_id = ? AND idx = ?', ref.contestId, ref.index)
  if (!row || refetch) {
    const x = await scrape<ExtractedProblem>(`/contest/${ref.contestId}/problem/${ref.index}`, extractProblem.toString())
    if (x.error) throw new Error(x.error)
    const anyCase = /in any case|any letter case|any register|case-insensitive|case insensitive/i.test(x.text)
    tx(() => {
      run(
        `INSERT INTO problem_details (contest_id, idx, statement_html, statement_text, time_limit_ms, memory_mb, interactive, any_case, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(contest_id, idx) DO UPDATE SET statement_html = excluded.statement_html, statement_text = excluded.statement_text,
           time_limit_ms = excluded.time_limit_ms, memory_mb = excluded.memory_mb, interactive = excluded.interactive,
           any_case = excluded.any_case, fetched_at = excluded.fetched_at`,
        ref.contestId,
        ref.index,
        x.html,
        x.text,
        parseSeconds(x.tl),
        parseMegabytes(x.ml),
        x.interactive ? 1 : 0,
        anyCase ? 1 : 0,
        Date.now()
      )
      run('DELETE FROM tests WHERE contest_id = ? AND idx = ? AND is_sample = 1', ref.contestId, ref.index)
      for (const s of x.samples) {
        run('INSERT INTO tests (contest_id, idx, input, expected, is_sample) VALUES (?, ?, ?, ?, 1)', ref.contestId, ref.index, s.input, s.output)
      }
    })
    row = get<DetailRow>('SELECT * FROM problem_details WHERE contest_id = ? AND idx = ?', ref.contestId, ref.index)!
    if (!meta && x.title) {
      run(
        'INSERT OR IGNORE INTO problems (contest_id, idx, name, rating, tags) VALUES (?, ?, ?, NULL, ?)',
        ref.contestId,
        ref.index,
        x.title.replace(/^[A-Z]\d?\.\s*/, ''),
        '[]'
      )
    }
  }
  return {
    contestId: ref.contestId,
    index: ref.index,
    name: meta?.name ?? `${ref.contestId}${ref.index}`,
    rating: meta?.rating ?? null,
    tags: meta ? (JSON.parse(meta.tags) as string[]) : [],
    statementHtml: row.statement_html,
    statementText: row.statement_text,
    timeLimitMs: row.time_limit_ms,
    memoryMb: row.memory_mb,
    interactive: row.interactive === 1,
    anyCase: row.any_case === 1,
    url: problemUrl(ref)
  }
}

/** Contest ids to look for a tutorial link on: the contest itself, then a parallel Div. 1/2 round. */
function editorialSources(contestId: number): number[] {
  const me = get<{ start_time: number }>('SELECT start_time FROM contests WHERE id = ?', contestId)
  const out = [contestId]
  if (me) {
    for (const r of all<{ id: number }>(
      'SELECT id FROM contests WHERE id IN (?, ?) AND ABS(start_time - ?) < 3600000',
      contestId - 1,
      contestId + 1,
      me.start_time
    ))
      out.push(r.id)
  }
  return out
}

async function loadBlog(contestId: number): Promise<{ url: string; text: string } | null> {
  const cached = get<{ url: string; text: string }>('SELECT url, text FROM editorial_blogs WHERE contest_id = ?', contestId)
  if (cached) return cached.text ? cached : null
  for (const source of editorialSources(contestId)) {
    const links = await scrape<string[]>(`/contest/${source}`, extractTutorialLinks.toString())
    for (const link of links) {
      const path = link.startsWith('http') ? new URL(link).pathname : link
      const text = await scrape<string>(path, extractBlogText.toString())
      if (text.length > 200) {
        const url = `https://codeforces.com${path}`
        run('INSERT OR REPLACE INTO editorial_blogs (contest_id, url, text, fetched_at) VALUES (?, ?, ?, ?)', contestId, url, text, Date.now())
        return { url, text }
      }
    }
  }
  // Remember the miss so we don't re-scrape on every question.
  run('INSERT OR REPLACE INTO editorial_blogs (contest_id, url, text, fetched_at) VALUES (?, ?, ?, ?)', contestId, '', '', Date.now())
  return null
}

export interface EditorialSection {
  text: string
  url: string
  exact: boolean
}

export async function getEditorial(ref: ProblemRef): Promise<EditorialSection | null> {
  const row = get<{ text: string; source_url: string; exact: number }>(
    'SELECT text, source_url, exact FROM editorials WHERE contest_id = ? AND idx = ?',
    ref.contestId,
    ref.index
  )
  if (row) return { text: row.text, url: row.source_url, exact: row.exact === 1 }
  const blog = await loadBlog(ref.contestId)
  if (!blog) return null
  const problems = all<{ idx: string; name: string }>('SELECT idx, name FROM problems WHERE contest_id = ?', ref.contestId)
  const sections = splitEditorial(
    blog.text,
    ref.contestId,
    problems.map((p) => ({ index: p.idx, name: p.name }))
  )
  let text = sections.get(ref.index)
  const exact = !!text
  if (!text) {
    const me = problems.find((p) => p.idx === ref.index)
    const detail = get<{ statement_text: string }>('SELECT statement_text FROM problem_details WHERE contest_id = ? AND idx = ?', ref.contestId, ref.index)
    text = bestChunks(blog.text, `${me?.name ?? ''} ${detail?.statement_text ?? ''}`)
  }
  text = text.slice(0, 12000)
  run(
    'INSERT OR REPLACE INTO editorials (contest_id, idx, text, source_url, exact, fetched_at) VALUES (?, ?, ?, ?, ?, ?)',
    ref.contestId,
    ref.index,
    text,
    blog.url,
    exact ? 1 : 0,
    Date.now()
  )
  return { text, url: blog.url, exact }
}
