# Changelog

All notable changes to Spark for Brightspace are documented here.

---

## [Unreleased]

### Added

- **"Show on start" setting.** A new toggle in the settings panel controls whether the extension panel opens automatically when you navigate to a Brightspace page. Previously the panel always opened on load.
- **Settings state preserved across panel toggles.** If the settings panel is open when you collapse the main panel, it will reopen automatically when the main panel slides back in.
- **Reload settings into already-open tabs.** Changing a setting now propagates to all other open Brightspace tabs immediately without requiring a page reload.

### Changed

- **Default and minimum panel width increased.** The default width is now 400 px (up from 350 px). The minimum resize limit has also been raised to prevent visual artifacts at very narrow widths.
- **Panel and toggle button animations synchronised.** The toggle button now uses matching keyframe animations for slide-in/out instead of a CSS `transition`, eliminating the visible lag between the button and the panel edge. Animation duration is driven by a single `--spark-slide-ms` CSS variable set from the JS constant, so the two are guaranteed to stay in sync.
- **Simplified slide animations.** Replaced multi-stop `linear` keyframes with clean `from`/`to` keyframes using `ease-out` (slide in) and `ease-in` (slide out), removing per-frame layout calculations that caused lag during panel resizing.
- **CSS animation timing unified.** All panel slide timings (`body` margin, `#spark-widget`, `#spark-toggle-btn`) now share a single `--spark-panel-width` and `--spark-slide-ms` CSS custom property driven from `panel.ts`.

### Fixed

- **Settings panel failed to open** in certain cases after the TypeScript refactor. Fixed.

### Internal

- **Full TypeScript migration.** All files in `src/` converted from `.js` to `.ts`. Tests migrated from Jest to Vitest and rewritten against the TypeScript source.
- **CSS class names extracted to `dom-constants.ts`.** All CSS class and ID strings used in JavaScript are now defined as frozen constants in `src/ui/dom-constants.ts`, eliminating scattered magic strings.
- **Source files refactored for separation of concerns.** `panel.ts`, `calendar.ts`, `frequency-chart.ts`, `settings-menu.ts`, `ui-state.ts`, `background.ts`, and `content.ts` each refactored to own a single well-defined responsibility.
- **Legal / repository hygiene.** `CONTRIBUTING.md` moved to repo root (GitHub canonical location) and updated with a Contributor License Agreement. `SECURITY.md` added. `LICENSE` updated to explicitly cover a future Pro tier and prohibit payment circumvention. Copyright headers added to all source files.

---

## [1.2.1] — 2026-04-23

### Improved

- **Smarter automatic fetching.** Data fetches no longer depend solely on a full page reload.
  - Switching to a D2L tab now triggers a fetch if the 5-minute cooldown has elapsed.
  - Mouse movement or page scrolling (debounced 2 s) also triggers a fetch once the cooldown has lifted.
  - A full page reload always triggers a fetch unconditionally, bypassing the cooldown.
  - The manual refresh button inside the extension panel is unaffected by the cooldown and always fetches immediately.
- **Fetch on first install without a page reload.** When the extension is installed or re-enabled, the content script and styles are programmatically injected into any already-open Brightspace tabs. Previously, users had to manually reload every open tab before the extension became active.
- **Fetch on extension re-enable and browser restart.** The background service worker now detects cold starts (first install, re-enable, browser restart) via `chrome.storage.session` and re-injects into open Brightspace tabs automatically.
