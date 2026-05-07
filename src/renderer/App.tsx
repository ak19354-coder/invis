/**
 * Invis — Main App Component
 * 
 * Root component that assembles the invisible overlay:
 * Header (draggable) → Content Panel (tabbed) → Status Bar
 */

import React, { useEffect } from 'react'
import { Header, TranscriptPanel, AIPanel, SettingsPanel, StatusBar } from './components'
import { useAppStore } from './store/useAppStore'
import { TranscriptionManager } from './audio/TranscriptionManager'

const App: React.FC = () => {
  const { activeTab, setActiveTab, setConnected } = useAppStore()

  // Listen for navigation events from main process (via hotkeys / tray)
  useEffect(() => {
    const cleanup = window.invisAPI?.onNavigate((tab: string) => {
      if (tab === 'transcript' || tab === 'ai' || tab === 'settings') {
        setActiveTab(tab)
      }
    })
    return cleanup
  }, [setActiveTab])

  // Simulate connection status (will be replaced with real WebSocket)
  useEffect(() => {
    setConnected(true)
  }, [setConnected])

  const { isListening, audioConfig, setAudioLevels, addTranscriptSegment, setListening } = useAppStore()

  // Transcription Pipeline Lifecycle
  useEffect(() => {
    let manager: TranscriptionManager | null = null

    if (isListening) {
      // Create and start the transcription pipeline
      manager = new TranscriptionManager({
        systemDeviceId: audioConfig.systemDeviceId,
        micDeviceId: audioConfig.micDeviceId,
        vadSensitivity: 0.5,
        onTranscript: (segment) => {
          addTranscriptSegment(segment)
          // Optional: automatically send to AI if it's a question or important
        },
        onAudioLevel: (levels) => {
          setAudioLevels(levels)
        },
        onError: (err) => {
          console.error('[App] Transcription pipeline error:', err)
          setListening(false)
        }
      })

      manager.start().catch(err => {
        console.error('[App] Failed to start transcription:', err)
        setListening(false)
      })
      window.invisAPI?.startTranscription()
    } else {
      window.invisAPI?.stopTranscription()
    }

    return () => {
      if (manager) {
        manager.stop()
      }
      window.invisAPI?.stopTranscription()
    }
  }, [isListening, audioConfig.systemDeviceId, audioConfig.micDeviceId])

  // Render the active tab content
  const renderContent = () => {
    switch (activeTab) {
      case 'transcript':
        return <TranscriptPanel />
      case 'ai':
        return <AIPanel />
      case 'settings':
        return <SettingsPanel />
      default:
        return <AIPanel />
    }
  }

  return (
    <div className="overlay-container" id="overlay-root">
      <Header />
      <main className="content-panel" id="content-panel">
        {renderContent()}
      </main>
      <StatusBar />
    </div>
  )
}

export default App
