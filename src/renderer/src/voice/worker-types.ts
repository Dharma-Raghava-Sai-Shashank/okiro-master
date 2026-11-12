/** Minimal typing for a dedicated worker's global scope (the renderer tsconfig uses the DOM lib). */
export interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent) => void) | null
}

export interface LoadProgress {
  status: string
  file?: string
  loaded?: number
  total?: number
  progress?: number
}

export async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return !!(await gpu?.requestAdapter())
  } catch {
    return false
  }
}
