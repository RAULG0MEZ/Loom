const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('loomLocal', {
  listSources: () => ipcRenderer.invoke('sources:list'),
  saveRecording: (payload) => ipcRenderer.invoke('recordings:save', payload),
  listRecordings: () => ipcRenderer.invoke('recordings:list'),
  revealRecording: (filePath) => ipcRenderer.invoke('recordings:reveal', filePath),
  openFolder: () => ipcRenderer.invoke('recordings:openFolder'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSaveTarget: (saveTarget) => ipcRenderer.invoke('settings:setSaveTarget', saveTarget),
  chooseSaveDirectory: () => ipcRenderer.invoke('settings:chooseSaveDirectory'),
  cloudflareStatus: () => ipcRenderer.invoke('cloudflare:status'),
  uploadToCloudflare: (payload) => ipcRenderer.invoke('cloudflare:upload', payload),
  showPermissionHelp: () => ipcRenderer.invoke('permissions:help'),
  openPermissionSettings: () => ipcRenderer.invoke('permissions:openSettings'),
  openCameraSettings: () => ipcRenderer.invoke('permissions:openCameraSettings'),
  openMicrophoneSettings: () => ipcRenderer.invoke('permissions:openMicrophoneSettings'),
  requestPermissions: () => ipcRenderer.invoke('permissions:request'),
  permissionStatus: () => ipcRenderer.invoke('permissions:status'),
  setMousePassthrough: (ignore) => ipcRenderer.invoke('overlay:pointer', ignore),
  setRecordingState: (isRecording) => ipcRenderer.invoke('recording:state', isRecording),
  onStopRecordingRequest: (callback) => ipcRenderer.on('recording:stop-request', callback),
  onPauseToggleRecordingRequest: (callback) => ipcRenderer.on('recording:pause-toggle-request', callback),
  quit: () => ipcRenderer.invoke('app:quit')
});
