/**
 * Invis — Sidecar Process Manager
 * 
 * Manages the Python faster-whisper sidecar process lifecycle.
 * Communicates via stdin/stdout JSON lines protocol.
 * Handles process spawning, health checking, and auto-restart.
 */

import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { EventEmitter } from 'events'

export interface TranscriptionResult {
  id: string
  text: string
  language: string
  duration: number
  probability?: number
}

export class SidecarManager extends EventEmitter {
  private process: ChildProcess | null = null
  private isRunning = false
  private restartCount = 0
  private readonly MAX_RESTARTS = 3
  private pendingCallbacks: Map<string, (result: TranscriptionResult) => void> = new Map()
  private lineBuffer = ''

  /**
   * Start the Python whisper sidecar process.
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    const sidecarPath = this.getSidecarPath()
    console.log(`[SidecarManager] Starting sidecar: ${sidecarPath}`)

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn('python', [sidecarPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        })

        this.isRunning = true

        // Handle stdout (JSON lines from sidecar)
        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleStdout(data.toString())
        })

        // Handle stderr (logs from sidecar)
        this.process.stderr?.on('data', (data: Buffer) => {
          console.log(`[Sidecar] ${data.toString().trim()}`)
        })

        // Handle process exit
        this.process.on('close', (code) => {
          console.log(`[SidecarManager] Process exited with code ${code}`)
          this.isRunning = false
          this.emit('exit', code)

          // Auto-restart on unexpected exit
          if (code !== 0 && this.restartCount < this.MAX_RESTARTS) {
            this.restartCount++
            console.log(`[SidecarManager] Auto-restarting (attempt ${this.restartCount}/${this.MAX_RESTARTS})`)
            setTimeout(() => this.start(), 1000)
          }
        })

        this.process.on('error', (err) => {
          console.error(`[SidecarManager] Process error:`, err)
          this.isRunning = false
          this.emit('error', err)
          reject(err)
        })

        // Wait for model_loaded message
        const timeout = setTimeout(() => {
          resolve() // Resolve even if model takes too long
        }, 30000)

        this.once('model_loaded', () => {
          clearTimeout(timeout)
          this.restartCount = 0 // Reset on successful start
          resolve()
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop the sidecar process gracefully.
   */
  async stop(): Promise<void> {
    if (!this.process || !this.isRunning) return

    return new Promise((resolve) => {
      this.sendMessage({ type: 'shutdown' })
      
      // Give it 5 seconds to shut down gracefully
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGTERM')
        }
        resolve()
      }, 5000)

      this.process!.on('close', () => {
        clearTimeout(timeout)
        this.isRunning = false
        this.process = null
        resolve()
      })
    })
  }

  /**
   * Send an audio segment for transcription.
   * Returns a promise that resolves with the transcription result.
   */
  async transcribe(audioBuffer: Int16Array, segmentId: string): Promise<TranscriptionResult> {
    if (!this.isRunning || !this.process) {
      throw new Error('Sidecar is not running')
    }

    // Convert Int16Array to base64
    const bytes = new Uint8Array(audioBuffer.buffer)
    const base64 = Buffer.from(bytes).toString('base64')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(segmentId)
        reject(new Error(`Transcription timeout for segment ${segmentId}`))
      }, 30000)

      this.pendingCallbacks.set(segmentId, (result) => {
        clearTimeout(timeout)
        resolve(result)
      })

      this.sendMessage({
        type: 'transcribe',
        audio_b64: base64,
        id: segmentId,
      })
    })
  }

  /**
   * Check if the sidecar is alive.
   */
  async ping(): Promise<boolean> {
    if (!this.isRunning) return false
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000)
      
      this.once('pong', () => {
        clearTimeout(timeout)
        resolve(true)
      })

      this.sendMessage({ type: 'ping' })
    })
  }

  get running(): boolean { return this.isRunning }

  // ─── Private ──────────────────────────────────────────

  private getSidecarPath(): string {
    // In dev, the sidecar is in the source directory
    // In production, it should be bundled with the app
    if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
      return join(__dirname, '../../src/main/sidecar/whisper-sidecar.py')
    }
    return join(process.resourcesPath, 'sidecar/whisper-sidecar.py')
  }

  private sendMessage(data: Record<string, unknown>): void {
    if (!this.process?.stdin?.writable) return
    const line = JSON.stringify(data) + '\n'
    this.process.stdin.write(line)
  }

  private handleStdout(data: string): void {
    // Buffer partial lines
    this.lineBuffer += data
    const lines = this.lineBuffer.split('\n')
    
    // Keep the last partial line in the buffer
    this.lineBuffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const message = JSON.parse(trimmed)
        this.handleMessage(message)
      } catch {
        console.warn(`[SidecarManager] Invalid JSON from sidecar: ${trimmed}`)
      }
    }
  }

  private handleMessage(message: Record<string, unknown>): void {
    const type = message.type as string

    switch (type) {
      case 'model_loaded':
        console.log(`[SidecarManager] Model loaded: ${message.model}`)
        this.emit('model_loaded')
        break

      case 'result': {
        const id = message.id as string
        const callback = this.pendingCallbacks.get(id)
        if (callback) {
          this.pendingCallbacks.delete(id)
          callback({
            id,
            text: message.text as string,
            language: message.language as string,
            duration: message.duration as number,
            probability: message.probability as number | undefined,
          })
        }
        this.emit('transcription', message)
        break
      }

      case 'pong':
        this.emit('pong')
        break

      case 'error':
        console.error(`[SidecarManager] Sidecar error:`, message.message)
        const errorId = message.id as string | undefined
        if (errorId) {
          const callback = this.pendingCallbacks.get(errorId)
          if (callback) {
            this.pendingCallbacks.delete(errorId)
            callback({
              id: errorId,
              text: '',
              language: 'en',
              duration: 0,
            })
          }
        }
        this.emit('error', new Error(message.message as string))
        break

      case 'shutdown_ack':
        console.log('[SidecarManager] Shutdown acknowledged')
        break

      default:
        console.warn(`[SidecarManager] Unknown message type: ${type}`)
    }
  }
}
