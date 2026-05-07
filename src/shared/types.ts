// Invis — Shared Type Definitions

// ─── Overlay Types ───────────────────────────────────────

export interface OverlayConfig {
  opacity: number           // 0.1 to 0.9
  alwaysOnTop: boolean
  positionX: number
  positionY: number
  width: number
  height: number
  theme: 'dark' | 'light'
  fontSize: number          // 12-24
  isVisible: boolean
  isLocked: boolean         // When locked, click-through enabled
}

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  opacity: 0.85,
  alwaysOnTop: true,
  positionX: 100,
  positionY: 100,
  width: 420,
  height: 600,
  theme: 'dark',
  fontSize: 14,
  isVisible: true,
  isLocked: false,
}

// ─── Audio Types ─────────────────────────────────────────

export interface AudioConfig {
  systemAudioDeviceId: string | null
  microphoneDeviceId: string | null
  vadEnabled: boolean
  vadSensitivity: number    // 0.0 to 1.0
  transcriptionProvider: 'local' | 'cloud'
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  systemAudioDeviceId: null,
  microphoneDeviceId: null,
  vadEnabled: true,
  vadSensitivity: 0.5,
  transcriptionProvider: 'local',
}

// ─── AI Types ────────────────────────────────────────────

export type AIModel = 'gpt-4o' | 'claude-3.5-sonnet' | 'gemini-2.0' | 'llama-3-local'
export type ResponseMode = 'auto' | 'on-demand' | 'copilot'

export interface AIConfig {
  model: AIModel
  responseMode: ResponseMode
  maxTokens: number
  temperature: number
  streamingEnabled: boolean
  interviewRole: string
  resumeText: string
  jobDescription: string
  expectedQuestions: string
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  model: 'gpt-4o',
  responseMode: 'on-demand',
  maxTokens: 500,
  temperature: 0.7,
  streamingEnabled: true,
  interviewRole: '',
  resumeText: '',
  jobDescription: '',
  expectedQuestions: '',
}

// ─── Transcript Types ────────────────────────────────────

export interface TranscriptSegment {
  id: string
  speaker: 'you' | 'them' | 'unknown'
  text: string
  timestamp: number
  isFinal: boolean
}

// ─── Meeting Types ───────────────────────────────────────

export interface Meeting {
  id: string
  title: string
  transcript: TranscriptSegment[]
  summary: string | null
  actionItems: string[]
  startedAt: number
  endedAt: number | null
}

// ─── Tab / View Types ────────────────────────────────────

export type OverlayTab = 'transcript' | 'ai' | 'settings'

// ─── IPC Channel Names ──────────────────────────────────

// ─── Audio Device Types ──────────────────────────────────

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

export const IPC_CHANNELS = {
  // Overlay controls
  TOGGLE_OVERLAY: 'overlay:toggle',
  SET_OVERLAY_CONFIG: 'overlay:set-config',
  GET_OVERLAY_CONFIG: 'overlay:get-config',
  OVERLAY_SET_LOCKED: 'overlay:set-locked',
  
  // Audio controls
  SET_AUDIO_CONFIG: 'audio:set-config',
  GET_AUDIO_DEVICES: 'audio:get-devices',
  AUDIO_START_CAPTURE: 'audio:start-capture',
  AUDIO_STOP_CAPTURE: 'audio:stop-capture',
  AUDIO_LEVEL: 'audio:level',
  
  // AI controls
  AI_REQUEST: 'ai:request',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_STREAM_END: 'ai:stream-end',
  
  // Transcript
  TRANSCRIPT_SEGMENT: 'transcript:segment',
  TRANSCRIPTION_START: 'transcription:start',
  TRANSCRIPTION_STOP: 'transcription:stop',
  
  // App controls
  APP_QUIT: 'app:quit',
  APP_MINIMIZE: 'app:minimize',
  
  // Window management
  WINDOW_RESIZE: 'window:resize',
  WINDOW_MOVE: 'window:move',
  WINDOW_SET_OPACITY: 'window:set-opacity',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
} as const
