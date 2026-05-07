/**
 * Invis — Settings Panel
 * 
 * Overlay configuration: opacity, AI model, always-on-top, theme.
 * Audio device configuration with AudioSetup sub-component.
 */

import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { AudioSetup } from './AudioSetup'
import type { AIModel, ResponseMode } from '../../shared/types'

export const SettingsPanel: React.FC = () => {
  const { overlayConfig, setOverlayConfig, aiConfig, setAIConfig } = useAppStore()
  const [activeSection, setActiveSection] = useState<'general' | 'audio' | 'profile'>('general')

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const opacity = parseFloat(e.target.value)
    setOverlayConfig({ opacity })
    window.invisAPI?.setOpacity(opacity)
  }

  const handleAlwaysOnTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const alwaysOnTop = e.target.checked
    setOverlayConfig({ alwaysOnTop })
    window.invisAPI?.setAlwaysOnTop(alwaysOnTop)
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAIConfig({ model: e.target.value as AIModel })
  }

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAIConfig({ responseMode: e.target.value as ResponseMode })
  }

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOverlayConfig({ fontSize: parseInt(e.target.value) })
  }

  return (
    <div className="settings-container" id="settings-panel">
      {/* Section Tabs */}
      <div className="settings-section-tabs">
        <button
          className={`settings-section-tab ${activeSection === 'general' ? 'active' : ''}`}
          onClick={() => setActiveSection('general')}
          id="settings-tab-general"
        >
          ⚙️ General
        </button>
        <button
          className={`settings-section-tab ${activeSection === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveSection('audio')}
          id="settings-tab-audio"
        >
          🎙️ Audio
        </button>
        <button
          className={`settings-section-tab ${activeSection === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveSection('profile')}
          id="settings-tab-profile"
        >
          📄 Profile
        </button>
      </div>

      {activeSection === 'audio' && <AudioSetup />}
      
      {activeSection === 'profile' && (
        <div className="settings-group" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="settings-group-title">Interview Context</div>
          <div className="settings-item-description" style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
            Provide your details so the AI can tailor its answers to your exact situation.
          </div>

          <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="settings-item-label" style={{ marginBottom: '8px' }}>Target Role / Designation (e.g. Student, Senior Dev)</span>
            <input
              type="text"
              className="ai-input"
              style={{ width: '100%' }}
              placeholder="e.g. Senior Frontend Engineer"
              value={aiConfig.interviewRole}
              onChange={(e) => setAIConfig({ interviewRole: e.target.value })}
            />
          </div>

          <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="settings-item-label" style={{ marginBottom: '8px' }}>Job Description (JD)</span>
            <textarea
              className="ai-input"
              style={{ width: '100%', minHeight: '100px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85em' }}
              placeholder="Paste the job description here..."
              value={aiConfig.jobDescription}
              onChange={(e) => setAIConfig({ jobDescription: e.target.value })}
            />
          </div>

          <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="settings-item-label" style={{ marginBottom: '8px' }}>Resume Text</span>
            <textarea
              className="ai-input"
              style={{ width: '100%', minHeight: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85em' }}
              placeholder="Paste your resume here..."
              value={aiConfig.resumeText}
              onChange={(e) => setAIConfig({ resumeText: e.target.value })}
            />
          </div>

          <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="settings-item-label" style={{ marginBottom: '8px' }}>Expected / Prepared Questions</span>
            <textarea
              className="ai-input"
              style={{ width: '100%', minHeight: '100px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85em' }}
              placeholder="Q: Tell me about yourself.&#10;A: I am a..."
              value={aiConfig.expectedQuestions}
              onChange={(e) => setAIConfig({ expectedQuestions: e.target.value })}
            />
          </div>
        </div>
      )}

      {activeSection === 'general' && (
        <>
          {/* Overlay Settings */}
          <div className="settings-group">
            <div className="settings-group-title">Overlay</div>
            
            <div className="settings-item">
              <span className="settings-item-label">Opacity</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  className="settings-slider"
                  min="0.1"
                  max="0.95"
                  step="0.05"
                  value={overlayConfig.opacity}
                  onChange={handleOpacityChange}
                  id="settings-opacity"
                />
                <span className="settings-item-value text-xs">
                  {Math.round(overlayConfig.opacity * 100)}%
                </span>
              </div>
            </div>

            <div className="settings-item">
              <span className="settings-item-label">Always on Top</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={overlayConfig.alwaysOnTop}
                  onChange={handleAlwaysOnTopChange}
                  id="settings-always-on-top"
                />
                <span className="toggle-track" />
              </label>
            </div>

            <div className="settings-item">
              <span className="settings-item-label">Font Size</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  className="settings-slider"
                  min="12"
                  max="22"
                  step="1"
                  value={overlayConfig.fontSize}
                  onChange={handleFontSizeChange}
                  id="settings-font-size"
                />
                <span className="settings-item-value text-xs">
                  {overlayConfig.fontSize}px
                </span>
              </div>
            </div>
          </div>

          {/* AI Settings */}
          <div className="settings-group">
            <div className="settings-group-title">AI Model</div>

            <div className="settings-item">
              <span className="settings-item-label">Model</span>
              <select
                className="settings-select"
                value={aiConfig.model}
                onChange={handleModelChange}
                id="settings-model"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                <option value="gemini-2.0">Gemini 2.0</option>
                <option value="llama-3-local">Llama 3 (Local)</option>
              </select>
            </div>

            <div className="settings-item">
              <span className="settings-item-label">Response Mode</span>
              <select
                className="settings-select"
                value={aiConfig.responseMode}
                onChange={handleModeChange}
                id="settings-response-mode"
              >
                <option value="auto">Auto (Live)</option>
                <option value="on-demand">On-Demand</option>
                <option value="copilot">Copilot (Bullets)</option>
              </select>
            </div>

            <div className="settings-item">
              <span className="settings-item-label">Streaming</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={aiConfig.streamingEnabled}
                  onChange={(e) => setAIConfig({ streamingEnabled: e.target.checked })}
                  id="settings-streaming"
                />
                <span className="toggle-track" />
              </label>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="settings-group">
            <div className="settings-group-title">Shortcuts</div>

            <div className="settings-item">
              <span className="settings-item-label">Toggle Overlay</span>
              <span className="settings-item-value font-mono text-xs">Ctrl+Shift+Space</span>
            </div>

            <div className="settings-item">
              <span className="settings-item-label">Ask AI</span>
              <span className="settings-item-value font-mono text-xs">Ctrl+Shift+A</span>
            </div>

            <div className="settings-item">
              <span className="settings-item-label">Quick Hide</span>
              <span className="settings-item-value font-mono text-xs">Escape</span>
            </div>
          </div>

          {/* About */}
          <div className="settings-group">
            <div className="settings-group-title">About</div>
            <div className="settings-item">
              <span className="settings-item-label">Version</span>
              <span className="settings-item-value text-xs">1.0.0-alpha</span>
            </div>
            <div className="settings-item">
              <span className="settings-item-label">Capture Protection</span>
              <span className="settings-item-value text-xs text-accent">● Active</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
