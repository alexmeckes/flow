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
  claudeProcess?: ChildProcess;
  lastCommand?: string;
  output: string[];
  createdAt: Date;
  updatedAt: Date;
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
      throw new Error(`Claude Code already running for project ${projectId}`);
    }
    
    try {
      // Determine which command to use
      let command = 'claude';
      let args: string[] = [];
      let useNonInteractive = false;
      
      // Check if claude exists first
      try {
        const checkCommand = process.platform === 'win32' ? 'where' : 'which';
        execSync(`${checkCommand} claude`);
        
        // For now, let's use interactive mode but we could switch to non-interactive
        // by setting useNonInteractive = true and handling commands differently
        useNonInteractive = false;
      } catch (error) {
        // Fallback to a test command if claude not found
        console.warn('Claude CLI not found, using test mode with bash');
        command = 'bash';
        args = ['-c', 'echo "Claude Code simulator started. Type commands to see them echoed back."; while read line; do echo "Received: $line"; done'];
      }
      
      project.claudeProcess = spawn(command, args, {
        cwd: project.path,
        shell: true,
        env: { ...process.env }
      });
      
      project.status = 'active';
      project.updatedAt = new Date();
      
      // Add initial message
      const startMessage = `Starting Claude in ${project.path}...\n`;
      project.output.push(startMessage);
      this.emit('output', { projectId, output: startMessage });
      
      // Handle stdout
      project.claudeProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[${project.name}] stdout:`, output);
        project.output.push(output);
        
        // Keep only last 1000 lines
        if (project.output.length > 1000) {
          project.output = project.output.slice(-1000);
        }
        
        this.emit('output', { projectId, output });
      });
      
      // Handle stderr
      project.claudeProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        console.log(`[${project.name}] stderr:`, output);
        project.output.push(`[STDERR] ${output}`);
        this.emit('output', { projectId, output: `[STDERR] ${output}` });
      });
      
      // Handle process exit
      project.claudeProcess.on('exit', (code) => {
        project.status = code === 0 ? 'idle' : 'error';
        project.claudeProcess = undefined;
        project.updatedAt = new Date();
        this.emit('status', { projectId, status: project.status });
      });
      
      // Handle process error
      project.claudeProcess.on('error', (err) => {
        project.status = 'error';
        project.output.push(`[ERROR] Process error: ${err.message}`);
        project.claudeProcess = undefined;
        project.updatedAt = new Date();
        this.emit('status', { projectId, status: 'error' });
      });
      
      this.emit('status', { projectId, status: 'active' });
    } catch (error) {
      project.status = 'error';
      throw error;
    }
  }
  
  stopClaudeCode(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project || !project.claudeProcess) return;
    
    try {
      project.claudeProcess.kill('SIGTERM');
      setTimeout(() => {
        if (project.claudeProcess) {
          project.claudeProcess.kill('SIGKILL');
        }
      }, 5000);
    } catch (error) {
      console.error(`Error stopping process for project ${projectId}:`, error);
    }
  }
  
  sendCommand(projectId: string, command: string): void {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    
    if (!project.claudeProcess || !project.claudeProcess.stdin) {
      throw new Error(`Claude not running for project ${projectId}`);
    }
    
    project.lastCommand = command;
    project.status = 'active';
    project.updatedAt = new Date();
    
    // Add command to output for visibility
    const commandOutput = `\n> ${command}\n`;
    project.output.push(commandOutput);
    this.emit('output', { projectId, output: commandOutput });
    
    // Send command to process stdin
    console.log(`Sending command to ${project.name}: ${command}`);
    
    // Send command with double newline - many chat interfaces use empty line to submit
    project.claudeProcess.stdin.write(command + '\n\n');
    console.log(`Sent command with double newline to ${project.name}`);
    
    this.emit('status', { projectId, status: 'active' });
  }
  
  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }
  
  getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }
  
  // Clean up all processes on shutdown
  cleanup(): void {
    for (const project of this.projects.values()) {
      if (project.claudeProcess) {
        this.stopClaudeCode(project.id);
      }
    }
  }
}