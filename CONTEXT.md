# Invis — Development Context

> **Last Updated:** 2026-05-04  
> **Current Phase:** Phase 1 — Foundation  
> **Current Sprint:** Sprint 1 — Project Setup & Invisible Overlay

---

## Project Overview

Building a Cluely-like AI overlay assistant that is invisible to screen recording/sharing.  
Cross-platform desktop app (Windows + macOS) using Electron + React + TypeScript.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Electron 33+ |
| Frontend | React 19 + TypeScript |
| State Management | Zustand |
| Styling | Vanilla CSS + CSS Variables |
| Build Tool | electron-vite + Vite 6 |
| Backend (planned) | Fastify + TypeScript (Node.js 22) |
| Auth & DB (planned) | Supabase (PostgreSQL + Auth) |

## Directory Structure

```
d:\cluely\
├── docs/
│   ├── prd.md                         # Product Requirements Document
│   ├── tech_requirements.md           # Technical Requirements
│   └── task_list.md                   # Sprint-level task breakdown
├── src/
│   ├── main/
│   │   └── index.ts                   # Electron main process — window creation, hotkeys, tray, IPC
│   ├── preload/
│   │   └── index.ts                   # Secure contextBridge API exposed to renderer
│   ├── renderer/
│   │   ├── index.html                 # HTML entry point
│   │   ├── main.tsx                   # React entry point
│   │   ├── App.tsx                    # Root component — Header + tabbed content + StatusBar
│   │   ├── components/
│   │   │   ├── index.ts              # Barrel export
│   │   │   ├── Header.tsx            # Draggable header with tabs & window controls
│   │   │   ├── TranscriptPanel.tsx   # Real-time transcript display
│   │   │   ├── AIPanel.tsx           # AI responses + input bar + demo mode
│   │   │   ├── SettingsPanel.tsx     # Overlay & AI settings controls
│   │   │   └── StatusBar.tsx         # Connection & listening status
│   │   ├── store/
│   │   │   └── useAppStore.ts        # Zustand store — tabs, transcript, AI, config
│   │   └── styles/
│   │       └── index.css             # Complete design system — glassmorphism dark theme
│   └── shared/
│       ├── index.ts                   # Barrel export
│       └── types.ts                   # Shared types, defaults, IPC channel constants
├── package.json                        # Dependencies & build scripts
├── tsconfig.json                       # TypeScript configuration
├── electron.vite.config.ts            # electron-vite build config
├── .prettierrc                         # Code formatting rules
├── .gitignore                          # Git ignore patterns
├── README.md                           # Project documentation
└── CONTEXT.md                          # This file — development tracker
```

## Completed Work

### Documentation (Pre-build)
- ✅ PRD created (`docs/prd.md`)
- ✅ Technical Requirements created (`docs/tech_requirements.md`)
- ✅ Task List created (`docs/task_list.md`)

### Sprint 1 — Project Setup & Invisible Overlay
- ✅ Project scaffolding (Electron + React + TypeScript + Vite)
  - package.json with all dependencies
  - tsconfig.json with path aliases
  - electron.vite.config.ts for main/preload/renderer
  - .prettierrc, .gitignore, README.md
- ✅ Invisible overlay engine (`src/main/index.ts`)
  - `setContentProtection(true)` — invisible to screen capture
  - Transparent, frameless, always-on-top window
  - `type: 'toolbar'` — hidden from Alt+Tab
  - `skipTaskbar: true` — hidden from taskbar
  - Global hotkeys (Ctrl+Shift+Space toggle, Ctrl+Shift+A AI query, Escape hide)
  - System tray with context menu
  - Single instance lock
  - Multi-monitor positioning
  - IPC handlers for all overlay controls
- ✅ Preload script (`src/preload/index.ts`)
  - Secure contextBridge API (no nodeIntegration)
  - Overlay control methods
  - AI streaming event listeners
  - Transcript event listeners
- ✅ Shared types (`src/shared/types.ts`)
  - OverlayConfig, AudioConfig, AIConfig types
  - TranscriptSegment, Meeting types
  - IPC_CHANNELS constants
  - Default configurations
- ✅ Overlay UI shell
  - Header with draggable region, tab nav, window controls
  - TranscriptPanel with auto-scroll and speaker labels
  - AIPanel with streaming responses, input bar, demo mode
  - SettingsPanel with opacity, model selection, hotkeys
  - StatusBar with connection/listening indicators
  - Complete CSS design system (glassmorphism, animations, tokens)
- ✅ Zustand store (`src/renderer/store/useAppStore.ts`)
  - Tab state, transcript array, AI responses with streaming
  - Overlay config, AI config, connection status

### ⏳ Pending — Needs `npm install`
- [ ] Install dependencies: run `npm install` in `d:\cluely`
- [ ] Test dev server: run `npm run dev`
- [ ] Verify overlay invisibility with screen recording

## Architecture Decisions

1. **electron-vite** — Unified Electron + Vite build (handles main, preload, renderer)
2. **setContentProtection(true)** — Primary invisibility (WDA_EXCLUDEFROMCAPTURE on Win, NSWindow.sharingType=.none on macOS)
3. **Zustand** — Lightweight state over Redux; perfect for real-time streaming updates
4. **CSS Variables** — Design tokens for overlay theming (no Tailwind needed)
5. **contextBridge** — Secure IPC; renderer has zero Node.js access
6. **Demo mode** — AI panel works without backend, simulating streamed responses

## Key Files Quick Reference

| Purpose | File |
|---|---|
| Window creation + invisibility | `src/main/index.ts` |
| Secure IPC bridge | `src/preload/index.ts` |
| Root UI component | `src/renderer/App.tsx` |
| State management | `src/renderer/store/useAppStore.ts` |
| Design system | `src/renderer/styles/index.css` |
| Type definitions | `src/shared/types.ts` |

## Next Steps (Sprint 2)

1. Audio capture pipeline (VB-Cable integration, VAD, transcription)
2. Backend AI orchestrator (Fastify + OpenAI streaming)
3. WebSocket connection for real-time AI streaming
