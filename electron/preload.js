const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  reportError: (message, meta = null) => {
    ipcRenderer.send('renderer-error', { message, meta, timestamp: Date.now() })
  },
  reportStartup: payload => {
    ipcRenderer.send('startup-progress', payload)
  },
  notifyStartupReady: payload => {
    ipcRenderer.send('startup-ready', payload)
  },
  notifyStartupFailed: payload => {
    ipcRenderer.send('startup-failed', payload)
  },
  saveState: (key, value) => ipcRenderer.invoke('state:save', key, value),
  loadState: key => ipcRenderer.invoke('state:load', key),
  writeNote: (folder, name, content) => ipcRenderer.invoke('note:write', folder, name, content),
  readNote: (folder, name) => ipcRenderer.invoke('note:read', folder, name),
  listNotes: folder => ipcRenderer.invoke('note:list', folder),
  deleteNote: (folder, name) => ipcRenderer.invoke('note:delete', folder, name),
  showSavePrompt: () => ipcRenderer.invoke('dialog:unsaved'),
  onBeforeQuit: cb => ipcRenderer.on('app-before-quit', cb),
  confirmQuit: () => ipcRenderer.send('quit-confirmed'),
  notifyThemeChange: theme => ipcRenderer.send('theme-changed', theme),
  onNavigateTab: cb => ipcRenderer.on('navigate-tab', (_event, tab) => cb(tab))
})
