import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { ModelInfo, PullProgress } from '@shared/types'
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
    // One model in memory at a time keeps 8 GB machines responsive.
    env: { ...process.env, OLLAMA_HOST: `127.0.0.1:${host.port || '11434'}`, OLLAMA_MAX_LOADED_MODELS: '1' },
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
    // Unload soon after searching so the chat model keeps the memory.
    body: JSON.stringify({ model: s.embedModel, input: texts, keep_alive: '30s' }),
    signal: AbortSignal.timeout(120_000)
  })
  if (!res.ok) throw new Error(`Embedding failed: ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as { embeddings: number[][] }
  return body.embeddings
}

const infoCache = new Map<string, ModelInfo>()

export function parseBillions(size: string): number {
  const m = /([\d.]+)\s*([BM])/i.exec(size)
  if (!m) return 0
  const v = parseFloat(m[1])
  return m[2].toUpperCase() === 'M' ? v / 1000 : v
}

/** Capabilities and size of a pulled model, from /api/show (cached). */
export async function modelInfo(model: string): Promise<ModelInfo | null> {
  const hit = infoCache.get(model)
  if (hit) return hit
  try {
    const res = await fetch(`${getSettings().ollamaHost}/api/show`, {
      method: 'POST',
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const body = (await res.json()) as { capabilities?: string[]; details?: { parameter_size?: string; family?: string } }
    const info: ModelInfo = {
      name: model,
      capabilities: body.capabilities ?? ['completion'],
      parameterSize: body.details?.parameter_size ?? '',
      billions: parseBillions(body.details?.parameter_size ?? ''),
      family: body.details?.family ?? ''
    }
    infoCache.set(model, info)
    return info
  } catch {
    return null
  }
}

export { recommendedModel, totalMemGb } from './recommend'
