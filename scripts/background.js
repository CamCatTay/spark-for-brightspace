import { getCourseContent } from "/scripts/brightspace.js";

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchCourses") {
        getCourseContent(sender.tab.url).then(function(data) {
            sendResponse(data); // data is already in object form
        });
        return true;
    }

    if (request.action === "openFaq") {
        chrome.tabs.create({ url: chrome.runtime.getURL("html/faq.html") });
    }
});

// Handle action button click to toggle the panel
chrome.action.onClicked.addListener((tab) => {
    // Only send message if on a d2l page
    if (tab.url && tab.url.includes("/d2l/")) {
        chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    }
});
