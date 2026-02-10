import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LocalWatcher } from './watcher'
import { CloudWatcher } from './watcher/cloud'
import {
  discoverPrinters,
  getPrinters,
  getPrinterByName,
  setPrinterPool,
  getPrinterPool,
  clearPrinterCache,
  submitPrintJob,
  getJob,
  cancelJob,
  getQueueSnapshot,
  clearFinishedJobs,
  checkHealth,
  startHealthMonitor,
  stopHealthMonitor,
  getMediaSizes
} from './printer'

// ---------------------------------------------------------------------------
// File Watcher (Local Mode)
// ---------------------------------------------------------------------------

const localWatcher = new LocalWatcher()

// ---------------------------------------------------------------------------
// Cloud Watcher (Cloud Mode)
// ---------------------------------------------------------------------------

const cloudWatcher = new CloudWatcher()

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

function setupWatcherEvents(): void {
  localWatcher.on('photo-ready', (payload) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('watcher:photo-ready', payload)
    }
  })

  localWatcher.on('photo-printed', (payload) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('watcher:photo-printed', payload)
    }
  })

  localWatcher.on('watch-error', (payload) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('watcher:error', {
        error: payload.error.message,
        filepath: payload.filepath
      })
    }
  })
}

setupWatcherEvents()

function setupCloudWatcherEvents(): void {
  cloudWatcher.on('photo-ready', (filePath, filename) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('cloud:photo-ready', { filePath, filename })
    }
  })

  cloudWatcher.on('cloud-error', (error) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('cloud:error', { error: error.message })
    }
  })

  cloudWatcher.on('connection-status', (connected) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('cloud:connection-status', { connected })
    }
  })
}

setupCloudWatcherEvents()

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1366,
    minHeight: 768,
    show: false,
    autoHideMenuBar: true,
    title: 'Smart Print',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.smartprint.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers will be registered here as features are built
  ipcMain.handle('ping', () => 'pong')

  // Dialog: open directory picker
  ipcMain.handle('dialog:open-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { canceled: true, path: '' }
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Watch Directory'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: '' }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  // Watcher IPC handlers
  ipcMain.handle('watcher:start', async (_event, directory: string) => {
    await localWatcher.start(directory)
    return { success: true, directory }
  })

  ipcMain.handle('watcher:stop', async () => {
    await localWatcher.stop()
    return { success: true }
  })

  ipcMain.handle('watcher:move-to-processed', async (_event, filepath: string) => {
    await localWatcher.moveToProcessed(filepath)
    return { success: true }
  })

  ipcMain.handle('watcher:status', () => {
    return {
      running: localWatcher.running,
      directory: localWatcher.directory
    }
  })

  // Cloud IPC handlers
  ipcMain.handle('cloud:register', async (_event, key: string) => {
    return cloudWatcher.register(key)
  })

  ipcMain.handle('cloud:start', async () => {
    await cloudWatcher.start()
    return { success: true }
  })

  ipcMain.handle('cloud:stop', () => {
    cloudWatcher.stop()
    return { success: true }
  })

  ipcMain.handle('cloud:confirm-print', async (_event, filename: string) => {
    return cloudWatcher.confirmPrint(filename)
  })

  ipcMain.handle('cloud:health', async () => {
    return cloudWatcher.checkHealth()
  })

  ipcMain.handle('cloud:status', () => {
    return cloudWatcher.getStatus()
  })

  // -------------------------------------------------------------------------
  // Printer IPC handlers (F002)
  // -------------------------------------------------------------------------

  ipcMain.handle('printer:discover', async (_event, forceRefresh?: boolean) => {
    return discoverPrinters(forceRefresh ?? false)
  })

  ipcMain.handle('printer:list', async () => {
    return getPrinters()
  })

  ipcMain.handle('printer:get', async (_event, name: string) => {
    return getPrinterByName(name)
  })

  ipcMain.handle('printer:set-pool', async (_event, names: string[]) => {
    return setPrinterPool(names)
  })

  ipcMain.handle('printer:get-pool', async () => {
    return getPrinterPool()
  })

  ipcMain.handle('printer:clear-cache', async () => {
    await clearPrinterCache()
    return { success: true }
  })

  ipcMain.handle('printer:media-sizes', async (_event, printerName: string) => {
    return getMediaSizes(printerName)
  })

  ipcMain.handle('printer:submit-job', async (_event, filename: string, options?: Record<string, unknown>) => {
    return submitPrintJob(filename, options)
  })

  ipcMain.handle('printer:get-job', async (_event, jobId: string) => {
    return getJob(jobId)
  })

  ipcMain.handle('printer:cancel-job', async (_event, jobId: string) => {
    return cancelJob(jobId)
  })

  ipcMain.handle('printer:queue-snapshot', async () => {
    return getQueueSnapshot()
  })

  ipcMain.handle('printer:clear-finished', async () => {
    const count = await clearFinishedJobs()
    return { cleared: count }
  })

  ipcMain.handle('printer:health', async () => {
    return checkHealth()
  })

  ipcMain.handle('printer:start-monitor', async () => {
    await startHealthMonitor()
    return { success: true }
  })

  ipcMain.handle('printer:stop-monitor', async () => {
    await stopHealthMonitor()
    return { success: true }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', async () => {
  await localWatcher.stop()
  cloudWatcher.stop()
  await stopHealthMonitor()
})
