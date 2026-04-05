/**
 * =============================================================================
 * ELECTRON MAIN PROCESS — main.js
 * =============================================================================
 * File layout expected in your project root:
 *
 *   your-app/
 *   ├── main.js                  ← this file
 *   ├── preload.js               ← exposes safe IPC to renderer
 *   ├── earthDangerAlgorithm.js  ← algorithm + fetchers
 *   ├── earthDanger.html         ← UI (renderer)
 *   └── package.json
 *
 * package.json must have:
 *   "main": "main.js"
 * =============================================================================
 */

'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { calculateDangerIndex } = require('./earthDangerAlgorithm');

// -----------------------------------------------------------------------------
// WINDOW
// -----------------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 820,
    minWidth: 600,
    minHeight: 600,
    title: 'Earth Danger Index',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // required for security
      nodeIntegration: false,   // never enable this
    },
  });

  win.loadFile('earthDanger.html');

  // Uncomment to open DevTools on launch:
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// -----------------------------------------------------------------------------
// IPC HANDLER
// The renderer calls window.electronAPI.getDangerIndex()
// preload.js forwards that as ipcRenderer.invoke('get-danger-index')
// We handle it here, run the algorithm, and return the full result object.
// -----------------------------------------------------------------------------

ipcMain.handle('get-danger-index', async () => {
  try {
    const result = await calculateDangerIndex();
    return { ok: true, data: result };
  } catch (err) {
    console.error('[main] calculateDangerIndex failed:', err);
    return { ok: false, error: err.message };
  }
});
