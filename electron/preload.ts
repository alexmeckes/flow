import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  
  // Process management
  createProject: (name: string, path: string) => 
    ipcRenderer.invoke('process:create', { name, path }),
  
  removeProject: (projectId: string) => 
    ipcRenderer.invoke('process:remove', projectId),
  
  startClaudeCode: (projectId: string) => 
    ipcRenderer.invoke('process:start', projectId),
  
  stopClaudeCode: (projectId: string) => 
    ipcRenderer.invoke('process:stop', projectId),
  
  sendCommand: (projectId: string, command: string) => 
    ipcRenderer.invoke('process:command', { projectId, command }),
  
  clearProjectOutput: (projectId: string) => 
    ipcRenderer.invoke('process:clearOutput', projectId),
  
  // Listen for process output
  onProcessOutput: (callback: (projectId: string, output: string) => void) => {
    ipcRenderer.on('process:output', (_, data) => callback(data.projectId, data.output));
  },
  
  // Listen for process status changes
  onProcessStatus: (callback: (projectId: string, status: string) => void) => {
    ipcRenderer.on('process:status', (_, data) => callback(data.projectId, data.status));
  },
  
  // Listen for output cleared
  onProcessOutputCleared: (callback: (projectId: string) => void) => {
    ipcRenderer.on('process:output:cleared', (_, data) => callback(data.projectId));
  },
  
  // Cursor integration
  openInCursor: (projectPath: string) => 
    ipcRenderer.invoke('cursor:open', projectPath),
  
  // State management
  saveState: (state: any) => 
    ipcRenderer.invoke('state:save', state),
  
  loadState: () => 
    ipcRenderer.invoke('state:load'),
  
  // Dialog
  selectDirectory: () => 
    ipcRenderer.invoke('dialog:selectDirectory')
});