#!/usr/bin/env python3
"""
Invis — Whisper Transcription Sidecar

Runs as a subprocess managed by the Electron main process.
Listens on stdin for JSON-encoded audio segments (base64 PCM),
transcribes using faster-whisper, and returns results on stdout.

Protocol (JSON lines, one per line):
  Input:  {"type": "transcribe", "audio_b64": "<base64 PCM 16-bit 16kHz mono>", "id": "seg-1"}
  Output: {"type": "result", "id": "seg-1", "text": "Hello world", "language": "en", "duration": 2.5}

  Input:  {"type": "ping"}
  Output: {"type": "pong"}

  Input:  {"type": "shutdown"}
  (process exits)
"""

import sys
import json
import base64
import struct
import logging
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format='[WhisperSidecar] %(levelname)s: %(message)s',
    stream=sys.stderr  # Logs go to stderr, protocol data goes to stdout
)

# ─── Model Loading ────────────────────────────────────────

model = None
MODEL_SIZE = "small.en"

def load_model():
    """Load the faster-whisper model."""
    global model
    try:
        from faster_whisper import WhisperModel
        logging.info(f"Loading model: {MODEL_SIZE}")
        model = WhisperModel(
            MODEL_SIZE,
            device="auto",  # CUDA if available, else CPU
            compute_type="int8",  # Quantized for speed
        )
        logging.info("Model loaded successfully")
        send_response({"type": "model_loaded", "model": MODEL_SIZE})
    except ImportError:
        logging.error("faster-whisper not installed. Run: pip install faster-whisper")
        send_response({"type": "error", "message": "faster-whisper not installed"})
    except Exception as e:
        logging.error(f"Failed to load model: {e}")
        send_response({"type": "error", "message": str(e)})

# ─── Audio Processing ─────────────────────────────────────

def pcm_b64_to_float32(audio_b64: str) -> np.ndarray:
    """Convert base64-encoded PCM 16-bit audio to float32 numpy array."""
    pcm_bytes = base64.b64decode(audio_b64)
    # Unpack as int16
    n_samples = len(pcm_bytes) // 2
    int16_data = struct.unpack(f'<{n_samples}h', pcm_bytes)
    # Normalize to [-1.0, 1.0]
    float32_data = np.array(int16_data, dtype=np.float32) / 32768.0
    return float32_data

def transcribe_audio(audio_b64: str, segment_id: str):
    """Transcribe a base64-encoded PCM audio segment."""
    if model is None:
        send_response({
            "type": "error",
            "id": segment_id,
            "message": "Model not loaded"
        })
        return

    try:
        audio = pcm_b64_to_float32(audio_b64)
        duration = len(audio) / 16000  # 16kHz sample rate

        if duration < 0.1:
            send_response({
                "type": "result",
                "id": segment_id,
                "text": "",
                "language": "en",
                "duration": duration
            })
            return

        # Run transcription
        segments, info = model.transcribe(
            audio,
            beam_size=5,
            language="en",
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=300,
                speech_pad_ms=100,
            ),
        )

        # Collect all segment texts
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        full_text = " ".join(text_parts).strip()

        send_response({
            "type": "result",
            "id": segment_id,
            "text": full_text,
            "language": info.language if info else "en",
            "duration": duration,
            "probability": info.language_probability if info else 0,
        })

    except Exception as e:
        logging.error(f"Transcription error: {e}")
        send_response({
            "type": "error",
            "id": segment_id,
            "message": str(e)
        })

# ─── Protocol ─────────────────────────────────────────────

def send_response(data: dict):
    """Send a JSON response to stdout (Electron main process)."""
    line = json.dumps(data, ensure_ascii=False)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()

def main():
    """Main loop: read JSON lines from stdin, process, respond on stdout."""
    logging.info("Whisper sidecar starting...")
    
    # Load model on startup
    load_model()

    logging.info("Ready for transcription requests")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            logging.error(f"Invalid JSON: {e}")
            send_response({"type": "error", "message": f"Invalid JSON: {e}"})
            continue

        msg_type = request.get("type", "")

        if msg_type == "ping":
            send_response({"type": "pong"})

        elif msg_type == "transcribe":
            audio_b64 = request.get("audio_b64", "")
            segment_id = request.get("id", "unknown")
            transcribe_audio(audio_b64, segment_id)

        elif msg_type == "shutdown":
            logging.info("Shutdown requested")
            send_response({"type": "shutdown_ack"})
            break

        else:
            send_response({"type": "error", "message": f"Unknown type: {msg_type}"})

    logging.info("Sidecar exiting")

if __name__ == "__main__":
    main()
