const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
	version: () => ipcRenderer.invoke('app-version'),
});
