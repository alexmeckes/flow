import { create } from 'zustand';
import { Project, Command } from '../types';

interface ProjectStore {
  projects: Project[];
  activeProjectId?: string;
  recentCommands: Command[];
  commandHistory: string[];
  
  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  setActiveProject: (projectId: string | undefined) => void;
  addCommand: (command: Command) => void;
  addToCommandHistory: (command: string) => void;
  updateProjectOutput: (projectId: string, output: string) => void;
  updateProjectStatus: (projectId: string, status: Project['status']) => void;
  clearProjectOutput: (projectId: string) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  activeProjectId: undefined,
  recentCommands: [],
  commandHistory: [],
  
  setProjects: (projects) => set({ projects }),
  
  addProject: (project) => set((state) => ({
    projects: [...state.projects, project]
  })),
  
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
  
  addCommand: (command) => set((state) => ({
    recentCommands: [command, ...state.recentCommands].slice(0, 100)
  })),
  
  addToCommandHistory: (command) => set((state) => ({
    commandHistory: [command, ...state.commandHistory.filter(c => c !== command)].slice(0, 50)
  })),
  
  updateProjectOutput: (projectId, output) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { 
            ...p, 
            output: [...p.output, output],
            updatedAt: new Date()
          } 
        : p
    )
  })),
  
  updateProjectStatus: (projectId, status) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { ...p, status, updatedAt: new Date() } 
        : p
    )
  })),
  
  clearProjectOutput: async (projectId) => {
    // Clear in the backend first
    if (window.electronAPI) {
      await window.electronAPI.clearProjectOutput(projectId);
    }
    
    // Then update the UI
    set((state) => ({
      projects: state.projects.map(p => 
        p.id === projectId 
          ? { ...p, output: [], updatedAt: new Date() } 
          : p
      )
    }));
  },
}));