export type StreamingCallback = (chunk: string, done: boolean, error?: string) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000

  constructor(url: string = 'ws://127.0.0.1:3001/api/v1/ai/stream') {
    this.url = url
  }

  connect(onOpen?: () => void, onClose?: () => void) {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected to backend')
      this.reconnectAttempts = 0
      onOpen?.()
    }

    this.ws.onclose = () => {
      console.log('[WebSocket] Disconnected from backend')
      this.ws = null
      onClose?.()
      this.attemptReconnect(onOpen, onClose)
    }

    this.ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err)
    }
  }

  private attemptReconnect(onOpen?: () => void, onClose?: () => void) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`[WebSocket] Reconnecting... Attempt ${this.reconnectAttempts}`)
    setTimeout(() => {
      this.connect(onOpen, onClose)
    }, this.reconnectDelay)
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent auto-reconnect
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Request an AI completion stream.
   * Returns a promise that resolves when the stream is fully established, but chunks arrive via callback.
   */
  streamCompletion(prompt: string, context: string, role: string, resume: string, jd: string, questions: string, onChunk: StreamingCallback) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      onChunk('', true, 'WebSocket is not connected')
      return
    }

    // Set up a temporary listener for this specific request
    // Note: In a real app with concurrent requests, we'd need request IDs.
    // For this prototype, we assume one request at a time.
    const listener = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.error) {
          onChunk('', true, data.error)
          this.ws?.removeEventListener('message', listener)
        } else if (data.done) {
          onChunk('', true)
          this.ws?.removeEventListener('message', listener)
        } else if (data.chunk) {
          onChunk(data.chunk, false)
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err)
      }
    }

    this.ws.addEventListener('message', listener)

    this.ws.send(JSON.stringify({ prompt, context, role, resume, jd, questions }))
  }
}

export const aiClient = new WebSocketClient()
