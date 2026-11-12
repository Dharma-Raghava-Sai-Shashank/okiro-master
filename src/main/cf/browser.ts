// A real Chromium session (persist:codeforces) shared by scraping, login and submitting, so Cloudflare
// clearance and the login cookie carry across. CF pages never get a preload or Node access.
import { BrowserWindow, shell } from 'electron'

export const CF_PARTITION = 'persist:codeforces'
const ORIGIN = 'https://codeforces.com'

let worker: BrowserWindow | null = null
let queue: Promise<unknown> = Promise.resolve()

export function cfWindow(show: boolean, title = 'Codeforces'): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    show,
    title,
    backgroundColor: '#0b1020',
    webPreferences: { partition: CF_PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  return win
}

function getWorker(): BrowserWindow {
  if (worker && !worker.isDestroyed()) return worker
  worker = cfWindow(false, 'Codeforces — verification')
  worker.on('close', (e) => {
    // Keep the worker alive; just hide it once the user has cleared a challenge.
    if (worker && !worker.isDestroyed()) {
      e.preventDefault()
      worker.hide()
    }
  })
  return worker
}

export function destroyWorker(): void {
  if (worker && !worker.isDestroyed()) {
    worker.removeAllListeners('close')
    worker.destroy()
  }
  worker = null
}

const isChallenge = (title: string) => /just a moment|attention required|checking your browser/i.test(title)

async function load(win: BrowserWindow, url: string): Promise<void> {
  await win.loadURL(url).catch((e: Error) => {
    // Redirects abort the original navigation (ERR_ABORTED) but the page still loads.
    if (!/ERR_ABORTED/.test(e.message)) throw e
  })
}

/** Make sure the worker sits on a codeforces.com page with Cloudflare cleared, showing it to the user if needed. */
async function ensureCleared(win: BrowserWindow): Promise<void> {
  if (!win.webContents.getURL().startsWith(ORIGIN) || isChallenge(win.webContents.getTitle())) await load(win, `${ORIGIN}/`)
  if (!isChallenge(win.webContents.getTitle())) return
  win.show()
  const deadline = Date.now() + 3 * 60 * 1000
  while (isChallenge(win.webContents.getTitle())) {
    if (Date.now() > deadline) throw new Error('Codeforces verification timed out')
    await new Promise((r) => setTimeout(r, 1000))
  }
  win.hide()
}

/**
 * Fetch a codeforces.com path from inside the page (same origin, real cookies) and run `extract`
 * — a self-contained function source taking (html) — on it with DOMParser. Serialized so only one
 * scrape runs at a time.
 */
export function scrape<T>(path: string, extractSource: string): Promise<T> {
  const job = queue.then(async () => {
    const win = getWorker()
    await ensureCleared(win)
    const script = `(async () => {
      const res = await fetch(${JSON.stringify(path)}, { credentials: 'include' });
      const html = await res.text();
      if (/just a moment/i.test(html.slice(0, 2000))) return { __challenge: true };
      return (${extractSource})(html);
    })()`
    let out = (await win.webContents.executeJavaScript(script, true)) as T & { __challenge?: boolean }
    if (out && out.__challenge) {
      await load(win, `${ORIGIN}${path}`)
      await ensureCleared(win)
      out = (await win.webContents.executeJavaScript(script, true)) as T & { __challenge?: boolean }
    }
    return out as T
  })
  queue = job.catch(() => undefined)
  return job
}

export async function loggedInHandle(): Promise<string | null> {
  const res = await scrape<{ handle: string | null }>(
    '/',
    `(html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const logout = doc.querySelector('a[href*="/logout"]');
      const profile = doc.querySelector('.lang-chooser a[href^="/profile/"]');
      return { handle: logout && profile ? profile.textContent.trim() : null };
    }`
  )
  return res.handle
}

/** Show the login page and resolve once the user is logged in (or closes the window). */
export function openLogin(): Promise<boolean> {
  return new Promise((resolve) => {
    const win = cfWindow(true, 'Log in to Codeforces')
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      if (!win.isDestroyed()) win.close()
      resolve(ok)
    }
    win.webContents.on('did-navigate', (_e, url) => {
      if (url.startsWith(ORIGIN) && !url.includes('/enter')) finish(true)
    })
    win.on('closed', () => finish(false))
    void load(win, `${ORIGIN}/enter`)
  })
}
