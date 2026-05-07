/**
 * Invis — Zustand Store
 * 
 * Central state management for the overlay UI.
 * Handles tabs, transcript, AI responses, settings, audio, and connection status.
 */

import { create } from 'zustand'
import type { OverlayTab, TranscriptSegment, AIConfig, OverlayConfig, AudioConfig } from '../../shared/types'
import { DEFAULT_AI_CONFIG, DEFAULT_OVERLAY_CONFIG, DEFAULT_AUDIO_CONFIG } from '../../shared/types'

// ─── Store Types ─────────────────────────────────────────

interface AIResponse {
  id: string
  text: string
  isStreaming: boolean
  timestamp: number
  model: string
}

interface AppState {
  // Active tab
  activeTab: OverlayTab
  setActiveTab: (tab: OverlayTab) => void

  // Transcript
  transcript: TranscriptSegment[]
  addTranscriptSegment: (segment: TranscriptSegment) => void
  clearTranscript: () => void

  // AI
  aiResponses: AIResponse[]
  currentStreamingResponse: string
  isAILoading: boolean
  aiConfig: AIConfig
  addAIResponse: (response: AIResponse) => void
  appendToCurrentStream: (chunk: string) => void
  finalizeCurrentStream: () => void
  setAILoading: (loading: boolean) => void
  setAIConfig: (config: Partial<AIConfig>) => void
  clearAIResponses: () => void

  // Overlay config
  overlayConfig: OverlayConfig
  setOverlayConfig: (config: Partial<OverlayConfig>) => void

  // Audio config
  audioConfig: AudioConfig
  setAudioConfig: (config: Partial<AudioConfig>) => void

  // Audio state
  audioLevels: { mic: number; system: number }
  setAudioLevels: (levels: { mic: number; system: number }) => void
  isCapturing: boolean
  setCapturing: (capturing: boolean) => void

  // Connection
  isConnected: boolean
  isListening: boolean
  setConnected: (connected: boolean) => void
  setListening: (listening: boolean) => void

  // AI input
  aiInput: string
  setAIInput: (input: string) => void
}

// ─── Store Implementation ────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  // Tab
  activeTab: 'ai',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Transcript
  transcript: [],
  addTranscriptSegment: (segment) => set((state) => ({
    transcript: [...state.transcript.slice(-100), segment], // Keep last 100 segments
  })),
  clearTranscript: () => set({ transcript: [] }),

  // AI
  aiResponses: [],
  currentStreamingResponse: '',
  isAILoading: false,
  aiConfig: { ...DEFAULT_AI_CONFIG },
  
  addAIResponse: (response) => set((state) => ({
    aiResponses: [...state.aiResponses.slice(-50), response],
  })),
  
  appendToCurrentStream: (chunk) => set((state) => ({
    currentStreamingResponse: state.currentStreamingResponse + chunk,
  })),
  
  finalizeCurrentStream: () => {
    const currentText = get().currentStreamingResponse
    if (currentText) {
      const response: AIResponse = {
        id: crypto.randomUUID(),
        text: currentText,
        isStreaming: false,
        timestamp: Date.now(),
        model: get().aiConfig.model,
      }
      set((state) => ({
        aiResponses: [...state.aiResponses.slice(-50), response],
        currentStreamingResponse: '',
        isAILoading: false,
      }))
    }
  },
  
  setAILoading: (loading) => set({ isAILoading: loading }),
  setAIConfig: (config) => set((state) => ({
    aiConfig: { ...state.aiConfig, ...config },
  })),
  clearAIResponses: () => set({ aiResponses: [], currentStreamingResponse: '' }),

  // Overlay config
  overlayConfig: { ...DEFAULT_OVERLAY_CONFIG },
  setOverlayConfig: (config) => set((state) => ({
    overlayConfig: { ...state.overlayConfig, ...config },
  })),

  // Audio config
  audioConfig: { ...DEFAULT_AUDIO_CONFIG },
  setAudioConfig: (config) => set((state) => ({
    audioConfig: { ...state.audioConfig, ...config },
  })),

  // Audio state
  audioLevels: { mic: 0, system: 0 },
  setAudioLevels: (levels) => set({ audioLevels: levels }),
  isCapturing: false,
  setCapturing: (capturing) => set({ isCapturing: capturing }),

  // Connection
  isConnected: false,
  isListening: false,
  setConnected: (connected) => set({ isConnected: connected }),
  setListening: (listening) => set({ isListening: listening }),

  // AI input
  aiInput: '',
  setAIInput: (input) => set({ aiInput: input }),
}))
