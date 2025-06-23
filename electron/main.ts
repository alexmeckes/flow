import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { ProcessManager } from './services/ProcessManagerPTY';
import { CursorIntegration } from './services/CursorIntegration';
import { CursorIntegrationEnhanced } from './services/CursorIntegrationEnhanced';
import { StateManager } from './services/StateManager';
import { setupCrashReporter } from './crashReporter';
import { setupAdvancedCrashHandler } from './crashHandler';

// Setup crash reporting immediately
setupCrashReporter();
setupAdvancedCrashHandler();

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';
const processManager = new ProcessManager();
const cursorIntegration = new CursorIntegration();
const cursorIntegrationEnhanced = new CursorIntegrationEnhanced();
const stateManager = new StateManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Only open DevTools if explicitly requested
    if (process.env.OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

// Process management handlers
ipcMain.handle('process:create', async (_, { name, path }) => {
  return processManager.createProject(name, path);
});

ipcMain.handle('process:remove', async (_, projectId) => {
  return processManager.removeProject(projectId);
});

// Session management handlers
ipcMain.handle('session:create', async (_, { projectId, name, description }) => {
  return processManager.createSession(projectId, name, description);
});

ipcMain.handle('session:remove', async (_, sessionId) => {
  return processManager.removeSession(sessionId);
});

ipcMain.handle('session:start', async (_, sessionId) => {
  return processManager.startClaudeCode(sessionId);
});

ipcMain.handle('session:stop', async (_, sessionId) => {
  return processManager.stopClaudeCode(sessionId);
});

ipcMain.handle('session:command', async (_, { sessionId, command }) => {
  return processManager.sendCommand(sessionId, command);
});

ipcMain.handle('session:clearOutput', async (_, sessionId) => {
  return processManager.clearSessionOutput(sessionId);
});

// Forward process events to renderer
processManager.on('output', (data) => {
  try {
    if (!data) {
      console.error('[Main] Received null/undefined output data');
      return;
    }
    
    // Remove verbose logging that can cause performance issues
    if (typeof data.output === 'string' && data.output.includes('\x00')) {
      data.output = data.output.replace(/\x00/g, '');
    }
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:output', data);
    }
  } catch (error) {
    console.error('[Main] Error in output handler:', error);
    console.error('[Main] Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
  }
});

processManager.on('status', (data) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:status', data);
    }
  } catch (error) {
    console.error('Error forwarding status:', error);
  }
});

processManager.on('output:cleared', (data) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:output:cleared', data);
    }
  } catch (error) {
    console.error('Error forwarding output:cleared:', error);
  }
});

processManager.on('progress', (data) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:progress', data);
    }
  } catch (error) {
    console.error('Error forwarding progress:', error);
  }
});

// Forward session events
processManager.on('session:created', (data) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:created', data);
    }
  } catch (error) {
    console.error('Error forwarding session:created:', error);
  }
});

processManager.on('session:removed', (data) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:removed', data);
    }
  } catch (error) {
    console.error('Error forwarding session:removed:', error);
  }
});

// Cursor integration handlers
ipcMain.handle('cursor:open', async (_, projectPath) => {
  try {
    const result = await cursorIntegrationEnhanced.openInCursor(projectPath);
    
    // Update project with Cursor window info if we have it
    const projects = processManager.getAllProjects();
    const project = projects.find(p => p.path === projectPath);
    if (project && result.windowId) {
      project.cursorWindowId = result.windowId;
      project.cursorPid = result.pid;
    }
    
    return result;
  } catch (error) {
    // Fallback to basic integration
    console.warn('Enhanced integration failed, using basic:', error);
    return cursorIntegration.openInCursor(projectPath);
  }
});

ipcMain.handle('cursor:checkOpen', async (_, projectPath) => {
  try {
    const window = await cursorIntegrationEnhanced.findCursorWindow(projectPath);
    return window !== null;
  } catch (error) {
    console.error('Error checking Cursor window:', error);
    return false;
  }
});

ipcMain.handle('cursor:arrangeWindows', async () => {
  try {
    await cursorIntegrationEnhanced.arrangeWindows();
    return true;
  } catch (error) {
    console.error('Failed to arrange windows:', error);
    return false;
  }
});

// State management handlers
ipcMain.handle('state:save', async (_, state) => {
  const projects = processManager.getAllProjects();
  return stateManager.save(projects, state?.recentCommands || []);
});

ipcMain.handle('state:load', async () => {
  return stateManager.load();
});

// Dialog handlers
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Project Directory',
    buttonLabel: 'Select Directory'
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Note: State loading is handled by the frontend in Layout.tsx
// This prevents duplicate projects from being created

// Save state periodically
setInterval(async () => {
  try {
    const projects = processManager.getAllProjects();
    await stateManager.save(projects);
  } catch (error) {
    console.error('Failed to auto-save state:', error);
  }
}, 30000); // Save every 30 seconds

// Cleanup on app quit
app.on('before-quit', async () => {
  // Save final state
  try {
    const projects = processManager.getAllProjects();
    await stateManager.save(projects);
  } catch (error) {
    console.error('Failed to save state on quit:', error);
  }
  
  // Cleanup window monitoring
  cursorIntegrationEnhanced.dispose();
  
  processManager.cleanup();
});