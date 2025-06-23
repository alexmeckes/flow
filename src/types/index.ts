export interface ProgressState {
  isActive: boolean;
  status: string;
  startTime: Date | null;
  lastOutputTime: Date | null;
  outputRate: number; // chars per second
  phase: 'idle' | 'thinking' | 'working' | 'waiting' | 'complete';
}

export interface ClaudeSession {
  id: string;
  projectId: string;
  name: string; // e.g., "Auth Bug Fix", "API Refactor"
  description?: string; // What this session is working on
  status: 'active' | 'idle' | 'error';
  lastCommand?: string;
  output: string[];
  progressState?: ProgressState;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  sessions: ClaudeSession[];
  createdAt: Date;
  updatedAt: Date;
  cursorWindowId?: number;
  cursorPid?: number;
}

export interface Command {
  id: string;
  projectId: string;
  sessionId?: string;
  command: string;
  timestamp: Date;
}

export interface AppState {
  projects: Project[];
  recentCommands: Command[];
  activeProjectId?: string;
}