import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  exitApp: () => ipcRenderer.invoke('exit-app'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
});
