# Invis — Product Requirements Document (PRD)

> **Version:** 1.0  
> **Date:** May 2026  
> **Status:** Draft  
> **Classification:** Confidential

---

## 1. Product Vision

**Invis** is a cross-platform (Windows + macOS) desktop application that provides real-time AI-powered assistance through an overlay window that is **invisible to all screen recording and screen-sharing software**. The user sees AI-generated responses, suggestions, and transcriptions live on their monitor, while any screen capture tool — Zoom, Teams, OBS, native OS recording — sees nothing.

### 1.1 Problem Statement

Professionals often need real-time information assistance during high-stakes scenarios (sales calls, presentations, live demos, support calls) but cannot reference notes or tools without it being visible to audiences during screen sharing.

### 1.2 Product Goal

Build a premium desktop application that:
- Renders an always-on-top overlay **excluded from OS-level screen capture**
- Listens to system/meeting audio in real-time and transcribes it
- Reads on-screen content via OCR
- Sends context (transcript + screen text) to LLMs for intelligent responses
- Returns answers via the invisible overlay within seconds
- Scales to 100K+ concurrent users via a cloud backend

---

## 2. Target Users & Personas

| Persona | Description | Key Need |
|---|---|---|
| **Sales Professional** | On daily Zoom/Teams calls with prospects | Real-time objection handling, competitor battle cards |
| **Technical Interviewer/Interviewee** | Conducts or takes live coding/behavioral interviews | Instant code suggestions, structured answer frameworks |
| **Customer Support Agent** | Handles live screen-share support sessions | Quick product knowledge lookup, troubleshooting steps |
| **Presenter / Speaker** | Delivers live webinars and demos | Talking points, audience Q&A assistance |
| **Student / Exam Taker** | Takes proctored online assessments | Real-time content lookup |

---

## 3. Core Features

### 3.1 Invisible Overlay Engine (P0 — Must Have)

The foundational feature. A transparent, always-on-top window that is **excluded from all screen capture**.

| Requirement | Details |
|---|---|
| **Windows** | Use `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` via Win32 API. Requires Windows 10 v2004+. Fallback to `WDA_MONITOR` (black rect) on older versions. |
| **macOS** | Set `NSWindow.sharingType = .none`. Excludes window from `CGWindowListCreateImage` and ScreenCaptureKit. |
| **Electron shortcut** | `win.setContentProtection(true)` wraps both OS APIs automatically. |
| **Overlay UX** | Draggable, resizable, adjustable opacity (10–90%), pin/unpin, always-on-top toggle. |
| **Hotkeys** | Global hotkey to show/hide overlay instantly (default: `Ctrl+Shift+Space` / `Cmd+Shift+Space`). |
| **Multi-monitor** | Overlay can be moved to any connected display. |

### 3.2 Real-Time Audio Capture & Transcription (P0)

| Requirement | Details |
|---|---|
| **System audio capture** | Virtual audio driver (VB-Cable on Windows, BlackHole on macOS) routes meeting output to app input. |
| **Microphone capture** | Simultaneously captures user's mic for full-duplex transcription. |
| **Transcription engine** | Streaming Whisper (local `faster-whisper` for privacy) or cloud ASR (Deepgram/AssemblyAI for speed). |
| **Latency target** | < 2 seconds from speech end to transcript display. |
| **Speaker diarization** | Distinguish "Them" vs "You" in transcript. |
| **Language support** | English (P0), Spanish, French, German, Hindi, Mandarin (P1). |

### 3.3 Screen Content Reading — OCR (P1)

| Requirement | Details |
|---|---|
| **Capture method** | Periodic screenshot of active window (every 2–5s). |
| **OCR engine** | Tesseract (local) or Cloud Vision API. |
| **Smart regions** | User-definable "watch zones" to OCR specific screen areas. |
| **Content awareness** | Detect question text, code blocks, form fields, chat messages. |

### 3.4 AI Response Generation (P0)

| Requirement | Details |
|---|---|
| **LLM backend** | OpenAI GPT-4o (default), Claude 3.5, Gemini 2.0, Llama 3 (local). |
| **Context assembly** | Merges transcript + OCR text + playbook context into a prompt. |
| **Streaming responses** | Token-by-token streaming to overlay for instant feedback. |
| **Response modes** | Auto / On-demand / Copilot |
| **Context window** | Rolling 8K token window of recent conversation + full playbook. |

### 3.5 Playbooks & Custom Knowledge (P1)

| Requirement | Details |
|---|---|
| **Upload formats** | PDF, DOCX, TXT, Markdown, URLs. |
| **Indexing** | RAG pipeline — chunk, embed, store in vector DB. |
| **Retrieval** | Top-K similarity search on each AI query for grounded responses. |
| **Templates** | Pre-built templates: Sales Call, Technical Interview, Support, Exam Prep. |
| **Team sharing** | Enterprise users can share playbooks across org. |

### 3.6 Meeting Intelligence (P2)

- Auto-generated meeting summary post-call
- Action item extraction
- Searchable meeting archive
- Calendar integration (Google Calendar, Outlook)

### 3.7 Settings & Configuration (P1)

- AI model selection, overlay appearance, audio device selection
- Hotkey customization, auto-launch, proxy/VPN config

---

## 4. User Flows

### 4.1 First-Time Setup
```
Install App → Create Account → Select Audio Devices →
Install Virtual Audio Driver (guided) → Choose AI Model →
Configure Hotkeys → Overlay Tutorial → Ready
```

### 4.2 Live Meeting Flow
```
User starts meeting → Presses hotkey to activate →
Overlay appears (invisible to screen share) →
Audio captured → Transcribed in real-time →
AI generates contextual suggestions →
User reads suggestions → Meeting ends → Summary saved
```

---

## 5. Success Metrics

| Metric | Target |
|---|---|
| Overlay invisibility rate | 100% on supported OS versions |
| Transcription latency | < 2 seconds |
| AI response latency | < 3 seconds (first token < 1s) |
| Cloud uptime | 99.9% |
| DAU/MAU ratio | > 40% |
| 30-day retention | > 60% |

---

## 6. Pricing Model

| Tier | Price | Features |
|---|---|---|
| **Free** | $0 | 5 AI responses/day, 30 min recording, basic overlay |
| **Pro** | $19/mo | Unlimited AI, unlimited recording, all models, playbooks |
| **Team** | $39/user/mo | Pro + shared playbooks, admin dashboard, SSO |
| **Enterprise** | Custom | Team + on-prem LLM, custom integrations, SLA |

---

## 7. Competitive Analysis

| Feature | Invis | Cluely | Otter.ai | Fireflies |
|---|---|---|---|---|
| Invisible overlay | ✅ | ✅ | ❌ | ❌ |
| Real-time transcription | ✅ | ✅ | ✅ | ✅ |
| AI response generation | ✅ | ✅ | Limited | Limited |
| Custom playbooks/RAG | ✅ | ✅ | ❌ | ❌ |
| Local LLM option | ✅ | ❌ | ❌ | ❌ |
| On-prem deployment | ✅ (Enterprise) | ❌ | ❌ | ❌ |

---

## 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| OS updates patch capture exclusion APIs | High | Monitor OS changelogs; maintain fallback rendering (DirectX/Metal). |
| Ethical/legal concerns | High | Clear ToS; enterprise positioning; compliance docs. |
| High AI latency | Medium | Edge caching; streaming tokens; local model fallback. |
| Virtual audio driver install friction | Medium | One-click installer; bundled driver; onboarding wizard. |
| Proctoring software detection | Medium | Process name obfuscation; optional stealth mode (P2). |

---

## 9. Release Roadmap

| Phase | Timeline | Deliverables |
|---|---|---|
| **Alpha** | Weeks 1–6 | Invisible overlay + audio capture + basic AI (Windows) |
| **Beta** | Weeks 7–12 | macOS support, OCR, playbooks, streaming responses |
| **v1.0** | Weeks 13–16 | Polish, billing, onboarding, public launch |
| **v1.1** | Weeks 17–20 | Meeting intelligence, team features, calendar |
| **v2.0** | Weeks 21–28 | Local LLM, on-prem enterprise, mobile companion |
