import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, EVENT_CHANNELS } from '@shared/api'

const api: Record<string, unknown> = {}

for (const [group, methods] of Object.entries(API_METHODS)) {
  const bridge: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const method of methods) {
    bridge[method] = (...args: unknown[]) => ipcRenderer.invoke(`${group}:${method}`, ...args)
  }
  api[group] = bridge
}

// LSP traffic is high-volume and fire-and-forget, so it uses send rather than invoke.
;(api.lsp as Record<string, unknown>).send = (message: string) => ipcRenderer.send('lsp:send', message)

api.on = (channel: string, cb: (payload: unknown) => void) => {
  if (!EVENT_CHANNELS.includes(channel as (typeof EVENT_CHANNELS)[number])) throw new Error(`Unknown channel ${channel}`)
  const listener = (_e: unknown, payload: unknown) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('okiro', api)
