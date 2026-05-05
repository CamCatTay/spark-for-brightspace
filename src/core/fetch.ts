// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { safe_send_message } from "../ui/panel";
import { get_state } from "./state";
import { FETCH_COURSES } from "../shared/constants/actions";
import { IS_FETCHING, LAST_FETCH_COMPLETED_AT } from "../shared/constants/storage-keys";
import { register_refresh_callback } from "../ui/frequency-chart";

const COOLDOWN_MS = 15 * 60 * 1000;

export function request_smart_fetch(force = false): void {
    const time_since_last = Date.now() - (get_state(LAST_FETCH_COMPLETED_AT)?.getTime() ?? 0);
    const is_cooldown_active = time_since_last < COOLDOWN_MS;

    if (get_state(IS_FETCHING) || (!force && is_cooldown_active)) return;

    safe_send_message({ action: FETCH_COURSES });
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") request_smart_fetch();
});

register_refresh_callback(() => request_smart_fetch(true));
