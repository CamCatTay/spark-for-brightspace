// background.js
// Handles the background service worker: fetches course data, manages caching,
// and responds to messages from the content script.

import { get_course_content } from "/src/api/brightspace.js";
import { Action } from "./shared/actions";

// ============================================================
// Constants
// ============================================================

const SCROLL_POS_KEY = "spark-scroll-pos";
const SETTINGS_VALUE_KEY = "spark-user-settings";
const D2L_URL_FILTER = "/d2l/";
const FAQ_URL = "https://camcattay.github.io/spark-for-brightspace/faq.html";

// ============================================================
// Helpers
// ============================================================

// Sends a message to all open D2L tabs except the one with sender_tab_id
function broadcast_to_d2l_tabs(sender_tab_id, message) {
    chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
            if (tab.id !== sender_tab_id && tab.url && tab.url.includes(D2L_URL_FILTER)) {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {});
            }
        });
    });
}

// ============================================================
// Message Handler
// ============================================================

// Listens for messages from content scripts and dispatches to the appropriate handler
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

    if (request.action === Action.SAVE_SCROLL_POSITION) {
        chrome.storage.local.set({ [SCROLL_POS_KEY]: request.position });
        return;
    }

    if (request.action === Action.GET_SCROLL_POSITION) {
        chrome.storage.local.get([SCROLL_POS_KEY], function(result) {
            sendResponse({ position: result[SCROLL_POS_KEY] || 0 });
        });
        return true; // keep channel open for async response
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

// ============================================================
// Action Button Handler
// ============================================================

// Toggles the side panel when the extension icon is clicked on a D2L tab
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes(D2L_URL_FILTER)) {
        chrome.tabs.sendMessage(tab.id, { action: Action.TOGGLE_PANEL });
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SCROLL_POS_KEY,
        SETTINGS_VALUE_KEY,
        D2L_URL_FILTER,
        FAQ_URL,
    };
}
