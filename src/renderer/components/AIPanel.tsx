/**
 * Invis — AI Panel
 * 
 * Shows AI responses with streaming support and an input bar
 * for on-demand queries.
 */

import React, { useEffect, useRef, useState } from 'react'
import { aiClient } from '../api/WebSocketClient'
import { useAppStore } from '../store/useAppStore'

export const AIPanel: React.FC = () => {
  const {
    aiResponses,
    currentStreamingResponse,
    isAILoading,
    aiInput,
    setAIInput,
    setAILoading,
    appendToCurrentStream,
    finalizeCurrentStream,
    addAIResponse,
    transcript,
  } = useAppStore()
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Ensure WebSocket is connected
  useEffect(() => {
    aiClient.connect()
    return () => aiClient.disconnect()
  }, [])

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [aiResponses, currentStreamingResponse])

  // Listen for hotkey to focus input
  useEffect(() => {
    const cleanup = window.invisAPI?.onHotkeyAskAI(() => {
      inputRef.current?.focus()
    })
    return cleanup
  }, [])

  const handleSend = () => {
    const prompt = aiInput.trim()
    if (!prompt || isAILoading) return

    setAIInput('')
    setAILoading(true)

    // Build context from transcript
    const context = transcript.slice(-10).map(t => `${t.speaker}: ${t.text}`).join('\n')

    generateResponse(prompt, context, aiConfig.interviewRole, aiConfig.resumeText, aiConfig.jobDescription, aiConfig.expectedQuestions)
  }

  const generateResponse = (prompt: string, context: string, role: string, resume: string, jd: string, questions: string) => {
    aiClient.streamCompletion(prompt, context, role, resume, jd, questions, (chunk, done, error) => {
      if (error) {
        appendToCurrentStream(`[Error: ${error}]`)
        finalizeCurrentStream()
        setAILoading(false)
        return
      }

      if (done) {
        finalizeCurrentStream()
        setAILoading(false)
      } else {
        appendToCurrentStream(chunk)
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasContent = aiResponses.length > 0 || currentStreamingResponse

  return (
    <div className="ai-container" id="ai-panel">
      {/* Responses area */}
      <div
        className="content-panel"
        ref={scrollRef}
        style={{ padding: 0, flex: 1, minHeight: 0 }}
      >
        {!hasContent ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-title">AI Assistant Ready</div>
            <div className="empty-state-description">
              Ask a question or press <span className="text-accent">Ctrl+Shift+A</span> for quick access.<br/>
              <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>To minimize/hide the app, press <strong>Ctrl+Shift+Space</strong> or the ─ button.</span>
            </div>
          </div>
        ) : (
          <>
            {aiResponses.map((response) => (
              <div key={response.id} className="ai-response">
                <div className="ai-response-label">
                  <span>🤖</span>
                  <span>AI • {response.model}</span>
                </div>
                <div className="ai-response-text">{response.text}</div>
              </div>
            ))}

            {currentStreamingResponse && (
              <div className="ai-response">
                <div className="ai-response-label">
                  <span>🤖</span>
                  <span>AI • streaming...</span>
                </div>
                <div className="ai-response-text">
                  {currentStreamingResponse}
                  <span className="ai-typing-indicator">
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="ai-input-bar" id="ai-input-bar">
        <input
          ref={inputRef}
          type="text"
          className="ai-input"
          placeholder="Ask anything... (Enter to send)"
          value={aiInput}
          onChange={(e) => setAIInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAILoading}
          id="ai-input"
        />
        <button
          className="ai-send-button"
          onClick={handleSend}
          disabled={!aiInput.trim() || isAILoading}
          title="Send (Enter)"
          id="ai-send-btn"
        >
          ▶
        </button>
      </div>
    </div>
  )
}

// ─── Demo Responses ──────────────────────────────────────

function getDemoResponse(prompt: string): string {
  const lower = prompt.toLowerCase()
  
  if (lower.includes('hello') || lower.includes('hi')) {
    return '👋 Hello! I\'m your Invis AI. I\'m ready to help you with:\n\n• Real-time meeting assistance\n• Answer suggestions\n• Code explanations\n• General Q&A\n\nJust ask me anything!'
  }
  
  if (lower.includes('test')) {
    return '✅ Invis is working correctly!\n\n• Overlay: Active & invisible to capture\n• AI Engine: Connected\n• Audio: Ready to capture\n\nThis window cannot be seen by screen recording software.'
  }

  return `Here's my analysis of your question:\n\n**"${prompt}"**\n\n• This is a demo response — connect to an AI backend for real answers\n• The overlay you're reading is invisible to screen capture\n• Press Ctrl+Shift+Space to toggle visibility\n\n💡 Tip: Upload playbooks for context-aware responses.`
}
