/**
 * Invis — Persistent Settings Store
 *
 * Uses electron-store to persist overlay configuration, AI settings,
 * and audio device preferences across app restarts.
 */

import Store from 'electron-store'
import { DEFAULT_OVERLAY_CONFIG, DEFAULT_AI_CONFIG, DEFAULT_AUDIO_CONFIG } from '../shared/types'
import type { OverlayConfig, AIConfig, AudioConfig } from '../shared/types'

interface StoreSchema {
  overlay: OverlayConfig
  ai: AIConfig
  audio: AudioConfig
}

const store = new Store<StoreSchema>({
  name: 'invis-config',
  defaults: {
    overlay: { ...DEFAULT_OVERLAY_CONFIG },
    ai: { ...DEFAULT_AI_CONFIG },
    audio: { ...DEFAULT_AUDIO_CONFIG },
  },
})

// ─── Overlay Config ──────────────────────────────────────

export function loadOverlayConfig(): OverlayConfig {
  return store.get('overlay', { ...DEFAULT_OVERLAY_CONFIG })
}

export function saveOverlayConfig(config: Partial<OverlayConfig>): OverlayConfig {
  const current = loadOverlayConfig()
  const updated = { ...current, ...config }
  store.set('overlay', updated)
  return updated
}

// ─── AI Config ───────────────────────────────────────────

export function loadAIConfig(): AIConfig {
  return store.get('ai', { ...DEFAULT_AI_CONFIG })
}

export function saveAIConfig(config: Partial<AIConfig>): AIConfig {
  const current = loadAIConfig()
  const updated = { ...current, ...config }
  store.set('ai', updated)
  return updated
}

// ─── Audio Config ────────────────────────────────────────

export function loadAudioConfig(): AudioConfig {
  return store.get('audio', { ...DEFAULT_AUDIO_CONFIG })
}

export function saveAudioConfig(config: Partial<AudioConfig>): AudioConfig {
  const current = loadAudioConfig()
  const updated = { ...current, ...config }
  store.set('audio', updated)
  return updated
}

export default store
