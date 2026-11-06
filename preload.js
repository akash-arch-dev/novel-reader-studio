const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  generateChapterAudio: (params) => ipcRenderer.invoke('generate-chapter-audio', params),
  deleteAudioVersion: (params) => ipcRenderer.invoke('delete-audio-version', params),
  onTTSProgress: (callback) => ipcRenderer.on('tts-progress', (event, data) => callback(data))
});