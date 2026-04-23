// Injected into Brightspace pages. Bootstraps the side panel, triggers data
// fetches via the background worker, and manages panel lifecycle.

import { Action } from "./shared/actions.js";
import {
    safe_send_message,
    inject_embedded_ui,
    register_panel_restore_callback,
    register_panel_open_callback,
    toggle_panel,
    panel_width,
} from "./ui/panel.js";
import {
    initialize_gui,
    update_gui,
    add_data_status_indicator,
    apply_settings,
    set_last_fetched_time,
    register_ui_callbacks,
    scroll_to_today,
} from "./ui/components.js";

const COURSE_DATA_KEY = "courseData";
const LAST_FETCHED_KEY = "spark-last-fetched";
const SETTINGS_VALUE_KEY = "spark-user-settings";
// Tab-local, session-scoped (sessionStorage — NOT synced across tabs):
const SCROLL_POS_SESSION_KEY = "spark-scroll-pos";
// Window-scoped flag read by the background worker to detect if this tab is already initialized.
const SPARK_INITIALIZED_FLAG = "__spark_initialized__";

// Minimum time between smart-triggered fetches (tab focus, page interaction).
// Page load and manual refresh always bypass this cooldown.
const FETCH_COOLDOWN_MS = 5 * 60 * 1000;
const INTERACTION_DEBOUNCE_MS = 2000;

let fetch_in_flight = false;
let global_fetch_in_flight = false; // true when another tab's fetch is still running
let _refresh_fn = null;
let _rerender_fn = null;
let last_completed_fetch_time = 0;
let interaction_debounce_timer = null;

function trigger_refresh() {
    if (_refresh_fn) _refresh_fn();
}

function trigger_rerender() {
    if (_rerender_fn) _rerender_fn();
}

// Fetches only if the cooldown has lifted and no fetch is in flight.
// Used by smart triggers (tab focus, page interaction) — never for manual refresh or page load.
function try_smart_fetch() {
    if (!_refresh_fn) return;
    if (fetch_in_flight || global_fetch_in_flight) return;
    if (Date.now() - last_completed_fetch_time < FETCH_COOLDOWN_MS) return;
    _refresh_fn();
}

// Debounced wrapper for high-frequency events (mousemove, scroll).
// Waits for activity to settle before attempting a smart fetch.
function on_page_interaction() {
    clearTimeout(interaction_debounce_timer);
    interaction_debounce_timer = setTimeout(try_smart_fetch, INTERACTION_DEBOUNCE_MS);
}

function on_page_ready() {
    window[SPARK_INITIALIZED_FLAG] = true;
    let course_data = {};

    const calendar_container = inject_embedded_ui();
    initialize_gui();

    // -- Scroll persistence --

    // Persist scroll position to sessionStorage: saved on scroll (debounced 300 ms).
    let scroll_save_timer = null;
    calendar_container.addEventListener("scroll", () => {
        clearTimeout(scroll_save_timer);
        scroll_save_timer = setTimeout(() => {
            console.log(calendar_container.scrollTop.toString());
            sessionStorage.setItem(SCROLL_POS_SESSION_KEY, calendar_container.scrollTop.toString());
        }, 300);
    });

    // Returns nothing. Reads the stored scroll position and applies it to the calendar container.
    // Falls back to scrolling to today's date on first open when no position has been saved.
    function restore_scroll_position() {
        const saved = parseInt(sessionStorage.getItem(SCROLL_POS_SESSION_KEY) || "0", 10);
        console.log(saved);
        if (saved > 0) {
            requestAnimationFrame(() => {
                calendar_container.scrollTop = saved;
            });
        } else {
            scroll_to_today();
        }
    }

    // -- Panel restore --

    // When this tab's panel is restored after being silently closed by another
    // tab, re-render the in-memory data so the panel is never blank.
    register_panel_restore_callback(() => {
        // Re-apply synced settings then re-render with in-memory data.
        chrome.storage.local.get([SETTINGS_VALUE_KEY], function(result) {
            if (result[SETTINGS_VALUE_KEY]) {
                apply_settings(result[SETTINGS_VALUE_KEY]);
            }
            if (course_data && Object.keys(course_data).length > 0) {
                update_gui(course_data, fetch_in_flight || global_fetch_in_flight);
                // restore_scroll_position()
            }
        });
    });

    // -- Initial data load --

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY, SETTINGS_VALUE_KEY], function(result) {
        if (result[SETTINGS_VALUE_KEY]) {
            apply_settings(result[SETTINGS_VALUE_KEY]);
        }
        if (result[LAST_FETCHED_KEY]) {
            set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
        }
        if (result[COURSE_DATA_KEY]) {
            course_data = JSON.parse(JSON.stringify(result[COURSE_DATA_KEY]));
            update_gui(course_data, true);
            restore_scroll_position();
        }
    });

    // -- Fetch and re-render callbacks --

    // Fetches fresh course data from the API and updates the UI on completion.
    _refresh_fn = function() {
        if (fetch_in_flight) return;
        fetch_in_flight = true;
        add_data_status_indicator(true);
        safe_send_message({ action: Action.BROADCAST_FETCH_STARTED });
        safe_send_message({ action: Action.FETCH_COURSES }, function(response) {
            fetch_in_flight = false;
            if (response) {
                course_data = JSON.parse(JSON.stringify(response));
                const fetch_time = new Date();
                set_last_fetched_time(fetch_time);

                chrome.storage.local.set({ [COURSE_DATA_KEY]: course_data, [LAST_FETCHED_KEY]: fetch_time.toISOString() }, function() {
                    last_completed_fetch_time = Date.now();
                    update_gui(course_data, false);
                    // restore_scroll_position();
                    safe_send_message({ action: Action.BROADCAST_COURSE_DATA_UPDATED });
                });
            }
        });
    };

    // Re-renders with current in-memory data (used when settings change without a new fetch).
    _rerender_fn = function() {
        if (course_data && Object.keys(course_data).length > 0) {
            update_gui(course_data, fetch_in_flight || global_fetch_in_flight);
        }
    };

    // Register refresh/re-render callbacks so the settings UI in components.js can trigger them
    register_ui_callbacks({ on_refresh: trigger_refresh, on_rerender: trigger_rerender });

    // Restore scroll position whenever the panel is opened (including first open on a new tab).
    /*
    register_panel_open_callback(() => {
        // restore_scroll_position(); Commented out in a few places because Im not sure I like how they function
    });
    */

    // -- Smart fetch triggers --

    // Fetch when the user switches to this tab or returns to the browser window.
    // Tab visibility is a discrete event so no debounce is needed.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            try_smart_fetch();
        }
    });

    // Fetch when user interacts with the page (mouse movement or scrolling), debounced
    // so that activity settling is what triggers the check rather than each raw event.
    document.addEventListener("mousemove", on_page_interaction);
    window.addEventListener("scroll", on_page_interaction);

    // Fetch fresh data from API — unconditional on page load, bypasses cooldown.
    _refresh_fn();
}

// Handles already-loaded pages (e.g. first install on an open tab where "load" won't re-fire).
if (document.readyState === "complete") {
    on_page_ready();
} else {
    window.addEventListener("load", on_page_ready);
}

// Listens for messages from the background service worker and dispatches to the appropriate handler
chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === Action.FETCH_STARTED) {
        // Another tab started fetching — show the loading indicator while we wait for its data.
        global_fetch_in_flight = true;
        add_data_status_indicator(true);
    }
    if (request.action === Action.COURSE_DATA_UPDATED) {
        // Another tab finished fetching — sync from storage and clear the global flag.
        global_fetch_in_flight = false;
        chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY], function(result) {
            if (result[LAST_FETCHED_KEY]) {
                set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
            }
            if (result[COURSE_DATA_KEY]) {
                update_gui(JSON.parse(JSON.stringify(result[COURSE_DATA_KEY])), fetch_in_flight);
            }
        });
    }
    if (request.action === Action.OPEN_URL) {
        window.open(request.url, "_blank");
    }
    if (request.action === Action.TOGGLE_PANEL) {
        toggle_panel();
    }

    if (request.action === Action.SETTINGS_CHANGED) {
        apply_settings(request.settings);
        trigger_rerender();
    }
});
