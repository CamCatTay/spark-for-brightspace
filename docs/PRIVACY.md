# Privacy Policy

Spark for Brightspace is a browser extension that displays your Brightspace course data in a side panel. This document explains what data the extension accesses, why, and what permissions it requires.

---

## Data Collection

Spark for Brightspace does **not** collect, transmit, or store any personal data on external servers. All data the extension reads remains on your device.

---

## Permission Justifications

### `storage`
`chrome.storage.local` is used to cache fetched course data between page loads and persist user display preferences. `chrome.storage.session` is used to store a single boolean flag per service worker lifecycle to determine whether programmatic injection has already been performed during the current session, preventing duplicate injections on routine service worker wake cycles. No data written to storage is ever transmitted externally.

### `tabs`
The extension maintains a single shared data cache across all concurrently open Brightspace tabs. When one tab completes a fetch, the background service worker must identify all other open Brightspace tabs in order to broadcast a sync message so they update from storage rather than issuing redundant API calls. `chrome.tabs.query` is called solely to filter tabs by URL against the `/d2l/` path. No tab title, page content, or navigation history is accessed at any point.

### `scripting`
Declarative content script injection via the `content_scripts` manifest key only applies to tabs navigated to *after* the extension is loaded. Tabs already open at the time of install, re-enable, or browser restart receive no content script and the extension is entirely non-functional in those tabs until the user manually reloads — with no feedback indicating why. `chrome.scripting.executeScript` and `chrome.scripting.insertCSS` are used to inject the content script and stylesheet into those pre-existing tabs, triggered once per cold start via a `chrome.storage.session` guard. Injection is conditional: before injecting, the background runs an inline script check to confirm the content script is not already present, preventing duplicate instances. All injections are scoped exclusively to tabs matching `https://*/d2l/*`.

### `host_permissions` — `https://*/d2l/*`
Manifest V3 requires that any origin targeted by `chrome.scripting` be explicitly listed in `host_permissions`; the `content_scripts` matches declaration does not satisfy this requirement for programmatic injection. Brightspace is a multi-tenant LMS deployed by institutions at their own domain names (e.g. `university.brightspace.com`, `d2l.institution.edu`), making a fixed-host permission unworkable. All Brightspace deployments serve their application exclusively under the `/d2l/` path, making `https://*/d2l/*` the narrowest pattern that correctly covers all valid Brightspace origins without over-reaching into unrelated pages on those same hosts.

---

## What Data Is Accessed

The extension makes authenticated requests to your institution's Brightspace API to retrieve your course list, assignments, quizzes, and discussions. These requests are made using your existing browser session cookies — no credentials are ever read or stored by the extension. The fetched data is cached locally in `chrome.storage.local` solely to display it in the panel without requiring a network request on every page load.

---

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/camcattay/spark-for-brightspace).
