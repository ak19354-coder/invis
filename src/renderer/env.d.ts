/**
 * Invis — Global Type Declarations
 *
 * Declares the `window.invisAPI` bridge exposed by the preload script
 * via contextBridge. This file is auto-included by TypeScript for all
 * renderer-side code.
 */

import type { OverlayConfig } from '../shared/types'

export interface StealthAPI {
  // Overlay controls
  toggleOverlay: () => void
  getOverlayConfig: () => Promise<OverlayConfig>
  setOverlayConfig: (config: Partial<OverlayConfig>) => void

  // Window controls
  setOpacity: (opacity: number) => void
  setAlwaysOnTop: (value: boolean) => void
  setLocked: (locked: boolean) => void
  minimizeApp: () => void
  quitApp: () => void

  // AI controls
  requestAI: (prompt: string, context?: string) => void

  // Audio controls
  getAudioDevices: () => Promise<MediaDeviceInfo[]>
  startAudioCapture: (systemDeviceId: string, micDeviceId: string) => void
  stopAudioCapture: () => void

  // Transcription controls
  startTranscription: () => void
  stopTranscription: () => void
  transcribeAudio: (base64: string, id: string) => Promise<any>

  // Event listeners (return cleanup function)
  onAIStreamChunk: (callback: (chunk: string) => void) => () => void
  onAIStreamEnd: (callback: () => void) => () => void
  onTranscriptSegment: (callback: (segment: any) => void) => () => void
  onNavigate: (callback: (tab: string) => void) => () => void
  onHotkeyAskAI: (callback: () => void) => () => void
  onAudioLevel: (callback: (level: { mic: number; system: number }) => void) => () => void
}

declare global {
  interface Window {
    invisAPI: StealthAPI
  }
}
