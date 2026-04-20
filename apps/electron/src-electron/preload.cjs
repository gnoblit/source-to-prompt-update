const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__YSP_ELECTRON__', {
  invoke(operation, payload = {}) {
    return ipcRenderer.invoke('ysp:invoke', operation, payload);
  }
});
