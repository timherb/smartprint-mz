import { app, shell, BrowserWindow, ipcMain, dialog, screen } from 'electron'
import { join, extname } from 'path'
import { readFile, readdir, stat } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import ElectronStoreModule from 'electron-store'
// Handle ESM/CJS interop - electron-store v11 is ESM-only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ElectronStore = ((ElectronStoreModule as any).default || ElectronStoreModule) as typeof ElectronStoreModule
import icon from '../../resources/icon.png?asset'
import { setupAutoUpdater } from './updater'
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
  getMediaSizes,
  setOnJobDone,
  setMainWindowRef,
  setHealthMainWindowRef
} from './printer'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Device ID — hardware-based, cached in electron-store
// ---------------------------------------------------------------------------

let cachedDeviceId: string | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateDeviceId(store: InstanceType<typeof ElectronStore<any>>): Promise<string> {
  // Return cached value if already resolved this session
  if (cachedDeviceId) return cachedDeviceId

  // Check electron-store first
  const stored = store.get('deviceId') as string | undefined
  if (stored) {
    cachedDeviceId = stored
    return stored
  }

  // Query hardware UUID
  let hwUuid: string | null = null
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('wmic', ['csproduct', 'get', 'UUID'], { timeout: 5000 })
      const lines = stdout.trim().split(/\r?\n/).filter((l) => l.trim().length > 0)
      // Second line contains the UUID (first line is the header "UUID")
      const uuidLine = lines.find((l) => /^[0-9A-F]{8}-/i.test(l.trim()))
      if (uuidLine) hwUuid = uuidLine.trim()
    } else if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('system_profiler', ['SPHardwareDataType'], { timeout: 5000 })
      const match = stdout.match(/Hardware UUID:\s*([0-9A-F-]+)/i)
      if (match) hwUuid = match[1]
    }
  } catch (err) {
    console.warn('[DeviceID] Hardware UUID query failed, using fallback:', err)
  }

  const deviceId = hwUuid || randomUUID()
  store.set('deviceId', deviceId)
  cachedDeviceId = deviceId
  return deviceId
}

// ---------------------------------------------------------------------------
// File Watcher (Local Mode)
// ---------------------------------------------------------------------------

const localWatcher = new LocalWatcher()

// ---------------------------------------------------------------------------
// Cloud Watcher (Cloud Mode)
// ---------------------------------------------------------------------------

const cloudWatcher = new CloudWatcher()

let mainWindowRef: BrowserWindow | null = null

function getMainWindow(): BrowserWindow | null {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) return mainWindowRef
  return null
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
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const winWidth = Math.max(1366, Math.round(screenW * 0.6))
  const winHeight = Math.max(768, Math.round(screenH * 0.8))

  mainWindowRef = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 1366,
    minHeight: 768,
    center: true,
    show: false,
    autoHideMenuBar: true,
    title: 'Smart Print',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindowRef.on('ready-to-show', () => {
    mainWindowRef!.show()
  })

  mainWindowRef.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindowRef.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindowRef.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.smartprint.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Auto-move files to "Printed Photos" folder after print completes or is cancelled
  setOnJobDone((job) => {
    if ((job.status === 'completed' || job.status === 'cancelled') && job.filepath) {
      localWatcher.moveToProcessed(job.filepath).catch((err) => {
        console.error('[onJobDone] Failed to move file to processed:', err)
      })
    }
  })

  // ── Settings persistence via electron-store ──
  const settingsStore = new ElectronStore({
    name: 'app-settings',
    defaults: {
      mode: 'local',
      localDirectory: '',
      cloudApiUrl: '',
      cloudRegistered: false,
      pollInterval: 60000,
      healthInterval: 30000,
      logLevel: 'info',
      paperSize: '',
      printerPool: [] as string[],
      copies: 1
    }
  })

  // ── Device ID — resolve at startup ──
  getOrCreateDeviceId(settingsStore).then((id) => {
    console.log(`[DeviceID] ${id}`)
  })

  ipcMain.handle('app:get-device-id', async () => {
    return getOrCreateDeviceId(settingsStore)
  })

  ipcMain.handle('settings:get', () => {
    return settingsStore.store
  })

  ipcMain.handle('settings:set', (_event, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      settingsStore.set(key, value)
    }
    return { success: true }
  })

  // App: set window title from renderer
  ipcMain.on('app:set-title', (_event, title: string) => {
    const win = getMainWindow()
    if (win) win.setTitle(title)
  })

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

  // File: read image as data URL for renderer thumbnails
  ipcMain.handle('file:read-as-data-url', async (_event, filepath: string) => {
    try {
      const data = await readFile(filepath)
      const ext = extname(filepath).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
      return `data:${mime};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })

  // Gallery: scan printed photos folder
  const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png'])
  ipcMain.handle('gallery:scan-printed-folder', async (_event, directory: string) => {
    try {
      const printedDir = join(directory, 'Printed Photos')
      const entries = await readdir(printedDir)
      const photos: Array<{ filename: string; filepath: string; sizeBytes: number; printedAt: number }> = []
      for (const entry of entries) {
        const ext = extname(entry).toLowerCase()
        if (!ALLOWED_IMAGE_EXTS.has(ext)) continue
        const filepath = join(printedDir, entry)
        const info = await stat(filepath)
        if (!info.isFile()) continue
        photos.push({
          filename: entry,
          filepath,
          sizeBytes: info.size,
          printedAt: info.mtimeMs
        })
      }
      return { success: true, photos }
    } catch {
      return { success: true, photos: [] }
    }
  })

  // Watcher: scan pending files in watch directory (for auto-print toggle)
  ipcMain.handle('watcher:scan-pending', async (_event, directory: string) => {
    try {
      const entries = await readdir(directory)
      const files: Array<{ filename: string; filepath: string; sizeBytes: number }> = []
      for (const entry of entries) {
        const ext = extname(entry).toLowerCase()
        if (!ALLOWED_IMAGE_EXTS.has(ext)) continue
        if (entry === 'Printed Photos') continue
        const filepath = join(directory, entry)
        const info = await stat(filepath)
        if (!info.isFile()) continue
        files.push({ filename: entry, filepath, sizeBytes: info.size })
      }
      return { success: true, files }
    } catch {
      return { success: true, files: [] }
    }
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

  ipcMain.handle('printer:submit-job', async (_event, filename: string, filepath: string, options?: Record<string, unknown>) => {
    return submitPrintJob(filename, filepath, options)
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

  // Register main window ref with printer subsystems (avoids getAllWindows pitfall
  // where hidden print windows can intercept IPC events or discovery calls)
  if (mainWindowRef) {
    setMainWindowRef(mainWindowRef)
    setHealthMainWindowRef(mainWindowRef)
  }

  // Set up auto-updater after window is created
  if (mainWindowRef) {
    setupAutoUpdater(mainWindowRef)
  }

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
