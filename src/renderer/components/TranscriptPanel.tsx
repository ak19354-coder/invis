/**
 * Invis — Transcript Panel
 * 
 * Displays real-time transcript segments with speaker labels.
 * Auto-scrolls to latest segment with scroll-lock capability.
 */

import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

export const TranscriptPanel: React.FC = () => {
  const { transcript } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // Auto-scroll to bottom on new segments
  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript])

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50
  }

  if (transcript.length === 0) {
    return (
      <div className="empty-state" id="transcript-empty">
        <div className="empty-state-icon">🎙️</div>
        <div className="empty-state-title">No transcript yet</div>
        <div className="empty-state-description">
          Start a meeting or conversation. Audio will be transcribed here in real-time.
        </div>
      </div>
    )
  }

  return (
    <div
      className="transcript-container"
      ref={scrollRef}
      onScroll={handleScroll}
      id="transcript-panel"
    >
      {transcript.map((segment) => (
        <div
          key={segment.id}
          className={`transcript-segment speaker-${segment.speaker}`}
        >
          <div className={`transcript-speaker ${segment.speaker}`}>
            {segment.speaker === 'you' ? '🟣 You' : segment.speaker === 'them' ? '🔵 Them' : '⚪ Unknown'}
          </div>
          <div className="transcript-text">{segment.text}</div>
        </div>
      ))}
    </div>
  )
}
