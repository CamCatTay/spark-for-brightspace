# Privacy & Terms

Spark for Brightspace is a browser extension that displays your Brightspace course data in a side panel. This document explains what data the extension accesses, why, and what permissions it requires.

**Effective Date:** September 15, 2026

---

## 1. Overview

Spark for Brightspace is a browser extension that displays your upcoming assignment due dates in a convenient side panel as you navigate your institution's D2L Brightspace portal. This policy is here to be upfront about what information the extension accesses, what gets saved on your device, and what we simply don't do.

**The short version:** your Brightspace data and preferences never leave your device. The only information that leaves your device is the optional uninstall survey response, which is entirely anonymous and voluntary.

---

## 2. Privacy & Data Handling

Spark for Brightspace does **not** collect, transmit, or store any personal data on external servers. All data the extension reads remains on your device.

The one exception is the **optional uninstall survey**. When the extension is uninstalled, Chrome opens a feedback page. If you choose to submit the form, the following information is sent to a private Google Sheet via a Google Apps Script web app:

- The reason you selected from the multiple-choice list
- A free-text explanation (only if you chose "Other", maximum 500 characters)
- A timestamp indicating when the form was submitted

This submission is entirely voluntary - you can close the page without filling in anything. No name, account, device identifier, or install ID is included in the submission. The data is used only to understand aggregate uninstall trends and improve the extension.

### `storage`
`chrome.storage.local` is used to cache fetched course data between page loads, persist user display preferences, and store a randomly generated anonymous install ID (`spark-client-id`). This ID is a UUID created locally by `crypto.randomUUID()` on first install. It is not linked to any account, device, or identity and is used only to distinguish unique installs in aggregate analytics. `chrome.storage.session` is used to store a single boolean flag per service worker lifecycle to determine whether programmatic injection has already been performed during the current session, preventing duplicate injections on routine service worker wake cycles. No personal data written to storage is ever transmitted externally.

### `tabs`
The extension maintains a single shared data cache across all concurrently open Brightspace tabs. When one tab completes a fetch, the background service worker must identify all other open Brightspace tabs in order to broadcast a sync message so they update from storage rather than issuing redundant API calls. `chrome.tabs.query` is called solely to filter tabs by URL against the `/d2l/` path. No tab title, page content, or navigation history is accessed at any point.

### `scripting`
Declarative content script injection via the `content_scripts` manifest key only applies to tabs navigated to *after* the extension is loaded. Tabs already open at the time of install, re-enable, or browser restart receive no content script and the extension is entirely non-functional in those tabs until the user manually reloads - with no feedback indicating why. `chrome.scripting.executeScript` and `chrome.scripting.insertCSS` are used to inject the content script and stylesheet into those pre-existing tabs, triggered once per cold start via a `chrome.storage.session` guard. Injection is conditional: before injecting, the background runs an inline script check to confirm the content script is not already present, preventing duplicate instances. All injections are scoped exclusively to tabs matching `https://*/d2l/*`.

### `host_permissions` - `https://*/d2l/*`
Manifest V3 requires that any origin targeted by `chrome.scripting` be explicitly listed in `host_permissions`; the `content_scripts` matches declaration does not satisfy this requirement for programmatic injection. Brightspace is a multi-tenant LMS deployed by institutions at their own domain names (e.g. `university.brightspace.com`, `d2l.institution.edu`), making a fixed-host permission unworkable. All Brightspace deployments serve their application exclusively under the `/d2l/` path, making `https://*/d2l/*` the narrowest pattern that correctly covers all valid Brightspace origins without over-reaching into unrelated pages on those same hosts.

---

## 3. What Data Is Accessed

The extension makes authenticated requests to your institution's Brightspace API to retrieve your course list, assignments, quizzes, and discussions. These requests are made using your existing browser session cookies - no credentials are ever read or stored by the extension. The fetched data is cached locally in `chrome.storage.local` solely to display it in the panel without requiring a network request on every page load.

---

## 4. What We Never Do

- We do **not** collect, share, or transmit any personal or academic data.
- We do **not** access any information outside of your institution's Brightspace domain.
- We do **not** read your username, password, or any login credentials.
- We do **not** operate any persistent backend servers or user-facing databases.

---

## 5. Permissions

The extension requests the following browser permissions, each with a specific purpose:

- **Tabs** - used to identify which tab is currently viewing Brightspace and to ensure only one tab shows the side panel at a time.
- **Scripting** - used to inject the side panel interface into Brightspace pages.
- **Storage** - used to cache your course data and remember your panel preferences locally on your device.

The extension only activates on pages within your institution's Brightspace domain (pages matching `https://*/d2l/*`). It remains completely inactive on every other website you visit.

---

## 6. Disclaimer & Limitation of Liability

Spark for Brightspace is an independent, open-source tool and is not affiliated with, endorsed by, or partnered with D2L Corporation or Brightspace.

The extension is provided **"AS IS"** without warranty of any kind. While Spark strives to display accurate assignment and calendar data, syncing or parsing may occasionally fail due to network errors, custom institutional settings, or updates to the Brightspace platform.

You are solely responsible for double-checking all official assignment deadlines, exam schedules, and course deliverables directly within your institution's official Brightspace portal. The developer and contributors shall not be liable for any missed deadlines, academic penalties, or lost data resulting from the use of this extension.

---

## 7. Changes to This Policy

If this privacy policy is updated for any reason, the revised version will be published here and the effective date at the top of this page will be updated accordingly. Any meaningful changes will also be highlighted in the release notes for the relevant update.

---

## 8. Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/camcattay/spark-for-brightspace).
