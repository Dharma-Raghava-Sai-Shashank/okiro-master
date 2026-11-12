import { ipcMain, shell, type BrowserWindow } from 'electron'
import { z } from 'zod'
import type { OkiroEvents } from '@shared/api'
import type { CoachRequest, ContestFilter, LlmStatus, ProblemRef, Settings } from '@shared/types'
import { getSettings, updateSettings, setClaudeKey, clearClaudeKey, getClaudeKey } from './settings'
import { sync, userInfo, ratingHistory } from './cf/sync'
import { getProblem, getEditorial } from './cf/scraper'
import { openLogin } from './cf/browser'
import { submit } from './cf/submit'
import { contestRows, dayEvents, dayStats, roadmap, submissionsFor, summary } from './progress'
import { addTest, deleteTest, getCode, listTests, problemFile, runProblemTests, saveCode, updateTest } from './workspace'
import * as coach from './coach'
import { recentNotes } from './coach/memory'
import { indexKb, kbCounts } from './coach/kb'
import { hasModel, listModels, ollamaBinary, ollamaRunning, pullModel, startOllama } from './llm/ollama-lifecycle'
import { sendToClangd, startClangd } from './lsp/clangd'

const refSchema = z.object({ contestId: z.number().int().positive(), index: z.string().regex(/^[A-Z][0-9]?$/) })
const ref = (v: unknown): ProblemRef => refSchema.parse(v)
const str = (v: unknown, max = 1_000_000): string => z.string().max(max).parse(v)

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const emit = <K extends keyof OkiroEvents>(channel: K, payload: OkiroEvents[K]) => {
    const w = getWindow()
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload)
  }
  const handle = (channel: string, fn: (...args: unknown[]) => unknown) =>
    ipcMain.handle(channel, (_e, ...args: unknown[]) => fn(...args))

  // settings
  handle('settings:get', () => getSettings())
  handle('settings:update', (patch) => {
    const before = getSettings()
    const next = updateSettings(patch as Partial<Settings>)
    if (next.handle !== before.handle && next.handle) void sync(false).then((r) => emit('sync:done', r))
    return next
  })
  handle('settings:setClaudeKey', (key) => setClaudeKey(str(key, 500)))
  handle('settings:clearClaudeKey', () => clearClaudeKey())

  // codeforces
  handle('cf:sync', async (force) => {
    const r = await sync(force === true)
    emit('sync:done', r)
    return r
  })
  handle('cf:contests', (f) => contestRows(f as ContestFilter))
  handle('cf:roadmap', () => roadmap())
  handle('cf:problem', async (r, refetch) => {
    const p = await getProblem(ref(r), refetch === true)
    // Warm the editorial cache so Arjun has it by the time the student asks.
    void getEditorial(ref(r)).catch(() => undefined)
    return p
  })
  handle('cf:user', () => userInfo())
  handle('cf:ratingHistory', () => ratingHistory())
  handle('cf:openLogin', () => openLogin())
  handle('cf:openExternal', (url) => {
    const u = new URL(str(url, 2000))
    if (u.protocol === 'https:' || u.protocol === 'http:') return shell.openExternal(u.href)
  })
  handle('cf:submissions', (r) => submissionsFor(ref(r)))

  // workspace
  handle('workspace:getCode', (r) => getCode(ref(r)))
  handle('workspace:saveCode', (r, code) => saveCode(ref(r), str(code)))
  handle('workspace:tests', (r) => listTests(ref(r)))
  handle('workspace:addTest', (r, input, expected) => addTest(ref(r), str(input), str(expected)))
  handle('workspace:updateTest', (id, input, expected) => updateTest(z.number().int().parse(id), str(input), str(expected)))
  handle('workspace:deleteTest', (id) => deleteTest(z.number().int().parse(id)))
  handle('workspace:run', (r, code, ids) => runProblemTests(ref(r), str(code), ids == null ? null : z.array(z.number().int()).parse(ids)))
  handle('workspace:filePath', (r) => problemFile(ref(r)))
  handle('workspace:submit', (r, code) => {
    const p = ref(r)
    void submit(p, str(code), (e) => {
      emit('submit:event', e)
      if (e.phase === 'done' && e.submission?.verdict === 'OK') void coach.onAccepted(p)
    }).catch((err: Error) => emit('submit:event', { ...p, phase: 'error', message: err.message }))
  })

  // coach
  handle('coach:send', (req) => coach.send(req as CoachRequest, (e) => emit('coach:event', e)))
  handle('coach:stop', (id) => coach.stop(str(id, 100)))
  handle('coach:history', (scope) => coach.history(str(scope, 200)))
  handle('coach:clear', (scope) => coach.clearHistory(str(scope, 200)))
  handle('coach:memory', () => recentNotes(50))

  // local LLM
  const status = async (): Promise<LlmStatus> => {
    const s = getSettings()
    const running = await ollamaRunning()
    const models = running ? await listModels() : []
    const kb = kbCounts()
    return {
      ollamaInstalled: running || !!ollamaBinary(),
      ollamaRunning: running,
      models,
      chatModelReady: hasModel(models, s.ollamaModel),
      embedModelReady: hasModel(models, s.embedModel),
      kbChunks: kb.chunks,
      kbEmbedded: kb.embedded,
      claudeKeySet: !!getClaudeKey()
    }
  }
  const reindex = () =>
    indexKb((done, total) => emit('kb:progress', { done, total }))
      .then(() => emit('kb:progress', { done: 1, total: 1 }))
      .catch((e: Error) => emit('kb:progress', { done: 0, total: 0, error: e.message }))
  handle('llm:status', status)
  handle('llm:start', async () => {
    await startOllama()
    return status()
  })
  handle('llm:pull', (model) => {
    const m = str(model, 200)
    void pullModel(m, (p) => emit('llm:pull', p))
      .then(() => {
        if (m === getSettings().embedModel) void reindex()
      })
      .catch((e: Error) => emit('llm:pull', { model: m, status: 'error', completed: 0, total: 0, done: true, error: e.message }))
  })
  handle('llm:indexKb', () => {
    void reindex()
  })

  // stats
  handle('stats:days', (from, to) => dayStats(str(from, 10), str(to, 10)))
  handle('stats:dayEvents', (date) => dayEvents(str(date, 10)))
  handle('stats:summary', () => summary())

  // clangd
  ipcMain.handle('lsp:start', (e) => startClangd(e.sender))
  ipcMain.on('lsp:send', (_e, message: unknown) => {
    if (typeof message === 'string') sendToClangd(message)
  })
}
