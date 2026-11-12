// Arjun's knowledge base: Markdown notes in resources/kb, chunked by "##" section and embedded
// locally through Ollama. Falls back to keyword search when embeddings are unavailable.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { all, get, run, tx } from '../db'
import { getSettings } from '../settings'
import { resourcesDir } from '../paths'
import { embed } from '../llm/ollama-lifecycle'
import { parseKbFile, type ParsedChunk } from './kb-parse'

export interface KbChunk {
  id: number
  topic: string
  heading: string
  tags: string[]
  text: string
}

const hashOf = (c: ParsedChunk) => createHash('sha1').update(c.file).update(c.text).digest('hex')

/** Sync resources/kb into the database and embed new or stale chunks. */
export async function indexKb(onProgress: (done: number, total: number) => void): Promise<void> {
  const dir = join(resourcesDir(), 'kb')
  let files: string[] = []
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  } catch {
    return
  }
  const chunks = files.flatMap((f) => parseKbFile(f, readFileSync(join(dir, f), 'utf8')))
  const hashes = new Set(chunks.map(hashOf))
  tx(() => {
    for (const r of all<{ id: number; hash: string }>('SELECT id, hash FROM kb_chunks')) {
      if (!hashes.has(r.hash)) run('DELETE FROM kb_chunks WHERE id = ?', r.id)
    }
    for (const c of chunks) {
      run(
        'INSERT OR IGNORE INTO kb_chunks (file, topic, heading, tags, text, hash) VALUES (?, ?, ?, ?, ?, ?)',
        c.file,
        c.topic,
        c.heading,
        JSON.stringify(c.tags),
        c.text,
        hashOf(c)
      )
    }
  })
  const model = getSettings().embedModel
  const pending = all<{ id: number; text: string }>(
    'SELECT id, text FROM kb_chunks WHERE embedding IS NULL OR embed_model IS NOT ?',
    model
  )
  const total = pending.length
  for (let i = 0; i < pending.length; i += 16) {
    const batch = pending.slice(i, i + 16)
    const vecs = await embed(batch.map((b) => `search_document: ${b.text}`))
    tx(() => {
      batch.forEach((b, j) => {
        run('UPDATE kb_chunks SET embedding = ?, embed_model = ? WHERE id = ?', Buffer.from(new Float32Array(vecs[j]).buffer), model, b.id)
      })
    })
    onProgress(Math.min(i + 16, total), total)
  }
}

export function kbCounts(): { chunks: number; embedded: number } {
  const model = getSettings().embedModel
  const r = get<{ chunks: number; embedded: number }>(
    'SELECT COUNT(*) AS chunks, SUM(CASE WHEN embedding IS NOT NULL AND embed_model = ? THEN 1 ELSE 0 END) AS embedded FROM kb_chunks',
    model
  )
  return { chunks: r?.chunks ?? 0, embedded: r?.embedded ?? 0 }
}

const tokenize = (s: string) => s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []

function keywordScores(query: string, rows: { id: number; text: string }[]): Map<number, number> {
  const q = new Set(tokenize(query))
  const df = new Map<string, number>()
  const docs = rows.map((r) => {
    const toks = new Set(tokenize(r.text))
    for (const t of toks) df.set(t, (df.get(t) ?? 0) + 1)
    return { id: r.id, toks }
  })
  const scores = new Map<number, number>()
  for (const d of docs) {
    let s = 0
    for (const t of q) if (d.toks.has(t)) s += Math.log(1 + rows.length / (df.get(t) ?? 1))
    scores.set(d.id, s)
  }
  return scores
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na * nb) || 1)
}

export async function searchKb(query: string, k: number, boostTags: string[] = []): Promise<KbChunk[]> {
  const model = getSettings().embedModel
  const rows = all<{ id: number; topic: string; heading: string; tags: string; text: string; embedding: Uint8Array | null; embed_model: string | null }>(
    'SELECT id, topic, heading, tags, text, embedding, embed_model FROM kb_chunks'
  )
  if (rows.length === 0) return []
  const boost = new Set(boostTags)
  let scores: Map<number, number>
  const embedded = rows.filter((r) => r.embedding && r.embed_model === model)
  let qv: Float32Array | null = null
  if (embedded.length > rows.length / 2) {
    try {
      qv = new Float32Array((await embed([`search_query: ${query.slice(0, 4000)}`]))[0])
    } catch {
      qv = null
    }
  }
  if (qv) {
    scores = new Map()
    for (const r of embedded) {
      const e = r.embedding!
      scores.set(r.id, cosine(qv, new Float32Array(e.buffer, e.byteOffset, e.byteLength / 4)))
    }
  } else {
    const kw = keywordScores(query, rows)
    const max = Math.max(1e-9, ...kw.values())
    scores = new Map([...kw].map(([id, s]) => [id, s / max]))
  }
  for (const r of rows) {
    const tags = JSON.parse(r.tags) as string[]
    if (tags.some((t) => boost.has(t)) && scores.has(r.id)) scores.set(r.id, scores.get(r.id)! + 0.05)
  }
  return rows
    .filter((r) => scores.has(r.id))
    .sort((a, b) => scores.get(b.id)! - scores.get(a.id)!)
    .slice(0, k)
    .map((r) => ({ id: r.id, topic: r.topic, heading: r.heading, tags: JSON.parse(r.tags) as string[], text: r.text }))
}
