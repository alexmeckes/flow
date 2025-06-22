import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as pty from 'node-pty';
// Removed complex parsers - let's keep it simple

export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'idle' | 'error';
  claudeProcess?: pty.IPty;
  lastCommand?: string;
  output: string[];
  createdAt: Date;
  updatedAt: Date;
  cursorWindowId?: number;
  cursorPid?: number;
}

export class ProcessManager extends EventEmitter {
  private projects: Map<string, Project> = new Map();
  
  createProject(name: string, projectPath: string): Project {
    // Validate project path exists
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    // Check if it's a directory
    const stats = fs.statSync(projectPath);
    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
    
    const project: Project = {
      id: uuidv4(),
      name,
      path: projectPath,
      status: 'idle',
      output: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.projects.set(project.id, project);
    this.emit('project:created', project);
    return project;
  }
  
  removeProject(projectId: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;
    
    // Stop the process if running
    if (project.claudeProcess) {
      this.stopClaudeCode(projectId);
    }
    
    this.projects.delete(projectId);
    this.emit('project:removed', projectId);
    return true;
  }
  
  async startClaudeCode(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    
    if (project.claudeProcess) {
      throw new Error(`Claude already running for project ${projectId}`);
    }
    
    try {
      // Create a pseudo-terminal with claude or test script
      let shell = process.platform === 'win32' ? 'claude.exe' : 'claude';
      let args: string[] = [];
      
      // For testing, use our simulator if claude not found
      if (process.env.USE_TEST_CLAUDE === 'true') {
        shell = 'node';
        args = [path.join(__dirname, '../../test-claude-simulator.js')];
        console.log('Using Claude simulator for testing');
      }
      
      project.claudeProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: project.path,
        env: process.env as { [key: string]: string }
      });
      
      project.status = 'active';
      project.updatedAt = new Date();
      
      // Simple deduplication state
      let lastLine = '';
      let lastEmittedLine = '';
      
      // Handle output from Claude
      project.claudeProcess.onData((data: string) => {
        // Just emit the raw data - let the frontend handle display
        // This preserves Claude's TUI behavior
        project.output.push(data);
        this.emit('output', { projectId, output: data });
        
        // Log for debugging
        console.log(`[${project.name}] Raw output:`, JSON.stringify(data.substring(0, 100)));
        
        // Keep only last 1000 entries
        if (project.output.length > 1000) {
          project.output = project.output.slice(-1000);
        }
      });
      
      // Handle process exit
      project.claudeProcess.onExit(({ exitCode, signal }) => {
        console.log(`Claude process exited with code ${exitCode}, signal ${signal}`);
        project.status = exitCode === 0 ? 'idle' : 'error';
        project.claudeProcess = undefined;
        project.updatedAt = new Date();
        this.emit('status', { projectId, status: project.status });
      });
      
      this.emit('status', { projectId, status: 'active' });
      
      // Give Claude a moment to start up
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      project.status = 'error';
      console.error(`Failed to start Claude for project ${projectId}:`, error);
      throw error;
    }
  }
  
  stopClaudeCode(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project || !project.claudeProcess) return;
    
    try {
      // Send Ctrl+D to gracefully exit
      project.claudeProcess.write('\x04');
      
      // Give it time to exit gracefully, then kill if needed
      setTimeout(() => {
        if (project.claudeProcess) {
          project.claudeProcess.kill();
        }
      }, 2000);
    } catch (error) {
      console.error(`Error stopping process for project ${projectId}:`, error);
    }
  }
  
  sendCommand(projectId: string, command: string): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    
    if (!project.claudeProcess) {
      throw new Error(`Claude not running for project ${projectId}`);
    }
    
    project.status = 'active';
    project.updatedAt = new Date();
    
    // With xterm.js, we're sending raw keystrokes, not full commands
    // Just pass them through directly to the PTY
    project.claudeProcess.write(command);
    
    // Log non-printable characters for debugging
    if (command === '\r' || command === '\n') {
      console.log(`[${project.name}] Sent: <ENTER>`);
    } else if (command === '\x7f' || command === '\b') {
      console.log(`[${project.name}] Sent: <BACKSPACE>`);
    } else if (command === '\x03') {
      console.log(`[${project.name}] Sent: <CTRL-C>`);
    } else if (command === '\x04') {
      console.log(`[${project.name}] Sent: <CTRL-D>`);
    } else if (command.length === 1 && command.charCodeAt(0) < 32) {
      console.log(`[${project.name}] Sent control char: 0x${command.charCodeAt(0).toString(16)}`);
    }
    
    this.emit('status', { projectId, status: 'active' });
  }
  
  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }
  
  getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }
  
  // Clear output for a specific project
  clearProjectOutput(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;
    
    project.output = [];
    project.updatedAt = new Date();
    
    // Nothing extra to clear
    
    this.emit('output:cleared', { projectId });
  }
  
  // Clean up all processes on shutdown
  cleanup(): void {
    for (const project of this.projects.values()) {
      if (project.claudeProcess) {
        this.stopClaudeCode(project.id);
      }
    }
    // Cleanup complete
  }
}