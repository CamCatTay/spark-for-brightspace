// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import type { CourseData } from "../shared/types";

export const DAYS_IN_WEEK = 7;
export const CALENDAR_DAYS_BACK_DEFAULT = 7;
export const SETTINGS_MIN_DAYS_BACK = 0;
export const SETTINGS_MAX_DAYS_BACK = 365;

export const DUE_TODAY_COLOR = "#e8900c";
export const DUE_TOMORROW_COLOR = "#e7c21d";
export const OVERDUE_COLOR = "#e84040";

export const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ITEM_TYPES = [
    { key: "assignments", label: "Assignments" },
    { key: "quizzes", label: "Quizzes" },
    { key: "discussions", label: "Discussions" },
];

// Synced across tabs via chrome.storage.local + broadcast:
export const CALENDAR_START_DAYS_BACK_STORAGE_KEY = "spark-calendar-start-days-back";
export const SHOW_COMPLETED_STORAGE_KEY = "spark-show-completed";
export const SHOW_ON_START_STORAGE_KEY = "spark-setting-show-on-start";
export const LAST_FETCH_COMPLETED_AT_STORAGE_KEY = "spark-last-fetch-completed-at";
// Tab-local, session-scoped (sessionStorage — NOT synced across tabs):
export const HIDDEN_COURSES_SESSION_KEY = "spark-hidden-courses";
export const HIDDEN_TYPES_SESSION_KEY = "spark-hidden-types";

const COURSE_NAME_TRIM_WORDS = [
    "Section",
    "XLS",
    "Group",
    "Spring",
    "Fall",
    "Winter",
    "Summer",
];

export function read_session_set(key: string): Set<string> {
    try {
        return new Set<string>(JSON.parse(sessionStorage.getItem(key) || "[]"));
    } catch {
        return new Set<string>();
    }
}

export function read_enabled_flag(key: string): boolean {
    return localStorage.getItem(key) !== "false";
}

export function read_calendar_start_days_back(): number {
    const raw = parseInt(
        localStorage.getItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY) ?? String(CALENDAR_DAYS_BACK_DEFAULT),
        10,
    );
    return Number.isFinite(raw) && raw >= 0 ? raw : CALENDAR_DAYS_BACK_DEFAULT;
}

export function truncate_course_name(name: string): string {
    if (!name) return name;
    const pattern = COURSE_NAME_TRIM_WORDS
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    return name.replace(new RegExp(`\\s*(${pattern})\\b.*$`, "i"), "").trim();
}

export function read_last_fetch_completed_at(): number {
    return parseInt(localStorage.getItem(LAST_FETCH_COMPLETED_AT_STORAGE_KEY) ?? "0", 10);
}

// Mutable shared state — a single object so any importing module can read and
// write properties without getter/setter boilerplate. Initialised once from
// storage on module load; all later mutations are reflected everywhere.
export const ui_state = {
    calendar_start_days_back: read_calendar_start_days_back(),
    show_completed_items: read_enabled_flag(SHOW_COMPLETED_STORAGE_KEY),
    show_on_start: read_enabled_flag(SHOW_ON_START_STORAGE_KEY),
    hidden_course_ids: read_session_set(HIDDEN_COURSES_SESSION_KEY),
    hidden_types: read_session_set(HIDDEN_TYPES_SESSION_KEY),
    last_fetched_time: null as Date | null,
    last_course_data: {} as CourseData,
    on_refresh: null as (() => void) | null,
    on_rerender: null as (() => void) | null,
};
