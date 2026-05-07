/**
 * Invis — Preload Script
 * 
 * Securely exposes IPC methods to the renderer via contextBridge.
 * The renderer CANNOT access Node.js directly — only these API methods.
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type { OverlayConfig } from '../shared/types'

// ─── Exposed API ─────────────────────────────────────────

const api = {
  // ── Overlay Controls ───────────────────────────────────
  
  toggleOverlay: () => {
    ipcRenderer.send(IPC_CHANNELS.TOGGLE_OVERLAY)
  },

  getOverlayConfig: (): Promise<OverlayConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_OVERLAY_CONFIG)
  },

  setOverlayConfig: (config: Partial<OverlayConfig>) => {
    ipcRenderer.send(IPC_CHANNELS.SET_OVERLAY_CONFIG, config)
  },

  // ── Window Controls ────────────────────────────────────

  setOpacity: (opacity: number) => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_OPACITY, opacity)
  },

  setAlwaysOnTop: (value: boolean) => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, value)
  },

  setLocked: (locked: boolean) => {
    ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_LOCKED, locked)
  },

  minimizeApp: () => {
    ipcRenderer.send(IPC_CHANNELS.APP_MINIMIZE)
  },

  quitApp: () => {
    ipcRenderer.send(IPC_CHANNELS.APP_QUIT)
  },

  // ── AI Controls ────────────────────────────────────────

  requestAI: (prompt: string, context?: string) => {
    ipcRenderer.send(IPC_CHANNELS.AI_REQUEST, { prompt, context })
  },

  // ── Audio Controls ─────────────────────────────────────

  getAudioDevices: (): Promise<MediaDeviceInfo[]> => {
    // Audio devices are enumerated in renderer via Web API
    return navigator.mediaDevices.enumerateDevices()
      .then(devices => devices.filter(d => d.kind === 'audioinput'))
  },

  startAudioCapture: (systemDeviceId: string, micDeviceId: string) => {
    ipcRenderer.send(IPC_CHANNELS.AUDIO_START_CAPTURE, { systemDeviceId, micDeviceId })
  },

  stopAudioCapture: () => {
    ipcRenderer.send(IPC_CHANNELS.AUDIO_STOP_CAPTURE)
  },

  // ── Transcription Controls ─────────────────────────────

  startTranscription: () => {
    ipcRenderer.send(IPC_CHANNELS.TRANSCRIPTION_START)
  },

  stopTranscription: () => {
    ipcRenderer.send(IPC_CHANNELS.TRANSCRIPTION_STOP)
  },

  transcribeAudio: (base64: string, id: string): Promise<any> => {
    return ipcRenderer.invoke('audio:transcribe', base64, id)
  },

  // ── Event Listeners ────────────────────────────────────

  onAIStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk)
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, handler)
  },

  onAIStreamEnd: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_END, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_END, handler)
  },

  onTranscriptSegment: (callback: (segment: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, segment: any) => callback(segment)
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_SEGMENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPT_SEGMENT, handler)
  },

  onNavigate: (callback: (tab: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tab: string) => callback(tab)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  },

  onHotkeyAskAI: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('hotkey:ask-ai', handler)
    return () => ipcRenderer.removeListener('hotkey:ask-ai', handler)
  },

  onAudioLevel: (callback: (level: { mic: number; system: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, level: { mic: number; system: number }) => callback(level)
    ipcRenderer.on(IPC_CHANNELS.AUDIO_LEVEL, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_LEVEL, handler)
  },
}

// ─── Expose to Renderer ──────────────────────────────────

contextBridge.exposeInMainWorld('invisAPI', api)

// ─── TypeScript Declaration ──────────────────────────────

export type StealthAPI = typeof api
