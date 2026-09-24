// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { formatTimeFromDate, formatFullDatetime, getDateOnly, formatDateHeader } from "../shared/utils/date-utils";
import { getCourseColor, ensureCourseColorsAssigned } from "../shared/utils/color-utils";
import { create_frequency_chart } from "./frequency-chart";
import { truncate_course_name } from "../shared/utils/string-utils";
import { DUE_TODAY_COLOR, DUE_TOMORROW_COLOR, get_setting, OVERDUE_COLOR } from "../core/settings";
import { CalendarCss, FrequencyChartCss, PanelCss } from "../shared/constants/ui";
import type { CourseData, CourseShape, ItemShape, LinkStatuses } from "../shared/types";
import { CALENDAR_DAYS_BACK, COURSE_DATA, HIDDEN_COURSES, HIDDEN_TYPES, IS_FETCHING, LAST_FETCH_COMPLETED_AT, LINK_STATUSES, SCROLL_POS, SHOW_COMPLETED_ASSIGNMENTS, SHOW_ERROR_LINKS } from "../shared/constants/storage-keys";
import { ASSIGNMENT_LINK_CLICKED } from "../shared/constants/actions";
import { get_state, set_state } from "../core/state";
import { register_panel_restore_callback } from "./panel";
import { scroll_to_today } from "./frequency-chart";
import { update_fetching_indicator, update_last_fetched_label } from "./fetch-indicator";

const AVAILABLE_ON_PREFIX = "Available on ";

const CREATE_EMPTY_DAY_NOTICE = false;
const EMPTY_DAY_MESSAGE = "No assignments due";

const NO_UPCOMING_ASSIGNMENTS = "No upcoming assignments";
const META_SEPARATOR = "|";
const COURSE_DOT_SYMBOL = "●";
const COMPLETED_BADGE_SYMBOL = "✓";
const INCOMPLETE_DOT_SYMBOL = "•";
const NOT_YET_AVAILABLE_BADGE_SYMBOL = "⊘";
const UNAVAILABLE_BADGE_SYMBOL = "—";

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
        if (get_setting(HIDDEN_COURSES).has(course_id)) return;

        const item_collections = [
            { items: course.assignments, type: "assignments" },
            { items: course.quizzes, type: "quizzes" },
            { items: course.discussions, type: "discussions" },
        ];

        item_collections.forEach(({ items, type }) => {
            if (get_setting(HIDDEN_TYPES).has(type)) return;
            if (!items) return;
            Object.keys(items).forEach((item_id) => {
                const item = items[item_id];
                const link_statuses = get_state(LINK_STATUSES) as LinkStatuses;
                const is_link_error = link_statuses[item.url ?? ""] === true;
                if (!item.due_date || (item.completed && !get_setting(SHOW_COMPLETED_ASSIGNMENTS)) || (is_link_error && !get_setting(SHOW_ERROR_LINKS))) return;
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

export function get_due_time_color(due_date: string | null | undefined, completed: boolean, now_date_only: Date, is_link_error = false): string | null {
    if (is_link_error) return null;
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
    const link_statuses = get_state(LINK_STATUSES) as LinkStatuses;
    const is_link_error = link_statuses[item.url ?? ""] === true;
    const color = get_due_time_color(item.due_date, item.completed, now_date_only, is_link_error);
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

function build_completion_badge(completed: boolean, unavailable: boolean, not_yet_available: boolean): HTMLDivElement {
    const badge = document.createElement("div");
    badge.className = completed && !unavailable && !not_yet_available ? CalendarCss.ITEM_COMPLETED_BADGE : CalendarCss.ITEM_INCOMPLETE_DOT;
    badge.textContent = unavailable ? UNAVAILABLE_BADGE_SYMBOL : not_yet_available ? NOT_YET_AVAILABLE_BADGE_SYMBOL : completed ? COMPLETED_BADGE_SYMBOL : INCOMPLETE_DOT_SYMBOL;
    return badge;
}

function build_item_card(item: ItemShape, course: CourseShape): HTMLAnchorElement {
    const now_date_only = getDateOnly(new Date())!;
    const start_date_only = item.start_date ? getDateOnly(item.start_date) : null;
    const is_not_yet_available = start_date_only !== null && start_date_only > now_date_only;
    const link_statuses = get_state(LINK_STATUSES) as LinkStatuses;
    const is_link_error = link_statuses[item.url ?? ""] === true;
    const is_unavailable = is_not_yet_available || is_link_error;

    const link = document.createElement("a");
    link.href = item.url ?? "";
    link.className = CalendarCss.ITEM;
    link.dataset.itemUrl = item.url ?? "";
    link.dataset.itemCompleted = String(item.completed);
    link.dataset.itemNotYetAvailable = String(is_not_yet_available);
    link.dataset.itemDueDate = item.due_date ?? "";
    if (item.url) {
        link.addEventListener("click", () => {
            void chrome.runtime.sendMessage({ action: ASSIGNMENT_LINK_CLICKED, url: item.url });
        });
    }
    if (is_unavailable) {
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
    link.appendChild(build_completion_badge(item.completed, is_link_error, is_not_yet_available));

    return link;
}

export function update_item_link_status(url: string, unavailable: boolean): void {
    const calendar_container = document.getElementById(PanelCss.CALENDAR_CONTAINER_ID);
    if (!calendar_container) return;

    calendar_container.querySelectorAll<HTMLAnchorElement>(`.${CalendarCss.ITEM}`).forEach((link) => {
        if (link.dataset.itemUrl !== url) return;
        const is_not_yet_available = link.dataset.itemNotYetAvailable === "true";
        const is_unavailable = unavailable || is_not_yet_available;
        link.classList.toggle(CalendarCss.ITEM_UNAVAILABLE, is_unavailable);
        const badge = link.querySelector<HTMLDivElement>(`.${CalendarCss.ITEM_COMPLETED_BADGE}, .${CalendarCss.ITEM_INCOMPLETE_DOT}`);
        if (!badge) return;
        const completed = link.dataset.itemCompleted === "true";
        badge.classList.toggle(CalendarCss.ITEM_COMPLETED_BADGE, completed && !unavailable && !is_not_yet_available);
        badge.classList.toggle(CalendarCss.ITEM_INCOMPLETE_DOT, !completed || unavailable || is_not_yet_available);
        badge.textContent = unavailable ? UNAVAILABLE_BADGE_SYMBOL : is_not_yet_available ? NOT_YET_AVAILABLE_BADGE_SYMBOL : completed ? COMPLETED_BADGE_SYMBOL : INCOMPLETE_DOT_SYMBOL;

        const due_time = link.querySelector<HTMLElement>(`.${CalendarCss.ITEM_TIME}`);
        if (due_time) {
            due_time.style.color = get_due_time_color(
                link.dataset.itemDueDate,
                completed,
                getDateOnly(new Date())!,
                unavailable,
            ) ?? "";
        }
    });
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


let scroll_listener_initialized = false;

export function update_calendar(course_data: CourseData): void {
    const calendar_container = document.getElementById(PanelCss.CALENDAR_CONTAINER_ID);
    if (!calendar_container) return;

    if (!scroll_listener_initialized) {
        calendar_container.addEventListener("scroll", () => save_scroll_state(calendar_container));
        scroll_listener_initialized = true;
    }

    ensureCourseColorsAssigned(course_data);

    const preserved_week_offset = get_preserved_week_offset(calendar_container);
    calendar_container.innerHTML = "";

    const { items_by_date, min_date, max_date } = collect_items_by_date(course_data);

    try {
        create_frequency_chart(calendar_container, items_by_date, preserved_week_offset);
    } catch (e) {
        console.error("Error creating frequency chart (non-fatal):", e);
    }

    update_last_fetched_label(get_state(LAST_FETCH_COMPLETED_AT));
    update_fetching_indicator();

    if (!min_date || !max_date) {
        show_empty_state(calendar_container);
        return;
    }

    const today = new Date();
    const start_date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const calendar_days_back = get_setting(CALENDAR_DAYS_BACK)
    start_date.setDate(start_date.getDate() - calendar_days_back);
    const end_date = new Date(max_date);

    build_calendar_list(items_by_date, start_date, end_date, calendar_container);
    mount_scrollbar_indicator(calendar_container);
}

function save_scroll_state(container: HTMLElement): void {
    set_state(SCROLL_POS, container.scrollTop);
}

export function restore_scroll_state(container: HTMLElement): void {
    const saved = get_state(SCROLL_POS) as number;
    saved > 0 ? (container.scrollTop = saved) : scroll_to_today();
}

register_panel_restore_callback(() => update_calendar(get_state(COURSE_DATA)));

