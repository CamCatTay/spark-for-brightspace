// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { LAST_FETCH_COMPLETED_AT_STORAGE_KEY as LAST_FETCH_STARTED_AT_STORAGE_KEY } from "./ui/ui-state";;
import {
    safe_send_message,
    inject_embedded_ui,
    register_panel_restore_callback,
    register_settings_panel_builder,
    toggle_panel,
} from "./ui/panel";
import {
    initialize_gui,
    update_gui,
    toggle_fetching_indicator,
    apply_settings,
    set_last_fetched_time,
    register_ui_callbacks,
} from "./ui/calendar";
import { scroll_to_today } from "./ui/frequency-chart";
import { build_settings_panel, update_settings_panel } from "./ui/settings-menu";
import type { CourseData } from "./shared/types";
import { read_last_fetch_completed_at, ui_state } from "./ui/ui-state";
import { BROADCAST_COURSE_DATA_UPDATED, BROADCAST_FETCH_STARTED, COURSE_DATA_UPDATED, FETCH_COURSES, OPEN_URL, SETTINGS_CHANGED, TOGGLE_PANEL } from "./shared/constants/actions";

const COURSE_DATA_KEY = "courseData";
const LAST_FETCHED_KEY = "spark-last-fetched";
const SETTINGS_VALUE_KEY = "spark-user-settings";
const SCROLL_POS_SESSION_KEY = "spark-scroll-pos";
const SPARK_INITIALIZED_FLAG = "__spark_initialized__";

// Cooldown between time to live fetches. (Mouse movement, Page navigation)
// Fetches are forced if user clicks refresh button
const TTL_COOLDOWN_TIME_MINUTES = 15;

const FETCH_COOLDOWN_MS = TTL_COOLDOWN_TIME_MINUTES * 60 * 1000;
const INTERACTION_DEBOUNCE_MS = 2000;
const SCROLL_SAVE_DEBOUNCE_MS = 300;
const DEFAULT_DEBOUNCE_MS = 10000

let course_data: CourseData = {};
let calendar_container: HTMLElement | null = null;
let fetch_in_flight = false;
let remote_fetch_in_flight = false;
let interaction_debounce_timer: ReturnType<typeof setTimeout> | undefined;
let scroll_save_debounce: ReturnType<typeof setTimeout> | undefined;

function fetch_and_store_courses() {
    if (Date.now() - read_last_fetch_completed_at() < DEFAULT_DEBOUNCE_MS)
    if (fetch_in_flight) return;
    chrome.storage.local.set({LAST_FETCH_STARTED_AT_STORAGE_KEY: Date.now().toString()});
    fetch_in_flight = true;
    toggle_fetching_indicator(true);
    safe_send_message({ action: BROADCAST_FETCH_STARTED });
    safe_send_message({ action: FETCH_COURSES }, on_fetch_response);
}

function on_fetch_response(response: unknown) {
    fetch_in_flight = false;
    toggle_fetching_indicator(false);
    if (!response) return;
    course_data = JSON.parse(JSON.stringify(response));
    const fetched_at = new Date();
    set_last_fetched_time(fetched_at);
    chrome.storage.local.set(
        { [COURSE_DATA_KEY]: course_data, [LAST_FETCHED_KEY]: fetched_at.toISOString() },
        on_course_data_stored
    );
}

function on_course_data_stored() {
    update_gui(course_data, false);
    safe_send_message({ action: BROADCAST_COURSE_DATA_UPDATED });
}

function rerender_with_cached_data() {
    if (course_data && Object.keys(course_data).length > 0) {
        update_gui(course_data, fetch_in_flight || remote_fetch_in_flight);
    }
}

function is_any_fetch_in_flight() {
    return fetch_in_flight || remote_fetch_in_flight;
}

function is_fetch_cooldown_active() {
    const last_fetch_completed_at = read_last_fetch_completed_at()
    return Date.now() - last_fetch_completed_at < FETCH_COOLDOWN_MS;
}

function try_smart_fetch() {
    if (is_any_fetch_in_flight()) return;
    if (is_fetch_cooldown_active()) return;
    fetch_and_store_courses();
}

function on_page_interaction() {
    clearTimeout(interaction_debounce_timer);
    interaction_debounce_timer = setTimeout(try_smart_fetch, INTERACTION_DEBOUNCE_MS);
}

function on_tab_visibility_changed() {
    if (document.visibilityState === "visible") {
        try_smart_fetch();
    }
}

function save_scroll_position() {
    if (calendar_container) {
        sessionStorage.setItem(SCROLL_POS_SESSION_KEY, calendar_container.scrollTop.toString());
    }
}

function on_calendar_scroll() {
    clearTimeout(scroll_save_debounce);
    scroll_save_debounce = setTimeout(save_scroll_position, SCROLL_SAVE_DEBOUNCE_MS);
}

function restore_scroll_position() {
    const saved_scroll_top = parseInt(sessionStorage.getItem(SCROLL_POS_SESSION_KEY) || "0", 10);
    if (saved_scroll_top > 0) {
        requestAnimationFrame(() => {
            if (calendar_container) calendar_container.scrollTop = saved_scroll_top;
        });
    } else {
        scroll_to_today();
    }
}

function setup_scroll_persistence() {
    calendar_container!.addEventListener("scroll", on_calendar_scroll);
}

function on_panel_restored() {
    chrome.storage.local.get([SETTINGS_VALUE_KEY], function(result) {
        if (result[SETTINGS_VALUE_KEY]) {
            apply_settings(result[SETTINGS_VALUE_KEY] as { days_back: number; show_completed?: boolean });
        }
        if (course_data && Object.keys(course_data).length > 0) {
            update_gui(course_data, fetch_in_flight || remote_fetch_in_flight);
        }
    });
}

function on_initial_cache_loaded(result: { [key: string]: unknown }) {
    if (result[SETTINGS_VALUE_KEY]) {
        apply_settings(result[SETTINGS_VALUE_KEY] as { days_back: number; show_completed?: boolean });
    }
    if (result[LAST_FETCHED_KEY]) {
        set_last_fetched_time(new Date(result[LAST_FETCHED_KEY] as string));
    }
    if (result[COURSE_DATA_KEY]) {
        course_data = JSON.parse(JSON.stringify(result[COURSE_DATA_KEY]));
        update_gui(course_data, true);
        restore_scroll_position();
    }
}

function load_initial_cached_data() {
    chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY, SETTINGS_VALUE_KEY], on_initial_cache_loaded);
}

function register_smart_fetch_listeners() {
    document.addEventListener("visibilitychange", on_tab_visibility_changed);
    document.addEventListener("mousemove", on_page_interaction);
    window.addEventListener("scroll", on_page_interaction);
}

function on_page_ready() {
    (window as unknown as { [key: string]: unknown })[SPARK_INITIALIZED_FLAG] = true;
    register_settings_panel_builder(build_settings_panel);
    update_settings_panel();
    calendar_container = inject_embedded_ui();
    initialize_gui();
    setup_scroll_persistence();
    register_panel_restore_callback(on_panel_restored);
    register_ui_callbacks({ on_refresh: fetch_and_store_courses, on_rerender: rerender_with_cached_data });
    register_smart_fetch_listeners();
    load_initial_cached_data();
    try_smart_fetch();
}

function reload_open_tabs() {
    if (document.readyState === "complete") {
        on_page_ready();
    } else {
        window.addEventListener("load", on_page_ready);
    }
}

function on_message_fetch_started() {
    remote_fetch_in_flight = true;
    toggle_fetching_indicator(true);
}

function on_remote_course_data_loaded(result: { [key: string]: unknown }) {
    if (result[LAST_FETCHED_KEY]) {
        set_last_fetched_time(new Date(result[LAST_FETCHED_KEY] as string));
    }
    if (result[COURSE_DATA_KEY]) {
        update_gui(JSON.parse(JSON.stringify(result[COURSE_DATA_KEY])), fetch_in_flight);
    }
}

function on_message_course_data_updated() {
    remote_fetch_in_flight = false;
    chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY], on_remote_course_data_loaded);
}

function on_message_open_url(url: string) {
    window.open(url, "_blank");
}

function on_message_settings_changed(settings: { days_back: number; show_completed?: boolean }) {
    apply_settings(settings);
    rerender_with_cached_data();
}

function handle_background_message(request: { action: string; url?: string; settings?: { days_back: number; show_completed?: boolean } }) {
    if (request.action === FETCH_COURSES) on_message_fetch_started();
    if (request.action === COURSE_DATA_UPDATED) on_message_course_data_updated();
    if (request.action === OPEN_URL) on_message_open_url(request.url!);
    if (request.action === TOGGLE_PANEL) toggle_panel();
    if (request.action === SETTINGS_CHANGED) on_message_settings_changed(request.settings!);
}

function initialize() {
    chrome.runtime.onMessage.addListener(handle_background_message);
    reload_open_tabs();
}

initialize();
