// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { formatTimeFromDate, formatFullDatetime, getDateOnly, formatDateHeader } from "../utils/date-utils";
import { getCourseColor, ensureCourseColorsAssigned } from "../utils/color-utils";
import { create_frequency_chart } from "./frequency-chart";
import { update_settings_course_list } from "./settings-menu";
import {
    ui_state,
    truncate_course_name,
    DUE_TODAY_COLOR,
    DUE_TOMORROW_COLOR,
    OVERDUE_COLOR,
    CALENDAR_START_DAYS_BACK_STORAGE_KEY,
    SHOW_COMPLETED_STORAGE_KEY,
    LAST_FETCH_COMPLETED_AT_STORAGE_KEY
} from "./ui-state";
import { CalendarCss, FrequencyChartCss, PanelCss, SettingsCss } from "./dom-constants";
import type { CourseData, CourseShape, ItemShape } from "../shared/types";

const AVAILABLE_ON_PREFIX = "Available on ";

const CREATE_EMPTY_DAY_NOTICE = false;
const EMPTY_DAY_MESSAGE = "No assignments due";

const NO_UPCOMING_ASSIGNMENTS = "No upcoming assignments";
const META_SEPARATOR = "|";
const COURSE_DOT_SYMBOL = "●";
const COMPLETED_BADGE_SYMBOL = "✓";
const INCOMPLETE_DOT_SYMBOL = "•";
const FETCHING_STATUS_LABEL = " — Fetching...";

interface DateIndexedItems {
    items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>>;
    min_date: Date | null;
    max_date: Date | null;
}

function collect_items_by_date(course_data: CourseData): DateIndexedItems {
    const items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>> = {};
    let min_date: Date | null = null;
    let max_date: Date | null = null;

    Object.keys(course_data).forEach((course_id) => {
        const course = course_data[course_id];
        if (ui_state.hidden_course_ids.has(course_id)) return;

        const item_collections = [
            { items: course.assignments, type: "assignments" },
            { items: course.quizzes, type: "quizzes" },
            { items: course.discussions, type: "discussions" },
        ];

        item_collections.forEach(({ items, type }) => {
            if (ui_state.hidden_types.has(type)) return;
            if (!items) return;
            Object.keys(items).forEach((item_id) => {
                const item = items[item_id];
                if (!item.due_date || (item.completed && !ui_state.show_completed_items)) return;
                const date_only = getDateOnly(item.due_date);
                if (!date_only) return;
                const date_key = date_only.toISOString().split("T")[0];
                if (!items_by_date[date_key]) {
                    items_by_date[date_key] = [];
                }
                items_by_date[date_key].push({ item, course });
                if (!min_date || date_only < min_date) min_date = date_only;
                if (!max_date || date_only > max_date) max_date = date_only;
            });
        });
    });

    return { items_by_date, min_date, max_date };
}

export function get_due_time_color(due_date: string | null | undefined, completed: boolean, now_date_only: Date): string | null {
    const due_date_only = getDateOnly(due_date);
    if (!due_date_only) return null;
    if (!completed && due_date_only < now_date_only) return OVERDUE_COLOR;
    if (due_date_only.getTime() === now_date_only.getTime()) return DUE_TODAY_COLOR;
    const tomorrow = new Date(now_date_only);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (due_date_only.getTime() === tomorrow.getTime()) return DUE_TOMORROW_COLOR;
    return null;
}

function build_start_date_section(start_date: string): HTMLDivElement {
    const container = document.createElement("div");
    container.className = CalendarCss.START_DATE_CONTAINER;

    const value = document.createElement("span");
    value.className = CalendarCss.START_DATE_VALUE;
    value.textContent = AVAILABLE_ON_PREFIX + formatFullDatetime(start_date);
    container.appendChild(value);

    return container;
}

function build_course_label(course: CourseShape): HTMLSpanElement {
    const span = document.createElement("span");
    span.className = CalendarCss.ITEM_COURSE;
    span.dataset.fullName = course.name;

    const dot = document.createElement("span");
    dot.className = CalendarCss.ITEM_COURSE_DOT;
    dot.textContent = COURSE_DOT_SYMBOL;
    dot.style.color = getCourseColor(course.name);
    span.appendChild(dot);
    span.appendChild(document.createTextNode(truncate_course_name(course.name)));

    return span;
}

function build_due_date_section(item: ItemShape, course: CourseShape, now_date_only: Date): HTMLDivElement {
    const container = document.createElement("div");
    container.className = CalendarCss.DUE_DATE_CONTAINER;

    const due_time_el = document.createElement("span");
    due_time_el.className = CalendarCss.ITEM_TIME;
    due_time_el.textContent = formatTimeFromDate(item.due_date);
    const color = get_due_time_color(item.due_date, item.completed, now_date_only);
    if (color) due_time_el.style.color = color;
    container.appendChild(due_time_el);

    const separator = document.createElement("span");
    separator.className = CalendarCss.ITEM_META_SEPARATOR;
    separator.textContent = META_SEPARATOR;
    container.appendChild(separator);

    container.appendChild(build_course_label(course));

    return container;
}

function build_item_meta(item: ItemShape, course: CourseShape, now_date_only: Date): HTMLDivElement {
    const meta = document.createElement("div");
    meta.className = CalendarCss.ITEM_META;

    if (item.start_date) {
        meta.appendChild(build_start_date_section(item.start_date));
    }
    meta.appendChild(build_due_date_section(item, course, now_date_only));

    return meta;
}

function build_completion_badge(completed: boolean): HTMLDivElement {
    const badge = document.createElement("div");
    badge.className = completed ? CalendarCss.ITEM_COMPLETED_BADGE : CalendarCss.ITEM_INCOMPLETE_DOT;
    badge.textContent = completed ? COMPLETED_BADGE_SYMBOL : INCOMPLETE_DOT_SYMBOL;
    return badge;
}

function build_item_card(item: ItemShape, course: CourseShape): HTMLAnchorElement {
    const now_date_only = getDateOnly(new Date())!;
    const start_date_only = item.start_date ? getDateOnly(item.start_date) : null;
    const is_not_yet_available = start_date_only !== null && start_date_only > now_date_only;

    const link = document.createElement("a");
    link.href = item.url ?? "";
    link.className = CalendarCss.ITEM;
    if (is_not_yet_available) {
        link.classList.add(CalendarCss.ITEM_UNAVAILABLE);
    }

    const name_el = document.createElement("div");
    name_el.className = CalendarCss.ITEM_NAME;
    name_el.textContent = item.name;

    const content = document.createElement("div");
    content.className = CalendarCss.ITEM_CONTENT;
    content.appendChild(name_el);
    content.appendChild(build_item_meta(item, course, now_date_only));

    link.appendChild(content);
    link.appendChild(build_completion_badge(item.completed));

    return link;
}

function build_empty_day_notice(): HTMLDivElement {
    const notice = document.createElement("div");
    notice.className = CalendarCss.EMPTY_DAY_NOTICE;
    notice.textContent = EMPTY_DAY_MESSAGE;
    return notice;
}

function build_date_section(date: Date, items: Array<{ item: ItemShape; course: CourseShape }>): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const header = document.createElement("div");
    header.className = CalendarCss.DATE_HEADER;
    const title = document.createElement("div");
    title.className = CalendarCss.DATE_TITLE;
    title.textContent = formatDateHeader(date);
    header.appendChild(title);
    fragment.appendChild(header);

    const items_container = document.createElement("div");
    items_container.className = CalendarCss.ITEMS_CONTAINER;
    if (items.length === 0 && CREATE_EMPTY_DAY_NOTICE) {
        items_container.appendChild(build_empty_day_notice());
    } else {
        items.forEach(({ item, course }) => items_container.appendChild(build_item_card(item, course)));
    }
    fragment.appendChild(items_container);

    return fragment;
}

function build_calendar_list(
    items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>>,
    start_date: Date,
    end_date: Date,
    calendar_container: HTMLElement,
): void {
    const current_date = new Date(start_date);
    while (current_date <= end_date) {
        const date_key = current_date.toISOString().split("T")[0];
        const day_items = items_by_date[date_key] || [];
        calendar_container.appendChild(build_date_section(current_date, day_items));
        current_date.setDate(current_date.getDate() + 1);
    }
}

function show_empty_state(calendar_container: HTMLElement): void {
    calendar_container.parentElement?.querySelector(`.${CalendarCss.SCROLLBAR_INDICATOR}`)?.remove();
    const empty_message = document.createElement("div");
    empty_message.id = CalendarCss.EMPTY_STATE_ID;
    empty_message.textContent = NO_UPCOMING_ASSIGNMENTS;
    calendar_container.appendChild(empty_message);
}

function get_preserved_week_offset(calendar_container: HTMLElement): number {
    const existing_chart = calendar_container.querySelector(`#${FrequencyChartCss.CONTAINER_ID}`) as (HTMLDivElement & { _week_offset?: number }) | null;
    return existing_chart?._week_offset ?? 0;
}

function build_scrollbar_notches(item_els: NodeListOf<HTMLElement>, scroll_height: number): HTMLDivElement[] {
    const notches: HTMLDivElement[] = [];
    item_els.forEach((item_el) => {
        const course_el = item_el.querySelector<HTMLElement>(`.${CalendarCss.ITEM_COURSE}`);
        const course_name = course_el?.dataset.fullName || course_el?.textContent || "";
        const percent_position = (item_el.offsetTop / scroll_height) * 100;

        const notch = document.createElement("div");
        notch.className = CalendarCss.SCROLLBAR_NOTCH;
        notch.style.top = percent_position + "%";
        notch.style.backgroundColor = getCourseColor(course_name);
        notch.title = course_name;
        notches.push(notch);
    });
    return notches;
}

function sync_scrollbar_indicator(calendar_container: HTMLElement): void {
    const indicator = calendar_container.parentElement?.querySelector(`.${CalendarCss.SCROLLBAR_INDICATOR}`);
    if (!indicator) return;

    const scroll_height = calendar_container.scrollHeight;
    const item_els = calendar_container.querySelectorAll<HTMLElement>(`.${CalendarCss.ITEM}`);
    const notches = indicator.querySelectorAll<HTMLElement>(`.${CalendarCss.SCROLLBAR_NOTCH}`);

    notches.forEach((notch, index) => {
        if (index < item_els.length) {
            notch.style.top = (item_els[index].offsetTop / scroll_height) * 100 + "%";
        }
    });
}

function mount_scrollbar_indicator(calendar_container: HTMLElement): void {
    calendar_container.parentElement?.querySelector(`.${CalendarCss.SCROLLBAR_INDICATOR}`)?.remove();

    const item_els = calendar_container.querySelectorAll<HTMLElement>(`.${CalendarCss.ITEM}`);
    if (item_els.length === 0) return;

    const container_height = calendar_container.clientHeight;
    const scroll_height = calendar_container.scrollHeight;
    if (scroll_height <= container_height) return;

    const indicator = document.createElement("div");
    indicator.className = CalendarCss.SCROLLBAR_INDICATOR;
    build_scrollbar_notches(item_els, scroll_height).forEach((notch) => indicator.appendChild(notch));
    calendar_container.parentElement?.appendChild(indicator);

    calendar_container.addEventListener("scroll", () => sync_scrollbar_indicator(calendar_container));
}

export function initialize_gui(): void {
    update_gui({} as CourseData, true);
}

export function add_data_status_indicator(is_stale: boolean): void {
    document.querySelector(`.${CalendarCss.FETCH_STATUS}`)?.remove();

    const last_fetched_el = document.querySelector(`.${FrequencyChartCss.LAST_FETCHED}`);
    if (!last_fetched_el) return;

    last_fetched_el.classList.remove(CalendarCss.FETCHING);

    if (is_stale) {
        const fetch_status = document.createElement("span");
        fetch_status.className = CalendarCss.FETCH_STATUS;
        const label_text = document.createTextNode(FETCHING_STATUS_LABEL);
        const spinner = document.createElement("span");
        spinner.className = CalendarCss.FETCH_SPINNER;
        fetch_status.appendChild(label_text);
        fetch_status.appendChild(spinner);
        last_fetched_el.appendChild(fetch_status);
        last_fetched_el.classList.add(CalendarCss.FETCHING);
    }
}

export function update_gui(course_data: CourseData, is_from_cache: boolean = false): void {
    const calendar_container = document.getElementById(PanelCss.CALENDAR_CONTAINER_ID);
    if (!calendar_container) return;

    ui_state.last_course_data = course_data;
    ensureCourseColorsAssigned(course_data);
    update_settings_course_list(course_data);

    const preserved_week_offset = get_preserved_week_offset(calendar_container);
    calendar_container.innerHTML = "";

    const { items_by_date, min_date, max_date } = collect_items_by_date(course_data);

    try {
        create_frequency_chart(calendar_container, items_by_date, preserved_week_offset);
    } catch (e) {
        console.error("Error creating frequency chart (non-fatal):", e);
    }

    if (is_from_cache) {
        add_data_status_indicator(true);
    }

    if (!min_date || !max_date) {
        show_empty_state(calendar_container);
        return;
    }

    const today = new Date();
    const start_date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start_date.setDate(start_date.getDate() - ui_state.calendar_start_days_back);
    const end_date = new Date(max_date);

    build_calendar_list(items_by_date, start_date, end_date, calendar_container);
    mount_scrollbar_indicator(calendar_container);
}

export function set_last_fetched_time(fetch_time: Date): void {
    ui_state.last_fetched_time = fetch_time;
}

export function register_ui_callbacks({ on_refresh, on_rerender }: { on_refresh: () => void; on_rerender: () => void }): void {
    ui_state.on_refresh = on_refresh;
    ui_state.on_rerender = on_rerender;
}

export function apply_settings({ days_back, show_completed }: { days_back: number; show_completed?: boolean }): void {
    ui_state.calendar_start_days_back = days_back;
    localStorage.setItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY, days_back.toString());

    if (show_completed !== undefined) {
        ui_state.show_completed_items = show_completed;
        localStorage.setItem(SHOW_COMPLETED_STORAGE_KEY, show_completed.toString());
    }

    const days_input = document.getElementById(SettingsCss.DAYS_BACK_INPUT_ID) as HTMLInputElement | null;
    if (days_input) days_input.value = days_back.toString();

    const completed_toggle = document.getElementById(SettingsCss.SHOW_COMPLETED_INPUT_ID) as HTMLInputElement | null;
    if (completed_toggle) completed_toggle.checked = ui_state.show_completed_items;
}
