import { COURSE_DATA, HIDDEN_COURSES, HIDDEN_TYPES, IS_FETCHING, LAST_FETCH_COMPLETED_AT, USER_SETTINGS } from "../shared/constants/storage-keys";
import { apply_setting_change, apply_user_settings } from "./settings";
import { apply_state_change, get_state } from "./state";
import { update_calendar } from "../ui/calendar";
import { update_settings_panel } from "../ui/settings-menu";
import { hide_fetching_indicator, show_fetching_indicator, update_fetching_indicator, update_last_fetched_label } from "../ui/fetch-indicator";

function on_chrome_storage_changed(changes: Record<string, any>, area: "sync" | "local" | "managed" | "session"): void {
    if (area === "sync") {
        if (changes[USER_SETTINGS]) {
            apply_user_settings(changes[USER_SETTINGS].newValue ?? {});
            update_settings_panel();
            update_calendar(get_state(COURSE_DATA));
        }
    }

    if (area === "session") {
        if (changes[HIDDEN_COURSES]) { apply_setting_change(HIDDEN_COURSES, changes[HIDDEN_COURSES].newValue); update_settings_panel(); }
        if (changes[HIDDEN_TYPES]) { apply_setting_change(HIDDEN_TYPES, changes[HIDDEN_TYPES].newValue); update_settings_panel(); }
    }

    if (area === "local") {
        if (changes[COURSE_DATA]) {
            apply_state_change(COURSE_DATA, changes[COURSE_DATA].newValue);
            update_settings_panel();
            update_calendar(get_state(COURSE_DATA));
        }
        if (changes[LAST_FETCH_COMPLETED_AT]) {
            apply_state_change(LAST_FETCH_COMPLETED_AT, changes[LAST_FETCH_COMPLETED_AT].newValue);
            update_last_fetched_label(get_state(LAST_FETCH_COMPLETED_AT));
        }
        if (changes[IS_FETCHING]) {
            apply_state_change(IS_FETCHING, changes[IS_FETCHING].newValue);
            update_fetching_indicator();
        }
    }
}
chrome.storage.onChanged.addListener(on_chrome_storage_changed);