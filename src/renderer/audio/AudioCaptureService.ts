/**
 * Invis — Audio Capture Service
 * 
 * Captures system audio (via VB-Cable) and microphone audio simultaneously.
 * Extracts PCM 16-bit 16kHz mono data for transcription via AudioWorklet.
 * Maintains a ring buffer of the last 30 seconds of audio.
 */

export interface AudioCaptureOptions {
  systemDeviceId: string   // VB-Cable device ID
  micDeviceId: string      // Microphone device ID
  sampleRate?: number      // Default 16000
  onPCMData?: (data: { source: 'system' | 'mic'; buffer: Int16Array }) => void
  onAudioLevel?: (levels: { mic: number; system: number }) => void
  onError?: (error: Error) => void
}

export class AudioCaptureService {
  private audioContext: AudioContext | null = null
  private systemStream: MediaStream | null = null
  private micStream: MediaStream | null = null
  private systemWorklet: AudioWorkletNode | null = null
  private micWorklet: AudioWorkletNode | null = null
  private options: AudioCaptureOptions
  private isCapturing = false

  // Ring buffer: stores last 30s of audio at 16kHz = 480,000 samples
  private readonly RING_BUFFER_SIZE = 480000
  private systemRingBuffer: Int16Array
  private micRingBuffer: Int16Array
  private systemWritePos = 0
  private micWritePos = 0

  // Audio levels for UI visualization
  private _micLevel = 0
  private _systemLevel = 0

  constructor(options: AudioCaptureOptions) {
    this.options = { sampleRate: 16000, ...options }
    this.systemRingBuffer = new Int16Array(this.RING_BUFFER_SIZE)
    this.micRingBuffer = new Int16Array(this.RING_BUFFER_SIZE)
  }

  get micLevel(): number { return this._micLevel }
  get systemLevel(): number { return this._systemLevel }
  get capturing(): boolean { return this.isCapturing }

  /**
   * Start capturing audio from both system and microphone inputs.
   */
  async start(): Promise<void> {
    if (this.isCapturing) return

    try {
      // Create AudioContext at 16kHz for Whisper compatibility
      this.audioContext = new AudioContext({ sampleRate: this.options.sampleRate })

      // Register the PCM processor worklet
      const workletUrl = new URL('./pcm-processor.worklet.js', import.meta.url)
      await this.audioContext.addModule(workletUrl.href)

      // Capture system audio (VB-Cable)
      if (this.options.systemDeviceId) {
        await this.startSystemCapture()
      }

      // Capture microphone
      if (this.options.micDeviceId) {
        await this.startMicCapture()
      }

      this.isCapturing = true
      console.log('[AudioCapture] Started capturing audio')
    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error)
      this.options.onError?.(error as Error)
      await this.stop()
      throw error
    }
  }

  /**
   * Stop all audio capture and release resources.
   */
  async stop(): Promise<void> {
    this.isCapturing = false

    // Stop worklet nodes
    this.systemWorklet?.disconnect()
    this.micWorklet?.disconnect()
    this.systemWorklet = null
    this.micWorklet = null

    // Stop media streams
    this.systemStream?.getTracks().forEach(t => t.stop())
    this.micStream?.getTracks().forEach(t => t.stop())
    this.systemStream = null
    this.micStream = null

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
    }
    this.audioContext = null

    // Reset levels
    this._micLevel = 0
    this._systemLevel = 0

    console.log('[AudioCapture] Stopped capturing audio')
  }

  /**
   * Get the last N seconds of audio from the ring buffer.
   */
  getRecentAudio(source: 'system' | 'mic', seconds: number): Int16Array {
    const buffer = source === 'system' ? this.systemRingBuffer : this.micRingBuffer
    const writePos = source === 'system' ? this.systemWritePos : this.micWritePos
    const samples = Math.min(seconds * (this.options.sampleRate || 16000), this.RING_BUFFER_SIZE)
    
    const result = new Int16Array(samples)
    let readPos = (writePos - samples + this.RING_BUFFER_SIZE) % this.RING_BUFFER_SIZE
    
    for (let i = 0; i < samples; i++) {
      result[i] = buffer[readPos]
      readPos = (readPos + 1) % this.RING_BUFFER_SIZE
    }
    
    return result
  }

  // ─── Private Methods ──────────────────────────────────

  private async startSystemCapture(): Promise<void> {
    this.systemStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: this.options.systemDeviceId },
        sampleRate: this.options.sampleRate,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    const source = this.audioContext!.createMediaStreamSource(this.systemStream)
    this.systemWorklet = new AudioWorkletNode(this.audioContext!, 'pcm-processor')
    
    this.systemWorklet.port.onmessage = (event) => {
      if (event.data.type === 'pcm') {
        const pcmData = new Int16Array(event.data.buffer)
        this.writeToRingBuffer('system', pcmData)
        this._systemLevel = event.data.rms
        this.options.onPCMData?.({ source: 'system', buffer: pcmData })
        this.options.onAudioLevel?.({ mic: this._micLevel, system: this._systemLevel })
      }
    }

    source.connect(this.systemWorklet)
    // Don't connect to destination — we don't want to hear it
  }

  private async startMicCapture(): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: this.options.micDeviceId },
        sampleRate: this.options.sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    const source = this.audioContext!.createMediaStreamSource(this.micStream)
    this.micWorklet = new AudioWorkletNode(this.audioContext!, 'pcm-processor')
    
    this.micWorklet.port.onmessage = (event) => {
      if (event.data.type === 'pcm') {
        const pcmData = new Int16Array(event.data.buffer)
        this.writeToRingBuffer('mic', pcmData)
        this._micLevel = event.data.rms
        this.options.onPCMData?.({ source: 'mic', buffer: pcmData })
        this.options.onAudioLevel?.({ mic: this._micLevel, system: this._systemLevel })
      }
    }

    source.connect(this.micWorklet)
  }

  private writeToRingBuffer(source: 'system' | 'mic', data: Int16Array): void {
    const buffer = source === 'system' ? this.systemRingBuffer : this.micRingBuffer
    let writePos = source === 'system' ? this.systemWritePos : this.micWritePos

    for (let i = 0; i < data.length; i++) {
      buffer[writePos] = data[i]
      writePos = (writePos + 1) % this.RING_BUFFER_SIZE
    }

    if (source === 'system') {
      this.systemWritePos = writePos
    } else {
      this.micWritePos = writePos
    }
  }
}

/**
 * Enumerate available audio input devices.
 */
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter(d => d.kind === 'audioinput')
}

/**
 * Check if VB-Cable is installed by looking for it in the device list.
 */
export async function isVBCableInstalled(): Promise<boolean> {
  const devices = await getAudioInputDevices()
  return devices.some(d => 
    d.label.toLowerCase().includes('cable') || 
    d.label.toLowerCase().includes('vb-audio') ||
    d.label.toLowerCase().includes('virtual')
  )
}
