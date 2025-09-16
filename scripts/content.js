window.addEventListener("load", () => {
    chrome.runtime.sendMessage({ action: "fetchCourses" }, function(response) {
        console.log("Course content:", response);
    });
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
});