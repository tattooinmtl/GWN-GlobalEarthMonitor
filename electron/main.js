const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, session } = require('electron')
const fs = require('fs')
const path = require('path')

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const SPLASH_MIN_VISIBLE_MS = 1200
const STARTUP_STATE_MAX_LINES = 80

// Use a dedicated writable profile path to avoid cache permission failures.
const APP_DATA_DIR = path.join(app.getPath('temp'), 'GWN-GlobalEarthMonitor')
const SESSION_DATA_DIR = path.join(APP_DATA_DIR, 'session')
const CHROME_CACHE_DIR = path.join(SESSION_DATA_DIR, 'Cache')
const GPU_CACHE_DIR = path.join(SESSION_DATA_DIR, 'GPUCache')
const CODE_CACHE_DIR = path.join(SESSION_DATA_DIR, 'Code Cache')
fs.mkdirSync(SESSION_DATA_DIR, { recursive: true })
fs.mkdirSync(CHROME_CACHE_DIR, { recursive: true })
fs.mkdirSync(GPU_CACHE_DIR, { recursive: true })
fs.mkdirSync(CODE_CACHE_DIR, { recursive: true })
app.setPath('userData', APP_DATA_DIR)
app.setPath('sessionData', SESSION_DATA_DIR)
app.commandLine.appendSwitch('disk-cache-dir', CHROME_CACHE_DIR)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-features', 'NetworkServiceInProcess')

let mainWindow = null
let splashWindow = null
let tray = null
let currentTheme = 'dark'
let splashShownAt = 0
let revealScheduled = false

// Read saved theme early so splash can use it
try {
  const stateFilePath = path.join(APP_DATA_DIR, 'app-state.json')
  if (fs.existsSync(stateFilePath)) {
    const saved = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'))
    if (saved?.theme === 'light') currentTheme = 'light'
  }
} catch { /* use default dark */ }
const startupState = {
  progress: 2,
  status: 'Preparing application shell...',
  lines: ['Preparing application shell...'],
  ready: false,
  failed: false
}

function logMainError(label, error) {
  const suffix = error ? ` ${error.stack || error.message || String(error)}` : ''
  console.error(`[main] ${label}${suffix}`)
}

function getDistIndexPath() {
  return path.join(__dirname, '../dist/index.html')
}

function clampProgress(progress) {
  if (!Number.isFinite(progress)) return startupState.progress
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function broadcastStartupState() {
  if (!splashWindow || splashWindow.isDestroyed()) return
  splashWindow.webContents.send('startup-state', startupState)
}

function pushStartupLog(message, progress = startupState.progress) {
  if (!message) return
  startupState.progress = Math.max(startupState.progress, clampProgress(progress))
  startupState.status = message
  startupState.lines = [...startupState.lines, message].slice(-STARTUP_STATE_MAX_LINES)
  broadcastStartupState()
}

function markStartupComplete(message, failed = false) {
  startupState.failed = failed
  startupState.ready = true
  startupState.progress = 100
  if (message) {
    startupState.status = message
    startupState.lines = [...startupState.lines, message].slice(-STARTUP_STATE_MAX_LINES)
  }
  broadcastStartupState()
  revealMainWindow()
}

function revealMainWindow() {
  if (revealScheduled || !startupState.ready || !mainWindow || mainWindow.isDestroyed()) return
  revealScheduled = true
  const delay = Math.max(0, SPLASH_MIN_VISIBLE_MS - (Date.now() - splashShownAt))

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }

    splashWindow = null
    revealScheduled = false
  }, delay)
}

function createSplashWindow() {
  const splashBg = currentTheme === 'light' ? '#f0f4f8' : '#06080d'
  const win = new BrowserWindow({
    width: 760,
    height: 470,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: splashBg,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    splashShownAt = Date.now()
    win.show()
    broadcastStartupState()
  })

  win.on('closed', () => {
    splashWindow = null
  })

  void win.loadFile(path.join(__dirname, 'splash.html'))
  return win
}

async function loadAppContent(win) {
  const distIndex = getDistIndexPath()
  const hasDistBuild = fs.existsSync(distIndex)

  if (DEV_SERVER_URL) {
    pushStartupLog(`Connecting to dev server: ${DEV_SERVER_URL}`, 10)
    try {
      await win.loadURL(DEV_SERVER_URL)
      pushStartupLog('Renderer page loaded from dev server.', 20)
      return
    } catch (err) {
      if (hasDistBuild) {
        pushStartupLog('Dev server unavailable. Falling back to local build.', 15)
        await win.loadFile(distIndex)
        pushStartupLog('Renderer page loaded from local build.', 20)
        return
      }

      const message = String(err && err.message ? err.message : err)
      const escaped = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      pushStartupLog('Startup failed before renderer boot. Showing error page.', 100)
      await win.loadURL(`data:text/html,${encodeURIComponent(`
      <html>
        <body style="margin:0;padding:24px;background:#0d1117;color:#e6edf3;font-family:Segoe UI,sans-serif;">
          <h2 style="margin-top:0;">GWN - Global Earth Monitor could not start</h2>
          <p>The dev server at <b>${DEV_SERVER_URL}</b> is not reachable and no built files were found.</p>
          <p>Run this in the project folder:</p>
          <pre style="background:#161b22;border:1px solid #30363d;padding:12px;border-radius:8px;">npm run electron-dev</pre>
          <p>Or build once and run:</p>
          <pre style="background:#161b22;border:1px solid #30363d;padding:12px;border-radius:8px;">npm run build\nnpm start</pre>
          <p style="color:#8b949e;">Error: ${escaped}</p>
        </body>
      </html>
    `)}`)
      markStartupComplete('Startup failed. Displaying error page.', true)
      return
    }
  }

  if (hasDistBuild) {
    pushStartupLog('Loading packaged renderer...', 10)
    await win.loadFile(distIndex)
    pushStartupLog('Renderer page loaded from local build.', 20)
    return
  }

  pushStartupLog('No local build found. Showing startup error page.', 100)
  await win.loadURL(`data:text/html,${encodeURIComponent(`
      <html>
        <body style="margin:0;padding:24px;background:#0d1117;color:#e6edf3;font-family:Segoe UI,sans-serif;">
          <h2 style="margin-top:0;">GWN - Global Earth Monitor could not start</h2>
          <p>No dev server URL was provided and no built files were found.</p>
          <p>Run this in the project folder:</p>
          <pre style="background:#161b22;border:1px solid #30363d;padding:12px;border-radius:8px;">npm run electron-dev</pre>
          <p>Or build once and run:</p>
          <pre style="background:#161b22;border:1px solid #30363d;padding:12px;border-radius:8px;">npm run build\nnpm start</pre>
        </body>
      </html>
    `)}`)
  markStartupComplete('Startup failed. Displaying error page.', true)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'GWN - Global Earth Monitor',
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !DEV_SERVER_URL
    }
  })

  // Forward ALL renderer console messages to terminal for debugging
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const tag = ['LOG', 'WARN', 'ERR', 'DBG'][level] || 'LOG'
    console.log(`[renderer:${tag}] ${message}`)
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    logMainError('render-process-gone', new Error(JSON.stringify(details)))
    pushStartupLog('Renderer process exited unexpectedly.', 100)
    markStartupComplete('Renderer process exited unexpectedly.', true)
  })

  win.webContents.on('unresponsive', () => {
    logMainError('renderer-unresponsive')
    pushStartupLog('Renderer is temporarily unresponsive.', startupState.progress)
  })

  win.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (isMainFrame) {
      logMainError('did-fail-load', new Error(`${code} ${desc} ${url}`))
      pushStartupLog(`Main frame load failed: ${desc}`, 100)
      markStartupComplete('Startup failed while loading main frame.', true)
    }
  })

  // --- Security: block navigation to external URLs ---
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_SERVER_URL
      ? [DEV_SERVER_URL, 'file://']
      : ['file://']
    if (!allowed.some(prefix => url.startsWith(prefix))) {
      event.preventDefault()
      logMainError('blocked-navigation', new Error(`Blocked navigation to: ${url}`))
    }
  })

  // --- Security: block new-window requests from opening external URLs ---
  win.webContents.setWindowOpenHandler(({ url }) => {
    logMainError('blocked-window-open', new Error(`Blocked window.open to: ${url}`))
    return { action: 'deny' }
  })

  // --- Security: disable DevTools in production builds ---
  if (!DEV_SERVER_URL) {
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools()
    })
  }

  win.on('close', (e) => {
    if (win._forceClose) return
    e.preventDefault()
    win.webContents.send('app-before-quit')
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  void loadAppContent(win)

  // DEBUG: auto-open DevTools to capture fetch errors
  win.webContents.once('did-finish-load', () => {
    win.webContents.openDevTools({ mode: 'detach' })
  })

  return win
}

app.whenReady().then(() => {
  ipcMain.on('renderer-error', (_event, payload) => {
    logMainError('renderer-error', new Error(JSON.stringify(payload)))
  })

  ipcMain.on('startup-progress', (_event, payload) => {
    const message = payload?.message || 'Starting...'
    pushStartupLog(message, payload?.progress)
  })

  ipcMain.on('startup-ready', (_event, payload) => {
    markStartupComplete(payload?.message || 'Startup complete.', false)
  })

  ipcMain.on('startup-failed', (_event, payload) => {
    markStartupComplete(payload?.message || 'Startup finished with errors.', true)
  })

  ipcMain.handle('startup-state:get', () => startupState)
  ipcMain.handle('splash-theme:get', () => currentTheme)

  // --- State persistence (JSON key-value in userData) ---
  const STATE_FILE = path.join(APP_DATA_DIR, 'app-state.json')
  function readStateFile() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) } catch { return {} }
  }
  function writeStateFile(obj) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2), 'utf-8')
  }
  ipcMain.handle('state:save', (_e, key, value) => {
    const state = readStateFile()
    state[key] = value
    writeStateFile(state)
  })
  ipcMain.handle('state:load', (_e, key) => {
    return readStateFile()[key] ?? null
  })

  // --- Notes file I/O ---
  const TEMP_TEXT_DIR = path.join(APP_DATA_DIR, 'TEMP_text')
  const USER_SAVED_DIR = path.join(APP_DATA_DIR, 'UserSavedFiles')
  fs.mkdirSync(TEMP_TEXT_DIR, { recursive: true })
  fs.mkdirSync(USER_SAVED_DIR, { recursive: true })

  function resolveNoteDir(folder) {
    if (folder === 'TEMP_text') return TEMP_TEXT_DIR
    if (folder === 'UserSavedFiles') return USER_SAVED_DIR
    return null
  }
  function sanitizeFilename(name) {
    const sanitized = name.replace(/[^a-zA-Z0-9_\-. ]/g, '').substring(0, 200)
    if (!sanitized || sanitized.startsWith('.') || sanitized.includes('..')) return ''
    return sanitized
  }
  ipcMain.handle('note:write', (_e, folder, name, content) => {
    const dir = resolveNoteDir(folder)
    if (!dir) return { ok: false, error: 'Invalid folder' }
    const safe = sanitizeFilename(name)
    if (!safe || !safe.endsWith('.txt')) return { ok: false, error: 'Invalid filename' }
    fs.writeFileSync(path.join(dir, safe), content, 'utf-8')
    return { ok: true }
  })
  ipcMain.handle('note:read', (_e, folder, name) => {
    const dir = resolveNoteDir(folder)
    if (!dir) return null
    const safe = sanitizeFilename(name)
    const fp = path.join(dir, safe)
    try { return fs.readFileSync(fp, 'utf-8') } catch { return null }
  })
  ipcMain.handle('note:list', (_e, folder) => {
    const dir = resolveNoteDir(folder)
    if (!dir) return []
    try { return fs.readdirSync(dir).filter(f => f.endsWith('.txt')) } catch { return [] }
  })
  ipcMain.handle('note:delete', (_e, folder, name) => {
    const dir = resolveNoteDir(folder)
    if (!dir) return { ok: false }
    const safe = sanitizeFilename(name)
    const fp = path.join(dir, safe)
    try { fs.unlinkSync(fp); return { ok: true } } catch { return { ok: false } }
  })
  ipcMain.handle('dialog:unsaved', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved Notes',
      message: 'You have unsaved notes. What would you like to do?'
    })
    return response  // 0 = Save, 1 = Discard, 2 = Cancel
  })
  ipcMain.on('quit-confirmed', () => {
    if (mainWindow) {
      mainWindow._forceClose = true
      mainWindow.close()
    }
  })

  // --- Theme change from renderer ---
  ipcMain.on('theme-changed', (_event, theme) => {
    currentTheme = theme === 'light' ? 'light' : 'dark'
    updateTrayIcon()
  })

  // --- Tray icon ---
  function getLogoPath(theme) {
    const filename = theme === 'light' ? 'LogoLight.ico' : 'LogoDark.ico'
    if (DEV_SERVER_URL) {
      return path.join(__dirname, filename)
    }
    const distPath = path.join(__dirname, '..', 'dist', filename)
    if (fs.existsSync(distPath)) return distPath
    return path.join(__dirname, filename)
  }

  function updateTrayIcon() {
    try {
      const iconPath = getLogoPath(currentTheme)
      if (!fs.existsSync(iconPath)) return
      const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 })
      if (icon.isEmpty()) return
      if (tray && !tray.isDestroyed()) {
        tray.setImage(icon)
      }
    } catch (err) {
      logMainError('tray-icon-update', err)
    }
  }

  function createTray() {
    try {
      const iconPath = getLogoPath('dark')
      if (!fs.existsSync(iconPath)) return
      const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 })
      if (icon.isEmpty()) return
      tray = new Tray(icon)
      tray.setToolTip('GWN - Global Earth Monitor')

      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } } },
        { label: 'Maximize', click: () => { if (mainWindow) mainWindow.maximize() } },
        { label: 'Restore', click: () => { if (mainWindow) mainWindow.restore() } },
        { type: 'separator' },
        { label: 'Earthquakes', click: () => { showAndNavigate('earthquakes') } },
        { label: 'Fireballs', click: () => { showAndNavigate('fireballs') } },
        { label: 'Asteroids', click: () => { showAndNavigate('asteroids') } },
        { label: 'Prediction', click: () => { showAndNavigate('prediction') } },
        { label: 'Volcanoes', click: () => { showAndNavigate('volcanoes') } },
        { type: 'separator' },
        { label: 'Quit', click: () => { if (mainWindow) { mainWindow._forceClose = true; mainWindow.close() } app.quit() } }
      ])
      tray.setContextMenu(contextMenu)

      tray.on('click', () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus() }
      })
    } catch (err) {
      logMainError('tray-create', err)
    }
  }

  function showAndNavigate(tab) {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('navigate-tab', tab)
    }
  }

  splashWindow = createSplashWindow()
  mainWindow = createWindow()
  createTray()
  app.on('activate', () => {
    if (!mainWindow) {
      splashWindow = createSplashWindow()
      mainWindow = createWindow()
    }
  })
})

app.on('render-process-gone', (_event, _wc, details) => {
  logMainError('app-render-process-gone', new Error(JSON.stringify(details)))
})

app.on('child-process-gone', (_event, details) => {
  logMainError('child-process-gone', new Error(JSON.stringify(details)))
})

process.on('uncaughtException', err => {
  logMainError('uncaughtException', err)
})

process.on('unhandledRejection', reason => {
  logMainError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
