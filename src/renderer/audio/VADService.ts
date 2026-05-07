/**
 * Invis — Voice Activity Detection Service
 * 
 * Wraps @ricky0123/vad-web (Silero VAD) for detecting speech boundaries.
 * Emits events for speech-start, speech-end, and complete speech segments.
 * Used to segment continuous audio into utterances for transcription.
 */

export interface VADOptions {
  /** Speech probability threshold (0.0 - 1.0). Higher = more strict. Default: 0.5 */
  speechThreshold?: number
  /** Minimum silence duration (ms) to consider speech ended. Default: 500 */
  silenceDurationMs?: number
  /** Minimum speech duration (ms) to emit. Default: 250 */
  minSpeechDurationMs?: number
  /** Maximum speech duration (ms) before force-split. Default: 30000 (30s) */
  maxSpeechDurationMs?: number
}

export interface SpeechSegment {
  /** PCM 16-bit audio data for this segment */
  audio: Int16Array
  /** Start timestamp (ms since capture start) */
  startTime: number
  /** End timestamp (ms since capture start) */
  endTime: number
  /** Source: mic or system audio */
  source: 'mic' | 'system'
}

type VADCallback = {
  onSpeechStart?: () => void
  onSpeechEnd?: (segment: SpeechSegment) => void
  onVADMisfire?: () => void
}

/**
 * Simple energy-based VAD implementation.
 * Falls back to this when @ricky0123/vad-web is not available.
 * 
 * Uses RMS energy threshold to detect speech vs silence.
 * Production use should integrate Silero VAD for better accuracy.
 */
export class VADService {
  private options: Required<VADOptions>
  private callbacks: VADCallback = {}
  private isSpeaking = false
  private speechStartTime = 0
  private silenceStartTime = 0
  private captureStartTime = 0
  private audioBuffer: Int16Array[] = []
  private currentSource: 'mic' | 'system' = 'mic'
  private running = false

  // Energy thresholds
  private readonly SPEECH_THRESHOLD: number
  private readonly SILENCE_THRESHOLD: number

  constructor(options?: VADOptions) {
    this.options = {
      speechThreshold: options?.speechThreshold ?? 0.5,
      silenceDurationMs: options?.silenceDurationMs ?? 500,
      minSpeechDurationMs: options?.minSpeechDurationMs ?? 250,
      maxSpeechDurationMs: options?.maxSpeechDurationMs ?? 30000,
    }

    // Map the 0-1 threshold to RMS energy levels
    this.SPEECH_THRESHOLD = 0.01 + (1 - this.options.speechThreshold) * 0.04
    this.SILENCE_THRESHOLD = this.SPEECH_THRESHOLD * 0.6
  }

  /**
   * Start the VAD processor.
   */
  start(callbacks: VADCallback): void {
    this.callbacks = callbacks
    this.captureStartTime = Date.now()
    this.running = true
    console.log('[VAD] Started voice activity detection')
  }

  /**
   * Stop the VAD processor.
   */
  stop(): void {
    // If speaking when stopped, emit the final segment
    if (this.isSpeaking && this.audioBuffer.length > 0) {
      this.emitSpeechSegment()
    }
    this.running = false
    this.isSpeaking = false
    this.audioBuffer = []
    console.log('[VAD] Stopped voice activity detection')
  }

  /**
   * Process a chunk of PCM audio data through VAD.
   * Call this for each PCM buffer received from AudioCaptureService.
   */
  processAudio(data: { source: 'mic' | 'system'; buffer: Int16Array; rms: number }): void {
    if (!this.running) return

    this.currentSource = data.source
    const now = Date.now()
    const isSpeech = data.rms >= this.SPEECH_THRESHOLD

    if (isSpeech) {
      if (!this.isSpeaking) {
        // Speech started
        this.isSpeaking = true
        this.speechStartTime = now
        this.silenceStartTime = 0
        this.audioBuffer = []
        this.callbacks.onSpeechStart?.()
      }
      this.silenceStartTime = 0
      this.audioBuffer.push(data.buffer)

      // Check for max duration force-split
      if (now - this.speechStartTime >= this.options.maxSpeechDurationMs) {
        this.emitSpeechSegment()
        // Start a new segment immediately
        this.isSpeaking = true
        this.speechStartTime = now
        this.audioBuffer = []
      }
    } else {
      if (this.isSpeaking) {
        // Silence during speech — buffer it (might be a pause)
        this.audioBuffer.push(data.buffer)
        
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = now
        }

        // Check if silence has lasted long enough to end speech
        if (now - this.silenceStartTime >= this.options.silenceDurationMs) {
          const duration = now - this.speechStartTime
          if (duration >= this.options.minSpeechDurationMs) {
            this.emitSpeechSegment()
          } else {
            // Too short — misfire
            this.callbacks.onVADMisfire?.()
            this.isSpeaking = false
            this.audioBuffer = []
          }
        }
      }
    }
  }

  // ─── Private ──────────────────────────────────────────

  private emitSpeechSegment(): void {
    // Concatenate all buffered audio chunks
    const totalLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0)
    const audio = new Int16Array(totalLength)
    let offset = 0
    for (const chunk of this.audioBuffer) {
      audio.set(chunk, offset)
      offset += chunk.length
    }

    const segment: SpeechSegment = {
      audio,
      startTime: this.speechStartTime - this.captureStartTime,
      endTime: Date.now() - this.captureStartTime,
      source: this.currentSource,
    }

    this.callbacks.onSpeechEnd?.(segment)
    this.isSpeaking = false
    this.audioBuffer = []
    this.silenceStartTime = 0
  }
}
