// Builds and controls the side panel DOM: tab switching, resize handling,
// scroll persistence, and rendering course content into the panel.

import { Action } from "../shared/actions";

// Registered by content.ts to avoid a circular import between panel and settings-menu.
let _build_settings_panel: (() => HTMLElement) | null = null;

export function register_settings_panel_builder(fn: () => HTMLElement): void {
    _build_settings_panel = fn;
}

const EXPANSION_STATE_KEY = "spark-expanded";
const PANEL_WIDTH_KEY = "spark-width";
const TOGGLE_BTN_TOP_KEY = "spark-toggle-btn-top";
const TOGGLE_BTN_ID = "spark-toggle-btn";
const DEFAULT_PANEL_WIDTH = 400;
const MIN_PANEL_WIDTH = 250;
const PANEL_SLIDE_IN_MS = 400;
const SETTINGS_TRANSITION_MS = 250;

export let panel_width: number = DEFAULT_PANEL_WIDTH;
let container: HTMLElement | null;
let toggle_btn: HTMLButtonElement | null = null;
let is_animating: boolean = false;
let settings_was_open: boolean = false;
let _on_panel_restore: (() => void) | null = null;
let _on_panel_open: (() => void) | null = null;


// Updates the document body's right margin to match the current panel width.
function update_body_margin() {
    document.body.style.marginRight = panel_width + "px";
    if (toggle_btn) toggle_btn.style.right = panel_width + "px";
}

// Creates the panel DOM structure and wires up resize dragging.
// Returns { container, calendar_container, panel } DOM elements.
function create_embedded_calendar_ui() {
    const new_container = document.createElement("div");
    new_container.id = "spark-widget";
    new_container.style.width = panel_width + "px";

    const panel = document.createElement("div");
    panel.id = "spark-panel";
    panel.style.width = panel_width + "px";

    const resize_handle = document.createElement("div");
    resize_handle.className = "spark-resize-handle";

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

// Clamps a top pixel value so the button stays fully within the viewport.
// Returns the clamped top value in pixels.
function clamp_toggle_top(top_px: number): number {
    const btn_height = toggle_btn ? toggle_btn.offsetHeight : 40;
    const max_top = window.innerHeight - btn_height;
    return Math.max(0, Math.min(top_px, max_top));
}

// Applies a vertical position to the toggle button and persists it to localStorage.
function set_toggle_top(top_px: number): void {
    const clamped = clamp_toggle_top(top_px);
    toggle_btn!.style.top = clamped + "px";
    toggle_btn!.style.transform = "none";
    localStorage.setItem(TOGGLE_BTN_TOP_KEY, clamped.toString());
}

function create_toggle_button() {
    const existing = document.getElementById(TOGGLE_BTN_ID);
    if (existing) existing.remove();

    const btn = document.createElement("button");
    btn.id = TOGGLE_BTN_ID;
    btn.setAttribute("title", "Toggle Spark panel");
    btn.textContent = "\u276E";

    // -- Vertical drag --
    let is_dragging = false;
    let drag_start_y = 0;
    let drag_start_top = 0;
    let drag_moved = false;

    btn.addEventListener("mousedown", function(e) {
        is_dragging = true;
        drag_moved = false;
        drag_start_y = e.clientY;
        drag_start_top = btn.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
        e.preventDefault();
    });

    document.addEventListener("mousemove", function(e) {
        if (!is_dragging) return;
        const delta_y = e.clientY - drag_start_y;
        if (Math.abs(delta_y) > 4) drag_moved = true;
        set_toggle_top(drag_start_top + delta_y);
    });

    document.addEventListener("mouseup", function() {
        if (!is_dragging) return;
        is_dragging = false;
        document.body.style.userSelect = "";
    });

    btn.addEventListener("click", function(e) {
        if (drag_moved) {
            e.stopImmediatePropagation();
            drag_moved = false;
            return;
        }
        toggle_panel();
    });

    return btn;
}

/**
 * Sends a message to the extension runtime, swallowing invalidated-context errors.
 * @param {Object} message - The message object to send.
 * @param {Function} [callback] - Optional response callback.
 */
export function safe_send_message(message: Record<string, unknown>, callback?: (response: unknown) => void): void {
    try {
        if (callback) {
            chrome.runtime.sendMessage(message, callback);
        } else {
            chrome.runtime.sendMessage(message);
        }
    } catch (e) {
        if (!(e as Error).message?.includes("Extension context invalidated")) {
            console.error(e);
        }
    }
}

/**
 * Registers a callback to be invoked when the tab becomes visible with the panel open.
 * @param {Function} fn - The callback to register.
 */
export function register_panel_restore_callback(fn: () => void): void {
    _on_panel_restore = fn;
}

/**
 * Registers a callback to be invoked whenever the panel is opened.
 * Use this to restore scroll position or other per-open state.
 * @param {Function} fn - The callback to register.
 */
export function register_panel_open_callback(fn: () => void): void {
    _on_panel_open = fn;
}

/**
 * Toggles the panel open or closed, handling settings panel state and animations.
 */
export function toggle_panel(): void {
    if (!container || is_animating) return;
    is_animating = true;

    const will_hide = !container.classList.contains("hidden");

    if (will_hide) {
        // If closing, check if settings panel is open first
        const sp = document.getElementById("spark-settings-panel");
        const settings_open = sp && sp.classList.contains("open");

        const do_close = () => {
            container!.classList.add("hidden");
            sessionStorage.setItem(EXPANSION_STATE_KEY, "false");
            document.body.style.marginRight = "0";
            if (toggle_btn) {
                toggle_btn.style.right = "0px";
                toggle_btn.textContent = "\u276E";
            }
            const animation_handler = () => {
                container!.style.display = "none";
                container!.removeEventListener("animationend", animation_handler);
                is_animating = false;
            };
            container!.addEventListener("animationend", animation_handler);
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
        if (toggle_btn) toggle_btn.textContent = "\u276F";

        if (settings_was_open) {
            settings_was_open = false;
            // Wait for the panel slide-in to finish before opening settings
            setTimeout(() => {
                let sp = document.getElementById("spark-settings-panel");
                if (!sp) {
                    if (!_build_settings_panel) return;
                    sp = _build_settings_panel();
                    document.body.appendChild(sp);
                }
                sp.style.right = panel_width + "px";
                sp.classList.add("open");
                if (_on_panel_open) _on_panel_open();
                // Settings transition completes after another SETTINGS_TRANSITION_MS
                setTimeout(() => { is_animating = false; }, SETTINGS_TRANSITION_MS);
            }, PANEL_SLIDE_IN_MS);
        } else {
            // Wait for the panel slide-in animation to finish, then unblock interactions.
            setTimeout(() => {
                if (_on_panel_open) _on_panel_open();
                is_animating = false;
            }, PANEL_SLIDE_IN_MS);
        }
    }
}

/**
 * Injects the side panel widget into the page and wires up visibility-change handling.
 * @returns {HTMLElement} The calendar container element where content should be rendered.
 */
export function inject_embedded_ui() {
    const existing = document.getElementById("spark-widget");
    if (existing) existing.remove();

    const saved_width = localStorage.getItem(PANEL_WIDTH_KEY);
    if (saved_width) {
        panel_width = parseInt(saved_width, 10);
    }

    const { container: new_container, calendar_container } = create_embedded_calendar_ui();
    container = new_container;

    toggle_btn = create_toggle_button();

    // Restore saved vertical position, falling back to CSS-centred default.
    const saved_top = localStorage.getItem(TOGGLE_BTN_TOP_KEY);
    if (saved_top !== null) {
        toggle_btn.style.top = saved_top + "px";
        toggle_btn.style.transform = "none";
    }

    // Remove the legacy cross-tab settings-open key so it can never incorrectly
    // auto-open the settings panel on a fresh load.
    chrome.storage.local.remove("spark-settings-open");

    const should_show_panel = sessionStorage.getItem(EXPANSION_STATE_KEY) === "true";

    if (should_show_panel) {
        toggle_btn.style.right = panel_width + "px";
        toggle_btn.textContent = "\u276F";
        update_body_margin();
    } else {
        container.style.display = "none";
        container.classList.add("hidden");
        document.body.style.marginRight = "0";
        toggle_btn.style.right = "0px";
        toggle_btn.textContent = "\u276E";
    }

    document.body.appendChild(container);
    document.body.appendChild(toggle_btn);

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
