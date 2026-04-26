# Contributing

---

## Contributor License Agreement

By submitting a pull request or otherwise contributing code, documentation, or other materials to this project, you agree to the following terms:

1. **IP Assignment.** You irrevocably assign all intellectual property rights in your contribution — including copyright — to the project copyright holders (CamCatTay). This assignment takes effect automatically upon submission.
2. **Original work.** You represent that your contribution is your own original work and that you have the right to make this assignment.
3. **License terms.** Your contribution is governed by the same license as the rest of this project (see the [LICENSE](LICENSE) file). You understand that the copyright holders may use, relicense, or commercialize the project and your contribution without further notice or compensation.

If you do not agree to these terms, do not submit a pull request.

---

## Running locally

```bash
npm install        # first time only
npm run build      # compile src/ → dist/
```

Then in Chrome: `chrome://extensions/` → Developer Mode → Load unpacked → pick the repo root.

After every source change you need to rebuild and reload:
```bash
npm run build
```
Then click the reload icon on the Spark card in `chrome://extensions/`. You don't need to re-load unpacked unless you change `manifest.json`.

**The extension only activates on pages matching `https://*/d2l/*`.** You need to be on an actual D2L page for the icon to do anything.

To run tests:
```bash
npm test
```

> Tests use [Vitest](https://vitest.dev/) and run directly against TypeScript source with no extra compilation step.

---

## Project structure quick reference

```
src/
  background.ts        service worker — message router, cross-tab sync
  content.ts           content script — owns runtime state, wires everything together
  api/
    brightspace.ts     all D2L API calls + HTML scraping fallbacks
  shared/
    actions.ts         Action enum used for chrome message passing
    types.ts           shared plain-object interfaces (CourseShape, ItemShape, CourseData)
  ui/
    panel.ts           panel DOM, resize, show/hide, toggle button
    components.ts      all rendering: calendar list, frequency chart, settings panel
  utils/
    color-utils.ts     stable course → color assignment
    date-utils.ts      date formatting helpers
styles/
  sidepanel.css        all CSS for the panel, scoped under :where(#spark-widget)
dist/                  build output — do not edit directly
tests/                 Vitest unit tests
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a deeper breakdown of how these pieces actually interact.

---

## Build system

Two separate Vite configs, one per entry point:

| Config | Input | Output | Format |
|--------|-------|--------|--------|
| `vite.content.config.js` | `src/content.ts` | `dist/content.js` | IIFE |
| `vite.background.config.js` | `src/background.ts` | `dist/background.js` | ES module |

Both use `emptyOutDir: false` so they don't clobber each other.

TypeScript is compiled to JavaScript by Vite's internal esbuild pipeline — `tsc` is not used for emit. To type-check without building:
```bash
./node_modules/.bin/tsc --noEmit
```

Content scripts must be IIFE because Chrome injects them as plain `<script>` tags with no module resolution. The service worker uses ES module because MV3 supports it natively and it's required for top-level `await`.

`npm run package` builds both bundles, then zips `dist/`, `styles/`, `icons/`, and `manifest.json` into a release zip for Web Store submission.

---

## Branching and commits

No strict convention enforced — just use common sense:

- Work on a feature branch, not directly on `main`
- Branch names: `feature/short-description` or `fix/short-description`
- Commit messages: imperative, present tense — "add frequency chart toggle" not "added" or "adding"
- Keep commits focused. One logical change per commit is ideal.
- Squash or clean up before merging if the branch got messy

---

## Merging / PRs

- For small changes (bug fixes, copy tweaks), merge directly after a quick self-review
- For anything that touches the API layer, message flow, or CSS scoping, get a second pair of eyes
- No force-pushes to `main`
- Delete branches after merging

---

## Releasing a new version

Version is stored in two places — `package.json` and `manifest.json`. The `npm version` lifecycle hook keeps them in sync automatically:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

This runs `scripts/sync-version.js` which copies the version from `package.json` into `manifest.json` and stages it. Then `npm run package` to build the zip.

---

## Things easy to forget after time away

**You must rebuild after every source change.** Chrome loads from `dist/`, not `src/`. If your changes aren't showing up, you probably forgot to run `npm run build` or forgot to reload the extension.

**The panel only shows on D2L pages.** `manifest.json` matches `https://*/d2l/*`. Local test pages or other sites won't trigger it.

**Storage is split intentionally.** Course data, last-fetched timestamp, and synced settings (look-back days, show-completed toggle) live in `chrome.storage.local` (shared across all tabs and the service worker). Panel width lives in `localStorage` (per-origin, fast reads, survives restarts). Per-tab session state (hidden courses, hidden item types, scroll position) lives in `sessionStorage` (cleared when the tab closes). Don't mix these up — putting course data in localStorage means the service worker can't read it.

**Settings sync vs. session-only.** Some settings are synced across tabs via `chrome.storage.local` + broadcast (look-back days, show-completed toggle). Others are session-only per-tab (hidden courses, hidden item types). This is intentional — see `components.js` storage key comments.

**The `dist/` files are committed.** They need to be in the repo so the extension can be loaded without running a build step. Keep them up to date before committing source changes.

**CSS specificity trick.** All panel styles are scoped under `:where(#spark-widget) *`. The `:where()` pseudo-class has zero specificity, which means D2L's own styles always win in a conflict. If you add a style and it's not showing up, check whether D2L is overriding it — you may need to be more specific inside the widget selector.

**API version strings are constants.** D2L REST API endpoints embed a version like `/d2l/api/le/1.82/...`. These are defined as named constants in `brightspace.ts` — don't inline new version numbers directly in endpoint strings.

**The two bundles are independent.** Vite inlines a copy of any shared module (like `actions.js`) into each bundle separately. They share no runtime linkage. If you change `actions.js`, both bundles need to be rebuilt.
