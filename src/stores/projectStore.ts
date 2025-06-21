import { create } from 'zustand'
import { Project, Command, AppSettings } from '../types'

interface ProjectStore {
  projects: Project[]
  activeProjectId: string | null
  commandHistory: Command[]
  settings: AppSettings
  
  // Actions
  addProject: (name: string, path: string) => void
  removeProject: (id: string) => void
  setActiveProject: (id: string) => void
  updateProjectStatus: (id: string, status: Project['status']) => void
  updateProjectOutput: (id: string, output: string) => void
  updateProjectProgress: (id: string, progress: number) => void
  
  sendCommand: (projectId: string, command: string) => Promise<void>
  addCommandToHistory: (command: Command) => void
  
  loadState: () => Promise<void>
  saveState: () => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  commandHistory: [],
  settings: {
    theme: 'dark',
    keyboardShortcuts: {
      focusCommandBar: 'cmd+k',
      switchProject: 'cmd+1-9',
      openInCursor: 'cmd+o',
      viewOutput: 'cmd+l',
    },
    autoSaveState: true,
    notificationsEnabled: true,
  },
  
  addProject: (name: string, path: string) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      path,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    set((state) => ({
      projects: [...state.projects, newProject],
      activeProjectId: newProject.id,
    }))
    
    // Start the Claude Code process
    window.electronAPI.startProcess(path).then((result) => {
      if (result.success && result.pid) {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === newProject.id ? { ...p, processId: result.pid } : p
          ),
        }))
      }
    })
    
    if (get().settings.autoSaveState) {
      get().saveState()
    }
  },
  
  removeProject: (id: string) => {
    // Stop the process first
    window.electronAPI.stopProcess(id)
    
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    }))
    
    if (get().settings.autoSaveState) {
      get().saveState()
    }
  },
  
  setActiveProject: (id: string) => {
    set({ activeProjectId: id })
  },
  
  updateProjectStatus: (id: string, status: Project['status']) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, status, updatedAt: new Date() } : p
      ),
    }))
  },
  
  updateProjectOutput: (id: string, output: string) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, currentOutput: output, updatedAt: new Date() } : p
      ),
    }))
  },
  
  updateProjectProgress: (id: string, progress: number) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, progress } : p
      ),
    }))
  },
  
  sendCommand: async (projectId: string, command: string) => {
    const newCommand: Command = {
      id: Date.now().toString(),
      projectId,
      command,
      timestamp: new Date(),
      status: 'pending',
    }
    
    get().addCommandToHistory(newCommand)
    get().updateProjectStatus(projectId, 'active')
    
    // Update last command for the project
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, lastCommand: command } : p
      ),
    }))
    
    try {
      const result = await window.electronAPI.sendCommand(projectId, command)
      if (result.success) {
        set((state) => ({
          commandHistory: state.commandHistory.map((c) =>
            c.id === newCommand.id ? { ...c, status: 'running' } : c
          ),
        }))
      }
    } catch (error) {
      set((state) => ({
        commandHistory: state.commandHistory.map((c) =>
          c.id === newCommand.id ? { ...c, status: 'failed' } : c
        ),
      }))
      get().updateProjectStatus(projectId, 'error')
    }
  },
  
  addCommandToHistory: (command: Command) => {
    set((state) => ({
      commandHistory: [command, ...state.commandHistory].slice(0, 100), // Keep last 100 commands
    }))
  },
  
  loadState: async () => {
    try {
      const state = await window.electronAPI.loadState()
      set({
        projects: state.projects.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          status: 'idle', // Reset status on load
          currentOutput: undefined,
          progress: undefined,
        })),
        activeProjectId: state.activeProjectId,
        commandHistory: state.commandHistory.map(c => ({
          ...c,
          timestamp: new Date(c.timestamp),
        })),
        settings: state.settings,
      })
    } catch (error) {
      console.error('Failed to load state:', error)
    }
  },
  
  saveState: async () => {
    const state = get()
    try {
      await window.electronAPI.saveState({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        commandHistory: state.commandHistory,
        settings: state.settings,
      })
    } catch (error) {
      console.error('Failed to save state:', error)
    }
  },
}))

// Set up listeners for process output and status updates
if (typeof window !== 'undefined' && window.electronAPI) {
  window.electronAPI.onProcessOutput((projectId, output) => {
    useProjectStore.getState().updateProjectOutput(projectId, output)
  })
  
  window.electronAPI.onProcessStatus((projectId, status) => {
    useProjectStore.getState().updateProjectStatus(projectId, status as Project['status'])
  })
}