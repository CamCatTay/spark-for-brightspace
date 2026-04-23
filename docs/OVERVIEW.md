---
tags: [project, javascript, chrome-extension]
status: active
last-reviewed: 2026-04-22
---

# Spark - for Brightspace

## Overview
Spark is a Manifest V3 Chrome extension that injects a resizable side panel into any D2L/Brightspace page, aggregating assignment due dates, quizzes, and discussion deadlines from all enrolled courses into a single chronological calendar view. It targets students who find D2L's native interface poor at surfacing upcoming work across courses. The project uses the D2L REST API directly from the content script context, with HTML-scraping fallbacks for endpoints that can be closed or access-restricted by professors.

→ **Architecture and code walkthrough:** [ARCHITECTURE.md](ARCHITECTURE.md)
→ **How to develop locally:** [CONTRIBUTING.md](CONTRIBUTING.md)

### Stack
- **Language:** JavaScript (vanilla, no framework)
- **Framework:** Chrome Extensions API (Manifest V3)
- **Bundler:** Vite — compiles `src/` into `dist/` before the extension is loaded
- **Key dependencies:** None at runtime — uses only browser-native `fetch`, `chrome.*` APIs, and the D2L/Brightspace REST API
- **Entry points:** `src/content.js` (content script), `src/background.js` (service worker)

## Ideas

### Roadmap
- [ ] Grade display alongside assignments
- [ ] Notifications / reminders for upcoming deadlines
- [ ] Export to calendar (Google Calendar / .ics)
- [x] Show/hide completed items toggle

### Notes / tech debt
- Unused legacy fetch URLs for non-graded and graded items via the `myItems` endpoint are still present in `brightspace.js` — kept as a fallback reference but could be removed

## Connections
<!-- Leave this section blank. To be filled manually. -->
