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
  
  // Session management
  createSession: (projectId: string, name: string, description?: string) => 
    ipcRenderer.invoke('session:create', { projectId, name, description }),
  
  removeSession: (sessionId: string) => 
    ipcRenderer.invoke('session:remove', sessionId),
  
  startClaudeSession: (sessionId: string) => 
    ipcRenderer.invoke('session:start', sessionId),
  
  stopClaudeSession: (sessionId: string) => 
    ipcRenderer.invoke('session:stop', sessionId),
  
  sendSessionCommand: (sessionId: string, command: string) => 
    ipcRenderer.invoke('session:command', { sessionId, command }),
  
  clearSessionOutput: (sessionId: string) => 
    ipcRenderer.invoke('session:clearOutput', sessionId),
  
  // Listen for session output
  onSessionOutput: (callback: (sessionId: string, projectId: string, output: string) => void) => {
    const handler = (_: any, data: any) => callback(data.sessionId, data.projectId, data.output);
    ipcRenderer.on('session:output', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('session:output', handler);
  },
  
  // Listen for session status changes
  onSessionStatus: (callback: (sessionId: string, projectId: string, status: string) => void) => {
    const handler = (_: any, data: any) => callback(data.sessionId, data.projectId, data.status);
    ipcRenderer.on('session:status', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('session:status', handler);
  },
  
  // Listen for output cleared
  onSessionOutputCleared: (callback: (sessionId: string, projectId: string) => void) => {
    const handler = (_: any, data: any) => callback(data.sessionId, data.projectId);
    ipcRenderer.on('session:output:cleared', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('session:output:cleared', handler);
  },
  
  // Listen for progress updates
  onSessionProgress: (callback: (sessionId: string, projectId: string, progressState: any) => void) => {
    const handler = (_: any, data: any) => callback(data.sessionId, data.projectId, data.progressState);
    ipcRenderer.on('session:progress', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('session:progress', handler);
  },
  
  // Listen for session events
  onSessionCreated: (callback: (projectId: string, session: any) => void) => {
    const handler = (_: any, data: any) => callback(data.projectId, data.session);
    ipcRenderer.on('session:created', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('session:created', handler);
  },
  
  onSessionRemoved: (callback: (projectId: string, sessionId: string) => void) => {
    const handler = (_: any, data: any) => callback(data.projectId, data.sessionId);
    ipcRenderer.on('session:removed', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('session:removed', handler);
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