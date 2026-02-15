# Smart Print - Photo Print Manager

> **Note:** This file is automatically loaded by Claude Code at the start of every conversation. It serves as the primary context for understanding this project.

## Project Overview

Smart Print is a desktop photo printing management application for live events. It monitors for incoming photos (via local folder watching or cloud API polling), manages print queues across multiple printers, and provides a professional monitoring/gallery UI.

**Primary deployment:** Windows laptops at live events (often older/budget hardware). Must work fully offline on local networks.

### Core Technologies

- **Language:** TypeScript (strict mode)
- **Framework:** Electron + React
- **Build Tool:** electron-vite
- **UI:** Tailwind CSS + inline styles (skeuomorphic theme system)
- **State Management:** Zustand (settings persisted via electron-store IPC)
- **Printing:** PowerShell + .NET System.Drawing on Windows, `lp` on macOS/Linux
- **Platform:** Windows (NSIS installer + portable .exe via electron-builder)

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
| electron-updater | Auto-updates | NSIS installer support |
| @fontsource/* | Bundled fonts | No remote font loading (offline use) |

---

## Project Status

### Component Status

| Component | Status | Notes |
|---|---|---|
| Project Scaffolding | Complete | Electron + React + TS + Tailwind v4 |
| Printer Integration | Complete | Discovery, queue (PowerShell/.NET), health, load balancing |
| Local File Monitoring | Complete | Chokidar watcher, EOF marker verification, auto-print |
| Cloud API Integration | Complete | Axios client, polling, registration, retry logic |
| UI - Design Concept D | Active | "Printing Press" skeuomorphic design with theme system |
| UI - Design Concept B3 | Reference | "Soft Studio" kept for reference, not active |
| Zustand Stores | Complete | settings, printer, watcher, cloud, gallery, theme, pressTheme |
| Settings Persistence | Complete | electron-store via IPC (survives portable builds) |
| Error Boundaries | Complete | Each screen wrapped with crash-safe fallback |
| Window Title | Complete | Live queue status in title bar |
| Gallery Auto-Refresh | Complete | Rescans on print job completion |
| Developer Wiki | Complete | 17 pages on Azure DevOps wiki |
| Operator Guide | Complete | 6 pages for event staff |

### Current Priorities

1. Confirm physical print quality on DS40 in person
2. Cloud event selection flow (waiting on YAML spec from architecture team)
3. App icon cleanup (transparent background)
4. Splash screen
5. Theme refinements based on in-person testing

### Known Issues

| Issue | Severity | Workaround |
|---|---|---|
| Electron `webContents.print()` fails with dye-sub printers on Windows | Critical | **Resolved:** Replaced with PowerShell/.NET GDI printing |
| Electron `ep.status` returns 0 for all printers on macOS | Med | Uses CUPS `printer-state-reasons` from options dict instead |
| CUPS `printer-state=3` (idle) reported even for offline printers | Med | Check `printer-state-reasons` for `offline-report` before trusting state |
| Ink/paper levels not available from Electron printer API | Low | Removed gauges; would need vendor SDKs per printer brand |
| Electron TypeScript defs missing `.status` and `.isDefault` on PrinterInfo | Low | Access via `(ep as any).status` |
| Auto-updater ERR_NAME_NOT_RESOLVED on offline networks | Low | Expected — app works without internet |

---

## Architecture

### Active Design: Concept D ("Printing Press")

The active UI is the skeuomorphic "Printing Press" design with a theme system:
- **Layout:** `src/renderer/src/layouts/AppLayoutD.tsx`
- **Screens:** `MonitorD.tsx`, `GalleryD.tsx`, `SettingsD.tsx`
- **Themes:** `src/renderer/src/themes/press-themes.ts` (8 defined, 2 active: brand + teal)
- **Theme store:** `src/renderer/src/stores/pressTheme.ts`

### Print Pipeline (Critical Path)

**Windows:** PowerShell + .NET `System.Drawing.Printing.PrintDocument`
- Writes a `.ps1` temp file with the print script
- Executes via `powershell -File` (avoids cmd.exe quoting issues)
- Uses GDI print pipeline (same as native Windows apps)
- Auto-detects landscape/portrait from image dimensions
- Zero margins, HighQualityBicubic interpolation

**macOS/Linux:** `lp -d <printer> -n <copies> <filepath>`

File: `src/main/printer/queue.ts`

### Directory Structure

```
smart-print/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point, IPC handlers, settings store
│   │   ├── updater.ts           # Auto-updater
│   │   ├── printer/
│   │   │   ├── manager.ts       # Discovery, caching, load balancing, paper sizes
│   │   │   ├── queue.ts         # PowerShell/.NET print jobs, retry, eviction
│   │   │   ├── health.ts        # Health monitoring (explicit mainWindowRef)
│   │   │   └── index.ts         # Barrel exports
│   │   ├── watcher/
│   │   │   ├── local.ts         # Chokidar watcher, EOF verification
│   │   │   └── cloud.ts         # API polling service
│   │   └── api/
│   │       ├── client.ts        # Axios client + interceptors
│   │       └── endpoints.ts     # API endpoint definitions
│   ├── renderer/
│   │   ├── src/
│   │   │   ├── App.tsx          # Renders AppLayoutD
│   │   │   ├── components/
│   │   │   │   ├── ErrorBoundary.tsx  # Crash-safe screen wrapper
│   │   │   │   └── LocalImage.tsx     # IPC-based image loader with LRU cache
│   │   │   ├── layouts/
│   │   │   │   ├── AppLayoutD.tsx     # Active: Printing Press design
│   │   │   │   └── AppLayoutB3.tsx    # Reference: Soft Studio design
│   │   │   ├── screens/
│   │   │   │   ├── MonitorD.tsx       # Gauges, queue, printers, activity
│   │   │   │   ├── GalleryD.tsx       # Photo grid with light table aesthetic
│   │   │   │   └── SettingsD.tsx      # Control panel settings
│   │   │   ├── stores/
│   │   │   │   ├── settings.ts        # Persisted to electron-store via IPC
│   │   │   │   ├── printer.ts         # Queue, health, discovery
│   │   │   │   ├── watcher.ts         # File watcher state
│   │   │   │   ├── cloud.ts           # Cloud polling state
│   │   │   │   ├── gallery.ts         # Printed photos scanning
│   │   │   │   ├── theme.ts           # Light/dark (legacy)
│   │   │   │   └── pressTheme.ts      # Press theme selection
│   │   │   └── themes/
│   │   │       └── press-themes.ts    # 8 theme definitions
│   │   └── assets/
│   │       └── main.css               # Tailwind + bundled @fontsource imports
│   └── preload/
│       ├── index.ts             # contextBridge API
│       └── index.d.ts           # TypeScript type declarations
├── build/                       # electron-builder resources (icons)
├── resources/                   # Runtime resources (icon)
├── electron-builder.yml         # NSIS + portable build config
├── azure-pipelines.yml          # CI: typecheck, build, package, publish
└── CLAUDE.md                    # This file
```

### Key Patterns

- **IPC Communication:** All main↔renderer via contextBridge (no nodeIntegration)
- **Two Modes:** "Local Print" (file watcher) and "Cloud Print" (API polling)
- **File Verification:** JPEG EOI / PNG IEND marker verification before printing
- **Multi-Printer:** Round-robin load balancing across up to 4 printers with fallback
- **Settings Persistence:** Zustand + electron-store via IPC (not localStorage)
- **Auto-Print:** Always enabled, no toggle. New photos auto-submit to print queue.
- **Explicit mainWindowRef:** Printer manager and health monitor use stored ref, never `getAllWindows()[0]`
- **Performance:** LRU image cache (50 entries), health check caching, job queue eviction (max 200)

---

## Quick Reference

### Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Development with hot reload
npm run build        # Production build (typecheck + vite)
npm run typecheck    # TypeScript check (node + web)
```

### Key Constants

- **Min Resolution:** 1366x768
- **Window Size:** 60% width × 80% height of screen, centered
- **Max Photo Size:** 20MB
- **Poll Interval:** 60 seconds (configurable)
- **Health Check Interval:** 30 seconds
- **Max Printers:** 4 (load balanced)
- **Max Finished Jobs:** 200 (older evicted)
- **Image Cache:** 50 entries (LRU)

---

## Debugging

### Log Locations

- **Console:** Launch `SmartPrint.exe` from cmd to see winston logs
- **Electron DevTools:** Available in dev mode (F12)

### Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| Print job fails instantly | Electron print API (old code) | Use PowerShell/.NET approach (current) |
| Settings lost on restart | localStorage in portable build | Fixed: electron-store via IPC |
| 30-60s startup | Portable .exe extracting to temp | Use NSIS installer instead |
| App loads slowly (20s+) | Google Fonts network request | Fixed: fonts bundled locally |
| Print queue shows "Error" but printer is fine | Driver rejected custom page size | Let driver use default (no pageSize param) |

---

## Upcoming: Cloud Event Selection Flow

Stashed plan at `~/.claude/plans/dapper-roaming-peacock.md`. Waiting for YAML spec from architecture team. Key points:
- Registration returns token + events list
- User must select an event before polling starts
- Event ID is required parameter for photo fetch
- Persistent modal for event selection
- Auto-print paused until event selected

---

## Claude Session Instructions

### At Session Start

```bash
git status
git log --oneline -10
```
- Read `progress.md` for recent session history

### During Session

- Update `progress.md` after completing significant tasks
- Update this file when architecture evolves

### At Session End

Run `/update-progress` or manually update `progress.md`.

---

## Code Standards

- Strict TypeScript, explicit return types on exports
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Zustand stores for shared state, electron-store for persistence
- No remote asset dependencies (fonts, images all bundled)
- Test on Windows with real hardware before declaring features complete

## Design

- **Active:** Concept D "Printing Press" — skeuomorphic, industrial
- **Themes:** Mozeus (navy + green, default) and Silver Teal (light)
- **Fonts:** Inter/DM Sans (body), JetBrains Mono (data) — all bundled via @fontsource
- **Target:** 1366x768 to 4K, event-friendly readability
