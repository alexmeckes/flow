import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { CursorArrangerMacOS } from './CursorArrangerMacOS';

const execAsync = promisify(exec);

// We'll use dynamic import to handle potential native module issues
let windowManager: any = null;

async function getWindowManager() {
  if (!windowManager) {
    try {
      console.log('getWindowManager: Loading node-window-manager...');
      const wm = await import('node-window-manager');
      windowManager = wm.windowManager;
      console.log('getWindowManager: Successfully loaded window manager');
      console.log('getWindowManager: Available methods:', Object.keys(windowManager));
    } catch (error) {
      console.error('getWindowManager: Failed to load window manager:', error);
    }
  }
  return windowManager;
}

export class CursorIntegrationEnhanced {
  private windowCheckInterval: NodeJS.Timeout | null = null;
  private projectWindowMap = new Map<string, number>();
  private macOSArranger = new CursorArrangerMacOS();

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
          // Skip if window object is invalid
          if (!window) continue;
          
          // Skip if window is not visible
          try {
            if (!window.isVisible || !window.isVisible()) continue;
          } catch (e) {
            // Window might be invalid, skip it
            continue;
          }
          
          // Get window title safely
          let title = '';
          try {
            const rawTitle = window.getTitle ? window.getTitle() : null;
            title = rawTitle ? String(rawTitle) : '';
          } catch (e) {
            // If we can't get the title, skip this window
            continue;
          }
          
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
            if (window.id && this.projectWindowMap.get(projectPath) === window.id) {
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
    if (!wm) {
      console.log('getAllCursorWindows: Window manager not available');
      return [];
    }
    
    try {
      const windows = wm.getWindows();
      console.log(`getAllCursorWindows: Total windows found: ${windows.length}`);
      
      const cursorWindows = windows.filter((window: any) => {
        try {
          // Get window title
          const title = window.getTitle() || '';
          const isVisible = window.isVisible();
          
          console.log(`getAllCursorWindows: Window "${title}" visible: ${isVisible}`);
          
          // Skip if window is not visible
          if (!isVisible) return false;
          
          // Check multiple patterns for Cursor windows
          const titleLower = title.toLowerCase();
          const isCursor = titleLower.includes('cursor') || 
                          titleLower === 'cursor' ||
                          title === 'Cursor';
          
          if (isCursor) {
            console.log(`getAllCursorWindows: Found Cursor window: "${title}"`);
          }
          
          return isCursor;
        } catch (e) {
          console.error('getAllCursorWindows: Error checking window:', e);
          return false;
        }
      });
      
      console.log(`getAllCursorWindows: Found ${cursorWindows.length} Cursor windows`);
      return cursorWindows;
    } catch (error) {
      console.error('getAllCursorWindows: Error:', error);
      return [];
    }
  }

  async arrangeWindows(): Promise<void> {
    console.log('arrangeWindows: Starting...');
    
    // Try macOS-specific approach first
    if (process.platform === 'darwin') {
      console.log('arrangeWindows: Trying macOS AppleScript approach...');
      const success = await this.macOSArranger.arrangeWindows();
      if (success) {
        console.log('arrangeWindows: Successfully arranged windows using AppleScript');
        return;
      }
      console.log('arrangeWindows: AppleScript failed, falling back to node-window-manager');
    }
    
    const windows = await this.getAllCursorWindows();
    console.log(`arrangeWindows: Found ${windows.length} Cursor windows`);
    
    if (windows.length === 0) {
      console.log('arrangeWindows: No windows found, exiting');
      return;
    }
    
    const wm = await getWindowManager();
    if (!wm) {
      console.log('arrangeWindows: Window manager not available');
      return;
    }
    
    // Get primary monitor dimensions
    let width = 1920;  // Default fallback
    let height = 1080; // Default fallback
    
    try {
      const monitors = wm.getMonitors();
      console.log(`arrangeWindows: Found ${monitors.length} monitors`);
      
      if (monitors.length > 0) {
        const primaryMonitor = monitors[0];
        const bounds = primaryMonitor.getBounds();
        console.log('arrangeWindows: Primary monitor bounds:', bounds);
        width = bounds.width;
        height = bounds.height;
      } else {
        console.log('arrangeWindows: No monitors found, using screen dimensions fallback');
        // Try to get screen dimensions from the first window's screen position
        if (windows.length > 0) {
          const firstWindowBounds = windows[0].getBounds();
          // Estimate screen size based on window positions
          windows.forEach(w => {
            const bounds = w.getBounds();
            width = Math.max(width, bounds.x + bounds.width + 100);
            height = Math.max(height, bounds.y + bounds.height + 100);
          });
          console.log(`arrangeWindows: Estimated screen size: ${width}x${height}`);
        }
      }
    } catch (error) {
      console.log('arrangeWindows: Error getting monitor info, using defaults:', error);
    }
    
    // Calculate grid layout
    const cols = Math.ceil(Math.sqrt(windows.length));
    const rows = Math.ceil(windows.length / cols);
    console.log(`arrangeWindows: Grid layout: ${cols}x${rows}`);
    
    const windowWidth = Math.floor(width / cols);
    const windowHeight = Math.floor(height / rows);
    console.log(`arrangeWindows: Window size: ${windowWidth}x${windowHeight}`);
    
    // Arrange windows in grid
    windows.forEach((window, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * windowWidth;
      const y = row * windowHeight;
      
      try {
        console.log(`arrangeWindows: Positioning window ${index} at (${x}, ${y}) with size ${windowWidth}x${windowHeight}`);
        console.log(`arrangeWindows: Window title: "${window.getTitle()}"`);
        
        // First check current bounds
        const currentBounds = window.getBounds();
        console.log(`arrangeWindows: Current bounds:`, currentBounds);
        
        window.setBounds({
          x: x,
          y: y,
          width: windowWidth,
          height: windowHeight
        });
        
        // Check if bounds actually changed
        const newBounds = window.getBounds();
        console.log(`arrangeWindows: New bounds:`, newBounds);
        
        if (currentBounds.x === newBounds.x && currentBounds.y === newBounds.y) {
          console.log(`arrangeWindows: WARNING - Window ${index} did not move! Possible permission issue.`);
        } else {
          console.log(`arrangeWindows: Successfully positioned window ${index}`);
        }
      } catch (error) {
        console.error(`arrangeWindows: Error arranging window ${index}:`, error);
      }
    });
    
    console.log('arrangeWindows: Completed');
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