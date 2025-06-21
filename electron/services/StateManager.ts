import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { AppState } from '../types'

export class StateManager {
  private configDir: string
  private stateFile: string
  
  constructor() {
    this.configDir = join(homedir(), '.claude-mission-control')
    this.stateFile = join(this.configDir, 'state.json')
  }
  
  async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create config directory:', error)
    }
  }
  
  async saveState(state: AppState): Promise<{ success: boolean }> {
    try {
      await this.ensureConfigDir()
      
      // Convert dates to ISO strings for JSON serialization
      const serializedState = {
        ...state,
        projects: state.projects.map(project => ({
          ...project,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        })),
        commandHistory: state.commandHistory.map(command => ({
          ...command,
          timestamp: command.timestamp.toISOString(),
        })),
      }
      
      await fs.writeFile(
        this.stateFile,
        JSON.stringify(serializedState, null, 2),
        'utf-8'
      )
      
      return { success: true }
    } catch (error) {
      console.error('Failed to save state:', error)
      return { success: false }
    }
  }
  
  async loadState(): Promise<AppState | null> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8')
      const parsedState = JSON.parse(data)
      
      // Convert ISO strings back to Date objects
      return {
        ...parsedState,
        projects: parsedState.projects.map((project: any) => ({
          ...project,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
        })),
        commandHistory: parsedState.commandHistory.map((command: any) => ({
          ...command,
          timestamp: new Date(command.timestamp),
        })),
      }
    } catch (error) {
      // File doesn't exist or is corrupted, return null
      return null
    }
  }
  
  async getRecentCommands(projectId?: string, limit: number = 10): Promise<string[]> {
    try {
      const state = await this.loadState()
      if (!state) return []
      
      let commands = state.commandHistory
      
      if (projectId) {
        commands = commands.filter(cmd => cmd.projectId === projectId)
      }
      
      // Get unique commands
      const uniqueCommands = Array.from(
        new Set(commands.map(cmd => cmd.command))
      )
      
      return uniqueCommands.slice(0, limit)
    } catch (error) {
      return []
    }
  }
  
  async clearState(): Promise<void> {
    try {
      await fs.unlink(this.stateFile)
    } catch (error) {
      // File doesn't exist, that's okay
    }
  }
}