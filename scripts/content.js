const COURSE_DATA_KEY = "courseData";

window.addEventListener("load", () => {
    let courseData = {};

    const calendarContainer = injectEmbeddedUI();
    initializeGUI();

    // Calculate and store scrollbar width
    scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    updateToggleButtonPosition();

    // Persist scroll position: save on scroll (debounced 300 ms)
    let scrollSaveTimer = null;
    calendarContainer.addEventListener("scroll", () => {
        clearTimeout(scrollSaveTimer);
        scrollSaveTimer = setTimeout(() => {
            safeSendMessage({
                action: "saveScrollPosition",
                position: calendarContainer.scrollTop
            });
        }, 300);
    });

    // Restore the shared scroll position after the calendar DOM is rebuilt.
    function restoreScrollPosition() {
        safeSendMessage({ action: "getScrollPosition" }, function(response) {
            if (response && response.position > 0) {
                requestAnimationFrame(() => {
                    calendarContainer.scrollTop = response.position;
                });
            }
        });
    }

    // When this tab's panel is restored after being silently closed by another
    // tab, re-render the in-memory data so the panel is never blank.
    registerPanelRestoreCallback(() => {
        if (courseData && Object.keys(courseData).length > 0) {
            updateGUI(courseData, false);
            restoreScrollPosition();
        }
    });

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY], function(result) {
        if (result.courseData) {
            courseData = JSON.parse(JSON.stringify(result.courseData));
            updateGUI(courseData, true);
            restoreScrollPosition();
        }
    });

    // Fetch fresh data from API
    safeSendMessage({ action: "fetchCourses" }, function(response) {
        if (response) {
            courseData = JSON.parse(JSON.stringify(response));

            chrome.storage.local.set({ courseData: courseData }, function() {
                updateGUI(courseData, false);
                restoreScrollPosition();
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
    if (request.action === "closePanel") {
        closePanelSilently();
    }
});
