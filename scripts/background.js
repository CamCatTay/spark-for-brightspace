import { getCourseContent } from "/scripts/brightspace.js";

const SCROLL_POS_KEY = "spark-scroll-pos";
const ACTIVE_TAB_KEY = "spark-active-panel-tab";

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
});

// Handle action button click to toggle the panel
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes("/d2l/")) {
        chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    }
});
