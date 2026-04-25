// Shared constants, storage keys, initialised settings state, and utilities
// used across all UI modules (calendar, frequency-chart, settings-menu).

import type { CourseData } from "../shared/types";

// --- Calendar / chart layout ---
export const DAYS_IN_WEEK = 7;
export const CALENDAR_DAYS_BACK_DEFAULT = 7;
export const SETTINGS_MIN_DAYS_BACK = 0;
export const SETTINGS_MAX_DAYS_BACK = 365;

// --- Due-date highlight colours ---
export const DUE_TODAY_COLOR = "#e8900c";
export const DUE_TOMORROW_COLOR = "#e7c21d";
export const OVERDUE_COLOR = "#e84040";

// --- Date / day label lookup tables ---
export const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// --- Assignment-type list used in settings and item collection ---
export const ITEM_TYPES = [
    { key: "assignments", label: "Assignments" },
    { key: "quizzes", label: "Quizzes" },
    { key: "discussions", label: "Discussions" },
];

// --- Storage Keys ---
// Synced across tabs via chrome.storage.local + broadcast:
export const CALENDAR_START_DAYS_BACK_STORAGE_KEY = "spark-calendar-start-days-back";
export const SHOW_COMPLETED_STORAGE_KEY = "spark-show-completed";
export const SHOW_ON_START_STORAGE_KEY = "spark-setting-show-on-start";
// Tab-local, session-scoped (sessionStorage — NOT synced across tabs):
export const HIDDEN_COURSES_SESSION_KEY = "spark-hidden-courses";
export const HIDDEN_TYPES_SESSION_KEY = "spark-hidden-types";

// Words stripped from the trailing portion of course names for compact display.
// E.g. "MATH 101 Spring 2025 Section A" → "MATH 101"
const COURSE_NAME_TRIM_WORDS = [
    "Section",
    "XLS",
    "Group",
    "Spring",
    "Fall",
    "Winter",
    "Summer",
];

// Safely reads a string array from sessionStorage, returning an empty set on any parse failure.
export function read_session_set(key: string): Set<string> {
    try {
        return new Set<string>(JSON.parse(sessionStorage.getItem(key) || "[]"));
    } catch {
        return new Set<string>();
    }
}

// Removes trailing semester/section words from a course name for compact display.
export function truncate_course_name(name: string): string {
    if (!name) return name;
    const pattern = COURSE_NAME_TRIM_WORDS
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    return name.replace(new RegExp(`\\s*(${pattern})\\b.*$`, "i"), "").trim();
}

// Mutable shared state — a single object so any importing module can read and
// write properties without getter/setter boilerplate. Initialised once from
// storage on module load; all later mutations are reflected everywhere.
export const ui_state = {
    calendar_start_days_back: (() => {
        const raw = parseInt(
            localStorage.getItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY) ?? String(CALENDAR_DAYS_BACK_DEFAULT),
            10,
        );
        return Number.isFinite(raw) && raw >= 0 ? raw : CALENDAR_DAYS_BACK_DEFAULT;
    })(),
    show_completed_items: localStorage.getItem(SHOW_COMPLETED_STORAGE_KEY) !== "false",
    show_on_start: localStorage.getItem(SHOW_ON_START_STORAGE_KEY) !== "false",
    hidden_course_ids: read_session_set(HIDDEN_COURSES_SESSION_KEY),
    hidden_types: read_session_set(HIDDEN_TYPES_SESSION_KEY),
    last_fetched_time: null as Date | null,
    last_course_data: {} as CourseData,
    on_refresh: null as (() => void) | null,
    on_rerender: null as (() => void) | null,
};
