import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron'
import * as path from 'path'
import { ProcessManager } from './services/ProcessManager'
import { CursorIntegration } from './services/CursorIntegration'
import { StateManager } from './services/StateManager'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Initialize services
const processManager = new ProcessManager()
const cursorIntegration = new CursorIntegration()
const stateManager = new StateManager()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    show: false,
  })

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  
  // Set up process manager listeners
  processManager.on('output', (projectId, output) => {
    mainWindow?.webContents.send('process:output', projectId, output)
  })
  
  processManager.on('status', (projectId, status) => {
    mainWindow?.webContents.send('process:status', projectId, status)
  })
  
  processManager.on('progress', (projectId, progress) => {
    mainWindow?.webContents.send('process:progress', projectId, progress)
  })
}

// App event handlers
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers for process management
ipcMain.handle('process:start', async (event, projectPath: string) => {
  const projectId = Date.now().toString() // Generate unique ID
  return await processManager.startProcess(projectId, projectPath)
})

ipcMain.handle('process:sendCommand', async (event, projectId: string, command: string) => {
  return await processManager.sendCommand(projectId, command)
})

ipcMain.handle('process:stop', async (event, projectId: string) => {
  return await processManager.stopProcess(projectId)
})

// IPC Handlers for Cursor integration
ipcMain.handle('cursor:open', async (event, projectPath: string) => {
  return await cursorIntegration.openInCursor(projectPath)
})

// IPC Handlers for state management
ipcMain.handle('state:save', async (event, state: any) => {
  return await stateManager.saveState(state)
})

ipcMain.handle('state:load', async () => {
  const state = await stateManager.loadState()
  return state || { projects: [], activeProjectId: null, commandHistory: [], settings: {
    theme: 'dark',
    keyboardShortcuts: {
      focusCommandBar: 'cmd+k',
      switchProject: 'cmd+1-9',
      openInCursor: 'cmd+o',
      viewOutput: 'cmd+l',
    },
    autoSaveState: true,
    notificationsEnabled: true,
  }}
})