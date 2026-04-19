// content.js
// Injected into Brightspace pages. Bootstraps the side panel, triggers data
// fetches via the background worker, and manages panel lifecycle.

import { Action } from "./shared/actions.js";
import {
    safe_send_message,
    inject_embedded_ui,
    register_panel_restore_callback,
    toggle_panel,
    close_panel_silently,
    panel_width,
} from "./ui/panel.js";
import {
    initialize_gui,
    update_gui,
    add_data_status_indicator,
    build_settings_panel,
    apply_settings,
    set_last_fetched_time,
    register_ui_callbacks,
} from "./ui/components.js";

// ============================================================
// Constants
// ============================================================

const COURSE_DATA_KEY = "courseData";
const LAST_FETCHED_KEY = "spark-last-fetched";
const SETTINGS_OPEN_KEY = "spark-settings-open";
const SETTINGS_VALUE_KEY = "spark-user-settings";

// ============================================================
// State
// ============================================================

let fetch_in_flight = false;
let global_fetch_in_flight = false; // true when another tab's fetch is still running
let _refresh_fn = null;
let _rerender_fn = null;

// Returns nothing. Calls the registered refresh function if one has been set.
function trigger_refresh() {
    if (_refresh_fn) _refresh_fn();
}

// Returns nothing. Calls the registered re-render function if one has been set.
function trigger_rerender() {
    if (_rerender_fn) _rerender_fn();
}

// ============================================================
// Page Load
// ============================================================

window.addEventListener("load", () => {
    let course_data = {};

    const calendar_container = inject_embedded_ui();
    initialize_gui();

    // -- Scroll persistence --

    // Persist scroll position: save on scroll (debounced 300 ms)
    let scroll_save_timer = null;
    calendar_container.addEventListener("scroll", () => {
        clearTimeout(scroll_save_timer);
        scroll_save_timer = setTimeout(() => {
            safe_send_message({
                action: Action.SAVE_SCROLL_POSITION,
                position: calendar_container.scrollTop
            });
        }, 300);
    });

    // Returns nothing. Reads the stored scroll position and applies it to the calendar container.
    function restore_scroll_position() {
        safe_send_message({ action: Action.GET_SCROLL_POSITION }, function(response) {
            if (response && response.position > 0) {
                requestAnimationFrame(() => {
                    calendar_container.scrollTop = response.position;
                });
            }
        });
    }

    // -- Panel restore --

    // When this tab's panel is restored after being silently closed by another
    // tab, re-render the in-memory data so the panel is never blank.
    register_panel_restore_callback(() => {
        // Re-apply settings then re-render so display is correct even if settings
        // changed on another tab while this panel was silently closed.
        chrome.storage.local.get([SETTINGS_OPEN_KEY, SETTINGS_VALUE_KEY], function(result) {
            if (result[SETTINGS_VALUE_KEY]) {
                apply_settings(result[SETTINGS_VALUE_KEY]);
            }
            if (course_data && Object.keys(course_data).length > 0) {
                update_gui(course_data, fetch_in_flight || global_fetch_in_flight);
                restore_scroll_position();
            }
            let sp = document.getElementById("spark-settings-panel");
            if (result[SETTINGS_OPEN_KEY]) {
                if (!sp) {
                    sp = build_settings_panel();
                    document.body.appendChild(sp);
                }
                sp.style.right = panel_width + "px";
                sp.classList.add("open");
            } else if (sp) {
                sp.classList.remove("open");
            }
        });
    });

    // -- Initial data load --

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY, SETTINGS_OPEN_KEY, SETTINGS_VALUE_KEY], function(result) {
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
        if (result[SETTINGS_OPEN_KEY]) {
            const widget = document.getElementById("d2l-todolist-widget");
            if (widget && !widget.classList.contains("hidden") && widget.style.display !== "none") {
                let sp = document.getElementById("spark-settings-panel");
                if (!sp) {
                    sp = build_settings_panel();
                    document.body.appendChild(sp);
                }
                sp.style.right = panel_width + "px";
                sp.classList.add("open");
            }
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
                    update_gui(course_data, false);
                    restore_scroll_position();
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

    // Fetch fresh data from API
    _refresh_fn();
});

// ============================================================
// Message Handler
// ============================================================

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
    if (request.action === Action.CLOSE_PANEL) {
        // Only close if this tab is currently visible — that means another tab
        // is open side-by-side (e.g. separate window). If this tab is hidden
        // (normal tab switch), leave the panel alone so it's still there when
        // the user comes back.
        if (document.visibilityState === "visible") {
            close_panel_silently();
        }
    }
    if (request.action === Action.SETTINGS_OPENED) {
        // Don't open the settings panel on a tab whose main panel is currently hidden
        // (e.g. the inactive side of a split-screen setup).
        const widget = document.getElementById("d2l-todolist-widget");
        if (!widget || widget.classList.contains("hidden") || widget.style.display === "none") return;
        let settings_panel = document.getElementById("spark-settings-panel");
        if (!settings_panel) {
            settings_panel = build_settings_panel();
            document.body.appendChild(settings_panel);
        }
        settings_panel.style.right = panel_width + "px";
        settings_panel.classList.add("open");
    }
    if (request.action === Action.SETTINGS_CLOSED) {
        const settings_panel = document.getElementById("spark-settings-panel");
        if (settings_panel) settings_panel.classList.remove("open");
    }
    if (request.action === Action.SETTINGS_CHANGED) {
        apply_settings(request.settings);
        trigger_rerender();
    }
});
