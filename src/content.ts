// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import {
    safe_send_message,
    inject_embedded_ui,
    register_panel_restore_callback,
    register_settings_panel_builder,
    toggle_panel
} from "./ui/panel";
import {
    initialize_calendar,
    update_gui,
    toggle_fetching_indicator,
} from "./ui/calendar";
import { scroll_to_today } from "./ui/frequency-chart";
import { build_settings_panel, update_settings_panel } from "./ui/settings-menu";
import { initialize_settings, apply_user_settings } from "./core/settings";
import {
    FETCH_COURSES,
    OPEN_URL,
    SETTINGS_CHANGED,
    TOGGLE_PANEL
} from "./shared/constants/actions";
import { COURSE_DATA, IS_FETCHING, LAST_FETCH_COMPLETED_AT, SCROLL_POS } from "./shared/constants/storage-keys";
import { get_state, set_state, initialize_state } from "./core/state";
import { initialize_storage_listener } from "./core/storage-listener";

const COOLDOWN_MS = 15 * 60 * 1000;

/**
 * The single source of truth for triggering a fetch.
 * Validates cooldowns and in-flight status before messaging background.
 */
function request_smart_fetch(force = false) {
    const time_since_last = Date.now() - (get_state(LAST_FETCH_COMPLETED_AT)?.getTime() ?? 0);
    const is_cooldown_active = time_since_last < COOLDOWN_MS;

    if (get_state(IS_FETCHING) || (!force && is_cooldown_active)) return;

    set_state(IS_FETCHING, true);
    toggle_fetching_indicator(true);

    safe_send_message({ action: FETCH_COURSES }, () => {
        set_state(IS_FETCHING, false);
        toggle_fetching_indicator(false);
    });
}

function save_scroll_state(container: HTMLElement) {
    set_state(SCROLL_POS, container.scrollTop);
}

function restore_scroll_state(container: HTMLElement) {
    const saved = get_state(SCROLL_POS) as number;
    saved > 0 ? (container.scrollTop = saved) : scroll_to_today();
}

/**
 * Message Routing
 */
function handle_runtime_messages(request: any) {
    switch (request.action) {
        case TOGGLE_PANEL:     toggle_panel(); break;
        case OPEN_URL:         window.open(request.url, "_blank"); break;
        case SETTINGS_CHANGED: apply_user_settings(request.settings); update_gui(get_state(COURSE_DATA), get_state(IS_FETCHING)); break;
    }
}

async function boot() {
    // 1. Load Settings & State
    await initialize_settings();
    await initialize_state();

    // 2. Setup UI
    const container = inject_embedded_ui();
    initialize_calendar();
    register_settings_panel_builder(build_settings_panel);
    update_settings_panel();

    // 3. Render Initial State
    update_gui(get_state(COURSE_DATA), false);
    if (container) restore_scroll_state(container);

    // 4. Register Listeners
    initialize_storage_listener();
    chrome.runtime.onMessage.addListener(handle_runtime_messages);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && request_smart_fetch());
    container?.addEventListener("scroll", () => save_scroll_state(container));
    register_panel_restore_callback(() => update_gui(get_state(COURSE_DATA), get_state(IS_FETCHING)));

    // 5. Initial Fetch
    request_smart_fetch();
}

async function initialize_spark() {
    // Check if we've already injected to prevent double-init
    // (Vite HMR can sometimes trigger this)
    if ((window as any).has_spark_initialized) return;
    (window as any).has_spark_initialized = true;

    await boot();
}

initialize_spark();