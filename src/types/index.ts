export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'idle' | 'error';
  lastCommand?: string;
  output: string[];
  createdAt: Date;
  updatedAt: Date;
  cursorWindowId?: number;
  cursorPid?: number;
}

export interface Command {
  id: string;
  projectId: string;
  command: string;
  timestamp: Date;
}

export interface AppState {
  projects: Project[];
  recentCommands: Command[];
  activeProjectId?: string;
}