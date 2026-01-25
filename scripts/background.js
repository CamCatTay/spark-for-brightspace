import { getCourseContent } from "/scripts/brightspace.js";
import { mapToObject } from "/scripts/utils.js";

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchCourses") {
        getCourseContent(sender.tab.url).then(function(data) { // .then is waiting for promise to resolve. Its like await but for non-async functions
            sendResponse(mapToObject(data)); // convert Map to Object for sending via sendResponse
        });
        return true;

    }
});
