/**
 * Invis — Electron Main Process
 * 
 * Creates the invisible overlay window that is excluded from all
 * screen capture/recording using OS-level APIs.
 * 
 * Features:
 * - setContentProtection(true) for capture exclusion
 * - Persistent settings via electron-store
 * - Click-through (lock) mode
 * - Fade-in/fade-out window animations
 * - System tray with proper icon
 * - Global hotkeys
 */

import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { DEFAULT_OVERLAY_CONFIG, IPC_CHANNELS } from '../shared/types'
import { loadOverlayConfig, saveOverlayConfig } from './store'
import type { OverlayConfig } from '../shared/types'
import { SidecarManager } from './sidecar/SidecarManager'

// ─── State ───────────────────────────────────────────────

let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
const sidecarManager = new SidecarManager()
let overlayConfig: OverlayConfig = loadOverlayConfig()
let isAnimating = false

// ─── Icon Path ───────────────────────────────────────────

function getIconPath(): string {
  // In dev, the icon is at project root /build/icon.png
  // In production, it's relative to the app path
  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    return join(__dirname, '../../build/icon.png')
  }
  return join(process.resourcesPath, 'build/icon.png')
}

// ─── Overlay Window Creation ─────────────────────────────

function createOverlayWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  // Use saved position or default to right side
  const x = overlayConfig.positionX !== DEFAULT_OVERLAY_CONFIG.positionX
    ? overlayConfig.positionX
    : screenWidth - overlayConfig.width - 20
  const y = overlayConfig.positionY !== DEFAULT_OVERLAY_CONFIG.positionY
    ? overlayConfig.positionY
    : 80

  const win = new BrowserWindow({
    // Size and position
    width: overlayConfig.width,
    height: overlayConfig.height,
    x,
    y,
    minWidth: 320,
    minHeight: 400,
    maxWidth: 800,
    maxHeight: 1200,

    // Invisible overlay properties
    transparent: true,           // Transparent background
    frame: false,                // No native title bar
    alwaysOnTop: overlayConfig.alwaysOnTop,
    skipTaskbar: true,           // Don't show in taskbar
    resizable: true,
    hasShadow: false,            // No shadow (cleaner overlay look)
    
    // Prevent appearing in window switcher (Alt+Tab)
    type: 'toolbar',

    // Start hidden for fade-in animation
    show: false,
    opacity: 0,

    // Security
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // ═══════════════════════════════════════════════════════
  // CRITICAL: Make window invisible to screen capture
  // On Windows: calls SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
  // On macOS: sets NSWindow.sharingType = .none
  // ═══════════════════════════════════════════════════════
  win.setContentProtection(true)

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Show window with fade-in once content is ready
  win.once('ready-to-show', () => {
    fadeInOverlay()
  })

  // Prevent the window title from changing
  win.on('page-title-updated', (e) => e.preventDefault())

  // Save position on move
  win.on('moved', () => {
    if (win && !win.isDestroyed()) {
      const [px, py] = win.getPosition()
      overlayConfig.positionX = px
      overlayConfig.positionY = py
      saveOverlayConfig({ positionX: px, positionY: py })
    }
  })

  // Save size on resize
  win.on('resized', () => {
    if (win && !win.isDestroyed()) {
      const [w, h] = win.getSize()
      overlayConfig.width = w
      overlayConfig.height = h
      saveOverlayConfig({ width: w, height: h })
    }
  })

  return win
}

// ─── Window Animations ──────────────────────────────────

function fadeInOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed() || isAnimating) return
  isAnimating = true

  overlayWindow.show()
  overlayWindow.setOpacity(0)
  overlayConfig.isVisible = true

  let opacity = 0
  const targetOpacity = overlayConfig.opacity
  const step = targetOpacity / 12  // ~12 steps over ~200ms
  
  const interval = setInterval(() => {
    opacity += step
    if (opacity >= targetOpacity || !overlayWindow || overlayWindow.isDestroyed()) {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(targetOpacity)
      }
      clearInterval(interval)
      isAnimating = false
      return
    }
    overlayWindow.setOpacity(opacity)
  }, 16) // ~60fps
}

function fadeOutOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed() || isAnimating) return
  isAnimating = true

  let opacity = overlayConfig.opacity
  const step = opacity / 10  // ~10 steps over ~160ms
  
  const interval = setInterval(() => {
    opacity -= step
    if (opacity <= 0 || !overlayWindow || overlayWindow.isDestroyed()) {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(0)
        overlayWindow.hide()
      }
      clearInterval(interval)
      isAnimating = false
      overlayConfig.isVisible = false
      return
    }
    overlayWindow.setOpacity(opacity)
  }, 16)
}

// ─── System Tray ─────────────────────────────────────────

function createTray(): void {
  let icon: Electron.NativeImage

  try {
    const iconPath = getIconPath()
    icon = nativeImage.createFromPath(iconPath)
    // Resize for tray (16x16 on Windows, 22x22 on macOS)
    icon = icon.resize({ width: 16, height: 16 })
  } catch {
    // Fallback: create a small purple icon programmatically
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide Overlay',
      click: () => toggleOverlay(),
    },
    {
      label: 'Settings',
      click: () => {
        overlayWindow?.webContents.send('navigate', 'settings')
        showOverlay()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Invis',
      click: () => app.quit(),
    },
  ])

  tray.setToolTip('Invis — Invisible AI Overlay')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => toggleOverlay())
}

// ─── Overlay Visibility ──────────────────────────────────

function toggleOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  
  if (overlayWindow.isVisible()) {
    hideOverlay()
  } else {
    showOverlay()
  }
}

function showOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  fadeInOverlay()
}

function hideOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  fadeOutOverlay()
}

// ─── Click-Through (Lock Mode) ──────────────────────────

function setLocked(locked: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  
  if (locked) {
    // Click-through: mouse events pass through the window
    overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    overlayWindow.setIgnoreMouseEvents(false)
  }
  
  overlayConfig.isLocked = locked
  saveOverlayConfig({ isLocked: locked })
}

// ─── IPC Handlers ────────────────────────────────────────

function setupIpcHandlers(): void {
  // Audio and Transcription Handlers
  ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_START, async () => {
    try {
      if (!sidecarManager.running) {
        await sidecarManager.start()
      }
    } catch (err) {
      console.error('[Main] Failed to start transcription sidecar:', err)
    }
  })

  ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_STOP, async () => {
    try {
      if (sidecarManager.running) {
        await sidecarManager.stop()
      }
    } catch (err) {
      console.error('[Main] Failed to stop transcription sidecar:', err)
    }
  })

  ipcMain.handle('audio:transcribe', async (_event, base64: string, id: string) => {
    try {
      if (!sidecarManager.running) {
        throw new Error('Sidecar is not running')
      }
      const buffer = Buffer.from(base64, 'base64')
      const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / Int16Array.BYTES_PER_ELEMENT)
      const result = await sidecarManager.transcribe(int16Array, id)
      return result
    } catch (err) {
      console.error('[Main] Transcription failed:', err)
      throw err
    }
  })

  // Toggle overlay visibility
  ipcMain.on(IPC_CHANNELS.TOGGLE_OVERLAY, () => {
    toggleOverlay()
  })

  // Get overlay config
  ipcMain.handle(IPC_CHANNELS.GET_OVERLAY_CONFIG, () => {
    return overlayConfig
  })

  // Set overlay config
  ipcMain.on(IPC_CHANNELS.SET_OVERLAY_CONFIG, (_event, config: Partial<OverlayConfig>) => {
    overlayConfig = { ...overlayConfig, ...config }
    saveOverlayConfig(config)
    applyOverlayConfig()
  })

  // Lock/Unlock overlay (click-through)
  ipcMain.on(IPC_CHANNELS.OVERLAY_SET_LOCKED, (_event, locked: boolean) => {
    setLocked(locked)
  })

  // Window controls
  ipcMain.on(IPC_CHANNELS.WINDOW_SET_OPACITY, (_event, opacity: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const clamped = Math.max(0.1, Math.min(0.95, opacity))
      overlayWindow.setOpacity(clamped)
      overlayConfig.opacity = clamped
      saveOverlayConfig({ opacity: clamped })
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, (_event, value: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(value)
      overlayConfig.alwaysOnTop = value
      saveOverlayConfig({ alwaysOnTop: value })
    }
  })

  // App controls
  ipcMain.on(IPC_CHANNELS.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE, () => {
    hideOverlay()
  })
}

function applyOverlayConfig(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  overlayWindow.setOpacity(overlayConfig.opacity)
  overlayWindow.setAlwaysOnTop(overlayConfig.alwaysOnTop)
  overlayWindow.setSize(overlayConfig.width, overlayConfig.height)
  overlayWindow.setPosition(overlayConfig.positionX, overlayConfig.positionY)
}

// ─── Global Hotkeys ──────────────────────────────────────

function registerHotkeys(): void {
  // Toggle overlay: Ctrl+Shift+Space (Windows/Linux) or Cmd+Shift+Space (macOS)
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    toggleOverlay()
  })

  // Quick AI query: Ctrl+Shift+A
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    showOverlay()
    overlayWindow?.webContents.send('hotkey:ask-ai')
  })

  // Quick hide: Escape
  globalShortcut.register('Escape', () => {
    if (overlayWindow?.isVisible()) {
      hideOverlay()
    }
  })
}

// ─── App Lifecycle ───────────────────────────────────────

app.whenReady().then(() => {
  console.log('[Invis] Starting application...')

  // Setup IPC before creating windows
  setupIpcHandlers()

  // Create the invisible overlay
  overlayWindow = createOverlayWindow()
  console.log('[Invis] Overlay window created with content protection enabled')

  // Create system tray
  createTray()
  console.log('[Invis] System tray created')

  // Register global hotkeys
  registerHotkeys()
  console.log('[Invis] Global hotkeys registered')
  console.log('[Invis] Ready — Ctrl+Shift+Space to toggle overlay')
})

// Cleanup on quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// macOS: keep app running when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (overlayWindow) {
      showOverlay()
      overlayWindow.focus()
    }
  })
}
