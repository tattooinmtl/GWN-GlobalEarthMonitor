/**
 * =============================================================================
 * PRELOAD SCRIPT — preload.js
 * =============================================================================
 * Runs in a privileged context BEFORE the renderer page loads.
 * Exposes ONLY the specific IPC calls the HTML needs — nothing else.
 * contextIsolation must be true in main.js (it is).
 * =============================================================================
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Call from renderer:  const result = await window.electronAPI.getDangerIndex();
   * Returns { ok: true, data: { dangerIndex, level, timestamp, components, formula } }
   *      or { ok: false, error: '...' }
   */
  getDangerIndex: () => ipcRenderer.invoke('get-danger-index'),
});
