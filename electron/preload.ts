import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Process management
  startProcess: (projectPath: string) => ipcRenderer.invoke('process:start', projectPath),
  sendCommand: (projectId: string, command: string) => ipcRenderer.invoke('process:sendCommand', projectId, command),
  stopProcess: (projectId: string) => ipcRenderer.invoke('process:stop', projectId),
  
  // Cursor integration
  openInCursor: (projectPath: string) => ipcRenderer.invoke('cursor:open', projectPath),
  
  // State management
  saveState: (state: any) => ipcRenderer.invoke('state:save', state),
  loadState: () => ipcRenderer.invoke('state:load'),
  
  // Process output streaming
  onProcessOutput: (callback: (projectId: string, output: string) => void) => {
    ipcRenderer.on('process:output', (event, projectId, output) => callback(projectId, output))
  },
  
  // Process status updates
  onProcessStatus: (callback: (projectId: string, status: string) => void) => {
    ipcRenderer.on('process:status', (event, projectId, status) => callback(projectId, status))
  },
})