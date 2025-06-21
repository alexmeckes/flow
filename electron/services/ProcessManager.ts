import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
// import { Project } from '../types' // Not used currently

interface ProcessInfo {
  process: ChildProcess
  projectId: string
  output: string[]
}

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map()
  
  async startProcess(projectId: string, projectPath: string): Promise<{ success: boolean; pid?: number }> {
    try {
      // Check if process already exists
      if (this.processes.has(projectId)) {
        await this.stopProcess(projectId)
      }
      
      // Spawn Claude Code process
      const claudeProcess = spawn('claude-code', [], {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, CLAUDE_CODE_MODE: 'mission-control' }
      })
      
      const processInfo: ProcessInfo = {
        process: claudeProcess,
        projectId,
        output: []
      }
      
      this.processes.set(projectId, processInfo)
      
      // Handle stdout
      claudeProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        processInfo.output.push(output)
        this.emit('output', projectId, output)
        
        // Try to parse status from output
        this.parseStatus(projectId, output)
      })
      
      // Handle stderr
      claudeProcess.stderr?.on('data', (data) => {
        const output = `[ERROR] ${data.toString()}`
        processInfo.output.push(output)
        this.emit('output', projectId, output)
        this.emit('status', projectId, 'error')
      })
      
      // Handle process exit
      claudeProcess.on('close', (code) => {
        this.processes.delete(projectId)
        this.emit('status', projectId, 'idle')
        this.emit('output', projectId, `Process exited with code ${code}`)
      })
      
      // Handle errors
      claudeProcess.on('error', (error) => {
        this.emit('status', projectId, 'error')
        this.emit('output', projectId, `Process error: ${error.message}`)
      })
      
      return { success: true, pid: claudeProcess.pid }
    } catch (error) {
      return { success: false }
    }
  }
  
  async sendCommand(projectId: string, command: string): Promise<{ success: boolean }> {
    try {
      const processInfo = this.processes.get(projectId)
      if (!processInfo) {
        throw new Error('Process not found')
      }
      
      // Send command to process stdin
      processInfo.process.stdin?.write(command + '\n')
      this.emit('status', projectId, 'active')
      
      return { success: true }
    } catch (error) {
      return { success: false }
    }
  }
  
  async stopProcess(projectId: string): Promise<{ success: boolean }> {
    try {
      const processInfo = this.processes.get(projectId)
      if (!processInfo) {
        return { success: true } // Already stopped
      }
      
      // Kill the process
      processInfo.process.kill('SIGTERM')
      
      // Give it time to clean up
      setTimeout(() => {
        if (processInfo.process.killed === false) {
          processInfo.process.kill('SIGKILL')
        }
      }, 5000)
      
      this.processes.delete(projectId)
      this.emit('status', projectId, 'idle')
      
      return { success: true }
    } catch (error) {
      return { success: false }
    }
  }
  
  private parseStatus(projectId: string, output: string) {
    // Try to detect status from Claude Code output
    if (output.includes('Starting') || output.includes('Running')) {
      this.emit('status', projectId, 'active')
    } else if (output.includes('Complete') || output.includes('Done')) {
      this.emit('status', projectId, 'idle')
    } else if (output.includes('Error') || output.includes('Failed')) {
      this.emit('status', projectId, 'error')
    }
    
    // Try to detect progress
    const progressMatch = output.match(/(\d+)%/)
    if (progressMatch) {
      const progress = parseInt(progressMatch[1])
      this.emit('progress', projectId, progress)
    }
  }
  
  getOutput(projectId: string): string[] {
    return this.processes.get(projectId)?.output || []
  }
  
  getAllProcesses(): string[] {
    return Array.from(this.processes.keys())
  }
}