// Preload script - 보안을 위해 contextIsolation 사용
const { contextBridge, ipcRenderer } = require('electron')

// 필요한 API만 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 업데이트 관련
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // 플랫폼 정보
  platform: process.platform
})
