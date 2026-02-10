# Smart Print - Photo Print Manager

> **Note:** This file is automatically loaded by Claude Code at the start of every conversation. It serves as the primary context for understanding this project.

## Project Overview

Smart Print is a desktop photo printing management application for live events. It monitors for incoming photos (via local folder watching or cloud API polling), manages print queues across multiple printers, and provides a professional monitoring/gallery UI.

### Core Technologies

- **Language:** TypeScript (strict mode)
- **Framework:** Electron + React
- **Build Tool:** electron-vite
- **UI:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Platform:** Windows (portable .exe via electron-builder)

### Key Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| electron | Desktop shell | Main + renderer processes |
| react, react-dom | UI framework | With TypeScript |
| electron-vite | Build tooling | Dev server + production builds |
| zustand | State management | Lightweight, hooks-based |
| chokidar | File watching | Local mode photo detection |
| axios | HTTP client | Cloud mode API integration |
| winston | Logging | All operations logged |
| electron-store | Config persistence | Settings, auth tokens, printer cache |
| shadcn/ui | UI components | Accessible, composable |

---

## Project Status

### Component Status

| Component | Status | Notes |
|---|---|---|
| Project Scaffolding | Complete | Electron + React + TS + Tailwind v4 + light/dark theme |
| Printer Integration | Complete | Discovery, queue, health, load balancing, IPC handlers |
| Local File Monitoring | Complete | Chokidar watcher, file verification, events |
| Cloud API Integration | Complete | Axios client, polling, registration, retry logic |
| UI - Settings Screen | Complete | B3 "Soft Studio" design, wired to stores |
| UI - Live Monitor | Complete | B3 design, wired to stores, 5s auto-refresh |
| UI - Gallery Screen | Complete | B3 design, wired to stores, batch ops |
| Zustand Stores | Complete | settings, printer, watcher, cloud, gallery, theme |

### Current Priorities

1. Initialize git repo and commit all work
2. End-to-end testing with real printers and file drops
3. Settings persistence via electron-store in renderer
4. Native file dialog for directory picker
5. Error boundaries and loading states

### Known Issues

| Issue | Severity | Workaround |
|---|---|---|
| None yet | - | - |

---

## Architecture

### Directory Structure

```
smart-print/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Main entry point
│   │   ├── printer/
│   │   │   ├── manager.ts       # Printer discovery & caching
│   │   │   ├── queue.ts         # Print job operations
│   │   │   └── health.ts        # Queue status monitoring
│   │   ├── watcher/
│   │   │   ├── local.ts         # Chokidar file watcher
│   │   │   └── cloud.ts         # API polling service
│   │   └── api/
│   │       ├── client.ts        # Axios client + interceptors
│   │       └── endpoints.ts     # API endpoint definitions
│   ├── renderer/                # React UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── screens/
│   │   │   ├── Settings.tsx
│   │   │   ├── Monitor.tsx
│   │   │   └── Gallery.tsx
│   │   ├── stores/              # Zustand stores
│   │   └── styles/
│   └── preload/                 # Preload scripts
│       └── index.ts             # contextBridge API
├── electron-builder.yml         # Windows build config
├── electron.vite.config.ts      # electron-vite config
├── tailwind.config.ts
├── tsconfig.json                # Base TS config
├── tsconfig.main.json
├── tsconfig.renderer.json
├── tsconfig.preload.json
├── CLAUDE.md                    # This file (auto-loaded)
├── progress.md                  # Session work log
├── features_list.json           # Feature tracking
└── requirements.md              # Original project specification
```

### Key Components

| Component | File(s) | Purpose |
|---|---|---|
| PrinterManager | `src/main/printer/manager.ts` | Discover printers, cache capabilities, load balance across up to 4 printers |
| PrintQueue | `src/main/printer/queue.ts` | Submit print jobs, manage queue |
| HealthCheck | `src/main/printer/health.ts` | Monitor printer/queue status |
| LocalWatcher | `src/main/watcher/local.ts` | Watch directory for new JPG/PNG files, verify completeness |
| CloudWatcher | `src/main/watcher/cloud.ts` | Poll API every 15s, download photos, confirm prints |
| ApiClient | `src/main/api/client.ts` | Axios with interceptors, retry logic, token management |
| Preload | `src/preload/index.ts` | contextBridge IPC exposure |

### Important Patterns

- **IPC Communication:** All main↔renderer communication via contextBridge (no nodeIntegration)
- **Two Modes:** "Local" (file watcher) and "Cloud" (API polling) - user selects in Settings
- **File Verification:** Both modes verify file completeness before printing (size comparison)
- **Multi-Printer:** Load balancing across up to 4 printers with fallback on failure
- **Logging:** All operations logged via winston

---

## API Boundaries

### Cloud Mode API

| Endpoint | Method | Data | Purpose |
|---|---|---|---|
| `/register` | POST | `{ registrationKey: string }` → `{ token: string }` | Device registration with 12-digit key |
| `/photos` | GET | `?token=xxx` → `{ photos: [{ url, filename, sizeBytes }] }` | Fetch pending photos |
| `/photos/confirm` | POST | `{ token, filename }` → `{ success: boolean }` | Confirm print completion |
| `/health` | GET | - → `{ status: 'ok' }` | Connection health check |

### IPC Channels (Main ↔ Renderer)

To be defined during implementation. Will use typed channels via contextBridge.

### File Watcher Events

| Event | Direction | Data | Purpose |
|---|---|---|---|
| `photo-ready` | Main → Renderer | `{ filepath, filename, size }` | File complete, ready to print |
| `photo-printed` | Main → Renderer | `{ filename, printer }` | File printed and moved |
| `watch-error` | Main → Renderer | `{ error, filepath }` | File system error |

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for Windows
npm run build

# Run tests
npm test
```

### Key Constants

- **Min Resolution:** 1366x768
- **Max Photo Size:** 20MB
- **API Poll Interval:** 15 seconds (configurable)
- **Health Check Interval:** 60 seconds
- **Max Printers:** 4 (load balanced)

---

## Debugging

### Log Locations

- **App Logs:** Via winston (location TBD after scaffolding)
- **Electron DevTools:** Available in dev mode

### Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| Not yet documented | - | - |

---

## Claude Session Instructions

### At Session Start

- Check git status:
```bash
git status
git log --oneline -10
```
- Read `progress.md` for recent session history
- Understand which branch you're on and any uncommitted changes

### During Session

- Update `progress.md` after completing significant tasks
- Update `features_list.json` when features are implemented
- Update this file (CLAUDE.md) when component status changes or architecture evolves

### At Session End

Run `/update-progress` or manually update `progress.md` with:
- Tasks completed
- Key decisions made
- Files modified
- Where to resume next session

### Conversation Continuations

When a session runs out of context, Claude generates a summary for the next conversation. The summary + this file provides full project context. If something seems missing, read `progress.md`.

---

## Code Standards

### TypeScript Conventions

- Strict mode enabled
- Explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use Zustand stores for shared state

### Commit Messages

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Keep messages concise but descriptive
- Reference feature IDs when applicable (e.g., `feat(F001): scaffold electron-vite project`)

---

## Design Guidelines

- **Aesthetic:** Modern, clean - inspired by VSCode, Figma, Linear, Raycast
- **NO purple gradients**
- **Accessible:** WCAG AA compliance
- **Responsive:** 1366x768 to 4K
- **Event-friendly:** Easy to read in various lighting conditions
- **Subtle animations** only

## Notes

- This application is primarily for Windows deployment (portable .exe)
- Used at live events, so reliability and clear status indicators are critical
- UI design will go through a 3-concept exploration phase (9 screens total) before final selection
