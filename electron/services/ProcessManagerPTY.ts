import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as pty from 'node-pty';
import { OutputAnalyzer } from './OutputAnalyzer';

export interface ProgressState {
  isActive: boolean;
  status: string;
  startTime: Date | null;
  lastOutputTime: Date | null;
  outputRate: number;
  phase: 'idle' | 'thinking' | 'working' | 'waiting' | 'complete';
}

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
  progressState?: ProgressState;
}

export class ProcessManager extends EventEmitter {
  private projects: Map<string, Project> = new Map();
  private outputAnalyzer = new OutputAnalyzer();
  private recentOutputs = new Map<string, Array<{ text: string; timestamp: Date }>>();
  private progressCheckInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.startProgressMonitoring();
  }

  private startProgressMonitoring(): void {
    // Check progress state every second
    this.progressCheckInterval = setInterval(() => {
      for (const [projectId, project] of this.projects) {
        if (project.progressState && project.progressState.isActive) {
          const now = new Date();
          const timeSinceLastOutput = project.progressState.lastOutputTime 
            ? now.getTime() - project.progressState.lastOutputTime.getTime()
            : 0;

          // Check if Claude is still active based on output patterns
          const recentOutputs = this.recentOutputs.get(projectId) || [];
          const lastOutput = recentOutputs.length > 0 
            ? recentOutputs[recentOutputs.length - 1].text 
            : '';

          const stillActive = this.outputAnalyzer.isStillActive(lastOutput, timeSinceLastOutput);

          if (!stillActive) {
            // Mark as complete if it was active
            project.progressState.isActive = false;
            project.progressState.phase = 'complete';
            project.progressState.status = 'Ready';
            
            this.emit('progress', { 
              projectId, 
              progressState: project.progressState 
            });
          }
        }
      }
    }, 1000);
  }
  
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
      
      // Initialize progress state
      project.progressState = {
        isActive: true,
        status: 'Starting Claude...',
        startTime: new Date(),
        lastOutputTime: new Date(),
        outputRate: 0,
        phase: 'thinking'
      };
      
      // Initialize recent outputs tracking
      this.recentOutputs.set(projectId, []);
      
      // Handle output from Claude
      project.claudeProcess.onData((data: string) => {
        // Emit raw data for terminal display
        project.output.push(data);
        this.emit('output', { projectId, output: data });
        
        // Track output for rate calculation
        const outputs = this.recentOutputs.get(projectId) || [];
        outputs.push({ text: data, timestamp: new Date() });
        // Keep only last 20 outputs
        if (outputs.length > 20) outputs.shift();
        this.recentOutputs.set(projectId, outputs);
        
        // Analyze output for progress
        const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '').trim();
        if (cleanData) {
          const analysis = this.outputAnalyzer.analyzeOutput(cleanData);
          const outputRate = this.outputAnalyzer.calculateOutputRate(outputs);
          
          // Update progress state
          if (project.progressState) {
            project.progressState.phase = analysis.phase as any;
            project.progressState.status = analysis.status;
            project.progressState.lastOutputTime = new Date();
            project.progressState.outputRate = outputRate;
            project.progressState.isActive = true;
            
            // Emit progress update
            this.emit('progress', { 
              projectId, 
              progressState: project.progressState 
            });
          }
        }
        
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
        
        // Clear progress state
        if (project.progressState) {
          project.progressState.isActive = false;
          project.progressState.phase = 'idle';
          project.progressState.status = '';
          this.emit('progress', { 
            projectId, 
            progressState: project.progressState 
          });
        }
        
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
    
    // Reset progress state when Enter is pressed (new command)
    if (command === '\r' || command === '\n') {
      console.log(`[${project.name}] Sent: <ENTER>`);
      
      // Reset progress for new command
      if (project.progressState) {
        project.progressState = {
          isActive: true,
          status: 'Processing command...',
          startTime: new Date(),
          lastOutputTime: new Date(),
          outputRate: 0,
          phase: 'thinking'
        };
        
        this.emit('progress', { 
          projectId, 
          progressState: project.progressState 
        });
      }
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
    // Stop progress monitoring
    if (this.progressCheckInterval) {
      clearInterval(this.progressCheckInterval);
      this.progressCheckInterval = null;
    }
    
    for (const project of this.projects.values()) {
      if (project.claudeProcess) {
        this.stopClaudeCode(project.id);
      }
    }
    // Cleanup complete
  }
}