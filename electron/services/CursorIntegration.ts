import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export class CursorIntegration {
  async openInCursor(projectPath: string): Promise<void> {
    try {
      if (process.platform === 'darwin') {
        // macOS
        await execAsync(`open -a "Cursor" "${projectPath}"`);
      } else if (process.platform === 'win32') {
        // Windows
        await execAsync(`start "" "cursor" "${projectPath}"`);
      } else {
        // Linux
        await execAsync(`cursor "${projectPath}"`);
      }
    } catch (error) {
      // If Cursor command fails, try alternative methods
      if (process.platform === 'darwin') {
        // Try opening with full app path
        try {
          await execAsync(`open -a "/Applications/Cursor.app" "${projectPath}"`);
        } catch {
          throw new Error('Cursor IDE not found. Please ensure Cursor is installed.');
        }
      } else {
        throw new Error('Failed to open Cursor. Please ensure Cursor is installed and available in PATH.');
      }
    }
  }
  
  async checkCursorInstalled(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        // Check if Cursor.app exists
        const { stdout } = await execAsync('ls /Applications/ | grep -i cursor');
        return stdout.includes('Cursor');
      } else {
        // Check if cursor command exists
        await execAsync('which cursor');
        return true;
      }
    } catch {
      return false;
    }
  }
  
  async findCursorWindows(): Promise<any[]> {
    // This would require platform-specific window management APIs
    // For now, we'll return an empty array
    // In a real implementation, you'd use node-window-manager or similar
    return [];
  }
}