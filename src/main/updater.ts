/**
 * Auto-update module using electron-updater with generic provider.
 * Checks Azure Blob Storage for new versions and prompts user to install.
 */

import { app, dialog, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
      return `${timestamp} [Updater] ${level}: ${message}${metaStr}`
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'smart-print-updater.log',
      maxsize: 2 * 1024 * 1024,
      maxFiles: 2
    })
  ]
})

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // Don't auto-download; prompt user first
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available', { version: info.version })

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Smart Print v${info.version} is available.`,
        detail: `Current version: v${app.getVersion()}\nNew version: v${info.version}\n\nWould you like to download and install the update?`,
        buttons: ['Update', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) {
          logger.info('User chose to update')
          autoUpdater.downloadUpdate().catch((err) => {
            logger.error('Download failed', { error: String(err) })
          })
        }
      })
      .catch((err) => logger.error('Dialog error', { error: String(err) }))
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('Already on latest version')
  })

  autoUpdater.on('download-progress', (progress) => {
    logger.debug('Download progress', { percent: progress.percent.toFixed(1) })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:download-progress', progress)
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded', { version: info.version })

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'The update has been downloaded.',
        detail: 'Smart Print will restart to apply the update.',
        buttons: ['Install Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
      .catch((err) => logger.error('Install dialog error', { error: String(err) }))
  })

  autoUpdater.on('error', (err) => {
    logger.error('Update check failed', { error: String(err) })
  })

  // Check for updates on startup (skip in dev mode)
  if (app.isPackaged) {
    logger.info('Checking for updates...')
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error('Update check error', { error: String(err) })
    })
  }
}
