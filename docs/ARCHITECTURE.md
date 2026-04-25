# Architecture

This document covers how Spark works internally — the major pieces, how they interact, non-obvious design decisions, and things that aren't obvious from reading the code alone. Intended for contributors who need to understand the codebase at depth.

---

## Big picture

Spark is a Chrome extension (Manifest V3) that injects a side panel into any D2L page. It uses the D2L REST API directly — no server-side component, no auth proxy. The browser's own session cookies are forwarded automatically with `fetch()` calls.

There are two runtime contexts that can never share memory:

| Context | File | Notes |
|---------|------|-------|
| Content script | `src/content.ts` | Injected into each D2L tab; owns runtime state |
| Service worker | `src/background.ts` | Shared singleton; handles API calls and message routing |

Everything in `src/ui/` and `src/utils/` runs only in the content script context. `src/api/brightspace.ts` runs only in the service worker. `src/shared/actions.ts` is inlined into both bundles at build time. `src/shared/types.ts` defines plain-object interfaces (`CourseShape`, `ItemShape`, `CourseData`) shared across the message boundary — these are type-only and have no runtime presence in either bundle.

---

## Entry points and the build

The browser loads `dist/content.js` and `dist/background.js`. These are built by Vite from `src/`. **Never edit `dist/` directly.**

```
src/content.ts   →  vite.content.config.js   →  dist/content.js    (IIFE format)
src/background.ts →  vite.background.config.js →  dist/background.js  (ES module format)
```

Vite compiles TypeScript to JavaScript internally via esbuild — `tsc` is not used for emit. Running `./node_modules/.bin/tsc --noEmit` is used only for type-checking.

**Why IIFE for the content script?** Chrome injects content scripts as plain `<script>` tags into the host page. There's no module resolution — `import` statements just fail. Vite's IIFE format wraps everything in `(function() { ... })()` and inlines all dependencies, so the output is a single self-contained file.

**Why ES module for the background?** MV3 service workers support `type: "module"` natively. It's also required for top-level `await`. The background script gets bundled anyway so `actions.js` works the same way in both contexts.

**Shared modules are duplicated, not shared.** Vite inlines a copy of `actions.ts` (and any other shared module) into each bundle independently. The two bundles have no runtime linkage. If you change a shared module, both bundles must be rebuilt.

---

## Message flow

All communication between the content script and service worker goes through `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`. The `Action` enum in `src/shared/actions.ts` defines all message types. Never use bare strings for message actions.

### Fetch sequence (happy path)

```
User opens panel / panel triggers refresh
  → content.js sends Action.BROADCAST_FETCH_STARTED to background
    → background broadcasts Action.FETCH_STARTED to all other D2L tabs
      → other tabs show their loading indicator (global_fetch_in_flight = true)

  → content.js sends Action.FETCH_COURSES to background
    → background calls get_course_content() in brightspace.js
      → API calls happen (quizzes, assignments, discussions, attempt counts, submissions)
    → background sends response back to content.js

  → content.js stores result in chrome.storage.local
  → content.js sends Action.BROADCAST_COURSE_DATA_UPDATED to background
    → background broadcasts Action.COURSE_DATA_UPDATED to all other D2L tabs
      → other tabs read from chrome.storage.local and re-render
```

### Per-tab panel state

Panel open/closed state is tracked per-tab in `sessionStorage` (`EXPANSION_STATE_KEY`). There is no cross-tab enforcement — multiple D2L tabs can have the panel open simultaneously.

`register_panel_restore_callback` is used to re-apply synced settings and re-render in-memory data whenever the tab regains visibility (via the `visibilitychange` event). This keeps the panel content fresh when a user switches back to a D2L tab.

---

## State and storage

Three different storage mechanisms are used intentionally:

| Storage | What lives there | Who reads it |
|---------|-----------------|--------------|
| `chrome.storage.local` | Course data, last-fetched timestamp, synced settings (look-back days, show-completed), anonymous client ID (`spark-client-id`) | Content script + service worker; survives tab close |
| `localStorage` | Panel width, `CALENDAR_START_DAYS_BACK` | Content script only; per-origin, survives browser restart |
| `sessionStorage` | Scroll position, hidden courses, hidden item types | Content script only; per-tab, cleared when tab closes |

**Why the split?**
- Course data must be accessible by the service worker, so it goes in `chrome.storage.local`.
- UI preferences that sync across tabs (look-back days) go in `chrome.storage.local` too, broadcast via `Action.BROADCAST_SETTINGS_CHANGED`.
- Per-tab session state (which courses are hidden, scroll position) goes in `sessionStorage` because it's intentionally not shared — each tab maintains its own view.
- Panel width goes in `localStorage` because it persists across sessions and is purely local.

If you add a new setting, decide: should it sync across tabs? → `chrome.storage.local` + broadcast. Should it persist but stay local? → `localStorage`. Should it reset when the tab closes? → `sessionStorage`.

---

## The API layer (`src/api/brightspace.ts`)

### How it finds courses

1. Fetches `/d2l/api/lp/1.43/enrollments/myenrollments/` — paginates automatically if `PagingInfo.HasMoreItems` is true
2. Filters to active, accessible courses where `OrgUnit.Type.Id === 3` (actual courses, not departments or org nodes)
3. Fetches the current user ID from `/d2l/api/lp/1.49/users/whoami`

### Pagination

`get_brightspace_data()` handles two different pagination styles used by different D2L endpoints:
- **`Next`-based**: `data.Objects` + `data.Next` URL for the next page (quiz/assignment endpoints)
- **`PagingInfo`-based**: `data.Items` + `data.PagingInfo.Bookmark` appended as a query param (enrollment endpoint)

This is handled recursively and transparently — callers just get a flat array back.

### Completion detection (the tricky part)

The D2L API doesn't reliably expose completion state for all item types. The extension works around this:

**Quizzes** — The submissions API doesn't give completion data cleanly. Instead, the extension scrapes the quiz summary HTML page at `/d2l/lms/quizzing/user/quiz_summary.d2l?qi=<id>&ou=<orgId>` and looks for `id="z_l"` containing "Completed - N". If N > 0, the quiz is done. There's a regex fallback that searches the whole body if the element selector fails.

**Assignments** — Tries the submissions API first: `/d2l/api/le/1.82/<courseId>/dropbox/folders/<assignmentId>/submissions/`. If the API returns an error object (e.g., the folder is closed by the professor and returns `{ Errors: [...] }`), it falls back to scraping the submission history page at `/d2l/lms/dropbox/user/folders_history.d2l?db=<id>&ou=<courseId>` and checking for `class="d_gn d_gt"` rows.

**Discussions** — Uses post counts from the discussion topic posts API. At least one post from the current user = completed. (Posts are fetched per topic.)

The HTML scraping is brittle by nature — if D2L changes their page structure, these selectors will break silently. Keep this in mind when debugging missing completion states.

### Parallel fetching

Quiz attempt counts are fetched in parallel per course using `Promise.all`. Same for assignment submissions. Per-course fetching itself is sequential (a `for...of` loop over courses) to avoid hammering the API. Within each course, quizzes and assignments are fetched in parallel.

The comment in the code notes that `.join(",")` was chosen over an alternative after profiling (~2× faster for constructing the course ID CSV).

### API version strings

D2L endpoints embed version numbers: `/d2l/api/le/1.82/...`, `/d2l/api/lp/1.49/...`. These are embedded in the endpoint strings defined as functions in `brightspace.ts`. Don't inline new version numbers — if you add an endpoint, define a clearly named helper function for it.

---

## UI layer

### `panel.ts` — the panel shell

Owns the panel DOM: `#spark-widget` (outer container) → `#spark-panel` → `#calendar-container`. Also creates the floating toggle button (`#spark-toggle-btn`).

Key responsibilities:
- **Resize**: A drag handle on the left edge lets users resize the panel. Min width is 250px. Width is persisted to `localStorage`.
- **Show/hide animation**: 400ms slide-in using CSS transform. An `is_animating` guard prevents triggering another toggle mid-animation.
- **Body margin**: `document.body.style.marginRight` is set to the panel width so D2L's content doesn't get covered. This is updated on resize.
- **Toggle button drag**: The floating toggle button (`#spark-toggle-btn`) is vertically draggable. Its position is persisted to `localStorage` (`TOGGLE_BTN_TOP_KEY`). A small drag threshold (4px) distinguishes a drag from a click.
- **Tab visibility restore**: `register_panel_restore_callback` fires whenever the tab becomes visible again (`visibilitychange` event) with the panel already open. It re-applies synced settings and re-renders from in-memory data.

### `components.ts` — all visual rendering

The heaviest file. Responsible for:
- The chronological calendar list (date headers + item cards)
- Urgency coloring (due today → orange, due tomorrow → yellow, overdue → red)
- **"Not yet available" items**: items with a `start_date` in the future get a `.not-yet-available` style and show an "Available on [date]" line. `clear_past_start_date()` in `brightspace.js` strips start dates that are already in the past before they reach the UI.
- The scrollbar notch indicator (colored dots on the right edge of the panel, one per item)
- The frequency bar chart (counts items per weekday, navigable by week). Each day column is clickable — clicking scrolls the calendar to that date.
- The settings slide-out panel
- Course name truncation (strips words like "Section", "Spring", "Fall" from course names for display)

Settings that sync across tabs are saved to `chrome.storage.local` + broadcast via the background. Settings that are session-only (hidden courses, hidden item types) go straight to `sessionStorage`.

### `color-utils.ts` — stable course colors

Courses are sorted lexicographically by name, then each gets a color from the 7-color pool by index. This means color assignment is deterministic and consistent across sessions and tabs, as long as the set of course names doesn't change. If a new course appears mid-semester, all colors may shift (because lexicographic order changes). This is a known limitation.

### `date-utils.ts`

Pure formatting helpers. No side effects. `formatDateHeader` is the one with the "Today · " / "Tomorrow · " prefix logic.

### CSS scoping

All panel styles are in `styles/sidepanel.css` and scoped under `:where(#spark-widget) *`. The `:where()` pseudo-class has **zero specificity**, so D2L's own styles always win in a conflict with the panel. The panel's internal styles only apply within `#spark-widget`. This was chosen to avoid accidentally overriding D2L's layout — the extension runs inside D2L's DOM, and any leaked style could break the page.

If you add a style and it's not applying, the most common cause is a D2L style with higher specificity winning. You may need to increase specificity within the widget selector, or use a more specific selector inside `#spark-widget`.

---

## Testing

Tests live in `tests/` and use [Vitest](https://vitest.dev/), which shares the same esbuild pipeline as the Vite build — TypeScript works with zero extra config. Run them with `npm test`.

Each source module that needs test isolation exports a minimal testing seam (e.g. `_resetColorMap()` in `color-utils.ts`). Modules with top-level side effects (e.g. `background.ts`) are imported dynamically inside `beforeEach` via `vi.doMock` + `vi.resetModules` + `await import()` so each test starts with a fresh module instance.

---

## Known gotchas and non-obvious behavior

**Uninstall page and feedback.** `chrome.runtime.setUninstallURL` points Chrome at `docs/uninstall.html` (hosted on GitHub Pages). When a user uninstalls, Chrome opens that page, which presents a short survey. Responses are `POST`ed (as JSON, `mode: no-cors`) to a Google Apps Script web app (`scripts/uninstall-feedback.gs`) which appends a row to a Google Sheet. Because `no-cors` responses are opaque, the page optimistically shows a success state regardless of network outcome.

**Anonymous client ID.** `chrome.runtime.onInstalled` fires with `reason === "install"` once on first install. The handler generates a UUID with `crypto.randomUUID()` and stores it in `chrome.storage.local` under `CLIENT_ID_KEY` (`spark-client-id`). It is never regenerated on updates or re-enables. Use `chrome.storage.local.get(CLIENT_ID_KEY)` to read it when tagging analytics events.

**`dist/` is committed to the repo.** The extension loads from `dist/`, and users who Load Unpacked from the repo root need those files to exist. Keep `dist/` up to date before committing source changes.

**The service worker can sleep.** MV3 service workers are terminated by Chrome when idle. The background script re-registers its `onMessage` listener on every wake. This is fine for request/response patterns but means you can't store anything in module-level variables in the background script and expect it to persist between messages.

**`safe_send_message` in `panel.ts`** wraps `chrome.runtime.sendMessage` with error suppression. The service worker might not be awake yet when a message is sent — this prevents uncaught errors in that case. If you're debugging missing message responses, check whether the service worker is awake.

**Course name truncation** strips words like "Section", "Fall", "Spring", "Group", and "XLS" from the end of course names for display. The full name is still used for color assignment and internal keying. If a course name looks wrong in the UI, check `COURSE_NAME_TRIM_WORDS` in `components.ts`.

**Start dates are cleared if in the past.** `clear_past_start_date()` in `brightspace.ts` returns `null` if the item's start date has already passed. This prevents items from showing a start date that's already come and gone, which would be confusing.

**Discussions use forum → topics → posts hierarchy.** Each course can have multiple forums, each forum has multiple topics, and each topic has posts. The extension fetches all three levels. If a professor creates a lot of discussion forums, this can be a meaningful number of API calls.

---

## File size reference (approx.)

| File | Lines |
|------|-------|
| `src/api/brightspace.ts` | ~400 |
| `src/ui/components.ts` | ~600+ |
| `src/ui/panel.ts` | ~250 |
| `src/content.ts` | ~200 |
| `src/background.ts` | ~70 |
| `styles/sidepanel.css` | ~600+ |
