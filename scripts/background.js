import { getCourseContent } from "/scripts/brightspace.js";

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchCourses") {
        getCourseContent(sender.tab.url).then(function(data) {
            sendResponse(data); // data is already in object form
        });
        return true;
    }
});

// open side panel on icon click
chrome.sidePanel
.setPanelBehavior({ openPanelOnActionClick: true })
.catch((error) => console.error(error));

/*
// disables side panel on non d2l pages (old method, likely to be removed)
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
if (!tab.url) return;
const url = new URL(tab.url);
// Enables the side panel on d2l pages
if (url.pathname.startsWith("/d2l/")) {
    await chrome.sidePanel.setOptions({
        tabId,
        path: "/html/sidepanel.html",
        enabled: true
    });
} else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.setOptions({
        tabId,
        enabled: false
    });
}
});
*/
