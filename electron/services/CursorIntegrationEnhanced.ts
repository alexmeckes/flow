import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// We'll use dynamic import to handle potential native module issues
let windowManager: any = null;

async function getWindowManager() {
  if (!windowManager) {
    try {
      const wm = await import('node-window-manager');
      windowManager = wm.windowManager;
    } catch (error) {
      console.warn('Window manager not available:', error);
    }
  }
  return windowManager;
}

export class CursorIntegrationEnhanced {
  private windowCheckInterval: NodeJS.Timeout | null = null;
  private projectWindowMap = new Map<string, number>();

  async openInCursor(projectPath: string): Promise<{ windowId?: number; pid?: number }> {
    try {
      // First check if Cursor is already open for this project
      const existingWindow = await this.findCursorWindow(projectPath);
      
      if (existingWindow) {
        // Focus the existing window
        await this.focusWindow(existingWindow);
        return { 
          windowId: existingWindow.id, 
          pid: existingWindow.processId 
        };
      }
      
      // Open new Cursor window
      const result = await this.openNewCursorWindow(projectPath);
      
      // Try to find the newly opened window after a short delay
      setTimeout(async () => {
        const newWindow = await this.findCursorWindow(projectPath);
        if (newWindow) {
          this.projectWindowMap.set(projectPath, newWindow.id);
        }
      }, 2000);
      
      return result;
    } catch (error) {
      console.error('Failed to open in Cursor:', error);
      throw error;
    }
  }

  private async openNewCursorWindow(projectPath: string): Promise<{ windowId?: number; pid?: number }> {
    try {
      let pid: number | undefined;
      
      if (process.platform === 'darwin') {
        // macOS - use open command which returns immediately
        const result = await execAsync(`open -a "Cursor" "${projectPath}" && echo $!`);
        // Note: Getting PID on macOS is tricky with 'open' command
        // We'll rely on window detection instead
      } else if (process.platform === 'win32') {
        // Windows
        const result = await execAsync(`start "" "cursor" "${projectPath}"`);
      } else {
        // Linux - can get PID directly
        const result = await execAsync(`cursor "${projectPath}" & echo $!`);
        const pidMatch = result.stdout.match(/(\d+)/);
        if (pidMatch) {
          pid = parseInt(pidMatch[1]);
        }
      }
      
      return { pid };
    } catch (error) {
      // Fallback methods
      if (process.platform === 'darwin') {
        try {
          await execAsync(`open -a "/Applications/Cursor.app" "${projectPath}"`);
          return {};
        } catch {
          throw new Error('Cursor IDE not found. Please ensure Cursor is installed.');
        }
      } else {
        throw new Error('Failed to open Cursor. Please ensure Cursor is installed and available in PATH.');
      }
    }
  }

  async findCursorWindow(projectPath: string): Promise<any | null> {
    const wm = await getWindowManager();
    if (!wm) return null;
    
    try {
      const windows = wm.getWindows();
      
      // Look for Cursor windows
      for (const window of windows) {
        try {
          // Get window title
          const title = window.getTitle() || '';
          
          // Skip if window is not visible
          if (!window.isVisible()) continue;
          
          // Check if this is a Cursor window
          const isCursor = title.toLowerCase().includes('cursor');
          
          if (isCursor) {
            // Check if the window title contains the project path
            // Cursor typically includes the project folder name in the title
            const projectName = path.basename(projectPath);
            if (title.includes(projectName) || title.includes(projectPath)) {
              return window;
            }
            
            // Also check if we previously mapped this window to this project
            if (this.projectWindowMap.get(projectPath) === window.id) {
              return window;
            }
          }
        } catch (e) {
          // Window might have been closed, continue
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding Cursor window:', error);
      return null;
    }
  }

  async focusWindow(window: any): Promise<void> {
    try {
      window.bringToTop();
      window.restore(); // In case it's minimized
      window.show();
    } catch (error) {
      console.error('Error focusing window:', error);
      // Fallback: try to open the project again
      throw error;
    }
  }

  async getAllCursorWindows(): Promise<any[]> {
    const wm = await getWindowManager();
    if (!wm) return [];
    
    try {
      const windows = wm.getWindows();
      return windows.filter((window: any) => {
        try {
          // Get window title
          const title = window.getTitle() || '';
          
          // Skip if window is not visible
          if (!window.isVisible()) return false;
          
          return title.toLowerCase().includes('cursor');
        } catch (e) {
          return false;
        }
      });
    } catch (error) {
      console.error('Error getting Cursor windows:', error);
      return [];
    }
  }

  async arrangeWindows(): Promise<void> {
    const windows = await this.getAllCursorWindows();
    if (windows.length === 0) return;
    
    const wm = await getWindowManager();
    if (!wm) return;
    
    // Get primary monitor dimensions
    const monitors = wm.getMonitors();
    const primaryMonitor = monitors[0];
    if (!primaryMonitor) return;
    
    const { width, height } = primaryMonitor.getBounds();
    
    // Calculate grid layout
    const cols = Math.ceil(Math.sqrt(windows.length));
    const rows = Math.ceil(windows.length / cols);
    
    const windowWidth = Math.floor(width / cols);
    const windowHeight = Math.floor(height / rows);
    
    // Arrange windows in grid
    windows.forEach((window, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      try {
        window.setBounds({
          x: col * windowWidth,
          y: row * windowHeight,
          width: windowWidth,
          height: windowHeight
        });
      } catch (error) {
        console.error('Error arranging window:', error);
      }
    });
  }

  async checkCursorInstalled(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync('ls /Applications/ | grep -i cursor');
        return stdout.includes('Cursor');
      } else {
        await execAsync('which cursor');
        return true;
      }
    } catch {
      return false;
    }
  }

  // Start monitoring windows for changes
  startWindowMonitoring(onWindowChange?: (windows: any[]) => void): void {
    if (this.windowCheckInterval) return;
    
    this.windowCheckInterval = setInterval(async () => {
      const windows = await this.getAllCursorWindows();
      if (onWindowChange) {
        onWindowChange(windows);
      }
    }, 2000); // Check every 2 seconds
  }

  stopWindowMonitoring(): void {
    if (this.windowCheckInterval) {
      clearInterval(this.windowCheckInterval);
      this.windowCheckInterval = null;
    }
  }

  dispose(): void {
    this.stopWindowMonitoring();
    this.projectWindowMap.clear();
  }
}