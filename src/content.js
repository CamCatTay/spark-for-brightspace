// content.js
// Injected into Brightspace pages. Bootstraps the side panel, triggers data
// fetches via the background worker, and manages panel lifecycle.

import { Action } from "./shared/actions.js";
import {
    safeSendMessage,
    injectEmbeddedUI,
    registerPanelRestoreCallback,
    togglePanel,
    closePanelSilently,
    panelWidth,
} from "./ui/panel.js";
import {
    initializeGUI,
    updateGUI,
    addDataStatusIndicator,
    buildSettingsPanel,
    applySettings,
    set_last_fetched_time,
    register_ui_callbacks,
} from "./ui/components.js";

const COURSE_DATA_KEY = "courseData";
const LAST_FETCHED_KEY = "spark-last-fetched";
const SETTINGS_OPEN_KEY = "spark-settings-open";
const SETTINGS_VALUE_KEY = "spark-user-settings";
let fetchInFlight = false;
let globalFetchInFlight = false; // true when another tab's fetch is still running
let _refreshFn = null;
let _reRenderFn = null;

function triggerRefresh() {
    if (_refreshFn) _refreshFn();
}

function triggerReRender() {
    if (_reRenderFn) _reRenderFn();
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
                action: Action.SAVE_SCROLL_POSITION,
                position: calendarContainer.scrollTop
            });
        }, 300);
    });

    // Restore the shared scroll position after the calendar DOM is rebuilt.
    function restoreScrollPosition() {
        safeSendMessage({ action: Action.GET_SCROLL_POSITION }, function(response) {
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
        // Re-apply settings then re-render so display is correct even if settings
        // changed on another tab while this panel was silently closed.
        chrome.storage.local.get([SETTINGS_OPEN_KEY, SETTINGS_VALUE_KEY], function(result) {
            if (result[SETTINGS_VALUE_KEY]) {
                applySettings(result[SETTINGS_VALUE_KEY]);
            }
            if (courseData && Object.keys(courseData).length > 0) {
                updateGUI(courseData, fetchInFlight || globalFetchInFlight);
                restoreScrollPosition();
            }
            let sp = document.getElementById("spark-settings-panel");
            if (result[SETTINGS_OPEN_KEY]) {
                if (!sp) {
                    sp = buildSettingsPanel();
                    document.body.appendChild(sp);
                }
                sp.style.right = panelWidth + "px";
                sp.classList.add("open");
            } else if (sp) {
                sp.classList.remove("open");
            }
        });
    });

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY, SETTINGS_OPEN_KEY, SETTINGS_VALUE_KEY], function(result) {
        if (result[SETTINGS_VALUE_KEY]) {
            applySettings(result[SETTINGS_VALUE_KEY]);
        }
        if (result[LAST_FETCHED_KEY]) {
            set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
        }
        if (result.courseData) {
            courseData = JSON.parse(JSON.stringify(result.courseData));
            updateGUI(courseData, true);
            restoreScrollPosition();
        }
        if (result[SETTINGS_OPEN_KEY]) {
            const widget = document.getElementById("d2l-todolist-widget");
            if (widget && !widget.classList.contains("hidden") && widget.style.display !== "none") {
                let sp = document.getElementById("spark-settings-panel");
                if (!sp) {
                    sp = buildSettingsPanel();
                    document.body.appendChild(sp);
                }
                sp.style.right = panelWidth + "px";
                sp.classList.add("open");
            }
        }
    });

    // Register the refresh function so ui-components can trigger a fetch
    _refreshFn = function() {
        if (fetchInFlight) return;
        fetchInFlight = true;
        addDataStatusIndicator(true);
        safeSendMessage({ action: Action.BROADCAST_FETCH_STARTED });
        safeSendMessage({ action: Action.FETCH_COURSES }, function(response) {
            fetchInFlight = false;
            if (response) {
                courseData = JSON.parse(JSON.stringify(response));
                const fetch_time = new Date();
                set_last_fetched_time(fetch_time);

                chrome.storage.local.set({ courseData: courseData, [LAST_FETCHED_KEY]: fetch_time.toISOString() }, function() {
                    updateGUI(courseData, false);
                    restoreScrollPosition();
                    safeSendMessage({ action: Action.BROADCAST_COURSE_DATA_UPDATED });
                });
            }
        });
    };

    // Re-render with current in-memory data (used when settings change)
    _reRenderFn = function() {
        if (courseData && Object.keys(courseData).length > 0) {
            updateGUI(courseData, fetchInFlight || globalFetchInFlight);
        }
    };

    // Register refresh/re-render callbacks so the settings UI in components.js can trigger them
    register_ui_callbacks({ on_refresh: triggerRefresh, on_rerender: triggerReRender });

    // Fetch fresh data from API
    _refreshFn();
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === Action.FETCH_STARTED) {
        // Another tab started fetching — show the loading indicator while we wait for its data.
        globalFetchInFlight = true;
        addDataStatusIndicator(true);
    }
    if (request.action === Action.COURSE_DATA_UPDATED) {
        // Another tab finished fetching — sync from storage and clear the global flag.
        globalFetchInFlight = false;
        chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY], function(result) {
            if (result[LAST_FETCHED_KEY]) {
                set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
            }
            if (result.courseData) {
                updateGUI(JSON.parse(JSON.stringify(result.courseData)), fetchInFlight);
            }
        });
    }
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
    if (request.action === Action.TOGGLE_PANEL) {
        togglePanel();
    }
    if (request.action === Action.CLOSE_PANEL) {
        // Only close if this tab is currently visible — that means another tab
        // is open side-by-side (e.g. separate window). If this tab is hidden
        // (normal tab switch), leave the panel alone so it's still there when
        // the user comes back.
        if (document.visibilityState === "visible") {
            closePanelSilently();
        }
    }
    if (request.action === Action.SETTINGS_OPENED) {
        // Don't open the settings panel on a tab whose main panel is currently hidden
        // (e.g. the inactive side of a split-screen setup).
        const widget = document.getElementById("d2l-todolist-widget");
        if (!widget || widget.classList.contains("hidden") || widget.style.display === "none") return;
        let settingsPanel = document.getElementById("spark-settings-panel");
        if (!settingsPanel) {
            settingsPanel = buildSettingsPanel();
            document.body.appendChild(settingsPanel);
        }
        settingsPanel.style.right = panelWidth + "px";
        settingsPanel.classList.add("open");
    }
    if (request.action === Action.SETTINGS_CLOSED) {
        const settingsPanel = document.getElementById("spark-settings-panel");
        if (settingsPanel) settingsPanel.classList.remove("open");
    }
    if (request.action === Action.SETTINGS_CHANGED) {
        applySettings(request.settings);
        triggerReRender();
    }
});
