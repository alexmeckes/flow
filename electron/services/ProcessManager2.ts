import { ChildProcess, spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'idle' | 'error';
  lastCommand?: string;
  output: string[];
  createdAt: Date;
  updatedAt: Date;
  isProcessing?: boolean;
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
      updatedAt: new Date(),
      isProcessing: false
    };
    
    this.projects.set(project.id, project);
    this.emit('project:created', project);
    return project;
  }
  
  removeProject(projectId: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;
    
    this.projects.delete(projectId);
    this.emit('project:removed', projectId);
    return true;
  }
  
  async startClaudeCode(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    
    // In this version, we don't keep a persistent process
    // Just mark as active/ready
    project.status = 'active';
    project.updatedAt = new Date();
    
    const message = `Claude is ready for commands in ${project.path}\n`;
    project.output.push(message);
    this.emit('output', { projectId, output: message });
    this.emit('status', { projectId, status: 'active' });
  }
  
  stopClaudeCode(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;
    
    project.status = 'idle';
    project.updatedAt = new Date();
    this.emit('status', { projectId, status: 'idle' });
  }
  
  async sendCommand(projectId: string, command: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    
    if (project.isProcessing) {
      throw new Error('Already processing a command');
    }
    
    project.lastCommand = command;
    project.isProcessing = true;
    project.updatedAt = new Date();
    
    // Add command to output
    const commandOutput = `\n> ${command}\n`;
    project.output.push(commandOutput);
    this.emit('output', { projectId, output: commandOutput });
    
    try {
      // Check if claude exists
      const checkCommand = process.platform === 'win32' ? 'where' : 'which';
      let useClaudeCommand = false;
      
      try {
        execSync(`${checkCommand} claude`);
        useClaudeCommand = true;
      } catch {
        console.warn('Claude CLI not found, using simulator');
      }
      
      if (useClaudeCommand) {
        // Use claude in non-interactive mode with -p flag
        const claudeProcess = spawn('claude', ['-p', command], {
          cwd: project.path,
          shell: false,
          env: { ...process.env }
        });
        
        let output = '';
        
        claudeProcess.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          project.output.push(chunk);
          this.emit('output', { projectId, output: chunk });
        });
        
        claudeProcess.stderr?.on('data', (data) => {
          const error = data.toString();
          project.output.push(`[ERROR] ${error}`);
          this.emit('output', { projectId, output: `[ERROR] ${error}` });
        });
        
        claudeProcess.on('close', (code) => {
          project.isProcessing = false;
          if (code !== 0) {
            project.status = 'error';
            this.emit('status', { projectId, status: 'error' });
          }
        });
        
        claudeProcess.on('error', (err) => {
          project.isProcessing = false;
          project.status = 'error';
          const errorMsg = `Process error: ${err.message}\n`;
          project.output.push(errorMsg);
          this.emit('output', { projectId, output: errorMsg });
          this.emit('status', { projectId, status: 'error' });
        });
      } else {
        // Simulator mode
        setTimeout(() => {
          const response = `[Simulator] Received: ${command}\n`;
          project.output.push(response);
          this.emit('output', { projectId, output: response });
          project.isProcessing = false;
        }, 500);
      }
    } catch (error: any) {
      project.isProcessing = false;
      project.status = 'error';
      const errorMsg = `Error: ${error.message}\n`;
      project.output.push(errorMsg);
      this.emit('output', { projectId, output: errorMsg });
      this.emit('status', { projectId, status: 'error' });
    }
  }
  
  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }
  
  getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }
  
  cleanup(): void {
    // Nothing to cleanup in this version
  }
}