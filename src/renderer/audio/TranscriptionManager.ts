/**
 * Invis — Transcription Manager
 * 
 * Orchestrates the full audio-to-text pipeline:
 * AudioCapture → VAD → Transcription → Store Update
 * 
 * For now, uses a simulated transcription backend.
 * In production, this sends audio segments to the faster-whisper
 * Python sidecar or Deepgram cloud API.
 */

import { AudioCaptureService } from './AudioCaptureService'
import { VADService } from './VADService'
import type { SpeechSegment } from './VADService'
import type { TranscriptSegment } from '../../shared/types'

export interface TranscriptionManagerOptions {
  systemDeviceId: string
  micDeviceId: string
  vadSensitivity?: number    // 0.0 to 1.0
  onTranscript?: (segment: TranscriptSegment) => void
  onAudioLevel?: (levels: { mic: number; system: number }) => void
  onSpeechStart?: (source: 'mic' | 'system') => void
  onError?: (error: Error) => void
}

export class TranscriptionManager {
  private captureService: AudioCaptureService | null = null
  private micVAD: VADService
  private systemVAD: VADService
  private options: TranscriptionManagerOptions
  private segmentCounter = 0
  private isRunning = false

  constructor(options: TranscriptionManagerOptions) {
    this.options = options

    // Create separate VAD instances for mic and system audio
    const vadOpts = { speechThreshold: options.vadSensitivity ?? 0.5 }
    this.micVAD = new VADService(vadOpts)
    this.systemVAD = new VADService(vadOpts)
  }

  get running(): boolean { return this.isRunning }

  /**
   * Start the full transcription pipeline.
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    console.log('[TranscriptionManager] Starting pipeline...')

    // Initialize audio capture
    this.captureService = new AudioCaptureService({
      systemDeviceId: this.options.systemDeviceId,
      micDeviceId: this.options.micDeviceId,
      onPCMData: (data) => this.handlePCMData(data),
      onAudioLevel: (levels) => this.options.onAudioLevel?.(levels),
      onError: (err) => this.options.onError?.(err),
    })

    // Start VAD for both streams
    this.micVAD.start({
      onSpeechStart: () => {
        console.log('[TranscriptionManager] Mic speech started')
        this.options.onSpeechStart?.('mic')
      },
      onSpeechEnd: (segment) => this.handleSpeechSegment(segment),
    })

    this.systemVAD.start({
      onSpeechStart: () => {
        console.log('[TranscriptionManager] System speech started')
        this.options.onSpeechStart?.('system')
      },
      onSpeechEnd: (segment) => this.handleSpeechSegment(segment),
    })

    // Start capturing
    await this.captureService.start()
    this.isRunning = true
    console.log('[TranscriptionManager] Pipeline running')
  }

  /**
   * Stop the transcription pipeline.
   */
  async stop(): Promise<void> {
    this.isRunning = false
    this.micVAD.stop()
    this.systemVAD.stop()
    await this.captureService?.stop()
    this.captureService = null
    console.log('[TranscriptionManager] Pipeline stopped')
  }

  // ─── Private ──────────────────────────────────────────

  private handlePCMData(data: { source: 'mic' | 'system'; buffer: Int16Array }): void {
    // Route to the appropriate VAD instance
    // Note: RMS is calculated by the worklet, but we approximate here
    const rms = this.calculateRMS(data.buffer)
    
    if (data.source === 'mic') {
      this.micVAD.processAudio({ ...data, rms })
    } else {
      this.systemVAD.processAudio({ ...data, rms })
    }
  }

  private async handleSpeechSegment(segment: SpeechSegment): Promise<void> {
    console.log(`[TranscriptionManager] Speech segment: ${segment.source}, ${segment.audio.length} samples, ${(segment.endTime - segment.startTime)}ms`)

    // TODO: In production, send to faster-whisper sidecar or Deepgram
    // For now, create a placeholder transcript segment
    const transcriptSegment: TranscriptSegment = {
      id: `seg-${++this.segmentCounter}-${Date.now()}`,
      speaker: segment.source === 'mic' ? 'you' : 'them',
      text: await this.transcribeSegment(segment),
      timestamp: Date.now(),
      isFinal: true,
    }

    this.options.onTranscript?.(transcriptSegment)
  }

  private async transcribeSegment(segment: SpeechSegment): Promise<string> {
    const durationSec = segment.audio.length / 16000

    if (durationSec < 0.5) {
      return '[short audio]'
    }

    try {
      if (window.invisAPI) {
        // Convert Int16Array to Uint8Array, then to base64
        const uint8Array = new Uint8Array(segment.audio.buffer)
        
        // chunk array to prevent call stack size exceeded
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(uint8Array.subarray(i, i + chunkSize)))
        }
        
        const base64 = btoa(binary)
        
        const result = await window.invisAPI.transcribeAudio(base64, `seg-${Date.now()}`)
        return result.text || '[no speech detected]'
      }
    } catch (err) {
      console.error('[TranscriptionManager] Transcription failed:', err)
      return `[Transcription failed: ${(err as Error).message}]`
    }

    return `[Audio: ${durationSec.toFixed(1)}s from ${segment.source}] — Connect faster-whisper for real transcription`
  }

  private calculateRMS(buffer: Int16Array): number {
    let sumSquares = 0
    for (let i = 0; i < buffer.length; i++) {
      const normalized = buffer[i] / 32768
      sumSquares += normalized * normalized
    }
    return Math.sqrt(sumSquares / buffer.length)
  }
}
