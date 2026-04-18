// background.js
// Handles the background service worker: fetches course data, manages caching,
// and responds to messages from the content script.

import { getCourseContent } from "/src/api/brightspace.js";

const SCROLL_POS_KEY = "spark-scroll-pos";
const ACTIVE_TAB_KEY = "spark-active-panel-tab";
const SETTINGS_OPEN_KEY = "spark-settings-open";
const SETTINGS_VALUE_KEY = "spark-user-settings";

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchCourses") {
        getCourseContent(sender.tab.url).then(function(data) {
            sendResponse(data); // data is already in object form
        });
        return true;
    }

    if (request.action === "openFaq") {
        chrome.tabs.create({ url: "https://camcattay.github.io/spark-for-brightspace/faq.html" });
        return;
    }

    // A tab opened its panel — record it and tell every other d2l tab to close.
    if (request.action === "panelOpened") {
        const activeTabId = sender.tab.id;
        chrome.storage.local.set({ [ACTIVE_TAB_KEY]: activeTabId });
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id !== activeTabId && tab.url && tab.url.includes("/d2l/")) {
                    chrome.tabs.sendMessage(tab.id, { action: "closePanel" }).catch(() => {});
                }
            });
        });
        return;
    }

    // A tab explicitly closed its panel — clear the active record.
    if (request.action === "panelClosed") {
        chrome.storage.local.get([ACTIVE_TAB_KEY], function(result) {
            if (result[ACTIVE_TAB_KEY] === sender.tab.id) {
                chrome.storage.local.remove(ACTIVE_TAB_KEY);
            }
        });
        return;
    }

    if (request.action === "saveScrollPosition") {
        chrome.storage.local.set({ [SCROLL_POS_KEY]: request.position });
        return;
    }

    if (request.action === "getScrollPosition") {
        chrome.storage.local.get([SCROLL_POS_KEY], function(result) {
            sendResponse({ position: result[SCROLL_POS_KEY] || 0 });
        });
        return true; // keep channel open for async response
    }

    // A tab started fetching — let other D2L tabs know so they can show the loading indicator.
    if (request.action === "broadcastFetchStarted") {
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id !== sender.tab.id && tab.url && tab.url.includes("/d2l/")) {
                    chrome.tabs.sendMessage(tab.id, { action: "fetchStarted" }).catch(() => {});
                }
            });
        });
        return;
    }

    // A tab finished fetching — broadcast to all other D2L tabs to sync.
    if (request.action === "broadcastCourseDataUpdated") {
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id !== sender.tab.id && tab.url && tab.url.includes("/d2l/")) {
                    chrome.tabs.sendMessage(tab.id, { action: "courseDataUpdated" }).catch(() => {});
                }
            });
        });
        return;
    }

    // Settings values changed on one tab — persist and relay to all other D2L tabs.
    if (request.action === "broadcastSettingsChanged") {
        chrome.storage.local.set({ [SETTINGS_VALUE_KEY]: request.settings });
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id !== sender.tab.id && tab.url && tab.url.includes("/d2l/")) {
                    chrome.tabs.sendMessage(tab.id, { action: "settingsChanged", settings: request.settings }).catch(() => {});
                }
            });
        });
        return;
    }

    // Settings panel opened on one tab — sync to all other D2L tabs.
    if (request.action === "broadcastSettingsOpened") {
        chrome.storage.local.set({ [SETTINGS_OPEN_KEY]: true });
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id !== sender.tab.id && tab.url && tab.url.includes("/d2l/")) {
                    chrome.tabs.sendMessage(tab.id, { action: "settingsOpened" }).catch(() => {});
                }
            });
        });
        return;
    }

    // Settings panel closed on one tab — sync to all other D2L tabs.
    if (request.action === "broadcastSettingsClosed") {
        chrome.storage.local.set({ [SETTINGS_OPEN_KEY]: false });
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id !== sender.tab.id && tab.url && tab.url.includes("/d2l/")) {
                    chrome.tabs.sendMessage(tab.id, { action: "settingsClosed" }).catch(() => {});
                }
            });
        });
        return;
    }
});

// Handle action button click to toggle the panel
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes("/d2l/")) {
        chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    }
});
