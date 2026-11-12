import { clipboard, type BrowserWindow } from 'electron'
import type { ProblemRef, SubmitEvent } from '@shared/types'
import { getSettings } from '../settings'
import { cfApi } from './api'
import { cfWindow } from './browser'
import { saveSubmissions } from './sync'
import { toSubmission } from '../progress'
import { get } from '../db'

type Emit = (e: SubmitEvent) => void

const isFinal = (v?: string) => !!v && v !== 'TESTING'

function fillAndSubmit(win: BrowserWindow, index: string, lang: string, code: string): Promise<{ ok: boolean; reason?: string; lang?: string }> {
  // Runs in the codeforces.com page. Codeforces syncs its ace editor into the textarea on submit,
  // so both are set.
  const script = `(() => {
    const form = document.querySelector('form.submit-form') || document.querySelector('form[action*="submit"]');
    if (!form) return { ok: false, reason: 'Submit form not found' };
    const fire = (el) => el.dispatchEvent(new Event('change', { bubbles: true }));
    const idx = form.querySelector('select[name=submittedProblemIndex]');
    if (idx) {
      if (![...idx.options].some(o => o.value === ${JSON.stringify(index)})) return { ok: false, reason: 'Problem ${index} is not in this contest' };
      idx.value = ${JSON.stringify(index)}; fire(idx);
    }
    const sel = form.querySelector('select[name=programTypeId]');
    if (!sel) return { ok: false, reason: 'Language selector not found' };
    const opts = [...sel.options];
    const want = ${JSON.stringify(lang.toLowerCase())};
    const opt = opts.find(o => o.text.toLowerCase().includes(want)) || opts.find(o => /g\\+\\+2\\d/i.test(o.text)) || opts.find(o => /g\\+\\+/i.test(o.text));
    if (!opt) return { ok: false, reason: 'No C++ compiler option found' };
    sel.value = opt.value; fire(sel);
    const ta = form.querySelector('#sourceCodeTextarea') || form.querySelector('textarea[name=source]');
    if (!ta) return { ok: false, reason: 'Source textarea not found' };
    ta.value = ${JSON.stringify(code)};
    try { if (window.ace) { const ed = window.ace.edit('editor'); ed.setValue(ta.value, -1); } } catch (e) {}
    const btn = form.querySelector('#singlePageSubmitButton') || form.querySelector('input[type=submit]');
    if (!btn) return { ok: false, reason: 'Submit button not found' };
    btn.click();
    return { ok: true, lang: opt.text };
  })()`
  return win.webContents.executeJavaScript(script, true)
}

function waitForNavigation(win: BrowserWindow, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(win.webContents.getURL()), timeoutMs)
    win.webContents.once('did-finish-load', () => {
      clearTimeout(t)
      resolve(win.webContents.getURL())
    })
  })
}

async function waitForLogin(win: BrowserWindow, emit: Emit, ref: ProblemRef): Promise<void> {
  emit({ ...ref, phase: 'login-required', message: 'Log in to Codeforces in the window that opened.' })
  win.show()
  const deadline = Date.now() + 5 * 60 * 1000
  while (win.webContents.getURL().includes('/enter')) {
    if (win.isDestroyed() || Date.now() > deadline) throw new Error('Login was not completed')
    await new Promise((r) => setTimeout(r, 1000))
  }
}

export async function submit(ref: ProblemRef, code: string, emit: Emit): Promise<void> {
  const s = getSettings()
  if (!s.handle) throw new Error('Set your Codeforces handle in Settings first')
  const submitUrl = `https://codeforces.com/contest/${ref.contestId}/submit`
  const win = cfWindow(false, `Submit ${ref.contestId}${ref.index}`)
  const startedAt = Date.now()
  try {
    emit({ ...ref, phase: 'opening' })
    await win.loadURL(submitUrl).catch(() => undefined)
    if (/just a moment/i.test(win.webContents.getTitle())) {
      win.show()
      while (/just a moment/i.test(win.webContents.getTitle())) await new Promise((r) => setTimeout(r, 1000))
    }
    if (win.webContents.getURL().includes('/enter')) {
      await waitForLogin(win, emit, ref)
      await win.loadURL(submitUrl).catch(() => undefined)
    }
    emit({ ...ref, phase: 'submitting' })
    const nav = waitForNavigation(win, 20_000)
    const r = await fillAndSubmit(win, ref.index, s.submitLanguage, code)
    if (!r.ok) {
      clipboard.writeText(code)
      win.show()
      throw new Error(`${r.reason}. Your code is on the clipboard — paste it and submit manually.`)
    }
    const after = await nav
    if (after.includes('/submit')) {
      const err = (await win.webContents.executeJavaScript(
        `(() => { const e = document.querySelector('.error, .for__source, span.error'); return e ? e.textContent.trim() : ''; })()`,
        true
      )) as string
      throw new Error(err || 'Codeforces did not accept the submission')
    }
    win.close()
    emit({ ...ref, phase: 'judging' })
    await pollVerdict(ref, s.handle, startedAt, emit)
  } finally {
    if (!win.isDestroyed() && !win.isVisible()) win.close()
  }
}

async function pollVerdict(ref: ProblemRef, handle: string, startedAt: number, emit: Emit): Promise<void> {
  const deadline = Date.now() + 10 * 60 * 1000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const recent = await cfApi.userStatus(handle, 10).catch(() => [])
    const mine = recent.find(
      (x) => x.contestId === ref.contestId && x.problem.index === ref.index && x.creationTimeSeconds * 1000 >= startedAt - 60_000
    )
    if (!mine) continue
    saveSubmissions([mine], true)
    const row = get<Parameters<typeof toSubmission>[0]>('SELECT * FROM submissions WHERE id = ?', mine.id)
    const submission = row ? toSubmission(row) : undefined
    if (isFinal(mine.verdict)) {
      emit({ ...ref, phase: 'done', submission })
      return
    }
    emit({ ...ref, phase: 'judging', submission, message: `Running on test ${mine.passedTestCount + 1}` })
  }
  throw new Error('Timed out waiting for the verdict')
}
