const COURSE_DATA_KEY = "courseData";
const LAST_FETCHED_KEY = "spark-last-fetched";
let fetchInFlight = false;
let globalFetchInFlight = false; // true when another tab's fetch is still running
let _refreshFn = null;

function triggerRefresh() {
    if (_refreshFn) _refreshFn();
}

window.addEventListener("load", () => {
    let courseData = {};

    const calendarContainer = injectEmbeddedUI();
    initializeGUI();

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
            updateGUI(courseData, fetchInFlight || globalFetchInFlight);
            restoreScrollPosition();
        }
    });

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY], function(result) {
        if (result[LAST_FETCHED_KEY]) {
            lastFetchedTime = new Date(result[LAST_FETCHED_KEY]);
        }
        if (result.courseData) {
            courseData = JSON.parse(JSON.stringify(result.courseData));
            updateGUI(courseData, true);
            restoreScrollPosition();
        }
    });

    // Register the refresh function so ui-components can trigger a fetch
    _refreshFn = function() {
        if (fetchInFlight) return;
        fetchInFlight = true;
        addDataStatusIndicator(true);
        safeSendMessage({ action: "broadcastFetchStarted" });
        safeSendMessage({ action: "fetchCourses" }, function(response) {
            fetchInFlight = false;
            if (response) {
                courseData = JSON.parse(JSON.stringify(response));
                lastFetchedTime = new Date();

                chrome.storage.local.set({ courseData: courseData, [LAST_FETCHED_KEY]: lastFetchedTime.toISOString() }, function() {
                    updateGUI(courseData, false);
                    restoreScrollPosition();
                    safeSendMessage({ action: "broadcastCourseDataUpdated" });
                });
            }
        });
    };

    // Fetch fresh data from API
    _refreshFn();
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "fetchStarted") {
        // Another tab started fetching — show the loading indicator while we wait for its data.
        globalFetchInFlight = true;
        addDataStatusIndicator(true);
    }
    if (request.action === "courseDataUpdated") {
        // Another tab finished fetching — sync from storage and clear the global flag.
        globalFetchInFlight = false;
        chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY], function(result) {
            if (result[LAST_FETCHED_KEY]) {
                lastFetchedTime = new Date(result[LAST_FETCHED_KEY]);
            }
            if (result.courseData) {
                updateGUI(JSON.parse(JSON.stringify(result.courseData)), fetchInFlight);
            }
        });
    }
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
    if (request.action === "togglePanel") {
        togglePanel();
    }
    if (request.action === "closePanel") {
        // Only close if this tab is currently visible — that means another tab
        // is open side-by-side (e.g. separate window). If this tab is hidden
        // (normal tab switch), leave the panel alone so it's still there when
        // the user comes back.
        if (document.visibilityState === "visible") {
            closePanelSilently();
        }
    }
});
