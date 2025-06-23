export interface IElectronAPI {
  // App info
  getVersion: () => Promise<string>;
  
  // Process management
  createProject: (name: string, path: string) => Promise<any>;
  removeProject: (projectId: string) => Promise<boolean>;
  
  // Session management
  createSession: (projectId: string, name: string, description?: string) => Promise<any>;
  removeSession: (sessionId: string) => Promise<boolean>;
  startClaudeSession: (sessionId: string) => Promise<void>;
  stopClaudeSession: (sessionId: string) => Promise<void>;
  sendSessionCommand: (sessionId: string, command: string) => Promise<void>;
  clearSessionOutput: (sessionId: string) => Promise<void>;
  
  // Listen for session events
  onSessionOutput: (callback: (sessionId: string, projectId: string, output: string) => void) => (() => void);
  onSessionStatus: (callback: (sessionId: string, projectId: string, status: string) => void) => (() => void);
  onSessionOutputCleared: (callback: (sessionId: string, projectId: string) => void) => (() => void);
  onSessionProgress: (callback: (sessionId: string, projectId: string, progressState: any) => void) => (() => void);
  onSessionCreated: (callback: (projectId: string, session: any) => void) => (() => void);
  onSessionRemoved: (callback: (projectId: string, sessionId: string) => void) => (() => void);
  
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