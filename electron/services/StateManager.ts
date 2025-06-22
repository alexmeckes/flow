import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Project } from './ProcessManagerPTY';

interface SavedProject {
  id: string;
  name: string;
  path: string;
  lastCommand?: string;
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  projects: SavedProject[];
  recentCommands: string[];
  version: string;
}

export class StateManager {
  private stateDir: string;
  private stateFile: string;
  
  constructor() {
    this.stateDir = path.join(os.homedir(), '.claude-mission-control');
    this.stateFile = path.join(this.stateDir, 'state.json');
    this.ensureStateDir();
  }
  
  private ensureStateDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }
  
  async save(projects: Project[], recentCommands: string[] = []): Promise<void> {
    try {
      const state: AppState = {
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          path: p.path,
          lastCommand: p.lastCommand,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        })),
        recentCommands: recentCommands.slice(0, 100),
        version: '1.0.0'
      };
      
      await fs.promises.writeFile(
        this.stateFile,
        JSON.stringify(state, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save state:', error);
      throw error;
    }
  }
  
  async load(): Promise<AppState | null> {
    try {
      if (!fs.existsSync(this.stateFile)) {
        return null;
      }
      
      const data = await fs.promises.readFile(this.stateFile, 'utf8');
      
      // Check if file is empty
      if (!data || data.trim() === '') {
        console.log('State file is empty, returning null');
        return null;
      }
      
      const state = JSON.parse(data) as AppState;
      
      // Validate state structure
      if (!state.projects || !Array.isArray(state.projects)) {
        console.warn('Invalid state file structure');
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to load state:', error);
      // Delete corrupted state file
      try {
        if (fs.existsSync(this.stateFile)) {
          fs.unlinkSync(this.stateFile);
          console.log('Deleted corrupted state file');
        }
      } catch (deleteError) {
        console.error('Failed to delete corrupted state file:', deleteError);
      }
      return null;
    }
  }
  
  async clearState(): Promise<void> {
    try {
      if (fs.existsSync(this.stateFile)) {
        await fs.promises.unlink(this.stateFile);
      }
    } catch (error) {
      console.error('Failed to clear state:', error);
    }
  }
  
  getStateDir(): string {
    return this.stateDir;
  }
}