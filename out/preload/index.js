"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  // Overlay controls
  TOGGLE_OVERLAY: "overlay:toggle",
  SET_OVERLAY_CONFIG: "overlay:set-config",
  GET_OVERLAY_CONFIG: "overlay:get-config",
  OVERLAY_SET_LOCKED: "overlay:set-locked",
  AUDIO_START_CAPTURE: "audio:start-capture",
  AUDIO_STOP_CAPTURE: "audio:stop-capture",
  AUDIO_LEVEL: "audio:level",
  // AI controls
  AI_REQUEST: "ai:request",
  AI_STREAM_CHUNK: "ai:stream-chunk",
  AI_STREAM_END: "ai:stream-end",
  // Transcript
  TRANSCRIPT_SEGMENT: "transcript:segment",
  TRANSCRIPTION_START: "transcription:start",
  TRANSCRIPTION_STOP: "transcription:stop",
  // App controls
  APP_QUIT: "app:quit",
  APP_MINIMIZE: "app:minimize",
  WINDOW_SET_OPACITY: "window:set-opacity",
  WINDOW_SET_ALWAYS_ON_TOP: "window:set-always-on-top"
};
const api = {
  // ── Overlay Controls ───────────────────────────────────
  toggleOverlay: () => {
    electron.ipcRenderer.send(IPC_CHANNELS.TOGGLE_OVERLAY);
  },
  getOverlayConfig: () => {
    return electron.ipcRenderer.invoke(IPC_CHANNELS.GET_OVERLAY_CONFIG);
  },
  setOverlayConfig: (config) => {
    electron.ipcRenderer.send(IPC_CHANNELS.SET_OVERLAY_CONFIG, config);
  },
  // ── Window Controls ────────────────────────────────────
  setOpacity: (opacity) => {
    electron.ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_OPACITY, opacity);
  },
  setAlwaysOnTop: (value) => {
    electron.ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, value);
  },
  setLocked: (locked) => {
    electron.ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_LOCKED, locked);
  },
  minimizeApp: () => {
    electron.ipcRenderer.send(IPC_CHANNELS.APP_MINIMIZE);
  },
  quitApp: () => {
    electron.ipcRenderer.send(IPC_CHANNELS.APP_QUIT);
  },
  // ── AI Controls ────────────────────────────────────────
  requestAI: (prompt, context) => {
    electron.ipcRenderer.send(IPC_CHANNELS.AI_REQUEST, { prompt, context });
  },
  // ── Audio Controls ─────────────────────────────────────
  getAudioDevices: () => {
    return navigator.mediaDevices.enumerateDevices().then((devices) => devices.filter((d) => d.kind === "audioinput"));
  },
  startAudioCapture: (systemDeviceId, micDeviceId) => {
    electron.ipcRenderer.send(IPC_CHANNELS.AUDIO_START_CAPTURE, { systemDeviceId, micDeviceId });
  },
  stopAudioCapture: () => {
    electron.ipcRenderer.send(IPC_CHANNELS.AUDIO_STOP_CAPTURE);
  },
  // ── Transcription Controls ─────────────────────────────
  startTranscription: () => {
    electron.ipcRenderer.send(IPC_CHANNELS.TRANSCRIPTION_START);
  },
  stopTranscription: () => {
    electron.ipcRenderer.send(IPC_CHANNELS.TRANSCRIPTION_STOP);
  },
  transcribeAudio: (base64, id) => {
    return electron.ipcRenderer.invoke("audio:transcribe", base64, id);
  },
  // ── Event Listeners ────────────────────────────────────
  onAIStreamChunk: (callback) => {
    const handler = (_event, chunk) => callback(chunk);
    electron.ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, handler);
  },
  onAIStreamEnd: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on(IPC_CHANNELS.AI_STREAM_END, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_END, handler);
  },
  onTranscriptSegment: (callback) => {
    const handler = (_event, segment) => callback(segment);
    electron.ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_SEGMENT, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPT_SEGMENT, handler);
  },
  onNavigate: (callback) => {
    const handler = (_event, tab) => callback(tab);
    electron.ipcRenderer.on("navigate", handler);
    return () => electron.ipcRenderer.removeListener("navigate", handler);
  },
  onHotkeyAskAI: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("hotkey:ask-ai", handler);
    return () => electron.ipcRenderer.removeListener("hotkey:ask-ai", handler);
  },
  onAudioLevel: (callback) => {
    const handler = (_event, level) => callback(level);
    electron.ipcRenderer.on(IPC_CHANNELS.AUDIO_LEVEL, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_LEVEL, handler);
  }
};
electron.contextBridge.exposeInMainWorld("invisAPI", api);
