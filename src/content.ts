// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { inject_embedded_ui, register_settings_panel_builder } from "./ui/panel";
import { update_calendar, restore_scroll_state } from "./ui/calendar";
import { build_settings_panel, update_settings_panel, register_rerender_callback } from "./ui/settings-menu";
import { initialize_settings } from "./core/settings";
import { COURSE_DATA } from "./shared/constants/storage-keys";
import { get_state, initialize_state } from "./core/state";
import { request_smart_fetch } from "./core/fetch";
import "./core/storage-listener";

async function main() {
    if ((window as any).has_spark_initialized) return;
    (window as any).has_spark_initialized = true;

    // 1. Load Settings & State
    await initialize_settings();
    await initialize_state();

    // 2. Setup UI
    const container = inject_embedded_ui();
    register_settings_panel_builder(build_settings_panel);
    register_rerender_callback(() => update_calendar(get_state(COURSE_DATA)));
    update_settings_panel();

    // 3. Render Initial State
    update_calendar(get_state(COURSE_DATA));
    if (container) restore_scroll_state(container);

    // 4. Initial Fetch
    request_smart_fetch();
}

main();
