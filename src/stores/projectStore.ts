import { create } from 'zustand';
import { Project, ClaudeSession, Command } from '../types';

interface ProjectStore {
  projects: Project[];
  activeProjectId?: string;
  activeSessionId?: string;
  recentCommands: Command[];
  commandHistory: string[];
  cursorStatusMap: Map<string, boolean>; // Map of projectPath -> isCursorOpen
  
  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  setActiveProject: (projectId: string | undefined) => void;
  setActiveSession: (sessionId: string | undefined) => void;
  updateCursorStatus: (projectPath: string, isOpen: boolean) => void;
  getCursorStatus: (projectPath: string) => boolean;
  
  // Session actions
  addSession: (projectId: string, session: ClaudeSession) => void;
  removeSession: (projectId: string, sessionId: string) => void;
  updateSession: (projectId: string, sessionId: string, updates: Partial<ClaudeSession>) => void;
  updateSessionOutput: (projectId: string, sessionId: string, output: string) => void;
  updateSessionStatus: (projectId: string, sessionId: string, status: ClaudeSession['status']) => void;
  clearSessionOutput: (projectId: string, sessionId: string) => void;
  
  // Command actions
  addCommand: (command: Command) => void;
  addToCommandHistory: (command: string) => void;
  
  // Cursor status actions
  updateCursorStatus: (projectPath: string, isOpen: boolean) => void;
  getCursorStatus: (projectPath: string) => boolean;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: undefined,
  activeSessionId: undefined,
  recentCommands: [],
  commandHistory: [],
  cursorStatusMap: new Map(),
  
  setProjects: (projects) => set({ projects }),
  
  addProject: (project) => set((state) => {
    // Check if project with same path already exists
    const exists = state.projects.some(p => p.path === project.path);
    if (exists) {
      console.warn(`Project already exists at path: ${project.path}`);
      return state;
    }
    return {
      projects: [...state.projects, project]
    };
  }),
  
  removeProject: (projectId) => set((state) => ({
    projects: state.projects.filter(p => p.id !== projectId),
    activeProjectId: state.activeProjectId === projectId ? undefined : state.activeProjectId
  })),
  
  updateProject: (projectId, updates) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId ? { ...p, ...updates } : p
    )
  })),
  
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  
  // Session actions
  addSession: (projectId, session) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { ...p, sessions: [...p.sessions, session], updatedAt: new Date() }
        : p
    )
  })),
  
  removeSession: (projectId, sessionId) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { ...p, sessions: p.sessions.filter(s => s.id !== sessionId), updatedAt: new Date() }
        : p
    ),
    activeSessionId: state.activeSessionId === sessionId ? undefined : state.activeSessionId
  })),
  
  updateSession: (projectId, sessionId, updates) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? {
            ...p,
            sessions: p.sessions.map(s => 
              s.id === sessionId ? { ...s, ...updates } : s
            ),
            updatedAt: new Date()
          }
        : p
    )
  })),
  
  updateSessionOutput: (projectId, sessionId, output) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? {
            ...p,
            sessions: p.sessions.map(s => 
              s.id === sessionId 
                ? { ...s, output: [...s.output, output], updatedAt: new Date() }
                : s
            )
          }
        : p
    )
  })),
  
  updateSessionStatus: (projectId, sessionId, status) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? {
            ...p,
            sessions: p.sessions.map(s => 
              s.id === sessionId 
                ? { ...s, status, updatedAt: new Date() }
                : s
            )
          }
        : p
    )
  })),
  
  clearSessionOutput: async (projectId, sessionId) => {
    // Clear in the backend first
    if (window.electronAPI) {
      await window.electronAPI.clearSessionOutput(sessionId);
    }
    
    // Then update the UI
    set((state) => ({
      projects: state.projects.map(p => 
        p.id === projectId 
          ? {
              ...p,
              sessions: p.sessions.map(s => 
                s.id === sessionId 
                  ? { ...s, output: [], updatedAt: new Date() }
                  : s
              )
            }
          : p
      )
    }));
  },
  
  addCommand: (command) => set((state) => ({
    recentCommands: [command, ...state.recentCommands].slice(0, 100)
  })),
  
  addToCommandHistory: (command) => set((state) => ({
    commandHistory: [command, ...state.commandHistory.filter(c => c !== command)].slice(0, 50)
  })),
  
  updateCursorStatus: (projectPath, isOpen) => set((state) => {
    const newMap = new Map(state.cursorStatusMap);
    newMap.set(projectPath, isOpen);
    return { cursorStatusMap: newMap };
  }),
  
  getCursorStatus: (projectPath) => {
    const state = get();
    return state.cursorStatusMap.get(projectPath) || false;
  },
}));