(function() {
	//#region src/shared/actions.js
	var Action = Object.freeze({
		CLOSE_PANEL: "close_panel",
		FETCH_STARTED: "fetch_started",
		COURSE_DATA_UPDATED: "course_data_updated",
		SETTINGS_CHANGED: "settings_changed",
		SETTINGS_OPENED: "settings_opened",
		SETTINGS_CLOSED: "settings_closed",
		TOGGLE_PANEL: "toggle_panel",
		OPEN_URL: "open_url",
		SAVE_SCROLL_POSITION: "save_scroll_position",
		GET_SCROLL_POSITION: "get_scroll_position",
		BROADCAST_FETCH_STARTED: "broadcast_fetch_started",
		FETCH_COURSES: "fetch_courses",
		BROADCAST_COURSE_DATA_UPDATED: "broadcast_course_data_updated",
		BROADCAST_SETTINGS_OPENED: "broadcast_settings_opened",
		BROADCAST_SETTINGS_CLOSED: "broadcast_settings_closed",
		OPEN_FAQ: "open_faq",
		BROADCAST_SETTINGS_CHANGED: "broadcast_settings_changed",
		PANEL_CLOSED: "panel_closed",
		PANEL_OPENED: "panel_opened"
	});
	if (typeof module !== "undefined" && module.exports) module.exports = { Action };
	//#endregion
	//#region src/utils/date-utils.js
	function formatTimeFromDate(dateString) {
		if (!dateString) return "No time";
		try {
			return new Date(dateString).toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true
			});
		} catch (e) {
			return "No time";
		}
	}
	function formatFullDatetime(dateString) {
		if (!dateString) return "No date";
		try {
			const date = new Date(dateString);
			return `${`${[
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec"
			][date.getMonth()]} ${date.getDate()}`}, ${date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true
			})}`;
		} catch (e) {
			return "No date";
		}
	}
	function getDateOnly(dateString) {
		if (!dateString) return null;
		try {
			const date = new Date(dateString);
			return new Date(date.getFullYear(), date.getMonth(), date.getDate());
		} catch (e) {
			return null;
		}
	}
	function formatDateHeader(date) {
		const today = /* @__PURE__ */ new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
		const monthNames = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec"
		];
		const dayNames = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday"
		];
		const title = `${monthNames[date.getMonth()]} ${date.getDate()}`;
		let label = dayNames[date.getDay()];
		if (dateOnly.getTime() === todayOnly.getTime()) label = `Today · ${label}`;
		else if (dateOnly.getTime() === tomorrowOnly.getTime()) label = `Tomorrow · ${label}`;
		return `${title} · ${label}`;
	}
	function getWeekStart(date) {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day;
		return new Date(d.getFullYear(), d.getMonth(), diff);
	}
	function getDateKey(date) {
		return date.toISOString().split("T")[0];
	}
	if (typeof module !== "undefined" && module.exports) module.exports = {
		formatTimeFromDate,
		formatFullDatetime,
		getDateOnly,
		formatDateHeader,
		getWeekStart,
		getDateKey
	};
	//#endregion
	//#region src/utils/color-utils.js
	var COLOR_POOL = [
		"#e05555",
		"#e07c2e",
		"#c9a800",
		"#3aaa4e",
		"#4a6ee0",
		"#d94f9e",
		"#8c52d4"
	];
	var courseColorMap = {};
	function getColorFromPool(index) {
		return COLOR_POOL[index % COLOR_POOL.length];
	}
	function ensureCourseColorsAssigned(courseData) {
		const allCourseNames = /* @__PURE__ */ new Set();
		Object.keys(courseData).forEach((courseId) => {
			allCourseNames.add(courseData[courseId].name);
		});
		Array.from(allCourseNames).sort().forEach((name, index) => {
			if (!courseColorMap[name]) courseColorMap[name] = getColorFromPool(index);
		});
	}
	function getCourseColor(courseName) {
		return courseColorMap[courseName] || "#808080";
	}
	if (typeof module !== "undefined" && module.exports) module.exports = {
		COLOR_POOL,
		getColorFromPool,
		ensureCourseColorsAssigned,
		getCourseColor,
		_resetColorMap: () => {
			courseColorMap = {};
		}
	};
	//#endregion
	//#region src/ui/components.js
	var COURSE_NAME_TRIM_WORDS = [
		"Section",
		"XLS",
		"Group",
		"Spring",
		"Fall",
		"Winter",
		"Summer"
	];
	var DAYS_IN_WEEK = 7;
	var SETTINGS_MAX_DAYS_BACK = 365;
	var DUE_TODAY_COLOR = "#e8900c";
	var DUE_TOMORROW_COLOR = "#e7c21d";
	var OVERDUE_COLOR = "#e84040";
	var MONTH_NAMES_SHORT = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec"
	];
	var DAY_LABELS = [
		"Sun",
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri",
		"Sat"
	];
	var ITEM_TYPES = [
		{
			key: "assignments",
			label: "Assignments"
		},
		{
			key: "quizzes",
			label: "Quizzes"
		},
		{
			key: "discussions",
			label: "Discussions"
		}
	];
	var CALENDAR_START_DAYS_BACK_STORAGE_KEY = "d2l-todolist-calendar-start-days-back";
	var HIDDEN_COURSES_STORAGE_KEY = "d2l-todolist-hidden-courses";
	var HIDDEN_TYPES_STORAGE_KEY = "d2l-todolist-hidden-types";
	var _on_refresh = null;
	var _on_rerender = null;
	var _last_course_data = {};
	var last_fetched_time = null;
	var hidden_course_ids = new Set(JSON.parse(localStorage.getItem(HIDDEN_COURSES_STORAGE_KEY) || "[]"));
	var hidden_types = new Set(JSON.parse(localStorage.getItem(HIDDEN_TYPES_STORAGE_KEY) || "[]"));
	var CALENDAR_START_DAYS_BACK = parseInt(localStorage.getItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY) ?? "7", 10);
	if (!Number.isFinite(CALENDAR_START_DAYS_BACK) || CALENDAR_START_DAYS_BACK < 0) CALENDAR_START_DAYS_BACK = 7;
	function truncate_course_name(name) {
		if (!name) return name;
		const pattern = COURSE_NAME_TRIM_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
		return name.replace(new RegExp(`\\s*(${pattern})\\b.*$`, "i"), "").trim();
	}
	function create_scrollbar_indicator(calendar_container) {
		const existing_indicator = calendar_container.parentElement.querySelector(".scrollbar-indicator");
		if (existing_indicator) existing_indicator.remove();
		const indicator = document.createElement("div");
		indicator.className = "scrollbar-indicator";
		const assignments = calendar_container.querySelectorAll(".calendar-item");
		if (assignments.length === 0) return;
		const container_height = calendar_container.clientHeight;
		const scroll_height = calendar_container.scrollHeight;
		if (scroll_height <= container_height) return;
		assignments.forEach((assignment_el) => {
			const course_el = assignment_el.querySelector(".item-course");
			const course_name = course_el?.dataset.fullName || course_el?.textContent || "";
			const course_color = getCourseColor(course_name);
			const percent_position = assignment_el.offsetTop / scroll_height * 100;
			const notch = document.createElement("div");
			notch.className = "scrollbar-notch";
			notch.style.top = percent_position + "%";
			notch.style.backgroundColor = course_color;
			notch.title = course_name;
			indicator.appendChild(notch);
		});
		calendar_container.parentElement.appendChild(indicator);
		calendar_container.addEventListener("scroll", () => {
			update_scrollbar_indicator(calendar_container);
		});
	}
	function update_scrollbar_indicator(calendar_container) {
		const indicator = calendar_container.parentElement.querySelector(".scrollbar-indicator");
		if (!indicator) return;
		const scroll_height = calendar_container.scrollHeight;
		const assignments = calendar_container.querySelectorAll(".calendar-item");
		indicator.querySelectorAll(".scrollbar-notch").forEach((notch, index) => {
			if (index < assignments.length) {
				const percent_position = assignments[index].offsetTop / scroll_height * 100;
				notch.style.top = percent_position + "%";
			}
		});
	}
	function create_assignment_element(item, course) {
		const assignment_container = document.createElement("a");
		assignment_container.className = "calendar-item";
		const now_date_only = getDateOnly(/* @__PURE__ */ new Date());
		const start_date_only = item.start_date ? getDateOnly(item.start_date) : null;
		if (start_date_only && start_date_only > now_date_only) assignment_container.classList.add("not-yet-available");
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
		if (!item.completed && due_date_only < now_date_only) due_time.style.color = OVERDUE_COLOR;
		else if (due_date_only && due_date_only.getTime() === now_date_only.getTime()) due_time.style.color = DUE_TODAY_COLOR;
		else if (due_date_only && due_date_only.getTime() === tomorrow_date_only.getTime()) due_time.style.color = DUE_TOMORROW_COLOR;
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
		assignment_container.addEventListener("click", function(e) {
			e.preventDefault();
			window.open(item.url, "_blank");
		});
		const badge = document.createElement("div");
		badge.className = item.completed ? "item-completed-badge" : "item-incomplete-dot";
		badge.textContent = item.completed ? "✓" : "•";
		assignment_container.appendChild(badge);
		return assignment_container;
	}
	function initialize_gui() {
		update_gui({}, true);
	}
	function add_data_status_indicator(is_stale) {
		const chart_container = document.getElementById("frequency-chart");
		const calendar_container = document.getElementById("calendar-container");
		const target_container = chart_container || calendar_container;
		if (!target_container) return;
		const existing_indicator = document.querySelector(".data-status-indicator");
		if (existing_indicator) existing_indicator.remove();
		if (is_stale) {
			const indicator = document.createElement("div");
			indicator.className = "data-status-indicator loading";
			indicator.innerHTML = "<span class=\"spinner\"></span> Fetching latest data...";
			target_container.appendChild(indicator);
		}
	}
	/**
	* Re-renders the full calendar panel from the provided course data.
	* @param {Object} course_data - Map of courseId → course object with assignments/quizzes/discussions.
	* @param {boolean} is_from_cache - When true, shows the "Fetching latest data..." stale indicator.
	*/
	function update_gui(course_data, is_from_cache = false) {
		const calendar_container = document.getElementById("calendar-container");
		if (!calendar_container) return;
		_last_course_data = course_data;
		ensureCourseColorsAssigned(course_data);
		update_settings_course_list(course_data);
		const existing_chart = calendar_container.querySelector("#frequency-chart");
		const preserved_week_offset = existing_chart ? existing_chart._weekOffset || 0 : 0;
		calendar_container.innerHTML = "";
		const items_by_date = {};
		let min_date = null;
		let max_date = null;
		Object.keys(course_data).forEach((course_id) => {
			const course = course_data[course_id];
			if (hidden_course_ids.has(course_id)) return;
			[
				{
					items: course.assignments,
					type: "assignments",
					show_completed: true
				},
				{
					items: course.quizzes,
					type: "quizzes",
					show_completed: true
				},
				{
					items: course.discussions,
					type: "discussions",
					show_completed: true
				}
			].forEach(({ items, type, show_completed }) => {
				if (hidden_types.has(type)) return;
				if (items) Object.keys(items).forEach((item_id) => {
					const item = items[item_id];
					if (item.due_date && (!item.completed || show_completed)) {
						const date_only = getDateOnly(item.due_date);
						if (date_only) {
							const date_key = date_only.toISOString().split("T")[0];
							if (!items_by_date[date_key]) items_by_date[date_key] = [];
							items_by_date[date_key].push({
								item,
								course
							});
							if (!min_date || date_only < min_date) min_date = date_only;
							if (!max_date || date_only > max_date) max_date = date_only;
						}
					}
				});
			});
		});
		try {
			if (typeof create_frequency_chart === "function" && typeof getWeekStart === "function" && typeof getDateKey === "function") create_frequency_chart(calendar_container, items_by_date, preserved_week_offset);
		} catch (e) {
			console.error("Error creating frequency chart (non-fatal):", e);
		}
		if (is_from_cache) add_data_status_indicator(true);
		if (!min_date || !max_date) {
			const existing_indicator = calendar_container.parentElement.querySelector(".scrollbar-indicator");
			if (existing_indicator) existing_indicator.remove();
			const empty_message = document.createElement("div");
			empty_message.id = "loading-indicator";
			empty_message.textContent = "No upcoming assignments";
			calendar_container.appendChild(empty_message);
			return;
		}
		const today = /* @__PURE__ */ new Date();
		const start_date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		start_date.setDate(start_date.getDate() - CALENDAR_START_DAYS_BACK);
		const end_date = new Date(max_date);
		let current_date = new Date(start_date);
		while (current_date <= end_date) {
			const items = items_by_date[current_date.toISOString().split("T")[0]] || [];
			const date_header = document.createElement("div");
			date_header.className = "calendar-date-header";
			date_header.innerHTML = `<div class="date-title">${formatDateHeader(current_date)}</div>`;
			calendar_container.appendChild(date_header);
			const items_container = document.createElement("div");
			items_container.className = "calendar-items-container";
			if (items.length === 0) {
				const empty_notice = document.createElement("div");
				empty_notice.className = "empty-day-notice";
				empty_notice.textContent = "No assignments due";
				items_container.appendChild(empty_notice);
			} else items.forEach(({ item, course }) => {
				const element = create_assignment_element(item, course);
				items_container.appendChild(element);
			});
			calendar_container.appendChild(items_container);
			current_date.setDate(current_date.getDate() + 1);
		}
		create_scrollbar_indicator(calendar_container);
	}
	function set_last_fetched_time(t) {
		last_fetched_time = t;
	}
	function create_frequency_chart(calendar_container, items_by_date, initial_week_offset = 0) {
		const today_week_start = getWeekStart(/* @__PURE__ */ new Date());
		const chart_container = document.createElement("div");
		chart_container.className = "frequency-chart-container";
		chart_container.id = "frequency-chart";
		chart_container._todayWeekStart = today_week_start.getTime();
		chart_container._weekOffset = initial_week_offset;
		chart_container._calendarContainer = calendar_container;
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
		const grid = document.createElement("div");
		grid.className = "frequency-chart-grid";
		grid.id = "frequency-chart-grid";
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
			safe_send_message({ action: settings_panel.classList.contains("open") ? Action.BROADCAST_SETTINGS_OPENED : Action.BROADCAST_SETTINGS_CLOSED });
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
		const chart_row = document.createElement("div");
		chart_row.className = "frequency-chart-row";
		chart_row.appendChild(prev_btn);
		chart_row.appendChild(grid);
		chart_row.appendChild(next_btn);
		chart_container.appendChild(chart_row);
		{
			const last_fetched_el = document.createElement("div");
			last_fetched_el.className = "frequency-chart-last-fetched";
			last_fetched_el.textContent = last_fetched_time ? "Last fetched: " + last_fetched_time.toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				second: "2-digit"
			}) : "Last fetched: —";
			chart_container.appendChild(last_fetched_el);
		}
		try {
			render_frequency_chart(chart_container, items_by_date, today_week_start, initial_week_offset, calendar_container);
			update_frequency_nav_buttons(chart_container);
		} catch (e) {
			console.error("Error rendering frequency chart:", e);
		}
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
		try {
			calendar_container.insertBefore(chart_container, calendar_container.firstChild);
		} catch (e) {
			console.error("Error inserting frequency chart:", e);
			calendar_container.appendChild(chart_container);
		}
	}
	function render_frequency_chart(chart_container, items_by_date, today_week_start, week_offset, calendar_container) {
		try {
			const grid = chart_container.querySelector("#frequency-chart-grid");
			if (!grid) return;
			grid.innerHTML = "";
			if (!calendar_container) calendar_container = chart_container._calendarContainer;
			let display_week_start;
			if (typeof today_week_start === "number") display_week_start = new Date(today_week_start);
			else display_week_start = new Date(today_week_start.getFullYear(), today_week_start.getMonth(), today_week_start.getDate());
			display_week_start.setDate(display_week_start.getDate() + week_offset * DAYS_IN_WEEK);
			const week_label_el = chart_container.querySelector("#frequency-chart-week-label");
			if (week_label_el) week_label_el.textContent = `Week of ${MONTH_NAMES_SHORT[display_week_start.getMonth()]} ${display_week_start.getDate()}`;
			const week_counts = [
				0,
				0,
				0,
				0,
				0,
				0,
				0
			];
			let max_count = 0;
			for (let i = 0; i < DAYS_IN_WEEK; i++) {
				const day_date = new Date(display_week_start);
				day_date.setDate(day_date.getDate() + i);
				const count = items_by_date[getDateKey(day_date)]?.filter(({ item }) => !item.completed).length || 0;
				week_counts[i] = count;
				max_count = Math.max(max_count, count);
			}
			for (let i = 0; i < DAYS_IN_WEEK; i++) {
				const day_date = new Date(display_week_start);
				day_date.setDate(day_date.getDate() + i);
				const count = week_counts[i];
				const height_percent = max_count === 0 ? 0 : count / max_count * 100;
				const day_cell = document.createElement("div");
				day_cell.className = "frequency-day";
				const today_check = /* @__PURE__ */ new Date();
				if (day_date.getFullYear() === today_check.getFullYear() && day_date.getMonth() === today_check.getMonth() && day_date.getDate() === today_check.getDate()) day_cell.classList.add("frequency-day--today");
				const day_label = document.createElement("div");
				day_label.className = "frequency-day-label";
				day_label.textContent = DAY_LABELS[i];
				day_cell.appendChild(day_label);
				const date_num = document.createElement("div");
				date_num.className = "frequency-day-date";
				date_num.textContent = day_date.getDate();
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
				count_label.textContent = count > 0 ? count : "—";
				day_cell.appendChild(count_label);
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
	function scroll_to_date(calendar_container, target_date) {
		try {
			const date_headers = Array.from(calendar_container.querySelectorAll(".calendar-date-header"));
			for (const header of date_headers) {
				const date_match = (header.querySelector(".date-title")?.textContent || "").match(/(\w+)\s+(\d+)/);
				if (date_match) {
					const month_str = date_match[1];
					const day = parseInt(date_match[2]);
					const month_index = MONTH_NAMES_SHORT.findIndex((m) => m.toLowerCase().startsWith(month_str.toLowerCase()));
					if (month_index >= 0 && day === target_date.getDate() && month_index === target_date.getMonth()) {
						const chart_el = calendar_container.querySelector("#frequency-chart");
						const chart_height = chart_el ? chart_el.getBoundingClientRect().height : 0;
						const container_rect = calendar_container.getBoundingClientRect();
						const items_container = header.nextElementSibling;
						let target_scroll;
						if (items_container) {
							const items_absolute_pos = items_container.getBoundingClientRect().top - container_rect.top + calendar_container.scrollTop;
							target_scroll = Math.max(0, items_absolute_pos - header.offsetHeight - chart_height);
						} else {
							const absolute_pos = header.getBoundingClientRect().top - container_rect.top + calendar_container.scrollTop;
							target_scroll = Math.max(0, absolute_pos - chart_height);
						}
						calendar_container.scrollTo({
							top: target_scroll,
							behavior: "smooth"
						});
						return;
					}
				}
			}
		} catch (e) {
			console.error("Error scrolling to date:", e);
		}
	}
	function update_frequency_nav_buttons(chart_container) {
		try {
			const prev_btn = chart_container.querySelector("#frequency-chart-prev");
			const next_btn = chart_container.querySelector("#frequency-chart-next");
			if (!prev_btn || !next_btn) return;
			prev_btn.disabled = (chart_container._weekOffset || 0) <= 0;
			next_btn.disabled = false;
		} catch (e) {
			console.error("Error updating frequency nav buttons:", e);
		}
	}
	function register_ui_callbacks({ on_refresh, on_rerender }) {
		_on_refresh = on_refresh;
		_on_rerender = on_rerender;
	}
	function get_all_settings() {
		return {
			days_back: CALENDAR_START_DAYS_BACK,
			hidden_courses: [...hidden_course_ids],
			hidden_types_arr: [...hidden_types]
		};
	}
	function apply_settings({ days_back, hidden_courses, hidden_types_arr }) {
		CALENDAR_START_DAYS_BACK = days_back;
		hidden_course_ids = new Set(hidden_courses);
		hidden_types = new Set(hidden_types_arr);
		localStorage.setItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY, days_back.toString());
		localStorage.setItem(HIDDEN_COURSES_STORAGE_KEY, JSON.stringify(hidden_courses));
		localStorage.setItem(HIDDEN_TYPES_STORAGE_KEY, JSON.stringify(hidden_types_arr));
		const days_input = document.getElementById("spark-setting-days-back");
		if (days_input) days_input.value = days_back.toString();
		ITEM_TYPES.forEach(({ key }) => {
			const cb = document.querySelector(`.settings-course-checkbox[data-setting-type="${key}"]`);
			if (cb) cb.checked = !hidden_types.has(key);
		});
		update_settings_course_list(_last_course_data);
	}
	function build_settings_panel() {
		const panel = document.createElement("div");
		panel.id = "spark-settings-panel";
		const header = document.createElement("div");
		header.className = "settings-header";
		const title = document.createElement("span");
		title.className = "settings-title";
		title.textContent = "Settings";
		header.appendChild(title);
		panel.appendChild(header);
		const body = document.createElement("div");
		body.className = "settings-body";
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
			safe_send_message({
				action: Action.BROADCAST_SETTINGS_CHANGED,
				settings: get_all_settings()
			});
			if (_on_rerender) _on_rerender();
		});
		section.appendChild(label);
		section.appendChild(description);
		section.appendChild(input);
		body.appendChild(section);
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
				if (checkbox.checked) hidden_types.delete(key);
				else hidden_types.add(key);
				localStorage.setItem(HIDDEN_TYPES_STORAGE_KEY, JSON.stringify([...hidden_types]));
				safe_send_message({
					action: Action.BROADCAST_SETTINGS_CHANGED,
					settings: get_all_settings()
				});
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
		if (Object.keys(_last_course_data).length > 0) update_settings_course_list(_last_course_data, courses_list);
		return panel;
	}
	function update_settings_course_list(course_data, list_el = null) {
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
				if (checkbox.checked) hidden_course_ids.delete(course_id);
				else hidden_course_ids.add(course_id);
				localStorage.setItem(HIDDEN_COURSES_STORAGE_KEY, JSON.stringify([...hidden_course_ids]));
				safe_send_message({
					action: Action.BROADCAST_SETTINGS_CHANGED,
					settings: get_all_settings()
				});
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
	//#endregion
	//#region src/ui/panel.js
	var EXPANSION_STATE_KEY = "d2l-todolist-expanded";
	var PANEL_WIDTH_KEY = "d2l-todolist-width";
	var DEFAULT_PANEL_WIDTH = 350;
	var MIN_PANEL_WIDTH = 250;
	var PANEL_SLIDE_IN_MS = 400;
	var SETTINGS_TRANSITION_MS = 250;
	var panel_width = DEFAULT_PANEL_WIDTH;
	var container;
	var is_animating = false;
	var settings_was_open = false;
	var was_closed_silently = false;
	var _on_panel_restore = null;
	function update_body_margin() {
		document.body.style.marginRight = panel_width + "px";
	}
	function create_embedded_calendar_ui() {
		const new_container = document.createElement("div");
		new_container.id = "d2l-todolist-widget";
		new_container.style.width = panel_width + "px";
		const panel = document.createElement("div");
		panel.id = "d2l-todolist-panel";
		panel.style.width = panel_width + "px";
		const resize_handle = document.createElement("div");
		resize_handle.className = "d2l-todolist-resize-handle";
		const calendar_container = document.createElement("div");
		calendar_container.id = "calendar-container";
		panel.appendChild(resize_handle);
		panel.appendChild(calendar_container);
		new_container.appendChild(panel);
		let is_resizing = false;
		let start_x = 0;
		let start_width = panel_width;
		resize_handle.addEventListener("mousedown", function(e) {
			is_resizing = true;
			start_x = e.clientX;
			start_width = panel_width;
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
		});
		document.addEventListener("mousemove", function(e) {
			if (!is_resizing) return;
			const delta_x = e.clientX - start_x;
			const new_width = Math.max(MIN_PANEL_WIDTH, start_width - delta_x);
			panel_width = new_width;
			new_container.style.width = new_width + "px";
			panel.style.width = new_width + "px";
			update_body_margin();
			const sp = document.getElementById("spark-settings-panel");
			if (sp) sp.style.right = new_width + "px";
			localStorage.setItem(PANEL_WIDTH_KEY, new_width.toString());
		});
		document.addEventListener("mouseup", function() {
			if (is_resizing) {
				is_resizing = false;
				document.body.style.userSelect = "";
				document.body.style.cursor = "";
			}
		});
		return {
			container: new_container,
			calendar_container,
			panel
		};
	}
	/**
	* Sends a message to the extension runtime, swallowing invalidated-context errors.
	* @param {Object} message - The message object to send.
	* @param {Function} [callback] - Optional response callback.
	*/
	function safe_send_message(message, callback) {
		try {
			if (callback) chrome.runtime.sendMessage(message, callback);
			else chrome.runtime.sendMessage(message);
		} catch (e) {
			if (!e.message?.includes("Extension context invalidated")) console.error(e);
		}
	}
	/**
	* Registers a callback to be invoked when the panel is restored after a silent close.
	* @param {Function} fn - The callback to register.
	*/
	function register_panel_restore_callback(fn) {
		_on_panel_restore = fn;
	}
	/**
	* Toggles the panel open or closed, handling settings panel state and animations.
	*/
	function toggle_panel() {
		if (!container || is_animating) return;
		is_animating = true;
		if (!container.classList.contains("hidden")) {
			const sp = document.getElementById("spark-settings-panel");
			const settings_open = sp && sp.classList.contains("open");
			const do_close = () => {
				container.classList.add("hidden");
				localStorage.setItem(EXPANSION_STATE_KEY, "false");
				was_closed_silently = false;
				safe_send_message({ action: Action.PANEL_CLOSED });
				document.body.style.marginRight = "0";
				const animation_handler = () => {
					container.style.display = "none";
					container.removeEventListener("animationend", animation_handler);
					is_animating = false;
				};
				container.addEventListener("animationend", animation_handler);
			};
			if (settings_open) {
				settings_was_open = true;
				sp.classList.remove("open");
				setTimeout(do_close, SETTINGS_TRANSITION_MS);
			} else {
				settings_was_open = false;
				do_close();
			}
		} else {
			container.classList.remove("hidden");
			localStorage.setItem(EXPANSION_STATE_KEY, "true");
			was_closed_silently = false;
			safe_send_message({ action: Action.PANEL_OPENED });
			container.style.display = "flex";
			update_body_margin();
			if (settings_was_open) {
				settings_was_open = false;
				setTimeout(() => {
					let sp = document.getElementById("spark-settings-panel");
					if (!sp) {
						sp = build_settings_panel();
						document.body.appendChild(sp);
					}
					sp.style.right = (typeof panel_width !== "undefined" ? panel_width : DEFAULT_PANEL_WIDTH) + "px";
					sp.classList.add("open");
					setTimeout(() => {
						is_animating = false;
					}, SETTINGS_TRANSITION_MS);
				}, PANEL_SLIDE_IN_MS);
			} else setTimeout(() => {
				chrome.storage.local.get(["spark-settings-open"], function(result) {
					if (result["spark-settings-open"]) {
						let sp = document.getElementById("spark-settings-panel");
						if (!sp) {
							sp = build_settings_panel();
							document.body.appendChild(sp);
						}
						sp.style.right = panel_width + "px";
						sp.classList.add("open");
						setTimeout(() => {
							is_animating = false;
						}, SETTINGS_TRANSITION_MS);
					} else is_animating = false;
				});
			}, PANEL_SLIDE_IN_MS);
		}
	}
	/**
	* Closes the panel without changing the user's saved preference.
	* Used when another tab takes over as the active panel.
	* Deliberately skips animation — the user is not watching this tab.
	*/
	function close_panel_silently() {
		if (!container || container.classList.contains("hidden")) return;
		was_closed_silently = true;
		container.classList.add("hidden");
		container.style.display = "none";
		document.body.style.marginRight = "0";
		const sp = document.getElementById("spark-settings-panel");
		if (sp) {
			sp.style.transition = "none";
			sp.classList.remove("open");
			requestAnimationFrame(() => {
				sp.style.transition = "";
			});
		}
	}
	/**
	* Injects the side panel widget into the page and wires up visibility-change handling.
	* @returns {HTMLElement} The calendar container element where content should be rendered.
	*/
	function inject_embedded_ui() {
		const existing = document.getElementById("d2l-todolist-widget");
		if (existing) existing.remove();
		const saved_width = localStorage.getItem(PANEL_WIDTH_KEY);
		if (saved_width) panel_width = parseInt(saved_width, 10);
		const { container: new_container, calendar_container } = create_embedded_calendar_ui();
		container = new_container;
		const saved_state = localStorage.getItem(EXPANSION_STATE_KEY);
		const should_show_panel = saved_state === null || saved_state === "true";
		if (!should_show_panel) {
			container.style.display = "none";
			container.classList.add("hidden");
		}
		if (should_show_panel) update_body_margin();
		else document.body.style.marginRight = "0";
		document.body.appendChild(container);
		if (should_show_panel) safe_send_message({ action: Action.PANEL_OPENED });
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState !== "visible") return;
			if (was_closed_silently) {
				const state = localStorage.getItem(EXPANSION_STATE_KEY);
				if (state === null || state === "true") {
					was_closed_silently = false;
					is_animating = false;
					container.style.display = "flex";
					container.classList.remove("hidden");
					update_body_margin();
					safe_send_message({ action: Action.PANEL_OPENED });
					if (_on_panel_restore) _on_panel_restore();
				}
			} else if (container && !container.classList.contains("hidden")) {
				safe_send_message({ action: Action.PANEL_OPENED });
				if (_on_panel_restore) _on_panel_restore();
			}
		});
		return calendar_container;
	}
	//#endregion
	//#region src/content.js
	var COURSE_DATA_KEY = "courseData";
	var LAST_FETCHED_KEY = "spark-last-fetched";
	var SETTINGS_OPEN_KEY = "spark-settings-open";
	var SETTINGS_VALUE_KEY = "spark-user-settings";
	var fetch_in_flight = false;
	var global_fetch_in_flight = false;
	var _refresh_fn = null;
	var _rerender_fn = null;
	function trigger_refresh() {
		if (_refresh_fn) _refresh_fn();
	}
	function trigger_rerender() {
		if (_rerender_fn) _rerender_fn();
	}
	window.addEventListener("load", () => {
		let course_data = {};
		const calendar_container = inject_embedded_ui();
		initialize_gui();
		let scroll_save_timer = null;
		calendar_container.addEventListener("scroll", () => {
			clearTimeout(scroll_save_timer);
			scroll_save_timer = setTimeout(() => {
				safe_send_message({
					action: Action.SAVE_SCROLL_POSITION,
					position: calendar_container.scrollTop
				});
			}, 300);
		});
		function restore_scroll_position() {
			safe_send_message({ action: Action.GET_SCROLL_POSITION }, function(response) {
				if (response && response.position > 0) requestAnimationFrame(() => {
					calendar_container.scrollTop = response.position;
				});
			});
		}
		register_panel_restore_callback(() => {
			chrome.storage.local.get([SETTINGS_OPEN_KEY, SETTINGS_VALUE_KEY], function(result) {
				if (result[SETTINGS_VALUE_KEY]) apply_settings(result[SETTINGS_VALUE_KEY]);
				if (course_data && Object.keys(course_data).length > 0) {
					update_gui(course_data, fetch_in_flight || global_fetch_in_flight);
					restore_scroll_position();
				}
				let sp = document.getElementById("spark-settings-panel");
				if (result[SETTINGS_OPEN_KEY]) {
					if (!sp) {
						sp = build_settings_panel();
						document.body.appendChild(sp);
					}
					sp.style.right = panel_width + "px";
					sp.classList.add("open");
				} else if (sp) sp.classList.remove("open");
			});
		});
		chrome.storage.local.get([
			COURSE_DATA_KEY,
			LAST_FETCHED_KEY,
			SETTINGS_OPEN_KEY,
			SETTINGS_VALUE_KEY
		], function(result) {
			if (result[SETTINGS_VALUE_KEY]) apply_settings(result[SETTINGS_VALUE_KEY]);
			if (result[LAST_FETCHED_KEY]) set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
			if (result[COURSE_DATA_KEY]) {
				course_data = JSON.parse(JSON.stringify(result[COURSE_DATA_KEY]));
				update_gui(course_data, true);
				restore_scroll_position();
			}
			if (result[SETTINGS_OPEN_KEY]) {
				const widget = document.getElementById("d2l-todolist-widget");
				if (widget && !widget.classList.contains("hidden") && widget.style.display !== "none") {
					let sp = document.getElementById("spark-settings-panel");
					if (!sp) {
						sp = build_settings_panel();
						document.body.appendChild(sp);
					}
					sp.style.right = panel_width + "px";
					sp.classList.add("open");
				}
			}
		});
		_refresh_fn = function() {
			if (fetch_in_flight) return;
			fetch_in_flight = true;
			add_data_status_indicator(true);
			safe_send_message({ action: Action.BROADCAST_FETCH_STARTED });
			safe_send_message({ action: Action.FETCH_COURSES }, function(response) {
				fetch_in_flight = false;
				if (response) {
					course_data = JSON.parse(JSON.stringify(response));
					const fetch_time = /* @__PURE__ */ new Date();
					set_last_fetched_time(fetch_time);
					chrome.storage.local.set({
						[COURSE_DATA_KEY]: course_data,
						[LAST_FETCHED_KEY]: fetch_time.toISOString()
					}, function() {
						update_gui(course_data, false);
						restore_scroll_position();
						safe_send_message({ action: Action.BROADCAST_COURSE_DATA_UPDATED });
					});
				}
			});
		};
		_rerender_fn = function() {
			if (course_data && Object.keys(course_data).length > 0) update_gui(course_data, fetch_in_flight || global_fetch_in_flight);
		};
		register_ui_callbacks({
			on_refresh: trigger_refresh,
			on_rerender: trigger_rerender
		});
		_refresh_fn();
	});
	chrome.runtime.onMessage.addListener(function(request) {
		if (request.action === Action.FETCH_STARTED) {
			global_fetch_in_flight = true;
			add_data_status_indicator(true);
		}
		if (request.action === Action.COURSE_DATA_UPDATED) {
			global_fetch_in_flight = false;
			chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY], function(result) {
				if (result[LAST_FETCHED_KEY]) set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
				if (result[COURSE_DATA_KEY]) update_gui(JSON.parse(JSON.stringify(result[COURSE_DATA_KEY])), fetch_in_flight);
			});
		}
		if (request.action === OPEN_URL_ACTION) window.open(request.url, "_blank");
		if (request.action === Action.TOGGLE_PANEL) toggle_panel();
		if (request.action === Action.CLOSE_PANEL) {
			if (document.visibilityState === "visible") close_panel_silently();
		}
		if (request.action === Action.SETTINGS_OPENED) {
			const widget = document.getElementById("d2l-todolist-widget");
			if (!widget || widget.classList.contains("hidden") || widget.style.display === "none") return;
			let settings_panel = document.getElementById("spark-settings-panel");
			if (!settings_panel) {
				settings_panel = build_settings_panel();
				document.body.appendChild(settings_panel);
			}
			settings_panel.style.right = panel_width + "px";
			settings_panel.classList.add("open");
		}
		if (request.action === Action.SETTINGS_CLOSED) {
			const settings_panel = document.getElementById("spark-settings-panel");
			if (settings_panel) settings_panel.classList.remove("open");
		}
		if (request.action === Action.SETTINGS_CHANGED) {
			apply_settings(request.settings);
			trigger_rerender();
		}
	});
	//#endregion
})();
