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
    const handler = (_: any, data: any) => callback(data.projectId, data.output);
    ipcRenderer.on('process:output', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('process:output', handler);
  },
  
  // Listen for process status changes
  onProcessStatus: (callback: (projectId: string, status: string) => void) => {
    const handler = (_: any, data: any) => callback(data.projectId, data.status);
    ipcRenderer.on('process:status', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('process:status', handler);
  },
  
  // Listen for output cleared
  onProcessOutputCleared: (callback: (projectId: string) => void) => {
    const handler = (_: any, data: any) => callback(data.projectId);
    ipcRenderer.on('process:output:cleared', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('process:output:cleared', handler);
  },
  
  // Listen for progress updates
  onProcessProgress: (callback: (projectId: string, progressState: any) => void) => {
    const handler = (_: any, data: any) => callback(data.projectId, data.progressState);
    ipcRenderer.on('process:progress', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('process:progress', handler);
  },
  
  // Cursor integration
  openInCursor: (projectPath: string) => 
    ipcRenderer.invoke('cursor:open', projectPath),
  
  checkCursorOpen: (projectPath: string) =>
    ipcRenderer.invoke('cursor:checkOpen', projectPath),
  
  arrangeCursorWindows: () =>
    ipcRenderer.invoke('cursor:arrangeWindows'),
  
  // State management
  saveState: (state: any) => 
    ipcRenderer.invoke('state:save', state),
  
  loadState: () => 
    ipcRenderer.invoke('state:load'),
  
  // Dialog
  selectDirectory: () => 
    ipcRenderer.invoke('dialog:selectDirectory')
});