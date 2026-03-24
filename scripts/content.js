const COURSE_DATA_KEY = "courseData";

window.addEventListener("load", () => {
    let courseData = {};

    injectEmbeddedUI();
    initializeGUI();

    // Calculate and store scrollbar width
    scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    updateToggleButtonPosition();

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY], function(result) {
        if (result.courseData) {
            courseData = JSON.parse(JSON.stringify(result.courseData));
            updateGUI(courseData, true);
        }
    });

    // Fetch fresh data from API
    chrome.runtime.sendMessage({ action: "fetchCourses" }, function(response) {
        if (response) {
            courseData = JSON.parse(JSON.stringify(response));

            chrome.storage.local.set({ courseData: courseData }, function() {
                updateGUI(courseData, false);
            });
        }
    });
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
    if (request.action === "togglePanel") {
        togglePanel();
    }
});
