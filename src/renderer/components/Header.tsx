/**
 * Invis — Header Component
 * 
 * Draggable header bar with app logo, tab navigation, and window controls.
 * Uses -webkit-app-region: drag for Electron window dragging.
 */

import React from 'react'
import { useAppStore } from '../store/useAppStore'
import type { OverlayTab } from '../../shared/types'

interface Tab {
  id: OverlayTab
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'transcript', label: 'Transcript', icon: '📋' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, overlayConfig, setOverlayConfig, isListening, setListening } = useAppStore()

  const handleMinimize = () => {
    window.invisAPI?.minimizeApp()
  }

  const handleClose = () => {
    window.invisAPI?.minimizeApp() // Minimize, don't quit
  }

  const handleLockToggle = () => {
    const newLocked = !overlayConfig.isLocked
    setOverlayConfig({ isLocked: newLocked })
    window.invisAPI?.setLocked(newLocked)
  }

  return (
    <header className="overlay-header" id="overlay-header">
      {/* Left: App Logo */}
      <div className="header-left">
        <div className="app-logo">
          <div className="app-logo-icon">S</div>
          <span className="app-logo-text">Stealth</span>
        </div>
        
        <button
          className={`control-button ${isListening ? 'active text-accent' : ''}`}
          onClick={() => setListening(!isListening)}
          title={isListening ? 'Stop Listening' : 'Start Listening'}
          id="btn-toggle-listen"
          style={{ width: 'auto', padding: '0 8px', marginLeft: '8px' }}
        >
          {isListening ? '⏹ Listening...' : '▶ Listen'}
        </button>
      </div>

      {/* Center: Tab Navigation */}
      <div className="header-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Right: Window Controls */}
      <div className="header-right">
        <button
          className={`control-button ${overlayConfig.isLocked ? 'locked' : ''}`}
          onClick={handleLockToggle}
          title={overlayConfig.isLocked ? 'Unlock overlay (click-through active)' : 'Lock overlay (enable click-through)'}
          id="btn-lock"
        >
          {overlayConfig.isLocked ? '🔒' : '🔓'}
        </button>
        <button
          className="control-button"
          onClick={handleMinimize}
          title="Minimize (Hide Overlay) [Shortcut: Ctrl+Shift+Space]"
          id="btn-minimize"
        >
          ─
        </button>
        <button
          className="control-button danger"
          onClick={handleClose}
          title="Close overlay"
          id="btn-close"
        >
          ✕
        </button>
      </div>
    </header>
  )
}

