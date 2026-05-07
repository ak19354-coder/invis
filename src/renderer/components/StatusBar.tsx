/**
 * Invis — Status Bar Component
 * 
 * Shows connection status, listening state, and active AI model.
 */

import React from 'react'
import { useAppStore } from '../store/useAppStore'

export const StatusBar: React.FC = () => {
  const { isConnected, isListening, aiConfig } = useAppStore()

  return (
    <footer className="status-bar" id="status-bar">
      <div className="status-left">
        <div className="status-item">
          <span className={`status-dot ${isListening ? 'listening' : 'disconnected'}`} />
          <span>{isListening ? 'Listening' : 'Idle'}</span>
        </div>
        <div className="status-item">
          <span>⚡</span>
          <span>{formatModelName(aiConfig.model)}</span>
        </div>
      </div>
      <div className="status-right">
        <div className="status-item">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>
    </footer>
  )
}

function formatModelName(model: string): string {
  const names: Record<string, string> = {
    'gpt-4o': 'GPT-4o',
    'claude-3.5-sonnet': 'Claude 3.5',
    'gemini-2.0': 'Gemini 2.0',
    'llama-3-local': 'Llama 3',
  }
  return names[model] || model
}
