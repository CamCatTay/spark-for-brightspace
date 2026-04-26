import { Action } from "../shared/actions";
import { getCourseColor } from "../utils/color-utils";
import { safe_send_message } from "./panel";
import { create_toggle_setting } from "../utils/settings-menu-utils";
import { SettingsCss } from "./dom-constants";
import {
    ui_state,
    truncate_course_name,
    ITEM_TYPES,
    CALENDAR_START_DAYS_BACK_STORAGE_KEY,
    SHOW_COMPLETED_STORAGE_KEY,
    SHOW_ON_START_STORAGE_KEY,
    HIDDEN_COURSES_SESSION_KEY,
    HIDDEN_TYPES_SESSION_KEY,
    SETTINGS_MIN_DAYS_BACK,
    SETTINGS_MAX_DAYS_BACK,
} from "./ui-state";
import type { CourseData, CourseShape } from "../shared/types";

function get_synced_settings() {
    return {
        days_back: ui_state.calendar_start_days_back,
        show_completed: ui_state.show_completed_items,
    };
}

function clamp_days_back(raw_value: number): number {
    return Math.max(SETTINGS_MIN_DAYS_BACK, Math.min(SETTINGS_MAX_DAYS_BACK, raw_value || 0));
}

function broadcast_settings_changed(): void {
    safe_send_message({ action: Action.BROADCAST_SETTINGS_CHANGED, settings: get_synced_settings() });
}

function trigger_rerender(): void {
    if (ui_state.on_rerender) ui_state.on_rerender();
}

function on_days_back_changed(input: HTMLInputElement): void {
    const clamped = clamp_days_back(parseInt(input.value, 10));
    input.value = clamped.toString();
    ui_state.calendar_start_days_back = clamped;
    localStorage.setItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY, clamped.toString());
    broadcast_settings_changed();
    trigger_rerender();
}

function on_show_completed_changed(checked: boolean): void {
    ui_state.show_completed_items = checked;
    localStorage.setItem(SHOW_COMPLETED_STORAGE_KEY, checked.toString());
    broadcast_settings_changed();
    trigger_rerender();
}

function on_show_on_start_changed(checked: boolean): void {
    ui_state.show_on_start = checked;
    localStorage.setItem(SHOW_ON_START_STORAGE_KEY, checked.toString());
    broadcast_settings_changed();
    trigger_rerender();
}

function on_type_visibility_changed(type_key: string, is_visible: boolean): void {
    if (is_visible) {
        ui_state.hidden_types.delete(type_key);
    } else {
        ui_state.hidden_types.add(type_key);
    }
    sessionStorage.setItem(HIDDEN_TYPES_SESSION_KEY, JSON.stringify([...ui_state.hidden_types]));
    trigger_rerender();
}

function on_course_visibility_changed(course_id: string, is_visible: boolean): void {
    if (is_visible) {
        ui_state.hidden_course_ids.delete(course_id);
    } else {
        ui_state.hidden_course_ids.add(course_id);
    }
    sessionStorage.setItem(HIDDEN_COURSES_SESSION_KEY, JSON.stringify([...ui_state.hidden_course_ids]));
    trigger_rerender();
}

function build_panel_header(): HTMLElement {
    const header = document.createElement("div");
    header.className = SettingsCss.PANEL_HEADER;

    const title = document.createElement("span");
    title.className = SettingsCss.PANEL_TITLE;
    title.textContent = "Settings";

    header.appendChild(title);
    return header;
}

function build_days_back_section(): HTMLElement {
    const section = document.createElement("div");
    section.className = SettingsCss.SECTION;

    const label = document.createElement("label");
    label.className = SettingsCss.LABEL;
    label.htmlFor = SettingsCss.DAYS_BACK_INPUT_ID;
    label.textContent = "Calendar look-back days";

    const description = document.createElement("p");
    description.className = SettingsCss.DESCRIPTION;
    description.textContent = "How many days before today the calendar starts showing items. Set to 0 to start from today.";

    const input = document.createElement("input");
    input.type = "number";
    input.id = SettingsCss.DAYS_BACK_INPUT_ID;
    input.className = SettingsCss.INPUT;
    input.min = SETTINGS_MIN_DAYS_BACK.toString();
    input.max = SETTINGS_MAX_DAYS_BACK.toString();
    input.value = ui_state.calendar_start_days_back.toString();
    input.addEventListener("change", () => on_days_back_changed(input));

    section.appendChild(label);
    section.appendChild(description);
    section.appendChild(input);
    return section;
}

function build_show_completed_section(): HTMLElement {
    const toggle = create_toggle_setting(
        "Show completed items",
        "When off, only incomplete items are shown in the calendar.",
        ui_state.show_completed_items,
        on_show_completed_changed
    );
    return toggle.section;
}

function build_show_on_start_section(): HTMLElement {
    const toggle = create_toggle_setting(
        "Show on start",
        "When off, the side panel will start hidden in new tabs.",
        ui_state.show_on_start,
        on_show_on_start_changed
    );
    return toggle.section;
}

function build_type_filter_row(key: string, type_label: string): HTMLElement {
    const row = document.createElement("label");
    row.className = SettingsCss.COURSE_ROW;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = SettingsCss.COURSE_CHECKBOX;
    checkbox.dataset.settingType = key;
    checkbox.checked = !ui_state.hidden_types.has(key);
    checkbox.addEventListener("change", () => on_type_visibility_changed(key, checkbox.checked));

    const name = document.createElement("span");
    name.className = SettingsCss.COURSE_NAME;
    name.textContent = type_label;

    row.appendChild(checkbox);
    row.appendChild(name);
    return row;
}

function build_types_filter_section(): HTMLElement {
    const section = document.createElement("div");
    section.className = SettingsCss.SECTION;

    const label = document.createElement("div");
    label.className = SettingsCss.LABEL;
    label.textContent = "Visible assignment types";

    const description = document.createElement("p");
    description.className = SettingsCss.DESCRIPTION;
    description.textContent = "Uncheck a type to hide it from the calendar.";

    const list = document.createElement("div");
    list.className = SettingsCss.COURSES_LIST;

    ITEM_TYPES.forEach(({ key, label: type_label }) => {
        list.appendChild(build_type_filter_row(key, type_label));
    });

    section.appendChild(label);
    section.appendChild(description);
    section.appendChild(list);
    return section;
}

function build_courses_section(): HTMLElement {
    const section = document.createElement("div");
    section.className = SettingsCss.SECTION;
    section.id = SettingsCss.COURSES_SECTION_ID;

    const label = document.createElement("div");
    label.className = SettingsCss.LABEL;
    label.textContent = "Visible courses";

    const description = document.createElement("p");
    description.className = SettingsCss.DESCRIPTION;
    description.textContent = "Uncheck a course to hide it from the calendar.";

    const list = document.createElement("div");
    list.id = SettingsCss.COURSES_LIST_ID;
    list.className = SettingsCss.COURSES_LIST;

    section.appendChild(label);
    section.appendChild(description);
    section.appendChild(list);
    return section;
}

function build_course_row(course_id: string, course: CourseShape): HTMLElement {
    const display_name = truncate_course_name(course.name) || course.name;
    const color = getCourseColor(course.name);

    const row = document.createElement("label");
    row.className = SettingsCss.COURSE_ROW;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = SettingsCss.COURSE_CHECKBOX;
    checkbox.checked = !ui_state.hidden_course_ids.has(course_id);
    checkbox.addEventListener("change", () => on_course_visibility_changed(course_id, checkbox.checked));

    const dot = document.createElement("span");
    dot.className = SettingsCss.COURSE_DOT;
    dot.style.backgroundColor = color;

    const name = document.createElement("span");
    name.className = SettingsCss.COURSE_NAME;
    name.textContent = display_name;
    name.title = course.name;

    row.appendChild(checkbox);
    row.appendChild(dot);
    row.appendChild(name);
    return row;
}

export function build_settings_panel(): HTMLElement {
    const panel = document.createElement("div");
    panel.id = SettingsCss.PANEL_ID;

    const body = document.createElement("div");
    body.className = SettingsCss.BODY;

    body.appendChild(build_days_back_section());
    body.appendChild(build_show_completed_section());
    body.appendChild(build_show_on_start_section());
    body.appendChild(build_types_filter_section());

    const courses_section = build_courses_section();
    body.appendChild(courses_section);

    panel.appendChild(build_panel_header());
    panel.appendChild(body);

    if (Object.keys(ui_state.last_course_data).length > 0) {
        const courses_list = courses_section.querySelector<HTMLElement>(`#${SettingsCss.COURSES_LIST_ID}`)!;
        update_settings_course_list(ui_state.last_course_data, courses_list);
    }

    return panel;
}

export function update_settings_course_list(course_data: CourseData, list_el: HTMLElement | null = null): void {
    const list = list_el || document.getElementById(SettingsCss.COURSES_LIST_ID);
    if (!list) return;

    list.innerHTML = "";

    Object.keys(course_data).forEach((course_id) => {
        list.appendChild(build_course_row(course_id, course_data[course_id]));
    });
}
