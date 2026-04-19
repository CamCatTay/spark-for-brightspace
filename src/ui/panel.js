// panel.js
// Builds and controls the side panel DOM: tab switching, resize handling,
// scroll persistence, and rendering course content into the panel.

import { Action } from "../shared/actions.js";
import { build_settings_panel } from "./components.js";

// ============================================================
// Constants
// ============================================================

const EXPANSION_STATE_KEY = "d2l-todolist-expanded";
const PANEL_WIDTH_KEY = "d2l-todolist-width";
const DEFAULT_PANEL_WIDTH = 350;
const MIN_PANEL_WIDTH = 250;
const PANEL_SLIDE_IN_MS = 400;
const SETTINGS_TRANSITION_MS = 250;

// ============================================================
// Module State
// ============================================================

export let panel_width = DEFAULT_PANEL_WIDTH;
let container;
let is_animating = false;
let settings_was_open = false;
// Callback invoked when the tab becomes visible with the panel open.
let _on_panel_restore = null;

// ============================================================
// Internal Helpers
// ============================================================

// Updates the document body's right margin to match the current panel width.
function update_body_margin() {
    document.body.style.marginRight = panel_width + "px";
}

// Creates the panel DOM structure and wires up resize dragging.
// Returns { container, calendar_container, panel } DOM elements.
function create_embedded_calendar_ui() {
    const new_container = document.createElement("div");
    new_container.id = "d2l-todolist-widget";
    new_container.style.width = panel_width + "px";

    const panel = document.createElement("div");
    panel.id = "d2l-todolist-panel";
    panel.style.width = panel_width + "px";

    const resize_handle = document.createElement("div");
    resize_handle.className = "d2l-todolist-resize-handle";

    const calendar_container = document.createElement("div");
    calendar_container.id = "calendar-container";

    panel.appendChild(resize_handle);
    panel.appendChild(calendar_container);
    new_container.appendChild(panel);

    // -- Resize --
    let is_resizing = false;
    let start_x = 0;
    let start_width = panel_width;

    resize_handle.addEventListener("mousedown", function(e) {
        is_resizing = true;
        start_x = e.clientX;
        start_width = panel_width;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
    });

    document.addEventListener("mousemove", function(e) {
        if (!is_resizing) return;

        const delta_x = e.clientX - start_x;
        const new_width = Math.max(MIN_PANEL_WIDTH, start_width - delta_x);

        panel_width = new_width;
        new_container.style.width = new_width + "px";
        panel.style.width = new_width + "px";
        update_body_margin();

        const sp = document.getElementById("spark-settings-panel");
        if (sp) sp.style.right = new_width + "px";

        localStorage.setItem(PANEL_WIDTH_KEY, new_width.toString());
    });

    document.addEventListener("mouseup", function() {
        if (is_resizing) {
            is_resizing = false;
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        }
    });

    return { container: new_container, calendar_container, panel };
}

// ============================================================
// Exports
// ============================================================

/**
 * Sends a message to the extension runtime, swallowing invalidated-context errors.
 * @param {Object} message - The message object to send.
 * @param {Function} [callback] - Optional response callback.
 */
export function safe_send_message(message, callback) {
    try {
        if (callback) {
            chrome.runtime.sendMessage(message, callback);
        } else {
            chrome.runtime.sendMessage(message);
        }
    } catch (e) {
        if (!e.message?.includes("Extension context invalidated")) {
            console.error(e);
        }
    }
}

/**
 * Registers a callback to be invoked when the tab becomes visible with the panel open.
 * @param {Function} fn - The callback to register.
 */
export function register_panel_restore_callback(fn) {
    _on_panel_restore = fn;
}

/**
 * Toggles the panel open or closed, handling settings panel state and animations.
 */
export function toggle_panel() {
    if (!container || is_animating) return;
    is_animating = true;

    const will_hide = !container.classList.contains("hidden");

    if (will_hide) {
        // If closing, check if settings panel is open first
        const sp = document.getElementById("spark-settings-panel");
        const settings_open = sp && sp.classList.contains("open");

        const do_close = () => {
            container.classList.add("hidden");
            sessionStorage.setItem(EXPANSION_STATE_KEY, "false");
            document.body.style.marginRight = "0";
            const animation_handler = () => {
                container.style.display = "none";
                container.removeEventListener("animationend", animation_handler);
                is_animating = false;
            };
            container.addEventListener("animationend", animation_handler);
        };

        if (settings_open) {
            settings_was_open = true;
            sp.classList.remove("open");
            setTimeout(do_close, SETTINGS_TRANSITION_MS);
        } else {
            settings_was_open = false;
            do_close();
        }
    } else {
        container.classList.remove("hidden");
        sessionStorage.setItem(EXPANSION_STATE_KEY, "true");
        container.style.display = "flex";
        update_body_margin();

        if (settings_was_open) {
            settings_was_open = false;
            // Wait for the panel slide-in to finish before opening settings
            setTimeout(() => {
                let sp = document.getElementById("spark-settings-panel");
                if (!sp) {
                    sp = build_settings_panel();
                    document.body.appendChild(sp);
                }
                sp.style.right = (typeof panel_width !== "undefined" ? panel_width : DEFAULT_PANEL_WIDTH) + "px";
                sp.classList.add("open");
                // Settings transition completes after another SETTINGS_TRANSITION_MS
                setTimeout(() => { is_animating = false; }, SETTINGS_TRANSITION_MS);
            }, PANEL_SLIDE_IN_MS);
        } else {
            // Panel slide-in is ~PANEL_SLIDE_IN_MS; then check if settings should be open globally
            setTimeout(() => {
                chrome.storage.local.get(["spark-settings-open"], function(result) {
                    if (result["spark-settings-open"]) {
                        let sp = document.getElementById("spark-settings-panel");
                        if (!sp) {
                            sp = build_settings_panel();
                            document.body.appendChild(sp);
                        }
                        sp.style.right = panel_width + "px";
                        sp.classList.add("open");
                        setTimeout(() => { is_animating = false; }, SETTINGS_TRANSITION_MS);
                    } else {
                        is_animating = false;
                    }
                });
            }, PANEL_SLIDE_IN_MS);
        }
    }
}

/**
 * Injects the side panel widget into the page and wires up visibility-change handling.
 * @returns {HTMLElement} The calendar container element where content should be rendered.
 */
export function inject_embedded_ui() {
    const existing = document.getElementById("d2l-todolist-widget");
    if (existing) existing.remove();

    const saved_width = localStorage.getItem(PANEL_WIDTH_KEY);
    if (saved_width) {
        panel_width = parseInt(saved_width, 10);
    }

    const { container: new_container, calendar_container } = create_embedded_calendar_ui();
    container = new_container;

    const should_show_panel = sessionStorage.getItem(EXPANSION_STATE_KEY);

    console.log("Should show panel?: ", should_show_panel);

    if (should_show_panel) {
        update_body_margin();
    } else {
        container.style.display = "none";
        container.classList.add("hidden");
        document.body.style.marginRight = "0";
    }

    document.body.appendChild(container);

    // Handle tab visibility changes.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;

        if (container && !container.classList.contains("hidden")) {
            // Panel is open — refresh data when the user switches back to this tab.
            if (_on_panel_restore) _on_panel_restore();
        }
    });

    return calendar_container;
}
