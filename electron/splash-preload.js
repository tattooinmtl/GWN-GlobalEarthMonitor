const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('splashAPI', {
  getStartupState: () => ipcRenderer.invoke('startup-state:get'),
  onStartupState: callback => {
    const handler = (_event, state) => callback(state)
    ipcRenderer.on('startup-state', handler)
    return () => ipcRenderer.removeListener('startup-state', handler)
  }
})
