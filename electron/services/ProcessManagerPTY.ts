import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as pty from 'node-pty';
import { OutputAnalyzer } from './OutputAnalyzer';
import { debugLog, debugPTYSpawn, debugPTYEvent, initPTYDebug } from '../debugPTY';

export interface ProgressState {
  isActive: boolean;
  status: string;
  startTime: Date | null;
  lastOutputTime: Date | null;
  outputRate: number;
  phase: 'idle' | 'thinking' | 'working' | 'waiting' | 'complete';
}

export interface ClaudeSession {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'active' | 'idle' | 'error';
  claudeProcess?: pty.IPty;
  lastCommand?: string;
  output: string[];
  progressState?: ProgressState;
  createdAt: Date;
  updatedAt: Date;
  lastAnalysisTime?: number;
  emitTimer?: NodeJS.Timeout | null;
  pendingOutput?: string;
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

export class ProcessManager extends EventEmitter {
  private projects: Map<string, Project> = new Map();
  private sessions: Map<string, ClaudeSession> = new Map();
  private outputAnalyzer = new OutputAnalyzer();
  private recentOutputs = new Map<string, Array<{ text: string; timestamp: Date }>>();
  private progressCheckInterval: NodeJS.Timeout | null = null;
  private activeDataHandlers = new Map<string, boolean>();
  
  constructor() {
    super();
    initPTYDebug();
    this.startProgressMonitoring();
    
    // Increase max listeners to prevent warning
    this.setMaxListeners(50);
    
    debugLog('ProcessManager initialized');
  }
  
  private async checkCommandExists(command: string): Promise<boolean> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (process.platform === 'win32') {
        await execAsync(`where ${command}`);
      } else {
        await execAsync(`which ${command}`);
      }
      return true;
    } catch {
      return false;
    }
  }

  private startProgressMonitoring(): void {
    // Check progress state every second
    this.progressCheckInterval = setInterval(() => {
      for (const [sessionId, session] of this.sessions) {
        if (session.progressState && session.progressState.isActive) {
          const now = new Date();
          const timeSinceLastOutput = session.progressState.lastOutputTime 
            ? now.getTime() - session.progressState.lastOutputTime.getTime()
            : 0;

          // Check if Claude is still active based on output patterns
          const recentOutputs = this.recentOutputs.get(sessionId) || [];
          const lastOutput = recentOutputs.length > 0 
            ? recentOutputs[recentOutputs.length - 1].text 
            : '';

          const stillActive = this.outputAnalyzer.isStillActive(lastOutput, timeSinceLastOutput);

          if (!stillActive) {
            // Mark as complete if it was active
            session.progressState.isActive = false;
            session.progressState.phase = 'complete';
            session.progressState.status = 'Ready';
            
            this.emit('progress', { 
              sessionId, 
              projectId: session.projectId,
              progressState: session.progressState 
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
      sessions: [],
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
    
    // Stop all sessions for this project
    for (const session of project.sessions) {
      this.removeSession(session.id);
    }
    
    this.projects.delete(projectId);
    this.emit('project:removed', projectId);
    return true;
  }
  
  createSession(projectId: string, name: string, description?: string): ClaudeSession {
    debugLog(`createSession called for project ${projectId}, name: ${name}`);
    
    const project = this.projects.get(projectId);
    if (!project) {
      debugLog(`Project ${projectId} not found`);
      throw new Error(`Project ${projectId} not found`);
    }
    
    const session: ClaudeSession = {
      id: uuidv4(),
      projectId,
      name,
      description,
      status: 'idle',
      output: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    debugLog(`Created session object:`, { id: session.id, name: session.name });
    
    project.sessions.push(session);
    this.sessions.set(session.id, session);
    
    debugLog(`Session ${session.id} added to maps. Total sessions: ${this.sessions.size}`);
    
    this.emit('session:created', { projectId, session });
    return session;
  }
  
  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    // Stop the process if running
    if (session.claudeProcess) {
      this.stopClaudeCode(sessionId);
    }
    
    // Clean up tracking data
    this.recentOutputs.delete(sessionId);
    this.activeDataHandlers.delete(sessionId);
    
    // Remove from project's sessions array
    const project = this.projects.get(session.projectId);
    if (project) {
      project.sessions = project.sessions.filter(s => s.id !== sessionId);
    }
    
    this.sessions.delete(sessionId);
    this.emit('session:removed', { projectId: session.projectId, sessionId });
    return true;
  }
  
  async startClaudeCode(sessionId: string): Promise<void> {
    debugLog(`startClaudeCode called for session ${sessionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      debugLog(`Session ${sessionId} not found in map. Available sessions:`, Array.from(this.sessions.keys()));
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const project = this.projects.get(session.projectId);
    if (!project) {
      debugLog(`Project ${session.projectId} not found`);
      throw new Error(`Project ${session.projectId} not found`);
    }
    
    if (session.claudeProcess) {
      debugLog(`Claude already running for session ${sessionId}`);
      throw new Error(`Claude already running for session ${sessionId}`);
    }
    
    debugLog(`Starting Claude for session ${sessionId} in project ${project.path}`);
    
    try {
      // Create a pseudo-terminal with claude or test script
      let shell = process.platform === 'win32' ? 'claude.exe' : 'claude';
      let args: string[] = [];
      
      // For testing, use our simulator if claude not found
      if (process.env.USE_TEST_CLAUDE === 'true') {
        shell = 'node';
        args = [path.join(__dirname, '../../test-claude-simulator.js')];
        console.log('Using Claude simulator for testing');
      } else if (process.env.USE_SAFE_PTY_TEST === 'true') {
        shell = 'node';
        args = [path.join(__dirname, '../../test-safe-pty.js')];
        console.log('Using safe PTY test script');
      }
      
      // Ensure the project path exists and is accessible
      if (!fs.existsSync(project.path)) {
        throw new Error(`Project path does not exist: ${project.path}`);
      }
      
      try {
        // First check if claude command exists
        const claudeExists = await this.checkCommandExists(shell);
        
        if (!claudeExists && shell === 'claude') {
          // Use a demo mode if claude is not installed
          console.warn('Claude command not found, using demo mode');
          shell = 'sh';
          args = ['-c', 'echo "Claude CLI not found. Please install Claude CLI."; echo "Visit: https://claude.ai/cli"; sleep 2; echo "Demo mode active"; while true; do read -p "> " input; echo "Demo response to: $input"; done'];
        }
        
        const ptyOptions = {
          name: 'xterm-256color',
          cols: 80,
          rows: 30,
          cwd: project.path,
          env: process.env as { [key: string]: string }
        };
        
        debugPTYSpawn(shell, args, ptyOptions);
        
        // Create PTY with additional safety wrapper
        const ptyInstance = pty.spawn(shell, args, ptyOptions);
        
        // Verify PTY instance is valid before using
        if (!ptyInstance || typeof ptyInstance.onData !== 'function') {
          throw new Error('Failed to create valid PTY instance');
        }
        
        session.claudeProcess = ptyInstance;
        
        debugPTYEvent(sessionId, 'spawned', { 
          pid: session.claudeProcess.pid,
          process: session.claudeProcess.process
        });
      } catch (spawnError) {
        console.error('Failed to spawn PTY:', spawnError);
        const errorMessage = spawnError instanceof Error ? spawnError.message : String(spawnError);
        
        // If spawn fails, try a simple shell
        try {
          console.log('Falling back to simple shell');
          session.claudeProcess = pty.spawn('sh', ['-c', 'echo "Error: Failed to start Claude. Check installation."; exit 1'], {
            name: 'xterm-256color',
            cols: 80,
            rows: 30,
            cwd: project.path,
            env: process.env as { [key: string]: string }
          });
        } catch (fallbackError) {
          throw new Error(`Failed to start any process: ${errorMessage}`);
        }
      }
      
      session.status = 'active';
      session.updatedAt = new Date();
      
      // Initialize progress state
      session.progressState = {
        isActive: true,
        status: 'Starting Claude...',
        startTime: new Date(),
        lastOutputTime: new Date(),
        outputRate: 0,
        phase: 'thinking'
      };
      
      // Initialize recent outputs tracking
      this.recentOutputs.set(sessionId, []);
      
      // Handle output from Claude
      debugPTYEvent(sessionId, 'attaching-onData-handler');
      
      // CRITICAL: Prevent duplicate handlers
      if (this.activeDataHandlers.get(sessionId)) {
        debugPTYEvent(sessionId, 'duplicate-handler-prevented');
        console.warn(`[ProcessManager] Prevented duplicate data handler for session ${sessionId}`);
        return;
      }
      
      this.activeDataHandlers.set(sessionId, true);
      
      session.claudeProcess.onData((data: string) => {
        try {
          // CRITICAL: Keep this handler SYNCHRONOUS to avoid backlog
          // Minimal logging to reduce overhead
          debugPTYEvent(sessionId, 'onData', { dataLength: data ? data.length : 0 });
        
        // CRITICAL: Check if session still exists (prevents crash if session was removed)
        const currentSession = this.sessions.get(sessionId);
        if (!currentSession || !currentSession.claudeProcess) {
          debugPTYEvent(sessionId, 'onData-session-gone');
          console.warn(`[ProcessManager] Received data for non-existent session ${sessionId}`);
          return;
        }
        
        try {
          // Add safety check for data validity
          if (typeof data !== 'string') {
            debugPTYEvent(sessionId, 'onData-invalid-type', { type: typeof data });
            console.error(`[ProcessManager] Invalid data type for session ${sessionId}:`, typeof data);
            return;
          }
          
          // Process data directly without delays - PTY backpressure will handle flow control
          currentSession.output.push(data);
          
          // Batch emit to avoid overwhelming IPC
          if (!currentSession.emitTimer) {
            currentSession.emitTimer = setTimeout(() => {
              const batchedOutput = currentSession.pendingOutput || '';
              if (batchedOutput) {
                this.emit('output', { sessionId, projectId: currentSession.projectId, output: batchedOutput });
                currentSession.pendingOutput = '';
              }
              currentSession.emitTimer = null;
            }, 16); // ~60fps
          }
          
          // Accumulate output
          if (!currentSession.pendingOutput) {
            currentSession.pendingOutput = '';
          }
          currentSession.pendingOutput += data;
          
          // Skip heavy processing for now to isolate the issue
          // TODO: Re-enable after fixing the hang issue
          
          // Keep only last 1000 entries and limit total size
          if (currentSession.output.length > 1000) {
            currentSession.output = currentSession.output.slice(-1000);
          }
          
          // Also check total memory usage of output buffer
          const totalOutputSize = currentSession.output.reduce((sum, str) => sum + str.length, 0);
          if (totalOutputSize > 10 * 1024 * 1024) { // 10MB limit
            console.warn(`[ProcessManager] Output buffer too large (${totalOutputSize} bytes), trimming...`);
            // Keep only last 100 entries when buffer is too large
            currentSession.output = currentSession.output.slice(-100);
          }
        } catch (error) {
          console.error(`[ProcessManager] Error handling PTY data for session ${sessionId}:`, error);
        }
        } catch (outerError) {
          // CRITICAL: Catch any error at the top level to prevent crash
          console.error(`[ProcessManager] CRITICAL: Top-level error in onData handler for session ${sessionId}:`, outerError);
          debugPTYEvent(sessionId, 'onData-critical-error', { 
            error: outerError instanceof Error ? outerError.message : String(outerError),
            stack: outerError instanceof Error ? outerError.stack : undefined
          });
        }
      });
      
      // Handle process exit
      session.claudeProcess.onExit(({ exitCode, signal }) => {
        console.log(`Claude process exited with code ${exitCode}, signal ${signal}`);
        session.status = exitCode === 0 ? 'idle' : 'error';
        session.claudeProcess = undefined;
        session.updatedAt = new Date();
        
        // Clear progress state
        if (session.progressState) {
          session.progressState.isActive = false;
          session.progressState.phase = 'idle';
          session.progressState.status = '';
          this.emit('progress', { 
            sessionId,
            projectId: session.projectId, 
            progressState: session.progressState 
          });
        }
        
        this.emit('status', { sessionId, projectId: session.projectId, status: session.status });
      });
      
      this.emit('status', { sessionId, projectId: session.projectId, status: 'active' });
      
      // Give Claude a moment to start up
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      session.status = 'error';
      console.error(`Failed to start Claude for session ${sessionId}:`, error);
      throw error;
    }
  }
  
  stopClaudeCode(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.claudeProcess) return;
    
    try {
      // CRITICAL: Clean up to prevent memory leaks and crashes
      // Remove the active handler flag
      this.activeDataHandlers.delete(sessionId);
      
      // Clean up emit timer
      if (session.emitTimer) {
        clearTimeout(session.emitTimer);
        session.emitTimer = null;
      }
      session.pendingOutput = '';
      
      // Send Ctrl+D to gracefully exit
      try {
        session.claudeProcess.write('\x04');
      } catch (writeError) {
        console.warn('Failed to send exit signal:', writeError);
      }
      
      // Give it time to exit gracefully, then kill if needed
      setTimeout(() => {
        if (session.claudeProcess) {
          try {
            session.claudeProcess.kill();
          } catch (killError) {
            console.warn('Failed to kill process:', killError);
          }
          session.claudeProcess = undefined;
        }
      }, 2000);
      
      // Immediately mark as stopped to prevent further operations
      session.claudeProcess = undefined;
    } catch (error) {
      console.error(`Error stopping process for session ${sessionId}:`, error);
    }
  }
  
  sendCommand(sessionId: string, command: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    
    if (!session.claudeProcess) {
      throw new Error(`Claude not running for session ${sessionId}`);
    }
    
    session.status = 'active';
    session.updatedAt = new Date();
    
    // With xterm.js, we're sending raw keystrokes, not full commands
    // Just pass them through directly to the PTY
    session.claudeProcess.write(command);
    
    // Reset progress state when Enter is pressed (new command)
    if (command === '\r' || command === '\n') {
      console.log(`[${session.name}] Sent: <ENTER>`);
      
      // Reset progress for new command
      if (session.progressState) {
        session.progressState = {
          isActive: true,
          status: 'Processing command...',
          startTime: new Date(),
          lastOutputTime: new Date(),
          outputRate: 0,
          phase: 'thinking'
        };
        
        this.emit('progress', { 
          sessionId,
          projectId: session.projectId, 
          progressState: session.progressState 
        });
      }
    } else if (command === '\x7f' || command === '\b') {
      console.log(`[${session.name}] Sent: <BACKSPACE>`);
    } else if (command === '\x03') {
      console.log(`[${session.name}] Sent: <CTRL-C>`);
    } else if (command === '\x04') {
      console.log(`[${session.name}] Sent: <CTRL-D>`);
    } else if (command.length === 1 && command.charCodeAt(0) < 32) {
      console.log(`[${session.name}] Sent control char: 0x${command.charCodeAt(0).toString(16)}`);
    }
    
    this.emit('status', { sessionId, projectId: session.projectId, status: 'active' });
  }
  
  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }
  
  getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }
  
  getSession(sessionId: string): ClaudeSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  getProjectSessions(projectId: string): ClaudeSession[] {
    const project = this.projects.get(projectId);
    return project ? project.sessions : [];
  }
  
  // Clear output for a specific session
  clearSessionOutput(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.output = [];
    session.updatedAt = new Date();
    
    this.emit('output:cleared', { sessionId, projectId: session.projectId });
  }
  
  // Clean up all processes on shutdown
  cleanup(): void {
    // Stop progress monitoring
    if (this.progressCheckInterval) {
      clearInterval(this.progressCheckInterval);
      this.progressCheckInterval = null;
    }
    
    // Stop all sessions
    for (const session of this.sessions.values()) {
      if (session.claudeProcess) {
        this.stopClaudeCode(session.id);
      }
    }
    // Cleanup complete
  }
}