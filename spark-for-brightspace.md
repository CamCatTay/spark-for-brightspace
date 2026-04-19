---
tags: [project, javascript, chrome-extension]
status: active
last-reviewed: 2026-04-18
---

# Spark - for Brightspace

## Overview
Spark is a Manifest V3 Chrome extension that injects a resizable side panel into any D2L/Brightspace page, aggregating assignment due dates, quizzes, and discussion deadlines from all enrolled courses into a single chronological calendar view. It targets students who find D2L's native interface poor at surfacing upcoming work across courses. The project uses the D2L REST API directly from the content script context, with HTML-scraping fallbacks for endpoints that can be closed or access-restricted by professors.

### Stack
- **Language:** JavaScript (vanilla, no framework)
- **Framework:** Chrome Extensions API (Manifest V3)
- **Bundler:** Vite — compiles `src/` into `dist/` before the extension is loaded
- **Key dependencies:** None at runtime — uses only browser-native `fetch`, `chrome.*` APIs, and the D2L/Brightspace REST API
- **Entry points:** `src/content.js` (content script), `src/background.js` (service worker)
- **How to run:**
  1. Run `npm run build` to compile `src/` → `dist/`
  2. Open `chrome://extensions` → Enable Developer Mode → Load Unpacked → select the repo root
  3. After any source change, run `npm run build` again and click the reload icon on the extension card

### Build Toolchain

The project uses **Vite** as a bundler. Vite reads the ES module `import`/`export` graph starting from each entry point, inlines all imported modules into a single output file, and writes the result to `dist/`. Chrome then loads those flat files — no module resolution happens at runtime.

#### Why bundling is needed for content scripts
Chrome content scripts are injected into a web page as plain `<script>` tags. They do not have access to Node.js `require()`, and Chrome does not process ES module `import` statements in content scripts. This means you cannot write `import { Action } from './shared/actions.js'` in a content script and have Chrome resolve it automatically.

The service worker (`background.js`) does support `type: "module"` natively in MV3, but we bundle it anyway so the same module graph works consistently and shared code (like `actions.js`) does not need to be maintained in two formats.

#### Output files
| File | Format | Source entry point |
|------|--------|--------------------|
| `dist/content.js` | IIFE (Immediately Invoked Function Expression) | `src/content.js` |
| `dist/background.js` | ES module | `src/background.js` |

**IIFE** wraps the entire bundle in `(function() { ... })()` so all variables are scoped and never leak into the page's global namespace. This is the correct format for content scripts.

**ES module** is used for the background service worker because Chrome MV3 supports it natively and it is required for top-level `await`.

#### Config files
There are two separate Vite config files — one per entry point — because each requires a different output format:

- **`vite.content.config.js`** — builds `src/content.js` as an IIFE into `dist/content.js`
- **`vite.background.config.js`** — builds `src/background.js` as an ES module into `dist/background.js`

Both set `emptyOutDir: false` so each build writes its own file without deleting the other's output.

#### npm scripts
| Command | What it does |
|---------|--------------|
| `npm run build` | Builds both content and background bundles |
| `npm run build:content` | Builds only `dist/content.js` |
| `npm run build:background` | Builds only `dist/background.js` |
| `npm run package` | Runs `build`, then zips `dist/`, `styles/`, `icons/`, and `manifest.json` into a release zip |
| `npm test` | Runs Jest unit tests (tests import directly from `src/`, bypassing `dist/`) |

#### How shared code is handled
When two entry points both import the same module (e.g. `src/shared/actions.js`), Vite inlines a copy of that module into **each** output bundle independently. The two bundles share no runtime linkage — `dist/content.js` and `dist/background.js` each contain their own copy of the `Action` enum. This is intentional: the bundles are loaded in completely separate contexts (a web page vs. a service worker) and cannot share memory anyway.

### Architecture
The codebase is a flat `scripts/` layer with no bundler or module graph beyond what the browser resolves at injection time.

- **`background.js`** — MV3 service worker. Acts as a message router: it receives `fetchCourses` requests from content scripts, calls `brightspace.js` to hit the API, and returns the result. Also coordinates cross-tab sync by broadcasting `panelOpened`, `panelClosed`, `broadcastFetchStarted`, and `broadcastCourseDataUpdated` messages to all other open D2L tabs, enforcing a single-active-panel invariant.

- **`content.js`** — Content script injected into every D2L page. Owns the runtime state: `courseData`, fetch-in-flight flags, and `lastFetchedTime`. Wires together `panel.js`, `ui-components.js`, and `background.js` messages. Handles settings persistence to `chrome.storage.local` and scroll position save/restore across page navigations.

- **`brightspace.js`** — All API calls to the D2L REST API. Fetches enrollments, then per-course quizzes, assignments, and discussion forums/topics in parallel where possible. Determines completion status by hitting secondary endpoints: quiz attempt counts are scraped from the HTML quiz summary page (`z_l` element), and assignment submissions fall back to scraping the submission history page (`d_gn d_gt` row detection) when the API returns an error (e.g., a professor-closed folder). Exports `get_course_content`, `mapData`, and individual fetch helpers.

- **`brightspace-test-data.js`** — Fake data generator used when `TEST_MODE = true` is set in `brightspace.js`. Produces randomized courses, assignments, quizzes, and discussions for UI development without hitting a live D2L instance.

- **`panel.js`** — Constructs and mounts the side panel DOM (`#d2l-todolist-widget`). Handles show/hide toggle animation, resizing via a drag handle (min 250 px), panel-width persistence in `localStorage`, and the `closePanelSilently` path used when another tab takes over.

- **`ui-components.js`** — All visual rendering. Builds the chronological calendar list (date headers + item cards with color-coded urgency), the week-navigable frequency bar chart, and the settings slide-out panel. Settings (look-back days, hidden courses, hidden item types) are stored in `localStorage` and synced across tabs via `broadcastSettingsChanged` messages.

- **`color-utils.js`** — Assigns a stable color from a fixed 7-color pool to each course by sorting course names lexicographically and picking by index mod pool size.

- **`date-utils.js`** — Formatting helpers: `formatTimeFromDate`, `formatFullDatetime`, `formatDateHeader` (with "Today · " / "Tomorrow · " prefixes), `getWeekStart`, `getDateKey`.

- **`styles/sidepanel.css`** — All CSS, scoped under `:where(#d2l-todolist-widget) *` to achieve zero specificity against D2L's own styles. Includes panel layout, slide-in/out animations, calendar items, the frequency chart, scrollbar notch indicator, and the settings panel.

### Key Decisions
- **No build toolchain (superseded):** Scripts were originally loaded directly by the browser via `content_scripts` in `manifest.json`. This was replaced by a Vite build step because Chrome content scripts cannot resolve ES module `import` statements at runtime. The bundler inlines all imports at build time, producing a single flat file that Chrome can inject without any module resolution.
- **Manifest V3 service worker:** Chosen to align with Chrome's current extension platform requirements, replacing the persistent background page of MV2. Cross-tab messaging replaces any shared in-memory state that a persistent page would have provided.
- **Single-active-panel invariant:** Only one D2L tab may show the panel at a time. When a tab opens its panel, the service worker broadcasts a close command to all other D2L tabs. This sidesteps duplicate fetch issues and competing UI state across tabs.
- **API + HTML scraping hybrid:** The D2L REST API does not expose quiz completion or submission state cleanly for all configurations. The extension falls back to scraping server-rendered HTML (`d2l/lms/quizzing/user/quiz_summary.d2l`, `d2l/lms/dropbox/user/folders_history.d2l`) when API endpoints fail or return error objects, making the completion detection more robust at the cost of brittleness to D2L UI changes.
- **`chrome.storage.local` vs. `localStorage` split:** Course data and last-fetched timestamps go to `chrome.storage.local` (shared by the service worker and all content scripts). UI preferences (panel width, hidden courses, look-back days) go to `localStorage` (per-origin, faster for render-time reads).
- **Parallel submission/attempt fetching via `Promise.all`:** Per-course quiz attempts and assignment submissions are fetched in parallel per course, then assignments are mapped synchronously. A benchmark comment in `brightspace.js` (`getCourseIds`) notes that `.join()` was chosen over an alternative after profiling (~2× faster).
- **CSS `:where()` scoping:** Using `:where(#d2l-todolist-widget) *` ensures the extension's styles have zero specificity, so they cannot accidentally override D2L's own CSS while still being applied within the panel.

## Ideas

### Roadmap (from README)
- [ ] Grade display alongside assignments — `README.md`
- [ ] Notifications / reminders for upcoming deadlines — `README.md`
- [ ] Export to calendar (Google Calendar / .ics) — `README.md`

### Comments
- [ ] Toggle completed items on/off in the frequency chart as a user setting — `scripts/ui-components.js:518` *(currently only incomplete items are counted; noted as a future setting)*
- [ ] Unused legacy fetch URLs for non-graded and graded items via the `myItems` endpoint are still present — `scripts/brightspace.js:287` *(kept as a fallback in case per-type fetching is reverted; could be removed or documented as dead code)*
- [ ] `TEST_MODE` flag is a manual developer toggle — `scripts/brightspace.js:22` *(no test runner or CI; fake data mode requires a source edit to activate)*

## Connections
<!-- Leave this section blank. To be filled manually. -->
