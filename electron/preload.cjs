const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('sterm', {
  platform: process.platform,
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.invoke('terminal:kill', id),
    showContextMenu: (id, canCopy) => ipcRenderer.invoke('terminal:context-menu', { id, canCopy }),
    onData: (id, callback) => {
      const listener = (_event, payload) => {
        if (payload.id === id) callback(payload.data);
      };
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
    onExit: (id, callback) => {
      const listener = (_event, payload) => {
        if (payload.id === id) callback(payload);
      };
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },
  clipboard: {
    hasImage: () => !clipboard.readImage().isEmpty(),
    readText: () => clipboard.readText(),
    saveImage: (terminalId) => ipcRenderer.invoke('clipboard:save-image', terminalId),
    writeText: (text) => clipboard.writeText(text),
  },
  piSessions: {
    list: (limit) => ipcRenderer.invoke('pi:sessions:list', limit),
  },
  integrations: {
    list: () => ipcRenderer.invoke('integrations:list'),
    install: (id) => ipcRenderer.invoke('integrations:install', id),
    uninstall: (id) => ipcRenderer.invoke('integrations:uninstall', id),
    doctor: () => ipcRenderer.invoke('integrations:doctor'),
  },
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  notify: (payload) => ipcRenderer.send('app:notify', payload),
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('app:command', listener);
    return () => ipcRenderer.removeListener('app:command', listener);
  },
  getVersion: () => ipcRenderer.invoke('app:version'),
});
