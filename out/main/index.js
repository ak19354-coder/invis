"use strict";
const electron = require("electron");
const path = require("path");
const Store = require("electron-store");
const child_process = require("child_process");
const events = require("events");
const DEFAULT_OVERLAY_CONFIG = {
  opacity: 0.85,
  alwaysOnTop: true,
  positionX: 100,
  positionY: 100,
  width: 420,
  height: 600,
  theme: "dark",
  fontSize: 14,
  isVisible: true,
  isLocked: false
};
const DEFAULT_AUDIO_CONFIG = {
  systemAudioDeviceId: null,
  microphoneDeviceId: null,
  vadEnabled: true,
  vadSensitivity: 0.5,
  transcriptionProvider: "local"
};
const DEFAULT_AI_CONFIG = {
  model: "gpt-4o",
  responseMode: "on-demand",
  maxTokens: 500,
  temperature: 0.7,
  streamingEnabled: true,
  interviewRole: "",
  resumeText: "",
  jobDescription: "",
  expectedQuestions: ""
};
const IPC_CHANNELS = {
  // Overlay controls
  TOGGLE_OVERLAY: "overlay:toggle",
  SET_OVERLAY_CONFIG: "overlay:set-config",
  GET_OVERLAY_CONFIG: "overlay:get-config",
  OVERLAY_SET_LOCKED: "overlay:set-locked",
  TRANSCRIPTION_START: "transcription:start",
  TRANSCRIPTION_STOP: "transcription:stop",
  // App controls
  APP_QUIT: "app:quit",
  APP_MINIMIZE: "app:minimize",
  WINDOW_SET_OPACITY: "window:set-opacity",
  WINDOW_SET_ALWAYS_ON_TOP: "window:set-always-on-top"
};
const store = new Store({
  name: "invis-config",
  defaults: {
    overlay: { ...DEFAULT_OVERLAY_CONFIG },
    ai: { ...DEFAULT_AI_CONFIG },
    audio: { ...DEFAULT_AUDIO_CONFIG }
  }
});
function loadOverlayConfig() {
  return store.get("overlay", { ...DEFAULT_OVERLAY_CONFIG });
}
function saveOverlayConfig(config) {
  const current = loadOverlayConfig();
  const updated = { ...current, ...config };
  store.set("overlay", updated);
  return updated;
}
class SidecarManager extends events.EventEmitter {
  constructor() {
    super(...arguments);
    this.process = null;
    this.isRunning = false;
    this.restartCount = 0;
    this.MAX_RESTARTS = 3;
    this.pendingCallbacks = /* @__PURE__ */ new Map();
    this.lineBuffer = "";
  }
  /**
   * Start the Python whisper sidecar process.
   */
  async start() {
    if (this.isRunning) return;
    const sidecarPath = this.getSidecarPath();
    console.log(`[SidecarManager] Starting sidecar: ${sidecarPath}`);
    return new Promise((resolve, reject) => {
      try {
        this.process = child_process.spawn("python", [sidecarPath], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env }
        });
        this.isRunning = true;
        this.process.stdout?.on("data", (data) => {
          this.handleStdout(data.toString());
        });
        this.process.stderr?.on("data", (data) => {
          console.log(`[Sidecar] ${data.toString().trim()}`);
        });
        this.process.on("close", (code) => {
          console.log(`[SidecarManager] Process exited with code ${code}`);
          this.isRunning = false;
          this.emit("exit", code);
          if (code !== 0 && this.restartCount < this.MAX_RESTARTS) {
            this.restartCount++;
            console.log(`[SidecarManager] Auto-restarting (attempt ${this.restartCount}/${this.MAX_RESTARTS})`);
            setTimeout(() => this.start(), 1e3);
          }
        });
        this.process.on("error", (err) => {
          console.error(`[SidecarManager] Process error:`, err);
          this.isRunning = false;
          this.emit("error", err);
          reject(err);
        });
        const timeout = setTimeout(() => {
          resolve();
        }, 3e4);
        this.once("model_loaded", () => {
          clearTimeout(timeout);
          this.restartCount = 0;
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  /**
   * Stop the sidecar process gracefully.
   */
  async stop() {
    if (!this.process || !this.isRunning) return;
    return new Promise((resolve) => {
      this.sendMessage({ type: "shutdown" });
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill("SIGTERM");
        }
        resolve();
      }, 5e3);
      this.process.on("close", () => {
        clearTimeout(timeout);
        this.isRunning = false;
        this.process = null;
        resolve();
      });
    });
  }
  /**
   * Send an audio segment for transcription.
   * Returns a promise that resolves with the transcription result.
   */
  async transcribe(audioBuffer, segmentId) {
    if (!this.isRunning || !this.process) {
      throw new Error("Sidecar is not running");
    }
    const bytes = new Uint8Array(audioBuffer.buffer);
    const base64 = Buffer.from(bytes).toString("base64");
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(segmentId);
        reject(new Error(`Transcription timeout for segment ${segmentId}`));
      }, 3e4);
      this.pendingCallbacks.set(segmentId, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });
      this.sendMessage({
        type: "transcribe",
        audio_b64: base64,
        id: segmentId
      });
    });
  }
  /**
   * Check if the sidecar is alive.
   */
  async ping() {
    if (!this.isRunning) return false;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5e3);
      this.once("pong", () => {
        clearTimeout(timeout);
        resolve(true);
      });
      this.sendMessage({ type: "ping" });
    });
  }
  get running() {
    return this.isRunning;
  }
  // ─── Private ──────────────────────────────────────────
  getSidecarPath() {
    if (process.env.NODE_ENV === "development" || process.env.ELECTRON_RENDERER_URL) {
      return path.join(__dirname, "../../src/main/sidecar/whisper-sidecar.py");
    }
    return path.join(process.resourcesPath, "sidecar/whisper-sidecar.py");
  }
  sendMessage(data) {
    if (!this.process?.stdin?.writable) return;
    const line = JSON.stringify(data) + "\n";
    this.process.stdin.write(line);
  }
  handleStdout(data) {
    this.lineBuffer += data;
    const lines = this.lineBuffer.split("\n");
    this.lineBuffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const message = JSON.parse(trimmed);
        this.handleMessage(message);
      } catch {
        console.warn(`[SidecarManager] Invalid JSON from sidecar: ${trimmed}`);
      }
    }
  }
  handleMessage(message) {
    const type = message.type;
    switch (type) {
      case "model_loaded":
        console.log(`[SidecarManager] Model loaded: ${message.model}`);
        this.emit("model_loaded");
        break;
      case "result": {
        const id = message.id;
        const callback = this.pendingCallbacks.get(id);
        if (callback) {
          this.pendingCallbacks.delete(id);
          callback({
            id,
            text: message.text,
            language: message.language,
            duration: message.duration,
            probability: message.probability
          });
        }
        this.emit("transcription", message);
        break;
      }
      case "pong":
        this.emit("pong");
        break;
      case "error":
        console.error(`[SidecarManager] Sidecar error:`, message.message);
        const errorId = message.id;
        if (errorId) {
          const callback = this.pendingCallbacks.get(errorId);
          if (callback) {
            this.pendingCallbacks.delete(errorId);
            callback({
              id: errorId,
              text: "",
              language: "en",
              duration: 0
            });
          }
        }
        this.emit("error", new Error(message.message));
        break;
      case "shutdown_ack":
        console.log("[SidecarManager] Shutdown acknowledged");
        break;
      default:
        console.warn(`[SidecarManager] Unknown message type: ${type}`);
    }
  }
}
let overlayWindow = null;
let tray = null;
const sidecarManager = new SidecarManager();
let overlayConfig = loadOverlayConfig();
let isAnimating = false;
function getIconPath() {
  if (process.env.NODE_ENV === "development" || process.env.ELECTRON_RENDERER_URL) {
    return path.join(__dirname, "../../build/icon.png");
  }
  return path.join(process.resourcesPath, "build/icon.png");
}
function createOverlayWindow() {
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const x = overlayConfig.positionX !== DEFAULT_OVERLAY_CONFIG.positionX ? overlayConfig.positionX : screenWidth - overlayConfig.width - 20;
  const y = overlayConfig.positionY !== DEFAULT_OVERLAY_CONFIG.positionY ? overlayConfig.positionY : 80;
  const win = new electron.BrowserWindow({
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
    transparent: true,
    // Transparent background
    frame: false,
    // No native title bar
    alwaysOnTop: overlayConfig.alwaysOnTop,
    skipTaskbar: true,
    // Don't show in taskbar
    resizable: true,
    hasShadow: false,
    // No shadow (cleaner overlay look)
    // Prevent appearing in window switcher (Alt+Tab)
    type: "toolbar",
    // Start hidden for fade-in animation
    show: false,
    opacity: 0,
    // Security
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setContentProtection(true);
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  win.once("ready-to-show", () => {
    fadeInOverlay();
  });
  win.on("page-title-updated", (e) => e.preventDefault());
  win.on("moved", () => {
    if (win && !win.isDestroyed()) {
      const [px, py] = win.getPosition();
      overlayConfig.positionX = px;
      overlayConfig.positionY = py;
      saveOverlayConfig({ positionX: px, positionY: py });
    }
  });
  win.on("resized", () => {
    if (win && !win.isDestroyed()) {
      const [w, h] = win.getSize();
      overlayConfig.width = w;
      overlayConfig.height = h;
      saveOverlayConfig({ width: w, height: h });
    }
  });
  return win;
}
function fadeInOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed() || isAnimating) return;
  isAnimating = true;
  overlayWindow.show();
  overlayWindow.setOpacity(0);
  overlayConfig.isVisible = true;
  let opacity = 0;
  const targetOpacity = overlayConfig.opacity;
  const step = targetOpacity / 12;
  const interval = setInterval(() => {
    opacity += step;
    if (opacity >= targetOpacity || !overlayWindow || overlayWindow.isDestroyed()) {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(targetOpacity);
      }
      clearInterval(interval);
      isAnimating = false;
      return;
    }
    overlayWindow.setOpacity(opacity);
  }, 16);
}
function fadeOutOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed() || isAnimating) return;
  isAnimating = true;
  let opacity = overlayConfig.opacity;
  const step = opacity / 10;
  const interval = setInterval(() => {
    opacity -= step;
    if (opacity <= 0 || !overlayWindow || overlayWindow.isDestroyed()) {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(0);
        overlayWindow.hide();
      }
      clearInterval(interval);
      isAnimating = false;
      overlayConfig.isVisible = false;
      return;
    }
    overlayWindow.setOpacity(opacity);
  }, 16);
}
function createTray() {
  let icon;
  try {
    const iconPath = getIconPath();
    icon = electron.nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: 16, height: 16 });
  } catch {
    icon = electron.nativeImage.createEmpty();
  }
  tray = new electron.Tray(icon);
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Show/Hide Overlay",
      click: () => toggleOverlay()
    },
    {
      label: "Settings",
      click: () => {
        overlayWindow?.webContents.send("navigate", "settings");
        showOverlay();
      }
    },
    { type: "separator" },
    {
      label: "Quit Invis",
      click: () => electron.app.quit()
    }
  ]);
  tray.setToolTip("Invis — Invisible AI Overlay");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => toggleOverlay());
}
function toggleOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (overlayWindow.isVisible()) {
    hideOverlay();
  } else {
    showOverlay();
  }
}
function showOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  fadeInOverlay();
}
function hideOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  fadeOutOverlay();
}
function setLocked(locked) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (locked) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
  }
  overlayConfig.isLocked = locked;
  saveOverlayConfig({ isLocked: locked });
}
function setupIpcHandlers() {
  electron.ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_START, async () => {
    try {
      if (!sidecarManager.running) {
        await sidecarManager.start();
      }
    } catch (err) {
      console.error("[Main] Failed to start transcription sidecar:", err);
    }
  });
  electron.ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_STOP, async () => {
    try {
      if (sidecarManager.running) {
        await sidecarManager.stop();
      }
    } catch (err) {
      console.error("[Main] Failed to stop transcription sidecar:", err);
    }
  });
  electron.ipcMain.handle("audio:transcribe", async (_event, base64, id) => {
    try {
      if (!sidecarManager.running) {
        throw new Error("Sidecar is not running");
      }
      const buffer = Buffer.from(base64, "base64");
      const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / Int16Array.BYTES_PER_ELEMENT);
      const result = await sidecarManager.transcribe(int16Array, id);
      return result;
    } catch (err) {
      console.error("[Main] Transcription failed:", err);
      throw err;
    }
  });
  electron.ipcMain.on(IPC_CHANNELS.TOGGLE_OVERLAY, () => {
    toggleOverlay();
  });
  electron.ipcMain.handle(IPC_CHANNELS.GET_OVERLAY_CONFIG, () => {
    return overlayConfig;
  });
  electron.ipcMain.on(IPC_CHANNELS.SET_OVERLAY_CONFIG, (_event, config) => {
    overlayConfig = { ...overlayConfig, ...config };
    saveOverlayConfig(config);
    applyOverlayConfig();
  });
  electron.ipcMain.on(IPC_CHANNELS.OVERLAY_SET_LOCKED, (_event, locked) => {
    setLocked(locked);
  });
  electron.ipcMain.on(IPC_CHANNELS.WINDOW_SET_OPACITY, (_event, opacity) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const clamped = Math.max(0.1, Math.min(0.95, opacity));
      overlayWindow.setOpacity(clamped);
      overlayConfig.opacity = clamped;
      saveOverlayConfig({ opacity: clamped });
    }
  });
  electron.ipcMain.on(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, (_event, value) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(value);
      overlayConfig.alwaysOnTop = value;
      saveOverlayConfig({ alwaysOnTop: value });
    }
  });
  electron.ipcMain.on(IPC_CHANNELS.APP_QUIT, () => {
    electron.app.quit();
  });
  electron.ipcMain.on(IPC_CHANNELS.APP_MINIMIZE, () => {
    hideOverlay();
  });
}
function applyOverlayConfig() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.setOpacity(overlayConfig.opacity);
  overlayWindow.setAlwaysOnTop(overlayConfig.alwaysOnTop);
  overlayWindow.setSize(overlayConfig.width, overlayConfig.height);
  overlayWindow.setPosition(overlayConfig.positionX, overlayConfig.positionY);
}
function registerHotkeys() {
  electron.globalShortcut.register("CommandOrControl+Shift+Space", () => {
    toggleOverlay();
  });
  electron.globalShortcut.register("CommandOrControl+Shift+A", () => {
    showOverlay();
    overlayWindow?.webContents.send("hotkey:ask-ai");
  });
  electron.globalShortcut.register("Escape", () => {
    if (overlayWindow?.isVisible()) {
      hideOverlay();
    }
  });
}
electron.app.whenReady().then(() => {
  console.log("[Invis] Starting application...");
  setupIpcHandlers();
  overlayWindow = createOverlayWindow();
  console.log("[Invis] Overlay window created with content protection enabled");
  createTray();
  console.log("[Invis] System tray created");
  registerHotkeys();
  console.log("[Invis] Global hotkeys registered");
  console.log("[Invis] Ready — Ctrl+Shift+Space to toggle overlay");
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
const gotTheLock = electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", () => {
    if (overlayWindow) {
      showOverlay();
      overlayWindow.focus();
    }
  });
}
