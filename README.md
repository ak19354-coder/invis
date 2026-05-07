# Invis

AI-powered invisible overlay assistant — undetectable by screen recording & screen sharing.

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Space` | Toggle overlay visibility |
| `Ctrl+Shift+A` | Quick AI query |
| `Escape` | Hide overlay |

## How Invisibility Works

The overlay uses OS-level APIs to exclude itself from screen capture:
- **Windows**: `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` via Electron's `setContentProtection(true)`
- **macOS**: `NSWindow.sharingType = .none`

No screen recording software (Zoom, Teams, OBS, Windows Game Bar) can see this window.

## Tech Stack

- **Desktop**: Electron 33+ with React 19 + TypeScript
- **Build**: electron-vite + Vite 6
- **State**: Zustand
- **Styling**: Vanilla CSS with glassmorphism dark theme

## Project Structure

```
src/
├── main/           # Electron main process (window creation, IPC, hotkeys)
├── preload/        # Secure bridge between main & renderer
├── renderer/       # React overlay UI
│   ├── components/ # Header, AIPanel, TranscriptPanel, SettingsPanel, StatusBar
│   ├── store/      # Zustand state management
│   └── styles/     # CSS design system
└── shared/         # Types & constants shared across processes
```
