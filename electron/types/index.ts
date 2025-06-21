export interface Project {
  id: string
  name: string
  path: string
  status: 'active' | 'idle' | 'error'
  lastCommand?: string
  currentOutput?: string
  progress?: number
  processId?: number
  createdAt: Date
  updatedAt: Date
}

export interface Command {
  id: string
  projectId: string
  command: string
  timestamp: Date
  status: 'pending' | 'running' | 'completed' | 'failed'
  output?: string
}

export interface AppState {
  projects: Project[]
  activeProjectId: string | null
  commandHistory: Command[]
  settings: AppSettings
}

export interface AppSettings {
  theme: 'dark' | 'light'
  keyboardShortcuts: KeyboardShortcuts
  autoSaveState: boolean
  notificationsEnabled: boolean
}

export interface KeyboardShortcuts {
  focusCommandBar: string
  switchProject: string
  openInCursor: string
  viewOutput: string
}

// Electron API types
declare global {
  interface Window {
    electronAPI: {
      startProcess: (projectPath: string) => Promise<{ success: boolean; pid?: number }>
      sendCommand: (projectId: string, command: string) => Promise<{ success: boolean }>
      stopProcess: (projectId: string) => Promise<{ success: boolean }>
      openInCursor: (projectPath: string) => Promise<{ success: boolean }>
      saveState: (state: AppState) => Promise<{ success: boolean }>
      loadState: () => Promise<AppState>
      onProcessOutput: (callback: (projectId: string, output: string) => void) => void
      onProcessStatus: (callback: (projectId: string, status: string) => void) => void
    }
  }
}