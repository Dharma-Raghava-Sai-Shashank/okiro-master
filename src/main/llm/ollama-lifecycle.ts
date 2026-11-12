import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { PullProgress } from '@shared/types'
import { getSettings } from '../settings'
import { ndjson } from './ollama'

const BINARIES = ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama', '/Applications/Ollama.app/Contents/Resources/ollama']
let child: ChildProcess | null = null

export const ollamaBinary = (): string | null => BINARIES.find((p) => existsSync(p)) ?? null

export async function ollamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${getSettings().ollamaHost}/api/version`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${getSettings().ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) })
    const body = (await res.json()) as { models?: { name: string }[] }
    return (body.models ?? []).map((m) => m.name)
  } catch {
    return []
  }
}

export const hasModel = (models: string[], name: string): boolean =>
  models.some((m) => m === name || m === `${name}:latest` || (name.includes(':') ? false : m.startsWith(`${name}:`)))

/** Start `ollama serve` bound to localhost if it isn't already running. */
export async function startOllama(): Promise<boolean> {
  if (await ollamaRunning()) return true
  const bin = ollamaBinary()
  if (!bin) return false
  const host = new URL(getSettings().ollamaHost)
  child = spawn(bin, ['serve'], {
    env: { ...process.env, OLLAMA_HOST: `127.0.0.1:${host.port || '11434'}` },
    stdio: 'ignore',
    detached: false
  })
  child.on('exit', () => {
    child = null
  })
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await ollamaRunning()) return true
  }
  return false
}

export function stopOllamaIfStarted(): void {
  child?.kill()
  child = null
}

export async function pullModel(model: string, onProgress: (p: PullProgress) => void): Promise<void> {
  const res = await fetch(`${getSettings().ollamaHost}/api/pull`, {
    method: 'POST',
    body: JSON.stringify({ model, stream: true })
  })
  if (!res.ok) throw new Error(`Pull failed: ${await res.text()}`)
  for await (const c of ndjson<{ status?: string; total?: number; completed?: number; error?: string }>(res)) {
    if (c.error) {
      onProgress({ model, status: 'error', completed: 0, total: 0, done: true, error: c.error })
      throw new Error(c.error)
    }
    onProgress({ model, status: c.status ?? '', completed: c.completed ?? 0, total: c.total ?? 0, done: c.status === 'success' })
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const s = getSettings()
  const res = await fetch(`${s.ollamaHost}/api/embed`, {
    method: 'POST',
    body: JSON.stringify({ model: s.embedModel, input: texts, keep_alive: '10m' }),
    signal: AbortSignal.timeout(120_000)
  })
  if (!res.ok) throw new Error(`Embedding failed: ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as { embeddings: number[][] }
  return body.embeddings
}
