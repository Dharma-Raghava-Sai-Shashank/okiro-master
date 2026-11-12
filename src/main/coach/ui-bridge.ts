// Lets Arjun drive the app: the main process asks the renderer to perform a UI action and waits
// for a one-line result to hand back to the model.
import { randomUUID } from 'node:crypto'
import type { UiAction, UiActionRequest } from '@shared/types'

let emitter: ((req: UiActionRequest) => void) | null = null
const pending = new Map<string, (result: string) => void>()

export function setUiEmitter(fn: (req: UiActionRequest) => void): void {
  emitter = fn
}

export function requestUiAction(action: UiAction, timeoutMs = 8000): Promise<string> {
  if (!emitter) return Promise.resolve('The app window is not available.')
  const id = randomUUID()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve('The app did not confirm the action.')
    }, timeoutMs)
    pending.set(id, (result) => {
      clearTimeout(timer)
      resolve(result)
    })
    emitter!({ id, action })
  })
}

export function resolveUiAction(id: string, result: string): void {
  pending.get(id)?.(result)
  pending.delete(id)
}
