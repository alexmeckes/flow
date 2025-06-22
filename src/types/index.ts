export interface ProgressState {
  isActive: boolean;
  status: string;
  startTime: Date | null;
  lastOutputTime: Date | null;
  outputRate: number; // chars per second
  phase: 'idle' | 'thinking' | 'working' | 'waiting' | 'complete';
}

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
  progressState?: ProgressState;
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