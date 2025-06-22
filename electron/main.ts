import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { ProcessManager } from './services/ProcessManagerPTY';
import { CursorIntegration } from './services/CursorIntegration';
import { CursorIntegrationEnhanced } from './services/CursorIntegrationEnhanced';
import { StateManager } from './services/StateManager';

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

ipcMain.handle('process:start', async (_, projectId) => {
  return processManager.startClaudeCode(projectId);
});

ipcMain.handle('process:stop', async (_, projectId) => {
  return processManager.stopClaudeCode(projectId);
});

ipcMain.handle('process:command', async (_, { projectId, command }) => {
  return processManager.sendCommand(projectId, command);
});

ipcMain.handle('process:clearOutput', async (_, projectId) => {
  return processManager.clearProjectOutput(projectId);
});

// Forward process events to renderer
processManager.on('output', (data) => {
  mainWindow?.webContents.send('process:output', data);
});

processManager.on('status', (data) => {
  mainWindow?.webContents.send('process:status', data);
});

processManager.on('output:cleared', (data) => {
  mainWindow?.webContents.send('process:output:cleared', data);
});

processManager.on('progress', (data) => {
  mainWindow?.webContents.send('process:progress', data);
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

// Load state on app ready
app.on('ready', async () => {
  const savedState = await stateManager.load();
  if (savedState) {
    // Restore projects (but not processes)
    for (const savedProject of savedState.projects) {
      try {
        processManager.createProject(savedProject.name, savedProject.path);
      } catch (error) {
        console.error(`Failed to restore project ${savedProject.name}:`, error);
      }
    }
  }
});

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