import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { openDb } from './db'
import { dataDir } from './paths'
import { registerIpc } from './ipc'
import { sync } from './cf/sync'
import { destroyWorker } from './cf/browser'
import { stopClangd } from './lsp/clangd'
import { indexKb } from './coach/kb'
import { ollamaRunning, stopOllamaIfStarted } from './llm/ollama-lifecycle'

let mainWindow: BrowserWindow | null = null

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
    if (process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL)) return
    e.preventDefault()
    if (/^https?:/.test(url)) void shell.openExternal(url)
  })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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
