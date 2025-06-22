import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CursorArrangerMacOS {
  async arrangeWindows(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      console.log('CursorArrangerMacOS: Not running on macOS');
      return false;
    }
    
    try {
      // AppleScript to arrange Cursor windows
      const script = `
        tell application "System Events"
          set cursorWindows to every window of every process whose name is "Cursor"
          set windowCount to count of cursorWindows
          
          if windowCount is 0 then
            return "No Cursor windows found"
          end if
          
          -- Get screen dimensions
          tell application "Finder"
            set screenBounds to bounds of window of desktop
            set screenWidth to item 3 of screenBounds
            set screenHeight to item 4 of screenBounds
          end tell
          
          -- Calculate grid layout
          set cols to (windowCount ^ 0.5) as integer
          if cols * cols < windowCount then
            set cols to cols + 1
          end if
          set rows to (windowCount / cols) as integer
          if rows * cols < windowCount then
            set rows to rows + 1
          end if
          
          set windowWidth to screenWidth / cols
          set windowHeight to screenHeight / rows
          
          -- Position each window
          set windowIndex to 0
          repeat with proc in every process whose name is "Cursor"
            repeat with win in every window of proc
              set col to windowIndex mod cols
              set row to (windowIndex / cols) as integer
              
              set x to col * windowWidth
              set y to row * windowHeight
              
              try
                set position of win to {x, y}
                set size of win to {windowWidth, windowHeight}
              end try
              
              set windowIndex to windowIndex + 1
            end repeat
          end repeat
          
          return "Arranged " & windowCount & " windows"
        end tell
      `;
      
      console.log('CursorArrangerMacOS: Executing AppleScript...');
      const result = await execAsync(`osascript -e '${script}'`);
      console.log('CursorArrangerMacOS: Result:', result.stdout);
      
      return true;
    } catch (error: any) {
      console.error('CursorArrangerMacOS: Error:', error);
      
      if (error.message.includes('not authorized')) {
        console.error('CursorArrangerMacOS: Permission denied. Please grant accessibility permissions.');
        console.error('Go to: System Settings > Privacy & Security > Accessibility');
        console.error('Add and enable your terminal app or Electron app');
      }
      
      return false;
    }
  }
  
  async testPermissions(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }
    
    try {
      // Simple test to check if we can control windows
      const script = `
        tell application "System Events"
          set proc to first process whose name is "Cursor"
          set win to first window of proc
          get position of win
        end tell
      `;
      
      await execAsync(`osascript -e '${script}'`);
      console.log('CursorArrangerMacOS: Permissions OK');
      return true;
    } catch (error) {
      console.log('CursorArrangerMacOS: No permission to control windows');
      return false;
    }
  }
}