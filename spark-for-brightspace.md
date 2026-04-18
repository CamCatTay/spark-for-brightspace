---
tags: [project, javascript, chrome-extension]
status: active
last-reviewed: 2026-04-18
---

# Spark - for Brightspace

## Overview
Spark is a Manifest V3 Chrome extension that injects a resizable side panel into any D2L/Brightspace page, aggregating assignment due dates, quizzes, and discussion deadlines from all enrolled courses into a single chronological calendar view. It targets students who find D2L's native interface poor at surfacing upcoming work across courses. The project uses the D2L REST API directly from the content script context, with HTML-scraping fallbacks for endpoints that can be closed or access-restricted by professors.

### Stack
- **Language:** JavaScript (vanilla, no build toolchain)
- **Framework:** Chrome Extensions API (Manifest V3)
- **Key dependencies:** None — uses only browser-native `fetch`, `chrome.*` APIs, and the D2L/Brightspace REST API
- **Entry points:** `scripts/content.js` (content script), `scripts/background.js` (service worker)
- **How to run:** Load unpacked via `chrome://extensions` → Enable Developer Mode → Load Unpacked → select repo root. Works on any Chromium-based browser targeting `https://*/d2l/*`.

### Architecture
The codebase is a flat `scripts/` layer with no bundler or module graph beyond what the browser resolves at injection time.

- **`background.js`** — MV3 service worker. Acts as a message router: it receives `fetchCourses` requests from content scripts, calls `brightspace.js` to hit the API, and returns the result. Also coordinates cross-tab sync by broadcasting `panelOpened`, `panelClosed`, `broadcastFetchStarted`, and `broadcastCourseDataUpdated` messages to all other open D2L tabs, enforcing a single-active-panel invariant.

- **`content.js`** — Content script injected into every D2L page. Owns the runtime state: `courseData`, fetch-in-flight flags, and `lastFetchedTime`. Wires together `panel.js`, `ui-components.js`, and `background.js` messages. Handles settings persistence to `chrome.storage.local` and scroll position save/restore across page navigations.

- **`brightspace.js`** — All API calls to the D2L REST API. Fetches enrollments, then per-course quizzes, assignments, and discussion forums/topics in parallel where possible. Determines completion status by hitting secondary endpoints: quiz attempt counts are scraped from the HTML quiz summary page (`z_l` element), and assignment submissions fall back to scraping the submission history page (`d_gn d_gt` row detection) when the API returns an error (e.g., a professor-closed folder). Exports `getCourseContent`, `mapData`, and individual fetch helpers.

- **`brightspace-test-data.js`** — Fake data generator used when `TEST_MODE = true` is set in `brightspace.js`. Produces randomized courses, assignments, quizzes, and discussions for UI development without hitting a live D2L instance.

- **`panel.js`** — Constructs and mounts the side panel DOM (`#d2l-todolist-widget`). Handles show/hide toggle animation, resizing via a drag handle (min 250 px), panel-width persistence in `localStorage`, and the `closePanelSilently` path used when another tab takes over.

- **`ui-components.js`** — All visual rendering. Builds the chronological calendar list (date headers + item cards with color-coded urgency), the week-navigable frequency bar chart, and the settings slide-out panel. Settings (look-back days, hidden courses, hidden item types) are stored in `localStorage` and synced across tabs via `broadcastSettingsChanged` messages.

- **`color-utils.js`** — Assigns a stable color from a fixed 7-color pool to each course by sorting course names lexicographically and picking by index mod pool size.

- **`date-utils.js`** — Formatting helpers: `formatTimeFromDate`, `formatFullDatetime`, `formatDateHeader` (with "Today · " / "Tomorrow · " prefixes), `getWeekStart`, `getDateKey`.

- **`styles/sidepanel.css`** — All CSS, scoped under `:where(#d2l-todolist-widget) *` to achieve zero specificity against D2L's own styles. Includes panel layout, slide-in/out animations, calendar items, the frequency chart, scrollbar notch indicator, and the settings panel.

### Key Decisions
- **No build toolchain:** Scripts are loaded directly by the browser via `content_scripts` in `manifest.json`, avoiding any Node.js dependency. This keeps the install and contribution story trivial at the cost of no tree-shaking or type checking.
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
