Initial Claude Code Prompts
Prompt 1: Project Scaffolding
Create a new Electron + React + TypeScript application for a photo printing management system with the following structure:

PROJECT SETUP:
- Use electron-vite for build tooling
- Configure TypeScript with strict mode
- Set up Tailwind CSS for styling
- Install shadcn/ui components
- Configure electron-builder for Windows portable .exe

REQUIRED DEPENDENCIES:
- electron
- react, react-dom
- typescript
- zustand (state management)
- chokidar (file watching)
- axios (API client)
- winston (logging)
- electron-store (config persistence)

INITIAL STRUCTURE:
- src/main/ for Electron main process
- src/renderer/ for React UI
- src/preload/ for preload scripts
- Proper IPC communication setup with contextBridge

CONFIGURATION:
- electron-builder.yml for Windows build
- TypeScript configs for main/renderer/preload
- Tailwind config with custom theme
- ESLint + Prettier

Create the scaffolding with a basic window that opens and displays "Photo Print Manager" in the center.
Prompt 2: Printer Integration Module
Create the printer management system for the Photo Print Manager application:

REQUIREMENTS:
- Discover all available printers on Windows using Node.js native modules
- Return printer list with: name, driver, status, paper sizes, paper types
- Implement lazy loading to avoid blocking startup
- Cache printer capabilities in electron-store config
- Create print job submission function
- Implement queue health check function
- Support multi-printer load balancing (up to 4 printers)

ARCHITECTURE:
- src/main/printer/manager.ts - Printer discovery & caching
- src/main/printer/queue.ts - Print job operations
- src/main/printer/health.ts - Queue status monitoring
- Expose functions via IPC to renderer

ERROR HANDLING:
- Handle offline printers gracefully
- Fallback to next printer in multi-queue mode
- Log all operations
- Return detailed error messages

Create unit tests for core printer functions.
Prompt 3: File Monitoring (Local Mode)
Implement Local mode file monitoring for the Photo Print Manager:

REQUIREMENTS:
- Use Chokidar to watch user-specified directory
- Detect new JPG and PNG files (max 20MB)
- Verify file transfer completion by comparing:
  - Filename (should contain expected size in bytes)
  - Actual file size
- Only process "complete" files
- Move printed files to "Printed Photos" directory
- Emit events when new photos are ready to print

ARCHITECTURE:
- src/main/watcher/local.ts
- Configurable watch directory from electron-store
- Debounce file additions (wait for writes to complete)
- Handle file move operations
- Log all file operations

EVENTS:
- 'photo-ready' when file is complete and ready to print
- 'photo-printed' when file is moved to printed directory
- 'watch-error' on any file system errors

Include error handling for locked files, permission issues, and disk space.
Prompt 4: API Integration (Cloud Mode)
Implement Cloud mode API integration for the Photo Print Manager:

REQUIREMENTS:
- Device registration with 12-digit key
- Store auth token securely in electron-store
- Poll API endpoint every 15 seconds (configurable)
- Download photos from API URLs
- Verify downloads using API-provided file size
- POST print confirmation with filename
- Connection health checks

ARCHITECTURE:
- src/main/api/client.ts - Axios client with interceptors
- src/main/api/endpoints.ts - API endpoint definitions
- src/main/watcher/cloud.ts - Polling service
- Token refresh logic
- Retry logic with exponential backoff

API STRUCTURE:
- POST /register { registrationKey: string } → { token: string }
- GET /photos?token=xxx → { photos: [{ url, filename, sizeBytes }] }
- POST /photos/confirm { token, filename } → { success: boolean }
- GET /health → { status: 'ok' }

ERROR HANDLING:
- Network connectivity checks
- Display user-friendly errors
- Automatic retry for transient failures
- Log all API interactions

Include connection status indicator that pings /health on startup and every 60 seconds.

UI Design Strategy
To ensure 3 completely independent designs without cross-contamination:
Approach: 9 Separate Claude Code Sessions
Why 9 agents?

3 designs × 3 screens each = 9 screens total
Each agent works on ONE screen only
No shared context = truly original concepts
You can mix-and-match across designs later

Design Requirements for Each Agent:
You are designing a [SCREEN NAME] for a professional photo printing management application.

CONTEXT:
- Desktop Electron application
- Used at live events
- Must work at 1366x768 minimum resolution
- Modern, clean aesthetic
- NO purple gradients
- Inspired by: VSCode, Figma, Linear, Raycast

SCREEN: [Settings / Monitor / Gallery]

REQUIREMENTS:
[Screen-specific requirements]

Create a React component with Tailwind CSS that is:
- Intuitive and professional
- Easy to read in various lighting
- Responsive (1366x768 to 4K)
- Accessible (WCAG AA)
- Uses subtle animations

Do NOT reference or consider any other designs. Create something completely original.
9 Agent Assignments
Design Concept A:

Agent A1: Settings screen
Agent A2: Live monitor screen
Agent A3: Gallery screen

Design Concept B:
4. Agent B1: Settings screen
5. Agent B2: Live monitor screen
6. Agent B3: Gallery screen
Design Concept C:
7. Agent C1: Settings screen
8. Agent C2: Live monitor screen
9. Agent C3: Gallery screen
After Design Generation

Preview all 9 screens
Select favorite complete concept (A, B, or C)
Optionally mix screens from different concepts
Iterate on chosen direction in Claude Code