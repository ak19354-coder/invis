# Invis — Complete Task List (Sprint-Level Breakdown)

> **Version:** 1.0 | **Date:** May 2026  
> **Methodology:** 2-week sprints | **Total Duration:** ~28 weeks (7 months)

---

## Phase 1: Foundation (Weeks 1–4)

### Sprint 1 — Project Setup & Invisible Overlay (Week 1–2)

#### 1.1 Project Scaffolding
- [ ] Initialize Electron + React + TypeScript + Vite project
- [ ] Configure `electron-builder` for Win/macOS builds
- [ ] Set up ESLint, Prettier, Husky pre-commit hooks
- [ ] Create project folder structure:
  ```
  src/
    main/          # Electron main process
    renderer/      # React overlay UI
    preload/       # Secure preload scripts
    shared/        # Shared types & constants
    native/        # Native addon code (C++/Swift)
  ```
- [ ] Set up GitHub repo, branch protection rules, PR templates
- [ ] Configure GitHub Actions CI (lint, test, build)

#### 1.2 Invisible Overlay — Core Engine
- [ ] Create `BrowserWindow` with transparent, frameless, always-on-top config
- [ ] Implement `win.setContentProtection(true)` for capture exclusion
- [ ] Test overlay invisibility with Zoom, Teams, OBS, native screen recorder
- [ ] Implement `WS_EX_TOOLWINDOW` via `ffi-napi` for Windows (hide from Alt+Tab)
- [ ] Implement macOS `NSWindow.collectionBehavior` for all-spaces visibility
- [ ] Build draggable header bar with custom drag region (`-webkit-app-region: drag`)
- [ ] Implement resizable overlay with min/max size constraints
- [ ] Add opacity slider (10%–90%) with CSS `opacity` + backdrop-filter
- [ ] Implement global hotkey (show/hide) using `globalShortcut` module
- [ ] Implement multi-monitor support (detect displays, allow positioning)
- [ ] Write integration test: capture screen → verify overlay NOT in capture

#### 1.3 Overlay UI Shell
- [ ] Design overlay component layout (Header, Content Panel, Status Bar)
- [ ] Implement dark theme with glassmorphism effects
- [ ] Add mode tabs: Transcript / AI Response / Settings
- [ ] Build scrollable content panel with auto-scroll and scroll-lock
- [ ] Add status bar with connection indicator, model name, mic status
- [ ] Implement smooth entry/exit animations (fade + slide)

---

### Sprint 2 — Audio Capture Pipeline (Week 3–4)

#### 2.1 Virtual Audio Driver Integration
- [ ] Research and select virtual audio driver per platform
- [ ] Create guided installer flow for VB-Cable (Windows)
- [ ] Create guided installer flow for BlackHole (macOS)
- [ ] Build audio device enumeration UI (list input/output devices)
- [ ] Implement audio device selection and persistence (electron-store)
- [ ] Add "Test Audio" button that plays/records a sample

#### 2.2 Audio Capture Module
- [ ] Implement system audio capture via `navigator.mediaDevices.getUserMedia`
- [ ] Implement microphone capture with separate stream
- [ ] Build audio mixer (merge system + mic into dual-channel stream)
- [ ] Implement Web Audio API `AudioWorklet` for real-time PCM extraction
- [ ] Convert audio to PCM 16-bit 16kHz mono format
- [ ] Build audio ring buffer (keep last 30 seconds in memory)
- [ ] Implement audio level meter UI (shows input volume)

#### 2.3 Voice Activity Detection (VAD)
- [ ] Integrate Silero VAD (`@ricky0123/vad-web`) in AudioWorklet
- [ ] Configure VAD parameters (speech threshold, silence duration)
- [ ] Emit events: `speech-start`, `speech-end`, `speech-segment`
- [ ] Buffer audio segments between `speech-start` and `speech-end`
- [ ] Test VAD accuracy with various microphones and noise levels

#### 2.4 Local Transcription (faster-whisper)
- [ ] Set up Python sidecar process management in Electron main
- [ ] Bundle `faster-whisper` with `whisper-small.en` model
- [ ] Create IPC bridge: Electron ↔ Python (stdio JSON protocol)
- [ ] Implement audio segment → transcription pipeline
- [ ] Add speaker label ("You" for mic, "Them" for system audio)
- [ ] Measure and optimize latency (target: < 2s)
- [ ] Implement model download on first launch with progress UI

---

## Phase 2: AI Integration (Weeks 5–8)

### Sprint 3 — AI Response Engine (Week 5–6)

#### 3.1 Backend — Auth Service
- [ ] Set up Supabase project (PostgreSQL + Auth + Storage)
- [ ] Configure email/password and Google OAuth authentication
- [ ] Implement JWT token refresh flow
- [ ] Create `users` table with plan, settings, stripe_customer_id
- [ ] Build Row-Level Security (RLS) policies
- [ ] Create auth API endpoints (login, register, refresh, logout)

#### 3.2 Backend — AI Orchestrator Service
- [ ] Initialize Fastify server with TypeScript
- [ ] Create `/api/v1/ai/complete` endpoint (standard completion)
- [ ] Create `/api/v1/ai/stream` WebSocket endpoint (streaming)
- [ ] Implement OpenAI GPT-4o integration with streaming
- [ ] Implement Claude 3.5 Sonnet integration with streaming
- [ ] Implement Gemini 2.0 integration with streaming
- [ ] Build prompt context assembler (transcript + OCR + playbook)
- [ ] Implement token counting and context window management (8K rolling)
- [ ] Add request queuing for rate limit handling
- [ ] Implement model fallback chain (primary → secondary → tertiary)
- [ ] Add usage logging to `usage_logs` table

#### 3.3 Client — AI Integration
- [ ] Build WebSocket client for streaming AI responses
- [ ] Implement connection management (auto-reconnect, heartbeat)
- [ ] Create `ContextManager` class (assembles transcript + OCR for prompts)
- [ ] Implement response mode switching (Auto / On-demand / Copilot)
- [ ] Build streaming markdown renderer for overlay content panel
- [ ] Add "Ask AI" hotkey (`Ctrl+Shift+A`) for on-demand queries
- [ ] Implement response caching (avoid re-asking same question)
- [ ] Show token usage indicator in status bar

---

### Sprint 4 — Cloud Transcription & OCR (Week 7–8)

#### 4.1 Cloud Transcription (Deepgram)
- [ ] Integrate Deepgram Streaming API via WebSocket
- [ ] Implement audio streaming: client → backend → Deepgram
- [ ] Handle interim and final transcript results
- [ ] Implement speaker diarization mapping
- [ ] Add transcription provider toggle (local Whisper vs Deepgram)
- [ ] Implement smart switching (local when offline, cloud when available)

#### 4.2 OCR Engine
- [ ] Integrate `desktopCapturer` for periodic screen capture
- [ ] Implement configurable capture interval (2s, 5s, 10s)
- [ ] Integrate Tesseract.js (WASM) for local OCR
- [ ] Build "watch zone" UI (user draws rectangle on screen to OCR)
- [ ] Implement text change diffing (only send new text to AI)
- [ ] Add OCR toggle (enable/disable) in settings
- [ ] Optimize: skip OCR when screen content hasn't changed (pixel hash)
- [ ] Optional: Google Cloud Vision API integration for high-accuracy mode

#### 4.3 Context Assembly & Intelligence
- [ ] Build unified context pipeline (transcript + OCR → AI prompt)
- [ ] Implement smart summarization of old transcript segments
- [ ] Add context priority system (recent speech > old speech > OCR)
- [ ] Implement "question detection" — auto-trigger AI on detected questions
- [ ] Build conversation state tracker (topic changes, key points)

---

## Phase 3: Knowledge & Playbooks (Weeks 9–12)

### Sprint 5 — Playbooks & RAG (Week 9–10)

#### 5.1 Backend — Playbook Service
- [ ] Create `playbooks` and `playbook_chunks` tables
- [ ] Build CRUD endpoints for playbooks
- [ ] Implement document upload endpoint (PDF, DOCX, TXT, MD)
- [ ] Build document parsing pipeline (pdf-parse, mammoth for DOCX)
- [ ] Implement chunking strategy (500 tokens with 50 token overlap)
- [ ] Integrate OpenAI `text-embedding-3-small` for chunk embeddings
- [ ] Store embeddings in pgvector (Supabase) or Pinecone
- [ ] Build similarity search endpoint (query → top-K chunks)
- [ ] Implement BullMQ job queue for async document processing
- [ ] Add progress tracking for document processing

#### 5.2 Client — Playbook Management UI
- [ ] Build Playbook list view (grid/list toggle)
- [ ] Implement playbook creation wizard
- [ ] Build document upload UI with drag-and-drop
- [ ] Show processing status (uploading → parsing → embedding → ready)
- [ ] Implement playbook selection before/during meeting
- [ ] Build playbook preview panel (view chunks, source files)
- [ ] Add pre-built templates (Sales Call, Interview, Support, Exam Prep)

#### 5.3 RAG Integration with AI
- [ ] Modify AI prompt builder to include playbook retrieval step
- [ ] Implement: query → embed → vector search → inject top-5 chunks → LLM
- [ ] Add source citations in AI responses (reference playbook section)
- [ ] Test RAG accuracy with sample playbooks
- [ ] Implement relevance threshold (don't inject low-similarity chunks)

---

### Sprint 6 — Meeting Intelligence (Week 11–12)

#### 6.1 Meeting Management
- [ ] Create `meetings` table and CRUD endpoints
- [ ] Implement auto-start meeting session on audio detection
- [ ] Auto-stop meeting after 60s of silence
- [ ] Store full transcript as JSONB (speaker, text, timestamp per segment)
- [ ] Implement meeting title auto-generation (first 10 words or AI title)
- [ ] Build meeting history list view in app

#### 6.2 Post-Meeting AI Features
- [ ] Build meeting summary generation (GPT-4o-mini, post-call)
- [ ] Implement action item extraction from transcript
- [ ] Add key topics / agenda detection
- [ ] Build searchable meeting archive (full-text search on transcripts)
- [ ] Implement "Ask about past meetings" — RAG over meeting history

#### 6.3 Settings & Preferences
- [ ] Build comprehensive Settings panel:
  - [ ] AI model selection (GPT-4o, Claude 3.5, Gemini, Local Llama)
  - [ ] Audio device configuration
  - [ ] Overlay appearance (theme, font size, opacity, position)
  - [ ] Hotkey customization
  - [ ] Language selection
  - [ ] Transcription provider (local / cloud)
  - [ ] OCR configuration (interval, watch zones)
  - [ ] Auto-launch on startup
  - [ ] Notification preferences
- [ ] Implement settings persistence (electron-store + Supabase sync)

---

## Phase 4: Polish & Monetization (Weeks 13–16)

### Sprint 7 — Billing & Onboarding (Week 13–14)

#### 7.1 Stripe Integration
- [ ] Set up Stripe products and price plans (Free, Pro, Team, Enterprise)
- [ ] Implement `/billing/checkout` — create Stripe Checkout session
- [ ] Implement `/billing/portal` — customer self-service portal
- [ ] Build Stripe webhook handler (subscription events)
- [ ] Implement usage metering (AI requests, transcription minutes)
- [ ] Enforce plan limits (5 AI/day for free, unlimited for pro)
- [ ] Build upgrade/downgrade flow in app
- [ ] Add billing management page in Settings

#### 7.2 Onboarding Experience
- [ ] Build first-launch setup wizard (5 steps):
  - [ ] Step 1: Account creation / login
  - [ ] Step 2: Audio device setup + virtual driver install
  - [ ] Step 3: AI model selection
  - [ ] Step 4: Hotkey configuration
  - [ ] Step 5: Interactive overlay tutorial
- [ ] Create animated tutorial overlay (highlights features)
- [ ] Add tooltip system for first-time feature discovery
- [ ] Implement "Skip to dashboard" option

#### 7.3 Auto-Updates
- [ ] Configure `electron-updater` with S3 backend
- [ ] Implement update notification UI (download progress, restart prompt)
- [ ] Build delta update system (only download changed files)
- [ ] Set up release channels (stable, beta, canary)

---

### Sprint 8 — Quality & Launch Prep (Week 15–16)

#### 8.1 Testing & Quality Assurance
- [ ] Write unit tests for all core modules (80% coverage target)
- [ ] Write Playwright E2E tests for all user flows
- [ ] Build automated invisibility test harness:
  - [ ] Launch app → start screen recording → verify overlay not captured
  - [ ] Test with: OBS, Zoom screen share, Teams screen share, Windows Game Bar
- [ ] Performance profiling: memory leaks, CPU usage, render performance
- [ ] Cross-platform testing matrix (Win 10, Win 11, macOS 13, 14, 15)
- [ ] Accessibility audit (keyboard navigation, screen reader compat)
- [ ] Security audit (dependency scan, CSP review, auth flow review)

#### 8.2 Performance Optimization
- [ ] Implement lazy loading for non-critical modules
- [ ] Optimize Electron startup (defer non-essential initialization)
- [ ] Implement WebSocket connection pooling
- [ ] Add response caching layer (Redis) for common AI queries
- [ ] Optimize OCR pipeline (skip unchanged frames)
- [ ] Profile and reduce memory usage (target < 200MB idle)
- [ ] Implement graceful degradation (offline mode with local Whisper + Llama)

#### 8.3 Launch Preparation
- [ ] Create landing page website
- [ ] Write documentation (user guide, FAQ, troubleshooting)
- [ ] Set up customer support channel (Intercom / Discord)
- [ ] Configure error reporting (Sentry)
- [ ] Set up analytics (Mixpanel / PostHog)
- [ ] Create app store listings (if applicable)
- [ ] Prepare marketing assets (demo video, screenshots)
- [ ] Code-sign application (Windows: EV certificate, macOS: Apple Developer)

---

## Phase 5: Scale & Enterprise (Weeks 17–22)

### Sprint 9 — Team & Enterprise Features (Week 17–18)

#### 9.1 Team Management
- [ ] Create `teams` and `team_members` tables
- [ ] Build team creation and invitation flow
- [ ] Implement RBAC (admin, member, viewer roles)
- [ ] Build admin dashboard (team usage stats, member management)
- [ ] Implement shared playbook library (team-scoped)
- [ ] Add team billing (per-seat pricing via Stripe)

#### 9.2 SSO Integration
- [ ] Implement SAML 2.0 SSO
- [ ] Implement OIDC SSO
- [ ] Build SSO configuration UI for enterprise admins
- [ ] Test with Okta, Azure AD, Google Workspace

#### 9.3 Calendar Integration
- [ ] Integrate Google Calendar API
- [ ] Integrate Microsoft Graph API (Outlook Calendar)
- [ ] Auto-detect upcoming meetings
- [ ] Auto-launch Invis when meeting starts
- [ ] Pre-load relevant playbook based on meeting title/attendees

---

### Sprint 10 — Scalability & Infrastructure (Week 19–20)

#### 10.1 Backend Scaling
- [ ] Migrate to ECS Fargate with auto-scaling policies
- [ ] Implement Redis cluster for session management + caching
- [ ] Set up PostgreSQL read replicas
- [ ] Configure CloudFront CDN for static assets and updates
- [ ] Implement WebSocket scaling with Redis pub/sub
- [ ] Set up cross-region deployment (US-East, EU-West, AP-Southeast)

#### 10.2 Monitoring & Observability
- [ ] Set up Datadog APM (trace all API requests)
- [ ] Configure Sentry for client-side error tracking
- [ ] Build custom dashboards (concurrent users, AI latency, error rates)
- [ ] Set up alerting (PagerDuty) for SLA breaches
- [ ] Implement structured logging (JSON) with request correlation IDs
- [ ] Add health check endpoints for all services

#### 10.3 Load Testing
- [ ] Write k6 load tests for API endpoints
- [ ] Simulate 10K concurrent WebSocket connections
- [ ] Benchmark AI orchestrator under load (queue depth, latency)
- [ ] Test database performance under concurrent writes
- [ ] Document capacity limits and scaling thresholds

---

### Sprint 11 — Advanced Features (Week 21–22)

#### 11.1 Local LLM Support
- [ ] Integrate `llama.cpp` via Node.js bindings or Python sidecar
- [ ] Support Llama 3 8B (quantized) for offline mode
- [ ] Build model download manager (progress UI, disk space check)
- [ ] Implement automatic local/cloud switching based on connectivity
- [ ] Benchmark local model quality vs cloud models

#### 11.2 Advanced Anti-Detection (P2)
- [ ] Implement process name randomization
- [ ] Build DirectX overlay renderer (Win) for DWM bypass fallback
- [ ] Build Metal layer renderer (macOS) for capture bypass fallback
- [ ] Implement network traffic obfuscation (domain fronting, WSS on 443)
- [ ] Add "stealth mode" toggle that activates all anti-detection layers
- [ ] Test against known proctoring software (ProctorU, Examity, HonorLock)

#### 11.3 Multi-Language Support
- [ ] Implement i18n framework (react-intl)
- [ ] Add transcription language selection
- [ ] Support Spanish, French, German, Hindi, Mandarin transcription
- [ ] Localize UI strings for supported languages

---

## Phase 6: Mobile & Future (Weeks 23–28)

### Sprint 12 — Mobile Companion & API (Week 23–24)

#### 12.1 Mobile Companion App
- [ ] Build React Native companion app (iOS + Android)
- [ ] Implement meeting history view
- [ ] Add push notifications for meeting summaries
- [ ] Build mobile playbook viewer
- [ ] Implement cross-device sync (desktop ↔ mobile)

#### 12.2 Public API
- [ ] Design and document public REST API
- [ ] Implement API key management
- [ ] Build developer portal with interactive docs (Swagger/OpenAPI)
- [ ] Add rate limiting per API key
- [ ] Create SDK packages (Node.js, Python)

---

### Sprint 13 — Analytics & Intelligence (Week 25–26)

#### 13.1 Usage Analytics Dashboard
- [ ] Build admin analytics dashboard:
  - [ ] Total meetings, AI requests, transcription hours
  - [ ] User engagement metrics (DAU, MAU, retention)
  - [ ] Revenue metrics (MRR, churn, ARPU)
- [ ] Implement product analytics events (feature usage tracking)
- [ ] Build A/B testing framework for feature rollout

#### 13.2 AI Model Improvements
- [ ] Implement prompt optimization based on user feedback
- [ ] Build response quality scoring system
- [ ] Add user feedback mechanism (👍/👎 on AI responses)
- [ ] Fine-tune prompts per use case (sales, interview, support)
- [ ] Implement smart model routing (simple → fast model, complex → powerful model)

---

### Sprint 14 — Hardening & v2.0 Launch (Week 27–28)

#### 14.1 Security Hardening
- [ ] Conduct third-party penetration test
- [ ] Implement SOC 2 compliance controls
- [ ] Add GDPR data export and deletion APIs
- [ ] Implement audit logging for all admin actions
- [ ] Review and harden all RLS policies
- [ ] Implement IP allowlisting for enterprise accounts

#### 14.2 Documentation & Launch
- [ ] Write comprehensive developer documentation
- [ ] Create video tutorials (setup, features, playbooks)
- [ ] Build knowledge base / help center
- [ ] Write enterprise deployment guide (on-prem LLM, SSO, compliance)
- [ ] Final cross-platform QA pass
- [ ] v2.0 public release

---

## Task Summary

| Phase | Sprints | Duration | Key Deliverables |
|---|---|---|---|
| **Phase 1: Foundation** | 1–2 | Weeks 1–4 | Invisible overlay, audio capture, local transcription |
| **Phase 2: AI Integration** | 3–4 | Weeks 5–8 | AI responses, cloud transcription, OCR |
| **Phase 3: Knowledge** | 5–6 | Weeks 9–12 | Playbooks, RAG, meeting intelligence |
| **Phase 4: Polish** | 7–8 | Weeks 13–16 | Billing, onboarding, testing, v1.0 launch |
| **Phase 5: Scale** | 9–11 | Weeks 17–22 | Teams, enterprise, scaling, local LLM |
| **Phase 6: Future** | 12–14 | Weeks 23–28 | Mobile, API, analytics, v2.0 launch |

**Total Tasks: ~200+ individual work items across 14 sprints**
