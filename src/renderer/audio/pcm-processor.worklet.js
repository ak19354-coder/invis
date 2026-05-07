/**
 * Invis — PCM Processor AudioWorklet
 * 
 * Runs in AudioWorklet thread for real-time PCM extraction.
 * Converts Float32 audio data to Int16 PCM format at 16kHz mono.
 * Posts PCM buffers to the main thread for transcription.
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // Buffer ~100ms of audio at 16kHz = 1600 samples
    this.BUFFER_SIZE = 1600
    this.buffer = new Float32Array(this.BUFFER_SIZE)
    this.bufferIndex = 0
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const channelData = input[0]
    if (!channelData) return true

    // Accumulate samples
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i]

      if (this.bufferIndex >= this.BUFFER_SIZE) {
        // Convert Float32 to Int16 PCM
        const pcm16 = this.float32ToInt16(this.buffer)
        
        // Calculate RMS level for visualization
        const rms = this.calculateRMS(this.buffer)

        this.port.postMessage({
          type: 'pcm',
          buffer: pcm16.buffer,
          rms,
        }, [pcm16.buffer])

        // Reset buffer
        this.buffer = new Float32Array(this.BUFFER_SIZE)
        this.bufferIndex = 0
      }
    }

    return true
  }

  float32ToInt16(float32) {
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      // Clamp to [-1, 1] then scale to Int16 range
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16
  }

  calculateRMS(buffer) {
    let sumSquares = 0
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i]
    }
    return Math.sqrt(sumSquares / buffer.length)
  }
}

registerProcessor('pcm-processor', PCMProcessor)
