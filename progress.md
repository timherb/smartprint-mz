# Smart Print - Development Log

================================================================================
## 2026-02-21 Session (Cloud API Integration — Full Flow)
================================================================================

### Tasks Completed
- [x] Replaced legacy API contract (`/register`, `/photos`, `/photos/confirm`, `/health`) with new spec
- [x] Implemented `/device/activate` endpoint — replaced old `/register`, sends appID, licenseKey, deviceCode, swVersion, osVersion, platform
- [x] Implemented `/device/syncevents` — fetches today's events for event selection
- [x] Implemented `/image/images` — fetches undownloaded images by eventID with approved filter
- [x] Implemented `/image/updatedownloaded` — marks images as downloaded per-image immediately after verification
- [x] Added `EventSelectorModal` — persistent blocking modal that appears after registration, auto-syncs events, requires event selection before polling starts
- [x] Added register/unregister flow — UNREGISTER button clears token and license key, allows re-registration
- [x] License key persisted to `cloud-config.json` and displayed in Settings for support reference
- [x] Approved Images Only checkbox — persisted setting, filters `/image/images` request; omits field when unchecked rather than sending false
- [x] Active Event display in Settings — shows selected event name with CHANGE EVENT button
- [x] Unified printing pipeline — cloud downloads now go directly to the watch folder; local watcher handles printing in both modes (eliminated duplicate `photo-ready → submitJob` pipeline)
- [x] Local watcher now starts in both local and cloud modes (always watches the folder if configured)
- [x] Output folder now shown in Settings for cloud mode (labeled "OUTPUT FOLDER")
- [x] `setOnJobDone` — files now moved directly via `fs.rename` to `{localDirectory}/Printed Photos/` in both modes, bypassing the local watcher dependency
- [x] Poll cancellation via generation counter — `stop()` bumps `pollGeneration`; download loop checks before each image and breaks if cancelled
- [x] Network error abort — first network error during download loop aborts entire poll cycle (avoids 1000-image retry storm)
- [x] `setApprovedOnly` auto-restarts polling if active (change takes effect immediately)
- [x] Saving settings now pushes `approvedOnly` to CloudWatcher before restart
- [x] Fixed `start()` blocking — initial poll and health check now fire with `void` (non-blocking); save/modal no longer freeze waiting for poll to complete
- [x] Fixed EventSelectorModal "STARTING..." stuck state — stale local state cleared when modal re-opens
- [x] Fixed base URL switching — API URL stored in electron-store, overrides default; working URL is `https://smartprint.smartactivator-api.net`
- [x] Added token logging (first 20 chars) to confirm auth header is being sent
- [x] Removed auto-clear of auth token on 401 — prevented token being wiped by failed syncevents call after registration
- [x] Initial connectivity check on startup for cloud mode (LED no longer stuck offline)
- [x] Cloud errors now shown as toast notifications in the UI
- [x] Added sourcemaps to electron-vite config for VS Code debugger support
- [x] VS Code launch config updated to attach mode with correct sourcemap paths
- [x] `image.uri` → `image.url` field name fix (actual API response uses `url`)
- [ ] Gallery still needs testing with a connected printer (files should now land in Printed Photos after printing)

### Key Decisions
- **Unified pipeline over dual pipeline** — cloud watcher now drops files into the watch folder instead of emitting `photo-ready` directly. Local watcher handles printing/moving identically in both modes. Eliminates duplicate code and makes gallery work naturally.
- **Per-image `updateDownloaded`** — called immediately after each verified download rather than batching. On crash, only the current in-flight image needs re-downloading.
- **Generation counter for poll cancellation** — `stop()` bumps a counter; the download loop checks it before each image. Correctly aborts a 1000-image loop when settings change mid-download.
- **`void this.poll()` in `start()`** — initial poll fires without blocking. Previously `await this.poll()` would block `start()` for the entire duration of downloading 1000 images, freezing save/modal.
- **`approved` field omitted (not `false`) when unchecked** — sending `false` would return only unapproved images. Omitting the field returns all images.
- **Registration state in `useCloud` not `useSettings`** — EventSelectorModal checks `useCloud.registered` (set immediately after activation) rather than `useSettings.cloudRegistered` (persisted but not updated until save).
- **Restart polling on `setApprovedOnly` change** — if filter changes mid-download-loop, `stop()` cancels it via generation counter and `start()` fires fresh with correct filter.

### Summary
Full cloud API integration implemented and tested end-to-end. Replaced the placeholder legacy API with the new SmartActivator spec (`/device/activate`, `/device/syncevents`, `/image/images`, `/image/updatedownloaded`). Built event selection UI, register/unregister flow, and approved-only filtering. Unified the printing pipeline so cloud and local modes share the same watch folder → print → gallery flow, eliminating duplicate code. Fixed multiple blocking issues (frozen save dialog, stuck STARTING modal, poll not cancelling on settings change, token being wiped after registration). Connected to live API and verified: registration, event sync, image download, and API mark-as-downloaded all working.

### Files Modified
- `src/main/api/endpoints.ts` — New types: ActivateRequest/Response, CloudEvent, ImageEntry, SyncEvents, GetImages, UpdateDownloaded; ACTIVATE/SYNC_EVENTS/IMAGES/UPDATE_DOWNLOADED endpoints
- `src/main/api/client.ts` — New functions: activateDevice, syncEvents, getImages, updateDownloaded; getLicenseKey/setLicenseKey; token logging; removed clearAuthToken on 401; checkNetworkConnectivity uses validateStatus
- `src/main/api/index.ts` — Updated barrel exports
- `src/main/watcher/cloud.ts` — Full rework: watchDirectory replaces temp dir, setWatchDirectory/setDeviceId/setApprovedOnly/selectEvent/syncEvents/unregister methods, generation counter, network abort, non-blocking start, per-image markDownloaded
- `src/main/index.ts` — cloud:unregister/sync-events/select-event/set-approved-only IPC handlers; setWatchDirectory at startup; local watcher started in both modes; setOnJobDone uses direct fs.rename
- `src/preload/index.ts` + `index.d.ts` — Added syncEvents, selectEvent, setApprovedOnly, unregister to cloud API surface; CloudEventDTO type; removed confirmPrint
- `src/renderer/src/stores/cloud.ts` — Added events, selectedEventId, licenseKey state; syncEvents/selectEvent/clearEventSelection/unregister actions; removed onPhotoReady→submitJob; cloud errors → toast
- `src/renderer/src/stores/settings.ts` — Added approvedOnly (persisted)
- `src/renderer/src/screens/SettingsD.tsx` — Register/unregister toggle; active license key display; event display + CHANGE EVENT button; approved-only checkbox; output folder in cloud mode; handleSave starts watcher in both modes
- `src/renderer/src/layouts/AppLayoutD.tsx` — EventSelectorModal rendered; local watcher starts regardless of mode; initial checkHealth on cloud mode startup
- `src/renderer/src/components/EventSelectorModal.tsx` — NEW: blocking event selection modal with auto-sync, refresh, TEST badge, stale state cleanup
- `electron.vite.config.ts` — sourcemap: true for main and preload
- `.vscode/launch.json` — Attach mode debugger config

### Outstanding Items
- [ ] Test gallery end-to-end with printer connected (files should move to Printed Photos after print)
- [ ] Confirm `https://smartprint.smartactivator-api.net` is the permanent production URL
- [ ] Remove debug token logging from client.ts request interceptor before production
- [ ] App icon cleanup (transparent background) — from prior session backlog
- [ ] Splash screen — from prior session backlog

### Next Session
- Connect a printer and verify full flow: cloud download → watch folder → print → Printed Photos → gallery
- The output folder must be set in Settings for cloud mode before polling can start
- Token and license key persist in `~/Library/Application Support/smart-print/cloud-config.json`

================================================================================
## 2026-02-15 Session (Windows Testing, Print Pipeline, Design Concept D)
================================================================================

### Tasks Completed
- [x] Fixed CI build — TypeScript errors from stale Photo type references after gallery store rewrite
- [x] Print pipeline: center-crop via `object-fit: cover` (no more white bars on mismatched aspect ratios)
- [x] Bundled fonts locally — replaced Google Fonts @import with @fontsource packages (Plus Jakarta Sans, JetBrains Mono, DM Sans, IBM Plex Mono). Critical for offline use.
- [x] Tightened CSP — removed Google Fonts domain whitelisting
- [x] Added Ctrl+Tab / Ctrl+Shift+Tab page navigation
- [x] Window sizing — 60% width x 80% height, centered on launch
- [x] Error boundaries wrapping each screen (Monitor, Gallery, Settings)
- [x] Live window title — "Smart Print — 3 printing, 12 completed"
- [x] Gallery auto-refresh when print jobs complete (1.5s delay for file move)
- [x] App logo wired into build (icon.ico, icon.icns, icon.png for all platforms)
- [x] NSIS installer target added — fixes 30-60s portable exe extraction on Windows
- [x] Settings persistence — replaced Zustand localStorage with electron-store via IPC (survives portable builds)
- [x] Auto-print hardcoded to always enabled, toggle removed from UI
- [x] **Print pipeline completely rewritten** — Electron's webContents.print() incompatible with DS40 dye-sub driver on Windows. Replaced with PowerShell + .NET System.Drawing.Printing (Windows GDI). macOS/Linux uses `lp` command.
- [x] Fixed PowerShell quoting — inline script via exec() was silently mangled by cmd.exe. Now writes .ps1 to temp file and executes with `-File` flag.
- [x] Print confirmed hitting Windows print spooler queue on DS40
- [x] Paper sizes now queried from Windows driver via .NET PrinterSettings.PaperSizes (same API as C# apps)
- [x] "Printing Press" skeuomorphic design concept (D) — 4 screens with industrial aesthetic
- [x] 8 color themes for D concept (Gunmetal, Brushed Silver, Champagne, Teal, Emerald, Brass, Military, Mozeus Brand)
- [x] Trimmed to 2 active themes: Mozeus (navy+green) and Silver Teal
- [x] UI cleanup: renamed modes (Local Print / Cloud Print), updated taglines, 4x3 registration input, removed API endpoint field, removed dark/light toggle, removed TIFF/BMP/HEIC formats, poll interval default 60s
- [x] Developer wiki — 17 pages pushed to Azure DevOps wiki (Architecture, Features, Development, Reference)
- [ ] Sweeping repo cleanup for performance on low-end devices (in progress)

### Key Decisions
- **Electron's webContents.print() is broken for dye-sub printers on Windows** — tried data URLs, file URLs, temp HTML files, webSecurity:false, silent:true/false. All fail instantly with the DS40 driver. Root cause: Chromium's print pipeline is incompatible with specialty printer drivers.
- **PowerShell + .NET GDI is the correct approach** — uses the same System.Drawing.Printing pipeline as native Windows apps. The DS40 driver was designed for GDI, not Chromium.
- **Temp .ps1 file, not inline PowerShell** — passing scripts via `exec("powershell -Command ...")` gets mangled by cmd.exe quoting. Writing to a temp file and using `-File` flag avoids all escaping issues.
- **Settings must use electron-store, not localStorage** — portable Electron builds on Windows don't reliably persist localStorage across restarts.
- **NSIS installer over portable** — portable .exe extracts to temp dir on every launch (30-60s). NSIS installs once to disk. Both artifacts now built by CI.
- **Design concept D chosen** — skeuomorphic "Printing Press" aesthetic. Mozeus brand theme (navy + green) as default. B3 "Soft Studio" files kept for reference.
- **Fonts must be local** — the primary use case is offline on a local network. No remote asset dependencies.

### Summary
First real Windows hardware test with the DS40 dye-sub printer. Discovered and resolved multiple critical issues: Electron's print API is fundamentally incompatible with specialty printer drivers on Windows, settings don't persist in portable builds, and Google Fonts caused 20-30s load delays on offline networks. Rewrote the entire print pipeline to use native OS printing (PowerShell/.NET on Windows, lp on macOS). Built the "Printing Press" skeuomorphic design concept with 8 color themes, settled on Mozeus brand (navy+green) as default. Created comprehensive developer wiki on Azure DevOps. Multiple UI refinements and label changes to match product direction.

### Files Modified
- src/main/printer/queue.ts — Complete rewrite: PowerShell/.NET GDI printing replaces Electron webContents.print()
- src/main/printer/manager.ts — Windows paper sizes via .NET PrinterSettings.PaperSizes
- src/main/index.ts — Settings electron-store, window sizing, poll interval defaults
- src/preload/index.ts + index.d.ts — Settings IPC, window title IPC, removed unused channels
- src/renderer/src/App.tsx — Switched to AppLayoutD
- src/renderer/src/stores/settings.ts — electron-store IPC storage adapter, removed autoPrint toggle, 60s poll default
- src/renderer/src/stores/pressTheme.ts — NEW: Zustand store for press theme selection
- src/renderer/src/themes/press-themes.ts — NEW: 8 theme definitions, 2 active
- src/renderer/src/layouts/AppLayoutD.tsx — NEW: Industrial press layout with theme support
- src/renderer/src/screens/MonitorD.tsx — NEW: Circular gauges, LED indicators, paper feed queue
- src/renderer/src/screens/GalleryD.tsx — NEW: Light table photo display
- src/renderer/src/screens/SettingsD.tsx — NEW: Control panel settings, 4x3 registration, cleaned labels
- src/renderer/src/components/ErrorBoundary.tsx — NEW: Crash-safe screen wrappers
- src/renderer/src/assets/main.css — Local @fontsource imports
- src/renderer/index.html — Tightened CSP
- electron-builder.yml — Added NSIS target, icon paths
- build/icon.ico, icon.icns, icon.png — App logo for all platforms
- Azure DevOps wiki — 17 pages of developer documentation

### Outstanding Items
- [ ] Confirm physical print quality on DS40 in person (Monday)
- [ ] Cloud event selection flow (waiting on YAML spec from architecture team)
- [ ] Sweeping repo cleanup (agent running)
- [ ] App icon with transparent background (clean up white corners)
- [ ] Splash screen with new logo

### Next Session
- Verify DS40 physical output quality and paper sizing
- Review and merge repo cleanup results
- Potentially refine Mozeus/Silver Teal themes based on in-person testing
- Cloud API integration when YAML spec arrives

================================================================================
## 2026-02-09 Session 2 (Bug Fixes, Persistence, CI/CD)
================================================================================

### Tasks Completed

- [x] Fixed printer status detection — CUPS `printer-state-reasons` checked before `printer-state`; `offline-report` now correctly maps to offline
- [x] Added `paused` printer status for held queues (Angie's Printer case)
- [x] Added CUPS media size query via `lpoptions -p <name> -l` with Windows PowerShell fallback
- [x] Added printer deduplication by device-uri serial/UUID (merges USB/AirPrint/network queues for same physical device)
- [x] Fixed file watcher: `ignoreInitial: false` to pick up existing files; fixed filename size check that was rejecting normal camera filenames
- [x] Added native directory picker via `dialog.showOpenDialog` IPC
- [x] Added settings persistence via zustand `persist` middleware (localStorage)
- [x] Added theme persistence across restarts
- [x] Added printer pool persistence in settings store
- [x] Auto-restore settings on launch: syncs pool to main process, auto-starts watcher, starts health monitor
- [x] Hid Session Uptime and Success Rate from Monitor (client-facing simplification)
- [x] Filtered Monitor printers to pool-only
- [x] Removed ink/paper level gauges (not available from Electron printer API)
- [x] Removed Export Original button from Gallery
- [x] Defaulted to light mode
- [x] Initialized git repo, committed 72 files (28,744 lines), pushed to Azure DevOps
- [x] Configured Azure Pipelines: Node.js on windows-latest, builds portable .exe, publishes as artifact

### Key Decisions

- CUPS `printer-state-reasons` must be checked BEFORE `printer-state` — macOS reports state=3 (idle) even for offline printers; the real status is in reasons (`offline-report`)
- Electron's `ep.status` returns 0 for all printers on macOS — must fall back to CUPS options
- Removed ink/paper gauges rather than showing fake data — Electron printer API doesn't expose these; would need vendor-specific SDKs per printer brand
- Paper sizes queried from print driver via `lpoptions` since Electron only exposes current media, not all supported
- Dedup uses device-uri serial/UUID, not display name — same model with different serials (physically separate printers) stays separate
- Settings persist to renderer localStorage via zustand — simpler than round-tripping through electron-store IPC
- "Set up once, open and go" architecture: persisted settings + auto-start on launch

### Summary

Major bug-fix and polish session. Fixed printer status detection for macOS CUPS, added real paper size queries from print drivers, implemented full settings persistence so clients configure once and the app auto-starts at every event. Set up git repo and Azure DevOps CI/CD pipeline producing downloadable Windows portable .exe artifacts.

### Files Modified

- src/main/printer/manager.ts — CUPS status fix, media query, dedup, paused status
- src/main/watcher/local.ts — ignoreInitial fix, filename size check fix
- src/main/index.ts — dialog IPC handler, getMediaSizes IPC
- src/main/printer/index.ts — export getMediaSizes
- src/preload/index.ts — openDirectory + mediaSizes API
- src/preload/index.d.ts — type declarations for new APIs
- src/renderer/src/stores/settings.ts — zustand persist, printerPool field
- src/renderer/src/stores/theme.ts — zustand persist, pre-hydration apply
- src/renderer/src/screens/SettingsB3.tsx — watcher start on save, pool from settings store, driver paper sizes, browse button wired
- src/renderer/src/screens/MonitorB3.tsx — removed stats/gauges, pool from settings store
- src/renderer/src/screens/GalleryB3.tsx — removed export button
- src/renderer/src/layouts/AppLayoutB3.tsx — auto-restore settings on mount
- azure-pipelines.yml — CI/CD pipeline (created via Azure DevOps UI)

### Outstanding Items

- [ ] End-to-end test on Windows with real printers
- [ ] Test file watcher with real photo drops
- [ ] Error boundaries and user-facing error messages
- [ ] Keyboard shortcuts
- [ ] App icon and branding

### Next Session

- Test on Windows: configure printers, drop photos, verify print jobs
- Address any Windows-specific issues (printer status mapping, file paths)
- Polish error handling and loading states

================================================================================
## 2026-02-09 Session (Full Build: Scaffolding → Backend → Design → Wiring)
================================================================================

### Tasks Completed

- [x] F001: Scaffolded Electron + React + TypeScript project with electron-vite
- [x] F002: Implemented printer integration module (discovery, queue, health, load balancing)
- [x] F003: Implemented local file monitoring (chokidar watcher, file verification, events)
- [x] F004: Implemented cloud API integration (axios client, polling, registration, retry logic)
- [x] F005-F007: Created 3 design concepts (A: Command Center, B: Dashboard Pro, C: Control Room)
- [x] Iterated on Design B with v2 (elevated typography, light/dark mode, front-end-design skill)
- [x] Created 2 additional B variants (B2: Warm Editorial, B3: Soft Studio)
- [x] Selected B3 "Soft Studio" as final design direction
- [x] Created Zustand stores bridging IPC API to React (settings, printer, watcher, cloud, gallery, theme)
- [x] Wired all B3 screens to real stores (replaced mock data with IPC-connected state)
- [x] Fixed electron-store v11 ESM/CJS interop issue
- [x] Set up Tailwind CSS v4 with full light/dark theme system via CSS variables
- [x] Configured electron-builder for Windows portable .exe

### Key Decisions

- Chose React/Tailwind code over Pencil mockups — faster iteration, no translation step
- Chose B3 "Soft Studio" (Plus Jakarta Sans + JetBrains Mono, copper accent, frosted glass nav) over B1 and B2
- Used parallel agents extensively — F002/F003/F004 built simultaneously, 3 design concepts simultaneously
- electron-store v11 requires ESM/CJS interop shim: `(module as any).default || module`
- Zustand stores use cross-store communication via `getState()` pattern for event forwarding
- Printer API DTO types derived from `window.api` return types to stay in sync with preload declarations

### Summary

Complete build session from zero to wired-up application. Scaffolded the Electron project, implemented all 4 backend modules (printer, watcher, cloud, API) in parallel, explored 5 design variations across 3 rounds, selected B3 "Soft Studio", created Zustand stores for the IPC bridge, and wired all screens to real data. The app now loads directly into the B3 design with full light/dark mode, real store connections, and event subscriptions. Screens show empty states until real printers/photos are available.

### Files Modified

- package.json, electron-builder.yml, electron.vite.config.ts — Project config
- src/main/index.ts — Main process with all IPC handlers
- src/main/printer/{manager,queue,health,index}.ts — Printer integration (F002)
- src/main/watcher/{local,cloud,index}.ts — File watching (F003) + Cloud polling
- src/main/api/{client,endpoints,index}.ts — API client (F004)
- src/preload/{index.ts,index.d.ts} — IPC bridge with typed APIs
- src/renderer/src/App.tsx — Simplified to load B3 directly
- src/renderer/src/assets/main.css — Tailwind v4 theme with light/dark CSS variables
- src/renderer/src/layouts/AppLayoutB3.tsx — Wired to stores
- src/renderer/src/screens/{SettingsB3,MonitorB3,GalleryB3}.tsx — Wired to stores
- src/renderer/src/stores/{settings,printer,watcher,cloud,gallery,theme}.ts — Zustand stores
- src/renderer/src/lib/utils.ts — cn() utility
- Plus design concept files: layouts/screens for A, B, B2, C (kept as reference)

### Outstanding Items

- [ ] Initialize git repository and create first commit
- [ ] Test with real printers on Windows
- [ ] Test local file watcher with actual photo drops
- [ ] Settings persistence across app restarts (electron-store integration for renderer prefs)
- [ ] Error boundaries and loading states
- [ ] Keyboard shortcuts

### Next Session

- Initialize git repo, commit all work
- Test end-to-end flow: configure settings → start watcher → drop photo → see in queue → print
- Add native file dialog for directory picker (electron dialog.showOpenDialog)
- Polish empty states and error handling

================================================================================
## 2025-02-09 Session (Project Initialization)
================================================================================

### Tasks Completed

- [x] Read and analyzed project requirements from requirements.md
- [x] Created CLAUDE.md from template with full project context
- [x] Created progress.md (this file) for session tracking
- [x] Created features_list.json with all features across 4 phases
- [x] Set up /update-progress slash command

### Key Decisions

- Organized features into 4 phases matching the requirement prompts
- Feature IDs follow pattern: F001-F004 for core phases, F005-F007 for UI screens
- UI design phase (3 concepts x 3 screens) tracked as separate features
- Chose to keep requirements.md as reference alongside structured docs

### Summary

Initialized the Smart Print project documentation using claude-project-templates.
Created CLAUDE.md with full architecture, API boundaries, and component status.
Set up features_list.json tracking 7 top-level features across scaffolding,
printer integration, local file monitoring, cloud API, and 3 UI screens.

### Files Modified

- CLAUDE.md - Created from template with project-specific info
- progress.md - Created (this file)
- features_list.json - Created with 7 features
- .claude/commands/update-progress.md - Created slash command

### Outstanding Items

- [ ] Actually scaffold the Electron + React + TypeScript project (F001)
- [ ] All implementation work pending

### Next Session

- Begin with Prompt 1: Project Scaffolding
- Set up electron-vite, install dependencies, create basic window
- Get "Photo Print Manager" displaying in center of window
