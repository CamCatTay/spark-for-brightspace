// Reusable UI component factories: course cards, item rows, date headers,
// settings panel, and course name formatting utilities.

import { Action } from "../shared/actions";
import { formatTimeFromDate, formatFullDatetime, getDateOnly, formatDateHeader, getWeekStart, getDateKey } from "../utils/date-utils";
import { getCourseColor, ensureCourseColorsAssigned } from "../utils/color-utils";
import { safe_send_message, panel_width } from "./panel";
import { create_toggle_setting } from "./settings-menu-utils";
import type { CourseData, CourseShape, ItemShape } from "../shared/types";

// Augmented HTMLDivElement for the frequency chart container, which stores
// week navigation state directly on the element to avoid module-level state.
interface FrequencyChartContainer extends HTMLDivElement {
    _todayWeekStart: number;
    _weekOffset: number;
    _calendarContainer: HTMLElement;
}

const COURSE_NAME_TRIM_WORDS = [
    "Section",
    "XLS",
    "Group",
    "Spring",
    "Fall",
    "Winter",
    "Summer",
];

const DAYS_IN_WEEK = 7;
const CALENDAR_DAYS_BACK_DEFAULT = 7;
const SETTINGS_MAX_DAYS_BACK = 365;

const SHOW_LAST_FETCHED = true; // Show last fetched time stamp
const DUE_TODAY_COLOR = "#e8900c";
const DUE_TOMORROW_COLOR = "#e7c21d";
const OVERDUE_COLOR = "#e84040";
const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ITEM_TYPES = [
    { key: "assignments", label: "Assignments" },
    { key: "quizzes", label: "Quizzes" },
    { key: "discussions", label: "Discussions" },
];

// Storage Keys
// Synced across tabs via chrome.storage.local + broadcast:
const CALENDAR_START_DAYS_BACK_STORAGE_KEY = "d2l-todolist-calendar-start-days-back";
const SHOW_COMPLETED_STORAGE_KEY = "d2l-todolist-show-completed";
// Tab-local, session-scoped (sessionStorage — NOT synced across tabs):
const HIDDEN_COURSES_SESSION_KEY = "spark-hidden-courses";
const HIDDEN_TYPES_SESSION_KEY = "spark-hidden-types";

// Callbacks registered by content.js so settings UI can trigger refresh/re-render
let _on_refresh: (() => void) | null = null;
let _on_rerender: (() => void) | null = null;

let _last_course_data: CourseData = {};
let last_fetched_time: Date | null = null;
let hidden_course_ids = new Set<string>(JSON.parse(sessionStorage.getItem(HIDDEN_COURSES_SESSION_KEY) || "[]"));
let hidden_types = new Set<string>(JSON.parse(sessionStorage.getItem(HIDDEN_TYPES_SESSION_KEY) || "[]"));

let CALENDAR_START_DAYS_BACK = parseInt(localStorage.getItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY) ?? "7", 10);
if (!Number.isFinite(CALENDAR_START_DAYS_BACK) || CALENDAR_START_DAYS_BACK < 0) CALENDAR_START_DAYS_BACK = 7;

// Default true: show completed items unless the user has explicitly turned it off.
let show_completed_items = localStorage.getItem(SHOW_COMPLETED_STORAGE_KEY) !== "false";
let hide_on_start = false;

function truncate_course_name(name: string): string {
    if (!name) return name;
    const pattern = COURSE_NAME_TRIM_WORDS
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    return name.replace(new RegExp(`\\s*(${pattern})\\b.*$`, "i"), "").trim();
}

function create_scrollbar_indicator(calendar_container: HTMLElement): void {
    const existing_indicator = calendar_container.parentElement?.querySelector(".scrollbar-indicator");
    if (existing_indicator) existing_indicator.remove();

    const indicator = document.createElement("div");
    indicator.className = "scrollbar-indicator";

    const assignments = calendar_container.querySelectorAll<HTMLElement>(".calendar-item");
    if (assignments.length === 0) return;

    const container_height = calendar_container.clientHeight;
    const scroll_height = calendar_container.scrollHeight;
    if (scroll_height <= container_height) return;

    assignments.forEach((assignment_el) => {
        const course_el = assignment_el.querySelector<HTMLElement>(".item-course");
        const course_name = course_el?.dataset.fullName || course_el?.textContent || "";
        const course_color = getCourseColor(course_name);
        const position_in_container = assignment_el.offsetTop;
        const percent_position = (position_in_container / scroll_height) * 100;

        const notch = document.createElement("div");
        notch.className = "scrollbar-notch";
        notch.style.top = percent_position + "%";
        notch.style.backgroundColor = course_color;
        notch.title = course_name;

        indicator.appendChild(notch);
    });

    calendar_container.parentElement?.appendChild(indicator);

    calendar_container.addEventListener("scroll", () => {
        update_scrollbar_indicator(calendar_container);
    });
}

function update_scrollbar_indicator(calendar_container: HTMLElement): void {
    const indicator = calendar_container.parentElement?.querySelector(".scrollbar-indicator");
    if (!indicator) return;

    const scroll_height = calendar_container.scrollHeight;
    const assignments = calendar_container.querySelectorAll<HTMLElement>(".calendar-item");
    const notches = indicator.querySelectorAll<HTMLElement>(".scrollbar-notch");

    notches.forEach((notch, index) => {
        if (index < assignments.length) {
            const position_in_container = assignments[index].offsetTop;
            const percent_position = (position_in_container / scroll_height) * 100;
            notch.style.top = percent_position + "%";
        }
    });
}

function create_assignment_element(item: ItemShape, course: CourseShape): HTMLAnchorElement {
    const assignment_container = document.createElement("a");
    assignment_container.href = item.url ?? "";
    assignment_container.className = "calendar-item";

    const now = new Date();
    const now_date_only = getDateOnly(now)!;
    const start_date_only = item.start_date ? getDateOnly(item.start_date) : null;
    const is_not_yet_available = start_date_only && start_date_only > now_date_only;

    if (is_not_yet_available) {
        assignment_container.classList.add("not-yet-available");
    }

    const item_name = document.createElement("div");
    item_name.className = "item-name";
    item_name.textContent = item.name;

    const item_meta = document.createElement("div");
    item_meta.className = "item-meta";

    if (item.start_date) {
        const start_date_container = document.createElement("div");
        start_date_container.className = "start-date-container";

        const start_date_value = document.createElement("span");
        start_date_value.className = "start-date-value";
        start_date_value.textContent = "Available on " + formatFullDatetime(item.start_date);
        start_date_container.appendChild(start_date_value);

        item_meta.appendChild(start_date_container);
    }

    const due_container = document.createElement("div");
    due_container.className = "due-date-container";

    const due_time = document.createElement("span");
    due_time.className = "item-time";
    due_time.textContent = formatTimeFromDate(item.due_date);
    const due_date_only = getDateOnly(item.due_date);
    const tomorrow_date_only = new Date(now_date_only);
    tomorrow_date_only.setDate(tomorrow_date_only.getDate() + 1);
    // Incomplete and past due
    if (!item.completed && due_date_only && due_date_only < now_date_only) {
        due_time.style.color = OVERDUE_COLOR;
    // Due today
    } else if (due_date_only && due_date_only.getTime() === now_date_only.getTime()) {
        due_time.style.color = DUE_TODAY_COLOR;
    // Due tomorrow
    } else if (due_date_only && due_date_only.getTime() === tomorrow_date_only.getTime()) {
        due_time.style.color = DUE_TOMORROW_COLOR;
    }
    due_container.appendChild(due_time);

    const meta_separator = document.createElement("span");
    meta_separator.className = "item-meta-separator";
    meta_separator.textContent = "|";
    due_container.appendChild(meta_separator);

    const item_course = document.createElement("span");
    item_course.className = "item-course";
    item_course.dataset.fullName = course.name;

    const course_dot = document.createElement("span");
    course_dot.className = "item-course-dot";
    course_dot.textContent = "●";
    course_dot.style.color = getCourseColor(course.name);
    item_course.appendChild(course_dot);
    item_course.appendChild(document.createTextNode(truncate_course_name(course.name)));

    due_container.appendChild(item_course);

    item_meta.appendChild(due_container);

    const item_content = document.createElement("div");
    item_content.className = "item-content";
    item_content.appendChild(item_name);
    item_content.appendChild(item_meta);
    assignment_container.appendChild(item_content);

    const badge = document.createElement("div");
    badge.className = item.completed ? "item-completed-badge" : "item-incomplete-dot";
    badge.textContent = item.completed ? "✓" : "•";
    assignment_container.appendChild(badge);

    return assignment_container;
}

export function initialize_gui(): void {
    update_gui({} as CourseData, true);
}

export function add_data_status_indicator(is_stale: boolean): void {
    const existing_status = document.querySelector(".fetch-status");
    if (existing_status) existing_status.remove();

    const last_fetched_el = document.querySelector(".frequency-chart-last-fetched");
    if (last_fetched_el) last_fetched_el.classList.remove("fetching");

    if (is_stale && last_fetched_el) {
        const fetch_status = document.createElement("span");
        fetch_status.className = "fetch-status";
        fetch_status.innerHTML = ' — Fetching...<span class="fetch-spinner"></span>';
        last_fetched_el.appendChild(fetch_status);
        last_fetched_el.classList.add("fetching");
    }
}

export function update_gui(course_data: CourseData, is_from_cache: boolean = false): void {
    const calendar_container = document.getElementById("calendar-container");
    if (!calendar_container) return;

    _last_course_data = course_data;
    ensureCourseColorsAssigned(course_data);
    update_settings_course_list(course_data);

    const existing_chart = calendar_container.querySelector("#frequency-chart") as FrequencyChartContainer | null;
    const preserved_week_offset = existing_chart ? (existing_chart._weekOffset || 0) : 0;

    calendar_container.innerHTML = "";

    // Collect all items with due dates
    const items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>> = {};
    let min_date: Date | null = null;
    let max_date: Date | null = null;

    Object.keys(course_data).forEach((course_id) => {
        const course = course_data[course_id];

        if (hidden_course_ids.has(course_id)) return;

        const item_collections = [
            { items: course.assignments, type: "assignments", show_completed: show_completed_items },
            { items: course.quizzes, type: "quizzes", show_completed: show_completed_items },
            { items: course.discussions, type: "discussions", show_completed: show_completed_items }
        ];

        item_collections.forEach(({ items, type, show_completed }) => {
            if (hidden_types.has(type)) return;
            if (items) {
                Object.keys(items).forEach((item_id) => {
                    const item = items[item_id];
                    if (item.due_date && (!item.completed || show_completed)) {
                        const date_only = getDateOnly(item.due_date);
                        if (date_only) {
                            const date_key = date_only.toISOString().split("T")[0];
                            if (!items_by_date[date_key]) {
                                items_by_date[date_key] = [];
                            }
                            items_by_date[date_key].push({ item, course });

                            if (!min_date || date_only < min_date) min_date = date_only;
                            if (!max_date || date_only > max_date) max_date = date_only;
                        }
                    }
                });
            }
        });
    });

    // Always create frequency chart (contains settings, refresh, and FAQ buttons)
    try {
        if (typeof create_frequency_chart === "function" && typeof getWeekStart === "function" && typeof getDateKey === "function") {
            create_frequency_chart(calendar_container, items_by_date, preserved_week_offset);
        }
    } catch (e) {
        console.error("Error creating frequency chart (non-fatal):", e);
    }
    if (is_from_cache) {
        add_data_status_indicator(true);
    }

    // Empty state — chart is already rendered above for the buttons and loading indicator
    if (!min_date || !max_date) {
        const existing_indicator = calendar_container.parentElement?.querySelector(".scrollbar-indicator");
        if (existing_indicator) existing_indicator.remove();
        const empty_message = document.createElement("div");
        empty_message.id = "loading-indicator";
        empty_message.textContent = "No upcoming assignments";
        calendar_container.appendChild(empty_message);
        return;
    }

    // Generate calendar from CALENDAR_START_DAYS_BACK days before today to max_date
    const today = new Date();
    const start_date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start_date.setDate(start_date.getDate() - CALENDAR_START_DAYS_BACK);
    const end_date = new Date(max_date);

    let current_date = new Date(start_date);
    while (current_date <= end_date) {
        const date_key = current_date.toISOString().split("T")[0];
        const items = items_by_date[date_key] || [];

        const date_header = document.createElement("div");
        date_header.className = "calendar-date-header";
        const date_header_text = formatDateHeader(current_date);
        date_header.innerHTML = `<div class="date-title">${date_header_text}</div>`;
        calendar_container.appendChild(date_header);

        const items_container = document.createElement("div");
        items_container.className = "calendar-items-container";

        if (items.length === 0) {
            const empty_notice = document.createElement("div");
            empty_notice.className = "empty-day-notice";
            empty_notice.textContent = "No assignments due";
            items_container.appendChild(empty_notice);
        } else {
            items.forEach(({ item, course }) => {
                const element = create_assignment_element(item, course);
                items_container.appendChild(element);
            });
        }

        calendar_container.appendChild(items_container);
        current_date.setDate(current_date.getDate() + 1);
    }

    create_scrollbar_indicator(calendar_container);
}

export function set_last_fetched_time(t: Date): void {
    last_fetched_time = t;
}

function create_frequency_chart(calendar_container: HTMLElement, items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>>, initial_week_offset: number = 0): void {
    // Get the week containing today
    const today = new Date();
    const today_week_start = getWeekStart(today);

    // Create chart container
    const chart_container = document.createElement("div") as unknown as FrequencyChartContainer;
    chart_container.className = "frequency-chart-container";
    chart_container.id = "frequency-chart";

    // Store current week and offset
    chart_container._todayWeekStart = today_week_start.getTime();
    chart_container._weekOffset = initial_week_offset;
    chart_container._calendarContainer = calendar_container; // Store for click-to-scroll

    const prev_btn = document.createElement("button");
    prev_btn.className = "frequency-chart-btn";
    prev_btn.textContent = "‹";
    prev_btn.disabled = true;
    prev_btn.id = "frequency-chart-prev";
    prev_btn.title = "Previous week";

    const next_btn = document.createElement("button");
    next_btn.className = "frequency-chart-btn";
    next_btn.textContent = "›";
    next_btn.id = "frequency-chart-next";
    next_btn.title = "Next week";

    // Create grid container
    const grid = document.createElement("div");
    grid.className = "frequency-chart-grid";
    grid.id = "frequency-chart-grid";

    // Week label row (label + FAQ button)
    const week_label_row = document.createElement("div");
    week_label_row.className = "frequency-chart-header-row";

    const week_label = document.createElement("div");
    week_label.className = "frequency-chart-week-label";
    week_label.id = "frequency-chart-week-label";

    const settings_btn = document.createElement("button");
    settings_btn.className = "spark-settings-btn";
    settings_btn.title = "Settings";
    settings_btn.textContent = "⚙";
    settings_btn.addEventListener("click", (e) => {
        e.stopPropagation();
        let settings_panel = document.getElementById("spark-settings-panel");
        if (!settings_panel) {
            settings_panel = build_settings_panel();
            document.body.appendChild(settings_panel);
        }
        settings_panel.classList.toggle("open");
        settings_panel.style.right = panel_width + "px";
    });
    week_label_row.appendChild(settings_btn);

    const refresh_btn = document.createElement("button");
    refresh_btn.className = "spark-refresh-btn";
    refresh_btn.title = "Refresh";
    refresh_btn.textContent = "↻";
    refresh_btn.addEventListener("click", (e) => {
        e.stopPropagation();
        refresh_btn.classList.add("spinning");
        refresh_btn.addEventListener("animationend", () => refresh_btn.classList.remove("spinning"), { once: true });
        if (_on_refresh) _on_refresh();
    });
    week_label_row.appendChild(refresh_btn);

    // Week label is added above buttons so it stays left-aligned while buttons below are right-aligned
    week_label_row.appendChild(week_label);

    const faq_spacer = document.createElement("div");
    faq_spacer.className = "spark-btn-spacer";
    week_label_row.appendChild(faq_spacer);

    const faq_btn = document.createElement("button");
    faq_btn.className = "faq-btn";
    faq_btn.title = "Help / FAQ";
    faq_btn.textContent = "?";
    faq_btn.addEventListener("click", (e) => {
        e.stopPropagation();
        safe_send_message({ action: Action.OPEN_FAQ });
    });
    week_label_row.appendChild(faq_btn);

    chart_container.appendChild(week_label_row);

    // Wrap grid + side buttons in a single row
    const chart_row = document.createElement("div");
    chart_row.className = "frequency-chart-row";
    chart_row.appendChild(prev_btn);
    chart_row.appendChild(grid);
    chart_row.appendChild(next_btn);
    chart_container.appendChild(chart_row);

    if (SHOW_LAST_FETCHED) {
        const last_fetched_el = document.createElement("div");
        last_fetched_el.className = "frequency-chart-last-fetched";
        last_fetched_el.textContent = last_fetched_time
            ? "Last fetched: " + last_fetched_time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
            : "Last fetched: —";
        chart_container.appendChild(last_fetched_el);
    }

    // Initial render
    try {
        render_frequency_chart(chart_container, items_by_date, today_week_start, initial_week_offset, calendar_container);
        update_frequency_nav_buttons(chart_container);
    } catch (e) {
        console.error("Error rendering frequency chart:", e);
    }

    // Add button event listeners with error handling
    prev_btn.addEventListener("click", () => {
        try {
            const offset = chart_container._weekOffset;
            if (offset > 0) {
                chart_container._weekOffset = offset - 1;
                render_frequency_chart(chart_container, items_by_date, today_week_start, chart_container._weekOffset, calendar_container);
                update_frequency_nav_buttons(chart_container);
            }
        } catch (e) {
            console.error("Error in prev button click:", e);
        }
    });

    next_btn.addEventListener("click", () => {
        try {
            chart_container._weekOffset += 1;
            render_frequency_chart(chart_container, items_by_date, today_week_start, chart_container._weekOffset, calendar_container);
            update_frequency_nav_buttons(chart_container);
        } catch (e) {
            console.error("Error in next button click:", e);
        }
    });

    // Insert at the beginning of the calendar
    try {
        calendar_container.insertBefore(chart_container, calendar_container.firstChild);
    } catch (e) {
        console.error("Error inserting frequency chart:", e);
        calendar_container.appendChild(chart_container);
    }
}

function render_frequency_chart(chart_container: FrequencyChartContainer, items_by_date: Record<string, Array<{ item: ItemShape; course: CourseShape }>>, today_week_start: Date | number, week_offset: number, calendar_container: HTMLElement): void {
    try {
        const grid = chart_container.querySelector("#frequency-chart-grid");
        if (!grid) return; // Safety check

        grid.innerHTML = "";
        if (!calendar_container) calendar_container = chart_container._calendarContainer; // Fallback

        // Calculate the week to display - convert timestamp back to Date if needed
        let display_week_start;
        if (typeof today_week_start === "number") {
            display_week_start = new Date(today_week_start);
        } else {
            display_week_start = new Date(today_week_start.getFullYear(), today_week_start.getMonth(), today_week_start.getDate());
        }
        display_week_start.setDate(display_week_start.getDate() + (week_offset * DAYS_IN_WEEK));

        // Update week label
        const week_label_el = chart_container.querySelector("#frequency-chart-week-label");
        if (week_label_el) {
            week_label_el.textContent = `Week of ${MONTH_NAMES_SHORT[display_week_start.getMonth()]} ${display_week_start.getDate()}`;
        }

        // Count assignments by day of the week
        const week_counts = [0, 0, 0, 0, 0, 0, 0];
        let max_count = 0;

        for (let i = 0; i < DAYS_IN_WEEK; i++) {
            const day_date = new Date(display_week_start);
            day_date.setDate(day_date.getDate() + i);
            const date_key = getDateKey(day_date);
            // Count only incomplete items for the frequency chart to reflect actionable workload
            // In the future this could be a user setting to toggle completed items on/off in the chart
            const count = items_by_date[date_key]?.filter(({ item }) => !item.completed).length || 0;
            week_counts[i] = count;
            max_count = Math.max(max_count, count);
        }

        // Create day cells
        for (let i = 0; i < DAYS_IN_WEEK; i++) {
            const day_date = new Date(display_week_start);
            day_date.setDate(day_date.getDate() + i);
            const count = week_counts[i];
            const height_percent = max_count === 0 ? 0 : (count / max_count) * 100;

            const day_cell = document.createElement("div");
            day_cell.className = "frequency-day";
            const today_check = new Date();
            if (
                day_date.getFullYear() === today_check.getFullYear() &&
                day_date.getMonth() === today_check.getMonth() &&
                day_date.getDate() === today_check.getDate()
            ) {
                day_cell.classList.add("frequency-day--today");
            }

            const day_label = document.createElement("div");
            day_label.className = "frequency-day-label";
            day_label.textContent = DAY_LABELS[i];
            day_cell.appendChild(day_label);

            const date_num = document.createElement("div");
            date_num.className = "frequency-day-date";
            date_num.textContent = day_date.getDate().toString();
            day_cell.appendChild(date_num);

            const bar_container = document.createElement("div");
            bar_container.className = "frequency-bar-container";

            const bar = document.createElement("div");
            bar.className = "frequency-bar";
            bar.style.height = height_percent + "%";
            bar_container.appendChild(bar);
            day_cell.appendChild(bar_container);
            const count_label = document.createElement("div");
            count_label.className = "frequency-day-count";
            count_label.textContent = count > 0 ? count.toString() : "—";
            day_cell.appendChild(count_label);

            // Add click handler to scroll to this date
            if (calendar_container) {
                day_cell.style.cursor = "pointer";
                day_cell.addEventListener("click", () => {
                    scroll_to_date(calendar_container, day_date);
                });
            }

            grid.appendChild(day_cell);
        }
    } catch (e) {
        console.error("Error in render_frequency_chart:", e);
    }
}

function scroll_to_date(calendar_container: HTMLElement, target_date: Date): void {
    try {
        const date_headers = Array.from(calendar_container.querySelectorAll(".calendar-date-header"));

        for (const header of date_headers) {
            const title_text = header.querySelector(".date-title")?.textContent || "";
            const date_match = title_text.match(/(\w+)\s+(\d+)/);

            if (date_match) {
                const month_str = date_match[1];
                const day = parseInt(date_match[2]);

                const month_index = MONTH_NAMES_SHORT.findIndex(m => m.toLowerCase().startsWith(month_str.toLowerCase()));

                if (month_index >= 0 && day === target_date.getDate() && month_index === target_date.getMonth()) {
                    // .calendar-date-header is position:sticky, so getBoundingClientRect().top
                    // returns the "stuck" position when scrolled past — not its natural layout position.
                    // Instead, measure its non-sticky sibling (.calendar-items-container) which always
                    // reflects the true layout position in the scrollable content.
                    const chart_el = calendar_container.querySelector("#frequency-chart");
                    const chart_height = chart_el ? chart_el.getBoundingClientRect().height : 0;
                    const container_rect = calendar_container.getBoundingClientRect();

const items_container = header.nextElementSibling as HTMLElement | null;
        let target_scroll: number;
        if (items_container) {
            const items_rect = items_container.getBoundingClientRect();
            // Absolute position of the items container within scrollable content
            const items_absolute_pos = items_rect.top - container_rect.top + calendar_container.scrollTop;
            // The header sits directly above the items container; offsetHeight is unaffected by sticky
            target_scroll = Math.max(0, items_absolute_pos - (header as HTMLElement).offsetHeight - chart_height);
                    } else {
                        // Fallback for a header with no following sibling
                        const header_rect = header.getBoundingClientRect();
                        const absolute_pos = header_rect.top - container_rect.top + calendar_container.scrollTop;
                        target_scroll = Math.max(0, absolute_pos - chart_height);
                    }

                    calendar_container.scrollTo({ top: target_scroll, behavior: "smooth" });
                    return;
                }
            }
        }
    } catch (e) {
        console.error("Error scrolling to date:", e);
    }
}

function update_frequency_nav_buttons(chart_container: FrequencyChartContainer): void {
    try {
const prev_btn = chart_container.querySelector<HTMLButtonElement>("#frequency-chart-prev");
    const next_btn = chart_container.querySelector<HTMLButtonElement>("#frequency-chart-next");
        if (!prev_btn || !next_btn) return;

        const offset = chart_container._weekOffset || 0;

        // Prev button disabled when at current week
        prev_btn.disabled = offset <= 0;

        // Next button always enabled (no upper limit)
        next_btn.disabled = false;    } catch (e) {
        console.error("Error updating frequency nav buttons:", e);
    }
}

export function scroll_to_today() {
    const cal = document.getElementById("calendar-container");
    if (cal) scroll_to_date(cal, new Date());
}

export function register_ui_callbacks({ on_refresh, on_rerender }: { on_refresh: () => void; on_rerender: () => void }): void {
    _on_refresh = on_refresh;
    _on_rerender = on_rerender;
}

function get_synced_settings() {
    return {
        days_back: CALENDAR_START_DAYS_BACK,
        show_completed: show_completed_items,
    };
}

export function apply_settings({ days_back, show_completed }: { days_back: number; show_completed?: boolean }): void {
    CALENDAR_START_DAYS_BACK = days_back;
    localStorage.setItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY, days_back.toString());

    if (show_completed !== undefined) {
        show_completed_items = show_completed;
        localStorage.setItem(SHOW_COMPLETED_STORAGE_KEY, show_completed.toString());
    }

    const days_input = document.getElementById("spark-setting-days-back") as HTMLInputElement | null;
    if (days_input) days_input.value = days_back.toString();

    const completed_toggle = document.getElementById("spark-setting-show-completed") as HTMLInputElement | null;
    if (completed_toggle) completed_toggle.checked = show_completed_items;
}

export function build_settings_panel() {
    const panel = document.createElement("div");
    panel.id = "spark-settings-panel";

    // Header
    const header = document.createElement("div");
    header.className = "settings-header";

    const title = document.createElement("span");
    title.className = "settings-title";
    title.textContent = "Settings";

    header.appendChild(title);
    panel.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "settings-body";

    // CALENDAR_START_DAYS_BACK setting
    const section = document.createElement("div");
    section.className = "settings-section";

    const label = document.createElement("label");
    label.className = "settings-label";
    label.htmlFor = "spark-setting-days-back";
    label.textContent = "Calendar look-back days";

    const description = document.createElement("p");
    description.className = "settings-description";
    description.textContent = "How many days before today the calendar starts showing items. Set to 0 to start from today.";

    const input = document.createElement("input");
    input.type = "number";
    input.id = "spark-setting-days-back";
    input.className = "settings-input";
    input.min = "0";
    input.max = "365";
    input.value = CALENDAR_START_DAYS_BACK.toString();
    input.addEventListener("change", () => {
        const val = Math.max(0, Math.min(SETTINGS_MAX_DAYS_BACK, parseInt(input.value, 10) || 0));
        input.value = val.toString();
        CALENDAR_START_DAYS_BACK = val;
        localStorage.setItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY, val.toString());
        safe_send_message({ action: Action.BROADCAST_SETTINGS_CHANGED, settings: get_synced_settings() });
        if (_on_rerender) _on_rerender();
    });

    section.appendChild(label);
    section.appendChild(description);
    section.appendChild(input);
    body.appendChild(section);

    const show_complete_items_setting = create_toggle_setting(
        "Show completed items",
        "When off, only incomplete items are shown in the calendar.",
        show_completed_items,
        (checked) => {
            show_completed_items = show_complete_items_setting.checkbox.checked;
            localStorage.setItem(SHOW_COMPLETED_STORAGE_KEY, show_completed_items.toString());
            safe_send_message({ action: Action.BROADCAST_SETTINGS_CHANGED, settings: get_synced_settings() });
            if (_on_rerender) _on_rerender();
        }
    );
    body.appendChild(show_complete_items_setting.section);

    // Assignment types section
    const types_section = document.createElement("div");
    types_section.className = "settings-section";

    const types_label = document.createElement("div");
    types_label.className = "settings-label";
    types_label.textContent = "Visible assignment types";

    const types_description = document.createElement("p");
    types_description.className = "settings-description";
    types_description.textContent = "Uncheck a type to hide it from the calendar.";

    const types_list = document.createElement("div");
    types_list.className = "settings-courses-list";

    ITEM_TYPES.forEach(({ key, label: type_label }) => {
        const row = document.createElement("label");
        row.className = "settings-course-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "settings-course-checkbox";
        checkbox.dataset.settingType = key;
        checkbox.checked = !hidden_types.has(key);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                hidden_types.delete(key);
            } else {
                hidden_types.add(key);
            }
            sessionStorage.setItem(HIDDEN_TYPES_SESSION_KEY, JSON.stringify([...hidden_types]));
            if (_on_rerender) _on_rerender();
        });

        const name = document.createElement("span");
        name.className = "settings-course-name";
        name.textContent = type_label;

        row.appendChild(checkbox);
        row.appendChild(name);
        types_list.appendChild(row);
    });

    types_section.appendChild(types_label);
    types_section.appendChild(types_description);
    types_section.appendChild(types_list);
    body.appendChild(types_section);

    // Courses section (populated by update_settings_course_list)
    const courses_section = document.createElement("div");
    courses_section.className = "settings-section";
    courses_section.id = "spark-settings-courses";

    const courses_label = document.createElement("div");
    courses_label.className = "settings-label";
    courses_label.textContent = "Visible courses";

    const courses_description = document.createElement("p");
    courses_description.className = "settings-description";
    courses_description.textContent = "Uncheck a course to hide it from the calendar.";

    const courses_list = document.createElement("div");
    courses_list.id = "spark-settings-courses-list";
    courses_list.className = "settings-courses-list";

    courses_section.appendChild(courses_label);
    courses_section.appendChild(courses_description);
    courses_section.appendChild(courses_list);
    body.appendChild(courses_section);

    panel.appendChild(body);

    // Populate course list with whatever data was last received.
    // Pass courses_list directly since the panel isn't in the DOM yet.
    if (Object.keys(_last_course_data).length > 0) {
        update_settings_course_list(_last_course_data, courses_list);
    }

    return panel;
}

function update_settings_course_list(course_data: CourseData, list_el: HTMLElement | null = null): void {
    const list = list_el || document.getElementById("spark-settings-courses-list");
    if (!list) return;

    list.innerHTML = "";

    Object.keys(course_data).forEach((course_id) => {
        const course = course_data[course_id];
        const display_name = truncate_course_name(course.name) || course.name;
        const color = getCourseColor(course.name);
        const is_hidden = hidden_course_ids.has(course_id);

        const row = document.createElement("label");
        row.className = "settings-course-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "settings-course-checkbox";
        checkbox.checked = !is_hidden;
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                hidden_course_ids.delete(course_id);
            } else {
                hidden_course_ids.add(course_id);
            }
            sessionStorage.setItem(HIDDEN_COURSES_SESSION_KEY, JSON.stringify([...hidden_course_ids]));
            if (_on_rerender) _on_rerender();
        });

        const dot = document.createElement("span");
        dot.className = "settings-course-dot";
        dot.style.backgroundColor = color;

        const name = document.createElement("span");
        name.className = "settings-course-name";
        name.textContent = display_name;
        name.title = course.name;

        row.appendChild(checkbox);
        row.appendChild(dot);
        row.appendChild(name);
        list.appendChild(row);
    });
}