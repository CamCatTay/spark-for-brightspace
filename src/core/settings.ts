import { CALENDAR_DAYS_BACK, D2L_DARK_MODE, HIDDEN_COURSES, HIDDEN_TYPES, SHOW_COMPLETED_ASSIGNMENTS, SHOW_ON_START, SPARK_DARK_MODE, USER_SETTINGS } from "../shared/constants/storage-keys";
import { RegistryItem, apply_bundle, apply_item_change, get_value, set_value, sync_registry } from "../shared/utils/registry-utils";

export const DAYS_IN_WEEK = 7;
export const MIN_CALENDAR_DAYS_BACK = 0;
export const MAX_CALENDAR_DAYS_BACK = 365;

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
export const COURSE_NAME_TRIM_WORDS = ["Section", "XLS", "Group", "Spring", "Fall", "Winter", "Summer"];

const registry: RegistryItem[] = [
    { key: CALENDAR_DAYS_BACK, default: 7, scope: "sync", transform: (v) => typeof v === "number" ? v : 7, value: 7 },
    { key: SPARK_DARK_MODE, default: false, scope: "sync", value: false },
    { key: D2L_DARK_MODE, default: false, scope: "sync", value: false },
    { key: SHOW_COMPLETED_ASSIGNMENTS, default: true, scope: "sync", value: true },
    { key: SHOW_ON_START, default: true, scope: "sync", value: true },
    { key: HIDDEN_COURSES, default: new Set(), scope: "session", transform: (v) => new Set(v ?? []), value: new Set() },
    { key: HIDDEN_TYPES, default: new Set(), scope: "session", transform: (v) => new Set(v ?? []), value: new Set() },
];

export const get_setting = (key: string): any => get_value(registry, key);
export const set_setting = (key: string, value: any): Promise<void> => set_value(registry, key, value, USER_SETTINGS);

export function apply_user_settings(settings: Record<string, any>): void {
    apply_bundle(registry, settings, "sync");
}

export function apply_setting_change(key: string, raw: any): void {
    apply_item_change(registry, key, raw);
}

export async function initialize_settings(): Promise<void> {
    await sync_registry(registry, USER_SETTINGS);
}