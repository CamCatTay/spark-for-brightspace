// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { getWeekStart, getDateKey } from "../shared/utils/date-utils";
import { safe_send_message, panel_width } from "./panel";
import { build_settings_panel } from "./settings-menu";
import { ui_state, DAYS_IN_WEEK, MONTH_NAMES_SHORT, DAY_LABELS } from "./ui-state";
import { FrequencyChartCss, CalendarCss, SettingsCss, PanelCss } from "../shared/constants/ui";
import type { CourseShape, ItemShape } from "../shared/types";
import { OPEN_FAQ } from "../shared/constants/actions";

const PREV_WEEK_ICON = "‹";
const NEXT_WEEK_ICON = "›";
const SETTINGS_ICON = "⚙";
const REFRESH_ICON = "↻";
const FAQ_ICON = "?";

const PREV_BTN_TITLE = "Previous week";
const NEXT_BTN_TITLE = "Next week";
const SETTINGS_BTN_TITLE = "Settings";
const REFRESH_BTN_TITLE = "Refresh";
const FAQ_BTN_TITLE = "Help / FAQ";

const LAST_FETCHED_PREFIX = "Last fetched: ";
const LAST_FETCHED_EMPTY = "Last fetched: —";
const WEEK_OF_PREFIX = "Week of ";

// Augments HTMLDivElement with week navigation state stored directly on the
// element to keep the chart self-contained without module-level variables.
interface FrequencyChartContainer extends HTMLDivElement {
    _today_week_start_ms: number;
    _week_offset: number;
    _calendar_container: HTMLElement;
}

export function compute_display_week_start(today_week_start_ms: number, week_offset: number): Date {
    const start = new Date(today_week_start_ms);
    start.setDate(start.getDate() + week_offset * DAYS_IN_WEEK);
    return start;
}

export function count_incomplete_items_per_day(
    items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>>,
    week_start: Date,
): { counts: number[]; max: number } {
    const counts: number[] = Array(DAYS_IN_WEEK).fill(0);
    let max = 0;
    for (let i = 0; i < DAYS_IN_WEEK; i++) {
        const day = new Date(week_start);
        day.setDate(day.getDate() + i);
        const count = items_by_date[getDateKey(day)]?.filter(({ item }) => !item.completed).length ?? 0;
        counts[i] = count;
        if (count > max) max = count;
    }
    return { counts, max };
}

export function format_week_label(week_start: Date): string {
    return `${WEEK_OF_PREFIX}${MONTH_NAMES_SHORT[week_start.getMonth()]} ${week_start.getDate()}`;
}

function is_today(date: Date): boolean {
    const today = new Date();
    return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    );
}

function create_settings_button(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = FrequencyChartCss.SETTINGS_BTN;
    btn.title = SETTINGS_BTN_TITLE;
    btn.textContent = SETTINGS_ICON;
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        let settings_panel = document.getElementById(SettingsCss.PANEL_ID);
        if (!settings_panel) {
            settings_panel = build_settings_panel();
            document.body.appendChild(settings_panel);
        }
        settings_panel.classList.toggle(SettingsCss.OPEN);
        settings_panel.style.right = panel_width + "px";
    });
    return btn;
}

function create_refresh_button(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = FrequencyChartCss.REFRESH_BTN;
    btn.title = REFRESH_BTN_TITLE;
    btn.textContent = REFRESH_ICON;
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.classList.add(FrequencyChartCss.SPINNING);
        btn.addEventListener("animationend", () => btn.classList.remove(FrequencyChartCss.SPINNING), { once: true });
        if (ui_state.on_refresh) ui_state.on_refresh();
    });
    return btn;
}

function create_faq_button(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = FrequencyChartCss.FAQ_BTN;
    btn.title = FAQ_BTN_TITLE;
    btn.textContent = FAQ_ICON;
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        safe_send_message({ action: OPEN_FAQ });
    });
    return btn;
}

function create_nav_button(icon: string, id: string, title: string, disabled = false): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = FrequencyChartCss.NAV_BTN;
    btn.textContent = icon;
    btn.id = id;
    btn.title = title;
    btn.disabled = disabled;
    return btn;
}

function build_header_row(): HTMLDivElement {
    const row = document.createElement("div");
    row.className = FrequencyChartCss.HEADER_ROW;

    row.appendChild(create_settings_button());
    row.appendChild(create_refresh_button());

    const week_label = document.createElement("div");
    week_label.className = FrequencyChartCss.WEEK_LABEL;
    week_label.id = FrequencyChartCss.WEEK_LABEL;
    row.appendChild(week_label);

    const spacer = document.createElement("div");
    spacer.className = FrequencyChartCss.BTN_SPACER;
    row.appendChild(spacer);

    row.appendChild(create_faq_button());
    return row;
}

function build_chart_row(
    prev_btn: HTMLButtonElement,
    grid: HTMLDivElement,
    next_btn: HTMLButtonElement,
): HTMLDivElement {
    const row = document.createElement("div");
    row.className = FrequencyChartCss.CHART_ROW;
    row.appendChild(prev_btn);
    row.appendChild(grid);
    row.appendChild(next_btn);
    return row;
}

function build_last_fetched_label(): HTMLDivElement {
    const el = document.createElement("div");
    el.className = FrequencyChartCss.LAST_FETCHED;
    el.textContent = ui_state.last_fetched_time
        ? LAST_FETCHED_PREFIX + ui_state.last_fetched_time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
        : LAST_FETCHED_EMPTY;
    return el;
}

export function build_day_cell(
    day_date: Date,
    count: number,
    max_count: number,
    on_click: () => void,
): HTMLDivElement {
    const cell = document.createElement("div");
    cell.className = FrequencyChartCss.DAY;
    if (is_today(day_date)) {
        cell.classList.add(FrequencyChartCss.DAY_TODAY);
    }

    const day_label_el = document.createElement("div");
    day_label_el.className = FrequencyChartCss.DAY_LABEL;
    day_label_el.textContent = DAY_LABELS[day_date.getDay()];
    cell.appendChild(day_label_el);

    const date_number = document.createElement("div");
    date_number.className = FrequencyChartCss.DAY_DATE;
    date_number.textContent = day_date.getDate().toString();
    cell.appendChild(date_number);

    const bar_wrapper = document.createElement("div");
    bar_wrapper.className = FrequencyChartCss.BAR_CONTAINER;
    const bar = document.createElement("div");
    bar.className = FrequencyChartCss.BAR;
    bar.style.height = (max_count === 0 ? 0 : (count / max_count) * 100) + "%";
    bar_wrapper.appendChild(bar);
    cell.appendChild(bar_wrapper);

    const item_count_label = document.createElement("div");
    item_count_label.className = FrequencyChartCss.DAY_COUNT;
    item_count_label.textContent = count > 0 ? count.toString() : "—";
    cell.appendChild(item_count_label);

    cell.style.cursor = "pointer";
    cell.addEventListener("click", on_click);
    return cell;
}

function update_week_label_text(chart_container: FrequencyChartContainer, week_start: Date): void {
    const label = chart_container.querySelector<HTMLElement>(`#${FrequencyChartCss.WEEK_LABEL}`);
    if (label) label.textContent = format_week_label(week_start);
}

function update_nav_button_states(chart_container: FrequencyChartContainer): void {
    const prev_btn = chart_container.querySelector<HTMLButtonElement>(`#${FrequencyChartCss.PREV_BTN_ID}`);
    const next_btn = chart_container.querySelector<HTMLButtonElement>(`#${FrequencyChartCss.NEXT_BTN_ID}`);
    if (!prev_btn || !next_btn) return;
    prev_btn.disabled = chart_container._week_offset <= 0;
    next_btn.disabled = false;
}

export function find_header_for_date(calendar_container: HTMLElement, target_date: Date): Element | null {
    const headers = Array.from(calendar_container.querySelectorAll(`.${CalendarCss.DATE_HEADER}`));
    for (const header of headers) {
        const title_text = header.querySelector(`.${CalendarCss.DATE_TITLE}`)?.textContent ?? "";
        const match = title_text.match(/(\w+)\s+(\d+)/);
        if (!match) continue;
        const month_index = MONTH_NAMES_SHORT.findIndex(m => m.toLowerCase().startsWith(match[1].toLowerCase()));
        const day = parseInt(match[2]);
        if (month_index === target_date.getMonth() && day === target_date.getDate()) {
            return header;
        }
    }
    return null;
}

export function compute_scroll_to_header(header: Element, calendar_container: HTMLElement): number {
    const chart_el = calendar_container.querySelector(`#${FrequencyChartCss.CONTAINER_ID}`);
    const chart_height = chart_el ? chart_el.getBoundingClientRect().height : 0;
    const container_rect = calendar_container.getBoundingClientRect();
    const header_height = (header as HTMLElement).offsetHeight;

    const items_section = header.nextElementSibling as HTMLElement | null;
    if (items_section) {
        const items_top = items_section.getBoundingClientRect().top - container_rect.top + calendar_container.scrollTop;
        return Math.max(0, items_top - header_height - chart_height);
    }

    const header_top = header.getBoundingClientRect().top - container_rect.top + calendar_container.scrollTop;
    return Math.max(0, header_top - chart_height);
}

function populate_week_grid(
    chart_container: FrequencyChartContainer,
    items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>>,
): void {
    try {
        const grid = chart_container.querySelector(`#${FrequencyChartCss.GRID}`);
        if (!grid) return;
        grid.innerHTML = "";

        const week_start = compute_display_week_start(chart_container._today_week_start_ms, chart_container._week_offset);
        update_week_label_text(chart_container, week_start);

        const { counts, max } = count_incomplete_items_per_day(items_by_date, week_start);
        const calendar_container = chart_container._calendar_container;

        for (let i = 0; i < DAYS_IN_WEEK; i++) {
            const day_date = new Date(week_start);
            day_date.setDate(day_date.getDate() + i);
            const cell = build_day_cell(day_date, counts[i], max, () => scroll_to_date(calendar_container, day_date));
            grid.appendChild(cell);
        }
    } catch (e) {
        console.error("Error rendering frequency chart:", e);
    }
}

function scroll_to_date(calendar_container: HTMLElement, target_date: Date): void {
    try {
        const header = find_header_for_date(calendar_container, target_date);
        if (!header) return;
        const scroll_target = compute_scroll_to_header(header, calendar_container);
        calendar_container.scrollTo({ top: scroll_target, behavior: "smooth" });
    } catch (e) {
        console.error("Error scrolling to date:", e);
    }
}

export function create_frequency_chart(
    calendar_container: HTMLElement,
    items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>>,
    initial_week_offset: number = 0,
): void {
    const today_week_start = getWeekStart(new Date());

    const chart_container = document.createElement("div") as unknown as FrequencyChartContainer;
    chart_container.className = FrequencyChartCss.CONTAINER;
    chart_container.id = FrequencyChartCss.CONTAINER_ID;
    chart_container._today_week_start_ms = today_week_start.getTime();
    chart_container._week_offset = initial_week_offset;
    chart_container._calendar_container = calendar_container;

    const prev_btn = create_nav_button(PREV_WEEK_ICON, FrequencyChartCss.PREV_BTN_ID, PREV_BTN_TITLE, true);
    const next_btn = create_nav_button(NEXT_WEEK_ICON, FrequencyChartCss.NEXT_BTN_ID, NEXT_BTN_TITLE);

    const grid = document.createElement("div");
    grid.className = FrequencyChartCss.GRID;
    grid.id = FrequencyChartCss.GRID;

    chart_container.appendChild(build_header_row());
    chart_container.appendChild(build_chart_row(prev_btn, grid, next_btn));
    chart_container.appendChild(build_last_fetched_label());

    try {
        populate_week_grid(chart_container, items_by_date);
        update_nav_button_states(chart_container);
    } catch (e) {
        console.error("Error rendering frequency chart:", e);
    }

    prev_btn.addEventListener("click", () => {
        try {
            if (chart_container._week_offset <= 0) return;
            chart_container._week_offset -= 1;
            populate_week_grid(chart_container, items_by_date);
            update_nav_button_states(chart_container);
        } catch (e) {
            console.error("Error navigating to previous week:", e);
        }
    });

    next_btn.addEventListener("click", () => {
        try {
            chart_container._week_offset += 1;
            populate_week_grid(chart_container, items_by_date);
            update_nav_button_states(chart_container);
        } catch (e) {
            console.error("Error navigating to next week:", e);
        }
    });

    try {
        calendar_container.insertBefore(chart_container, calendar_container.firstChild);
    } catch (e) {
        console.error("Error inserting frequency chart:", e);
        calendar_container.appendChild(chart_container);
    }
}

export function scroll_to_today(): void {
    const calendar_container = document.getElementById(PanelCss.CALENDAR_CONTAINER_ID);
    if (calendar_container) scroll_to_date(calendar_container, new Date());
}
