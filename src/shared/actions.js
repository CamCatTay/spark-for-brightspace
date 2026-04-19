// actions.js
// contains the enums used for chrome message passing

export const Action = Object.freeze({
    // Background
    CLOSE_PANEL: "close_panel",
    FETCH_STARTED: "fetch_started",
    COURSE_DATA_UPDATED: "course_data_updated",
    SETTINGS_CHANGED: "settings_changed",
    SETTINGS_OPENED: "settings_opened",
    SETTINGS_CLOSED: "settings_closed",
    TOGGLE_PANEL: "toggle_panel",
    OPEN_URL: "open_url",

    // Content
    SAVE_SCROLL_POSITION: "save_scroll_position",
    GET_SCROLL_POSITION: "get_scroll_position",
    BROADCAST_FETCH_STARTED: "broadcast_fetch_started",
    FETCH_COURSES: "fetch_courses",
    BROADCAST_COURSE_DATA_UPDATED: "broadcast_course_data_updated",

    // Components
    BROADCAST_SETTINGS_OPENED: "broadcast_settings_opened",
    BROADCAST_SETTINGS_CLOSED: "broadcast_settings_closed",
    OPEN_FAQ: "open_faq",
    BROADCAST_SETTINGS_CHANGED: "broadcast_settings_changed",

    // Panel
    PANEL_CLOSED: "panel_closed",
    PANEL_OPENED: "panel_opened",
})

// Exports for testing
if (typeof module !== "undefined" && module.exports) {
    module.exports = { Action };
}