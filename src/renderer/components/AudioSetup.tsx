/**
 * Invis — Audio Setup Component
 * 
 * Device enumeration, selection, and real-time audio level meters.
 * Allows users to select system audio (VB-Cable) and microphone inputs.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

interface AudioDevice {
  deviceId: string
  label: string
}

export const AudioSetup: React.FC = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedSystem, setSelectedSystem] = useState('')
  const [selectedMic, setSelectedMic] = useState('')
  const [micLevel, setMicLevel] = useState(0)
  const [systemLevel, setSystemLevel] = useState(0)
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [vbCableFound, setVbCableFound] = useState(false)
  const [showVBSetup, setShowVBSetup] = useState(false)

  const testStreamRef = useRef<MediaStream | null>(null)
  const testContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)

  const { setListening } = useAppStore()

  // Enumerate audio devices
  const refreshDevices = useCallback(async () => {
    try {
      // Request permission first (needed to get device labels)
      await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => stream.getTracks().forEach(t => t.stop()))

      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = allDevices
        .filter(d => d.kind === 'audioinput' && d.deviceId !== 'default')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone (${d.deviceId.slice(0, 8)})`,
        }))

      setDevices(audioInputs)

      // Check for VB-Cable
      const hasVBCable = audioInputs.some(d =>
        d.label.toLowerCase().includes('cable') ||
        d.label.toLowerCase().includes('vb-audio') ||
        d.label.toLowerCase().includes('virtual')
      )
      setVbCableFound(hasVBCable)

      // Auto-select VB-Cable if found
      if (hasVBCable && !selectedSystem) {
        const vbDevice = audioInputs.find(d =>
          d.label.toLowerCase().includes('cable') ||
          d.label.toLowerCase().includes('virtual')
        )
        if (vbDevice) setSelectedSystem(vbDevice.deviceId)
      }

      // Auto-select first non-virtual device as mic
      if (!selectedMic) {
        const micDevice = audioInputs.find(d =>
          !d.label.toLowerCase().includes('cable') &&
          !d.label.toLowerCase().includes('virtual')
        )
        if (micDevice) setSelectedMic(micDevice.deviceId)
      }
    } catch (error) {
      console.error('[AudioSetup] Failed to enumerate devices:', error)
    }
  }, [selectedSystem, selectedMic])

  useEffect(() => {
    refreshDevices()
    // Listen for device changes (plug/unplug)
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
      stopTestAudio()
    }
  }, [refreshDevices])

  // Test microphone with real-time level meter
  const testMicrophone = async () => {
    if (isTestingMic) {
      stopTestAudio()
      return
    }

    if (!selectedMic) return

    try {
      setIsTestingMic(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMic } },
      })
      testStreamRef.current = stream

      const ctx = new AudioContext()
      testContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setMicLevel(avg / 255) // Normalize to 0-1
        animFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()
    } catch (error) {
      console.error('[AudioSetup] Mic test failed:', error)
      setIsTestingMic(false)
    }
  }

  const stopTestAudio = () => {
    cancelAnimationFrame(animFrameRef.current)
    testStreamRef.current?.getTracks().forEach(t => t.stop())
    testStreamRef.current = null
    testContextRef.current?.close()
    testContextRef.current = null
    setIsTestingMic(false)
    setMicLevel(0)
    setSystemLevel(0)
  }

  if (showVBSetup) {
    return <VBCableSetupInline onBack={() => setShowVBSetup(false)} onComplete={() => {
      setShowVBSetup(false)
      refreshDevices()
    }} />
  }

  return (
    <div className="audio-setup" id="audio-setup">
      <div className="settings-group">
        <div className="settings-group-title">🎙️ Audio Devices</div>

        {/* System Audio (VB-Cable) */}
        <div className="settings-item">
          <span className="settings-item-label">System Audio</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="settings-select"
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              id="audio-system-select"
            >
              <option value="">Select device...</option>
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!vbCableFound && (
          <div className="audio-notice" id="vbcable-notice">
            <span>⚠️ VB-Cable not detected.</span>
            <button
              className="audio-notice-btn"
              onClick={() => setShowVBSetup(true)}
              id="btn-setup-vbcable"
            >
              Setup Guide
            </button>
          </div>
        )}

        {/* Microphone */}
        <div className="settings-item">
          <span className="settings-item-label">Microphone</span>
          <select
            className="settings-select"
            value={selectedMic}
            onChange={(e) => setSelectedMic(e.target.value)}
            id="audio-mic-select"
          >
            <option value="">Select device...</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Test Button & Level Meter */}
        <div className="settings-item">
          <span className="settings-item-label">Test Audio</span>
          <button
            className={`audio-test-btn ${isTestingMic ? 'active' : ''}`}
            onClick={testMicrophone}
            disabled={!selectedMic}
            id="btn-test-mic"
          >
            {isTestingMic ? '⏹ Stop' : '🎤 Test Mic'}
          </button>
        </div>

        {isTestingMic && (
          <div className="audio-level-container" id="audio-level-meter">
            <span className="settings-item-label">Level</span>
            <div className="audio-level-bar">
              <div
                className="audio-level-fill"
                style={{ width: `${Math.min(micLevel * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted">{Math.round(micLevel * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Inline VB-Cable Setup Guide ─────────────────────────

const VBCableSetupInline: React.FC<{
  onBack: () => void
  onComplete: () => void
}> = ({ onBack, onComplete }) => {
  return (
    <div className="vbcable-setup" id="vbcable-setup">
      <div className="settings-group">
        <div className="settings-group-title">
          <button className="audio-back-btn" onClick={onBack}>← Back</button>
          VB-Cable Setup
        </div>

        <div className="vbcable-steps">
          <div className="vbcable-step">
            <div className="vbcable-step-number">1</div>
            <div className="vbcable-step-content">
              <div className="vbcable-step-title">Download VB-Cable</div>
              <div className="vbcable-step-description">
                Download from <a
                  href="https://vb-audio.com/Cable/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent"
                  onClick={(e) => {
                    e.preventDefault()
                    // In Electron, open in default browser
                    window.open('https://vb-audio.com/Cable/', '_blank')
                  }}
                >
                  vb-audio.com/Cable
                </a>
              </div>
            </div>
          </div>

          <div className="vbcable-step">
            <div className="vbcable-step-number">2</div>
            <div className="vbcable-step-content">
              <div className="vbcable-step-title">Install Driver</div>
              <div className="vbcable-step-description">
                Extract the ZIP → Right-click <strong>VBCABLE_Setup_x64.exe</strong> → Run as Administrator
              </div>
            </div>
          </div>

          <div className="vbcable-step">
            <div className="vbcable-step-number">3</div>
            <div className="vbcable-step-content">
              <div className="vbcable-step-title">Restart Computer</div>
              <div className="vbcable-step-description">
                Restart your PC to activate the virtual audio driver.
              </div>
            </div>
          </div>

          <div className="vbcable-step">
            <div className="vbcable-step-number">4</div>
            <div className="vbcable-step-content">
              <div className="vbcable-step-title">Configure Sound</div>
              <div className="vbcable-step-description">
                Open <strong>Sound Settings</strong> → Set <strong>CABLE Input</strong> as the default playback device (or set it per-app for your meeting software).
              </div>
            </div>
          </div>

          <div className="vbcable-step">
            <div className="vbcable-step-number">5</div>
            <div className="vbcable-step-content">
              <div className="vbcable-step-title">Select in Invis</div>
              <div className="vbcable-step-description">
                After restart, come back here and select <strong>"CABLE Output"</strong> as System Audio device.
              </div>
            </div>
          </div>
        </div>

        <button
          className="audio-test-btn active"
          onClick={onComplete}
          style={{ marginTop: '12px', width: '100%' }}
          id="btn-vbcable-done"
        >
          ✓ I've installed VB-Cable — Refresh Devices
        </button>
      </div>
    </div>
  )
}
