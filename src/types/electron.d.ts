export interface IElectronAPI {
  // App info
  getVersion: () => Promise<string>;
  
  // Process management
  createProject: (name: string, path: string) => Promise<any>;
  removeProject: (projectId: string) => Promise<boolean>;
  startClaudeCode: (projectId: string) => Promise<void>;
  stopClaudeCode: (projectId: string) => Promise<void>;
  sendCommand: (projectId: string, command: string) => Promise<void>;
  clearProjectOutput: (projectId: string) => Promise<void>;
  
  // Listen for process output
  onProcessOutput: (callback: (projectId: string, output: string) => void) => void;
  
  // Listen for process status changes
  onProcessStatus: (callback: (projectId: string, status: string) => void) => void;
  
  // Listen for output cleared
  onProcessOutputCleared: (callback: (projectId: string) => void) => void;
  
  // Listen for progress updates
  onProcessProgress: (callback: (projectId: string, progressState: any) => void) => void;
  
  // Cursor integration
  openInCursor: (projectPath: string) => Promise<void>;
  checkCursorOpen: (projectPath: string) => Promise<boolean>;
  arrangeCursorWindows: () => Promise<boolean>;
  
  // State management
  saveState: (state: any) => Promise<void>;
  loadState: () => Promise<any>;
  
  // Dialog
  selectDirectory: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}