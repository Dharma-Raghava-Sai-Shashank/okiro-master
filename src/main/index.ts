import { app, BrowserWindow, net, protocol, session, shell, systemPreferences } from 'electron'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openDb } from './db'
import { dataDir } from './paths'
import { registerIpc } from './ipc'
import { sync } from './cf/sync'
import { CF_PARTITION, destroyWorker } from './cf/browser'
import { stopClangd } from './lsp/clangd'
import { indexKb } from './coach/kb'
import { ollamaRunning, stopOllamaIfStarted } from './llm/ollama-lifecycle'

// The packaged UI is served from app://okiro rather than file:// so it has a stable, secure origin
// (needed for the voice models' download cache and for scoping the microphone permission).
const APP_ORIGIN = 'app://okiro'
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

let mainWindow: BrowserWindow | null = null

const devUrl = () => (!app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined)
const isAppUrl = (u = ''): boolean => u.startsWith(APP_ORIGIN) || (!!devUrl() && u.startsWith(devUrl()!))

function serveRenderer(): void {
  const root = normalize(join(__dirname, '../renderer'))
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url)
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
    const file = normalize(join(root, rel))
    if (file !== root && !file.startsWith(root + sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

function lockDownPermissions(): void {
  const clipboard = new Set(['clipboard-sanitized-write', 'clipboard-read'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (!isAppUrl(details.requestingUrl)) return callback(false)
    if (permission === 'media') {
      const types = (details as { mediaTypes?: string[] }).mediaTypes ?? []
      if (types.some((t) => t !== 'audio')) return callback(false)
      if (process.platform !== 'darwin') return callback(true)
      void systemPreferences.askForMediaAccess('microphone').then(callback, () => callback(false))
      return
    }
    callback(clipboard.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin, details) => {
    const url = (details as { requestingUrl?: string }).requestingUrl ?? origin
    if (!isAppUrl(url)) return false
    if (permission === 'media') return (details as { mediaType?: string }).mediaType !== 'video'
    return clipboard.has(permission)
  })
  // Codeforces pages never get any permission (mic, notifications, …).
  const cf = session.fromPartition(CF_PARTITION)
  cf.setPermissionRequestHandler((_wc, _p, callback) => callback(false))
  cf.setPermissionCheckHandler(() => false)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#060912',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isAppUrl(url)) return
    e.preventDefault()
    if (/^https?:/.test(url)) void shell.openExternal(url)
  })
  const dev = devUrl()
  void mainWindow.loadURL(dev ?? `${APP_ORIGIN}/index.html`)
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(async () => {
    openDb(join(dataDir(), 'okiro.db'))
    serveRenderer()
    lockDownPermissions()
    registerIpc(() => mainWindow)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
    // Background warm-up: refresh Codeforces data and the knowledge-base index.
    void sync(false).then((r) => mainWindow?.webContents.send('sync:done', r))
    if (await ollamaRunning()) void indexKb(() => undefined).catch(() => undefined)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    stopClangd()
    stopOllamaIfStarted()
    destroyWorker()
  })
}
