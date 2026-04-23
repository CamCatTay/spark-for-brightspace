// Handles the background service worker: fetches course data, manages caching,
// and responds to messages from the content script.

import { get_course_content } from "/src/api/brightspace.js";
import { Action } from "./shared/actions";

const SETTINGS_VALUE_KEY = "spark-user-settings";
const D2L_URL_FILTER = "/d2l/";
const FAQ_URL = "https://camcattay.github.io/spark-for-brightspace/faq.html";
const SPARK_INITIALIZED_FLAG = "__spark_initialized__";
const SESSION_WORKER_INITIALIZED_KEY = "worker_initialized";

function broadcast_to_d2l_tabs(sender_tab_id, message) {
    chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
            if (tab.id !== sender_tab_id && tab.url && tab.url.includes(D2L_URL_FILTER)) {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {});
            }
        });
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === Action.FETCH_COURSES) {
        get_course_content(sender.tab.url).then(function(data) {
            sendResponse(data);
        });
        return true;
    }

    if (request.action === Action.OPEN_FAQ) {
        chrome.tabs.create({ url: FAQ_URL });
        return;
    }

    // A tab started fetching — let other D2L tabs know so they can show the loading indicator.
    if (request.action === Action.BROADCAST_FETCH_STARTED) {
        broadcast_to_d2l_tabs(sender.tab.id, { action: Action.FETCH_STARTED });
        return;
    }

    // A tab finished fetching — broadcast to all other D2L tabs to sync.
    if (request.action === Action.BROADCAST_COURSE_DATA_UPDATED) {
        broadcast_to_d2l_tabs(sender.tab.id, { action: Action.COURSE_DATA_UPDATED });
        return;
    }

    // Settings values changed on one tab — persist synced settings and relay to all other D2L tabs.
    if (request.action === Action.BROADCAST_SETTINGS_CHANGED) {
        chrome.storage.local.set({ [SETTINGS_VALUE_KEY]: request.settings });
        broadcast_to_d2l_tabs(sender.tab.id, { action: Action.SETTINGS_CHANGED, settings: request.settings });
        return;
    }
});

// Toggles the side panel when the extension icon is clicked on a D2L tab
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes(D2L_URL_FILTER)) {
        chrome.tabs.sendMessage(tab.id, { action: Action.TOGGLE_PANEL });
    }
});

// Runs once per service-worker lifecycle (session storage is wiped on first install,
// extension re-enable, and browser restart). Injects the content script into any
// already-open D2L tabs that don't have it yet, so users never need to reload.
chrome.storage.session.get([SESSION_WORKER_INITIALIZED_KEY], (result) => {
    if (result[SESSION_WORKER_INITIALIZED_KEY]) return;
    chrome.storage.session.set({ [SESSION_WORKER_INITIALIZED_KEY]: true });
    chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
            if (!tab.url || !tab.url.includes(D2L_URL_FILTER)) return;
            // Check if the content script is already running before injecting to avoid duplicates.
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (flag) => window[flag] === true,
                args: [SPARK_INITIALIZED_FLAG],
            }).then(results => {
                if (results && results[0] && results[0].result === true) return;
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["/dist/content.js"]
                }).catch(() => {});
                chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ["/styles/sidepanel.css"]
                }).catch(() => {});
            }).catch(() => {});
        });
    });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SETTINGS_VALUE_KEY,
        D2L_URL_FILTER,
        FAQ_URL,
        SPARK_INITIALIZED_FLAG,
        SESSION_WORKER_INITIALIZED_KEY,
    };
}
