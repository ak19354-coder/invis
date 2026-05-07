# Invis — Technical Requirements Document

> **Version:** 1.0 | **Date:** May 2026

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESKTOP CLIENT (Electron)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Invisible │ │  Audio   │ │   OCR    │ │   AI Response     │  │
│  │ Overlay   │ │ Capture  │ │  Engine  │ │   Renderer        │  │
│  │ Engine    │ │ Module   │ │          │ │   (Streaming)     │  │
│  └─────┬────┘ └────┬─────┘ └────┬─────┘ └────────┬──────────┘  │
│        │           │            │                  │              │
│  ┌─────┴───────────┴────────────┴──────────────────┴──────────┐  │
│  │              Context Manager (Event Bus)                    │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │ WebSocket / HTTPS                   │
└────────────────────────────┼────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │        API GATEWAY          │
              │    (Kong / AWS API GW)      │
              └──────┬──────────────┬───────┘
                     │              │
        ┌────────────┴───┐  ┌──────┴────────────┐
        │  Auth Service  │  │  AI Orchestrator   │
        │  (Supabase)    │  │  Service           │
        └────────────────┘  └──────┬─────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────┴────┐ ┌──────┴───┐ ┌───────┴──────┐
              │ OpenAI   │ │ Claude   │ │ Local Llama  │
              │ GPT-4o   │ │ 3.5 API  │ │ (on-device)  │
              └──────────┘ └──────────┘ └──────────────┘
```

---

## 2. Technology Stack

### 2.1 Desktop Client

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | **Electron 33+** | Mature ecosystem; built-in `setContentProtection(true)` API; large community. Tauri (Rust) is a future migration option for reduced binary size. |
| **Frontend** | React 19 + TypeScript | Component-based UI for overlay; fast rendering with concurrent mode. |
| **State Management** | Zustand | Lightweight, minimal boilerplate, perfect for real-time state updates. |
| **Styling** | Vanilla CSS + CSS Variables | Maximum control over overlay transparency, glassmorphism effects. |
| **Build Tool** | Vite + electron-builder | Fast HMR in dev; reliable cross-platform builds. |
| **IPC** | Electron IPC (Main ↔ Renderer) | Secure communication between main process and overlay renderer. |

### 2.2 Audio Pipeline

| Component | Technology | Details |
|---|---|---|
| **System audio routing** | VB-Cable (Win) / BlackHole (macOS) | Virtual audio driver; routes meeting output to app input. Bundled installer. |
| **Audio capture** | Web Audio API + `navigator.mediaDevices` | Captures from virtual device + microphone simultaneously. |
| **Voice Activity Detection** | `@ricky0123/vad-web` (Silero VAD) | Detects speech boundaries to segment audio for transcription. |
| **Local transcription** | `faster-whisper` (Python sidecar) | Runs Whisper `small.en` model locally; ~1.5s latency on modern GPU. |
| **Cloud transcription** | Deepgram Streaming API | < 300ms latency; WebSocket-based; speaker diarization built-in. |
| **Audio format** | PCM 16-bit, 16kHz mono | Optimal for Whisper; minimal bandwidth. |

### 2.3 OCR Pipeline

| Component | Technology | Details |
|---|---|---|
| **Screen capture** | Electron `desktopCapturer` | Captures specific window or region at configurable intervals (2–5s). |
| **Local OCR** | Tesseract.js v5 (WASM) | Runs entirely in-process; no external binary. ~200ms per frame. |
| **Cloud OCR** | Google Cloud Vision API | Higher accuracy; supports handwriting; used as upgrade option. |
| **Text diffing** | Custom diff engine | Only sends *new/changed* text to AI to reduce token usage. |

### 2.4 Backend Services

| Service | Technology | Details |
|---|---|---|
| **API Gateway** | AWS API Gateway + CloudFront | Rate limiting, API key management, edge caching. |
| **Auth** | Supabase Auth (JWT) | Email/password, Google OAuth, magic links. Row-level security. |
| **AI Orchestrator** | Node.js 22 (Fastify) | Routes AI requests to selected provider; manages streaming. |
| **Vector DB (RAG)** | Pinecone / pgvector (Supabase) | Stores playbook embeddings; cosine similarity search. |
| **Primary DB** | PostgreSQL (Supabase) | Users, subscriptions, meetings, playbooks metadata. |
| **Object Storage** | AWS S3 / Supabase Storage | Uploaded documents, meeting recordings, playbook files. |
| **Real-time Comms** | WebSocket (ws library) | Streaming AI tokens + live transcript to client. |
| **Job Queue** | BullMQ + Redis | Async document processing, embedding generation, summary generation. |
| **Billing** | Stripe | Subscription management, usage-based metering, webhooks. |

### 2.5 Infrastructure & DevOps

| Component | Technology |
|---|---|
| **Cloud Provider** | AWS (primary) |
| **Container Orchestration** | ECS Fargate (serverless containers) |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Datadog / Sentry |
| **Logging** | CloudWatch + structured JSON logs |
| **CDN** | CloudFront (app updates, static assets) |
| **Auto-updates** | `electron-updater` (S3 backend) |
| **Feature Flags** | LaunchDarkly / Unleash |

---

## 3. Invisible Overlay — Deep Technical Spec

### 3.1 Windows Implementation

```javascript
// main.js (Electron Main Process)
const { BrowserWindow } = require('electron');

const overlayWindow = new BrowserWindow({
  width: 400,
  height: 600,
  transparent: true,           // Transparent background
  frame: false,                // No title bar
  alwaysOnTop: true,           // Always visible
  skipTaskbar: true,           // Hidden from taskbar
  resizable: true,
  hasShadow: false,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  }
});

// CRITICAL: This makes the window invisible to screen capture
overlayWindow.setContentProtection(true);

// Set window to be click-through when not focused (optional)
overlayWindow.setIgnoreMouseEvents(false);

// Prevent window from appearing in Alt+Tab (Windows)
// Requires native module or ffi to set WS_EX_TOOLWINDOW
```

### 3.2 macOS Implementation

Electron's `setContentProtection(true)` automatically sets `NSWindow.sharingType = .none` on macOS. Additional native configuration via `electron-native-addon`:

```swift
// native-addon/src/mac_overlay.swift
import AppKit

func configureOverlay(window: NSWindow) {
    window.sharingType = .none           // Invisible to capture
    window.level = .floating             // Always on top
    window.isOpaque = false              // Transparent
    window.backgroundColor = .clear
    window.collectionBehavior = [
        .canJoinAllSpaces,               // Visible on all desktops
        .stationary,                     // Doesn't move with spaces
        .fullScreenAuxiliary             // Shows during fullscreen apps
    ]
}
```

### 3.3 Overlay Renderer Architecture

```
┌─ Overlay Window (BrowserWindow) ────────────────────┐
│                                                       │
│  ┌─ Header Bar (draggable) ───────────────────────┐  │
│  │  [≡ Mode] [📋 Transcript] [🤖 AI]  [⚙️] [✕]   │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Content Panel (scrollable) ───────────────────┐  │
│  │                                                 │  │
│  │  Live transcript or AI response                 │  │
│  │  rendered with streaming markdown               │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ Status Bar ───────────────────────────────────┐  │
│  │  🎙️ Listening • ⚡ GPT-4o • 📡 Connected      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 3.4 Anti-Detection Layers

| Layer | Technique | Details |
|---|---|---|
| **L1: OS API** | `setContentProtection(true)` | Primary defense. Window excluded from all standard capture APIs. |
| **L2: Process hiding** | Rename executable, randomize process name | Prevents detection by process-scanning proctoring software. |
| **L3: Window metadata** | No window title, `skipTaskbar: true` | Window doesn't appear in task managers or window lists. |
| **L4: Network stealth** | WebSocket over WSS (443) | Traffic indistinguishable from normal HTTPS. |
| **L5: Fallback rendering** | DirectX overlay (Win) / Metal layer (macOS) | If OS API is bypassed, render directly to GPU layer that bypasses DWM capture. |

---

## 4. Real-Time Audio Pipeline — Detailed Flow

```
Microphone ──┐
             ├──→ [Audio Mixer] ──→ [VAD] ──→ [Audio Buffer]
System Audio ┘                         │              │
  (via VB-Cable)                       │       (on speech end)
                                       │              │
                                       ▼              ▼
                                  [Silence     [Whisper / Deepgram]
                                   Detection]        │
                                                     ▼
                                              [Transcript Segment]
                                                     │
                                          ┌──────────┴──────────┐
                                          ▼                     ▼
                                   [Overlay Display]    [Context Manager]
                                                              │
                                                              ▼
                                                        [AI Prompt Builder]
                                                              │
                                                              ▼
                                                        [LLM API Call]
                                                              │
                                                              ▼
                                                   [Streaming Response → Overlay]
```

### 4.1 Audio Capture Config

```javascript
// renderer/audio-capture.js
const systemStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId: { exact: virtualCableDeviceId },
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  }
});

const micStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId: { exact: selectedMicId },
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  }
});
```

---

## 5. AI Orchestrator — Backend Design

### 5.1 API Endpoints

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh

POST   /api/v1/ai/complete          # Standard completion
WS     /api/v1/ai/stream            # Streaming completion (WebSocket)

POST   /api/v1/playbooks            # Create playbook
GET    /api/v1/playbooks            # List playbooks
POST   /api/v1/playbooks/:id/upload # Upload document to playbook
DELETE /api/v1/playbooks/:id

GET    /api/v1/meetings             # List meetings
GET    /api/v1/meetings/:id         # Get meeting details + transcript
POST   /api/v1/meetings/:id/summarize

GET    /api/v1/user/usage           # Usage stats for billing
POST   /api/v1/user/settings        # Update settings

POST   /api/v1/billing/checkout     # Stripe checkout session
POST   /api/v1/billing/portal       # Stripe customer portal
POST   /api/v1/billing/webhook      # Stripe webhook handler
```

### 5.2 AI Context Assembly

```javascript
// ai-orchestrator/context-builder.js
function buildPrompt({ transcript, ocrText, playbook, mode, userPrefs }) {
  const systemPrompt = `You are a real-time assistant. Provide concise, 
  actionable responses. Format: bullet points. Max 150 words.
  Mode: ${mode} // "auto" | "on-demand" | "copilot"
  User preferences: ${JSON.stringify(userPrefs)}`;

  const playbookContext = playbook 
    ? `\n\n--- REFERENCE MATERIAL ---\n${playbook.relevantChunks.join('\n')}` 
    : '';

  const conversationContext = `
--- LIVE TRANSCRIPT (last 2 minutes) ---
${transcript}

--- SCREEN CONTENT ---
${ocrText}
${playbookContext}`;

  return { systemPrompt, conversationContext };
}
```

---

## 6. Scalability Architecture

### 6.1 Horizontal Scaling

```
                    ┌──────────────┐
                    │  CloudFront  │
                    │    (CDN)     │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │ API Gateway  │
                    │ (rate limit) │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴──┐  ┌─────┴──┐  ┌─────┴──┐
        │ AI Svc │  │ AI Svc │  │ AI Svc │  ← Auto-scaled ECS tasks
        │  (1)   │  │  (2)   │  │  (N)   │
        └────────┘  └────────┘  └────────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────┴───────┐
                    │   Redis      │  ← Session cache + rate limiting
                    │  (Cluster)   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  PostgreSQL  │  ← Primary DB (read replicas)
                    │  (Supabase)  │
                    └──────────────┘
```

### 6.2 Scaling Targets

| Metric | Target | Strategy |
|---|---|---|
| Concurrent WebSocket connections | 100K | Horizontally scaled WS servers with sticky sessions via Redis pub/sub. |
| AI requests/second | 10K | Multiple LLM provider load balancing; request queuing with BullMQ. |
| Transcript storage | 10TB/year | S3 tiered storage (hot → warm → cold). |
| Vector search latency | < 50ms p99 | Pinecone serverless with regional replicas. |
| API response time | < 100ms p95 | Edge caching; connection pooling; prepared statements. |

### 6.3 Data Model (PostgreSQL)

```sql
-- Core tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',  -- free, pro, team, enterprise
  stripe_customer_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT,
  transcript JSONB,       -- [{speaker, text, timestamp}]
  summary TEXT,
  action_items JSONB,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT,     -- sales, interview, support, custom
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playbook_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id),
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- pgvector
  source_file TEXT,
  chunk_index INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type TEXT,        -- ai_request, transcription_minute, ocr_scan
  tokens_used INT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Security Requirements

| Area | Requirement |
|---|---|
| **Auth** | JWT with RS256 signing; refresh token rotation; 15-min access token expiry. |
| **API** | Rate limiting (100 req/min free, 1000 req/min pro); API key + JWT dual auth. |
| **Data encryption** | TLS 1.3 in transit; AES-256 at rest (S3, DB). |
| **Client security** | Electron context isolation; no `nodeIntegration`; CSP headers. |
| **Playbook data** | User-scoped RLS in Supabase; team-scoped sharing with RBAC. |
| **Compliance** | GDPR data deletion API; SOC 2 readiness; privacy-by-design. |
| **Audit logging** | All admin actions logged; billing events immutable. |

---

## 8. Performance Budgets

| Metric | Budget |
|---|---|
| Electron app cold start | < 3 seconds |
| Overlay render FPS | 60 FPS minimum |
| Audio capture → transcript display | < 2 seconds |
| Transcript → AI response (first token) | < 1.5 seconds |
| AI response (full) | < 5 seconds |
| OCR scan → text extraction | < 500ms |
| App memory usage (idle) | < 200MB |
| App memory usage (active) | < 500MB |
| Binary size (installer) | < 150MB |
| Auto-update download | < 30MB (delta updates) |

---

## 9. Testing Strategy

| Type | Tool | Coverage Target |
|---|---|---|
| Unit tests | Jest + React Testing Library | 80% coverage |
| Integration tests | Playwright (Electron) | All user flows |
| E2E (overlay invisibility) | Custom screen capture test harness | Verify overlay excluded from capture on Win/macOS |
| Load testing | k6 / Artillery | 10K concurrent WS connections |
| Security testing | OWASP ZAP + npm audit | Zero critical/high vulnerabilities |
| Performance testing | Lighthouse + custom benchmarks | All performance budgets met |
