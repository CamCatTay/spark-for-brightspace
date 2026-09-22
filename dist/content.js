(function() {
	//#region src/shared/actions.ts
	var Action = Object.freeze({
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
		BROADCAST_SETTINGS_CHANGED: "broadcast_settings_changed"
	});
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
	var CALENDAR_START_DAYS_BACK_STORAGE_KEY = "spark-calendar-start-days-back";
	var SHOW_COMPLETED_STORAGE_KEY = "spark-show-completed";
	var SHOW_NO_DUE_DATE_STORAGE_KEY = "spark-show-no-due-date";
	var SHOW_ON_START_STORAGE_KEY = "spark-setting-show-on-start";
	var HIDDEN_COURSES_SESSION_KEY = "spark-hidden-courses";
	var HIDDEN_TYPES_SESSION_KEY = "spark-hidden-types";
	var COURSE_NAME_TRIM_WORDS = [
		"Section",
		"XLS",
		"Group",
		"Spring",
		"Fall",
		"Winter",
		"Summer"
	];
	function read_session_set(key) {
		try {
			return new Set(JSON.parse(sessionStorage.getItem(key) || "[]"));
		} catch {
			return /* @__PURE__ */ new Set();
		}
	}
	function read_enabled_flag(key) {
		return localStorage.getItem(key) !== "false";
	}
	function read_calendar_start_days_back() {
		const raw = parseInt(localStorage.getItem("spark-calendar-start-days-back") ?? String(7), 10);
		return Number.isFinite(raw) && raw >= 0 ? raw : 7;
	}
	function truncate_course_name(name) {
		if (!name) return name;
		const pattern = COURSE_NAME_TRIM_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
		return name.replace(new RegExp(`\\s*(${pattern})\\b.*$`, "i"), "").trim();
	}
	var ui_state = {
		calendar_start_days_back: read_calendar_start_days_back(),
		show_completed_items: read_enabled_flag(SHOW_COMPLETED_STORAGE_KEY),
		show_no_due_date_items: read_enabled_flag(SHOW_NO_DUE_DATE_STORAGE_KEY),
		show_on_start: read_enabled_flag(SHOW_ON_START_STORAGE_KEY),
		hidden_course_ids: read_session_set(HIDDEN_COURSES_SESSION_KEY),
		hidden_types: read_session_set(HIDDEN_TYPES_SESSION_KEY),
		last_fetched_time: null,
		last_course_data: {},
		on_refresh: null,
		on_rerender: null
	};
	//#endregion
	//#region src/ui/dom-constants.ts
	var SettingsCss = Object.freeze({
		BODY: "settings-body",
		COURSE_CHECKBOX: "settings-course-checkbox",
		COURSE_DOT: "settings-course-dot",
		COURSE_NAME: "settings-course-name",
		COURSES_LIST: "settings-courses-list",
		COURSES_LIST_ID: "spark-settings-courses-list",
		COURSES_SECTION_ID: "spark-settings-courses",
		COURSE_ROW: "settings-course-row",
		DAYS_BACK_INPUT_ID: "spark-setting-days-back",
		SHOW_COMPLETED_INPUT_ID: "spark-setting-show-completed",
		SHOW_NO_DUE_DATE_INPUT_ID: "spark-setting-show-no-due-date",
		DESCRIPTION: "settings-description",
		INPUT: "settings-input",
		LABEL: "settings-label",
		OPEN: "open",
		PANEL_HEADER: "settings-header",
		PANEL_ID: "spark-settings-panel",
		PANEL_TITLE: "settings-title",
		SECTION: "settings-section"
	});
	var PanelCss = Object.freeze({
		WIDGET_ID: "spark-widget",
		PANEL_ID: "spark-panel",
		RESIZE_HANDLE: "spark-resize-handle",
		CALENDAR_CONTAINER_ID: "calendar-container",
		TOGGLE_BTN_ID: "spark-toggle-btn",
		TOGGLE_BTN_TITLE: "Toggle Spark panel",
		TOGGLE_SLIDE_IN: "spark-toggle-slide-in",
		TOGGLE_SLIDE_OUT: "spark-toggle-slide-out",
		WIDGET_HIDDEN: "hidden"
	});
	var FrequencyChartCss = Object.freeze({
		CONTAINER: "frequency-chart-container",
		CONTAINER_ID: "frequency-chart",
		NAV_BTN: "frequency-chart-btn",
		PREV_BTN_ID: "frequency-chart-prev",
		NEXT_BTN_ID: "frequency-chart-next",
		GRID: "frequency-chart-grid",
		HEADER_ROW: "frequency-chart-header-row",
		WEEK_LABEL: "frequency-chart-week-label",
		SETTINGS_BTN: "spark-settings-btn",
		REFRESH_BTN: "spark-refresh-btn",
		SPINNING: "spinning",
		BTN_SPACER: "spark-btn-spacer",
		FAQ_BTN: "faq-btn",
		CHART_ROW: "frequency-chart-row",
		LAST_FETCHED: "frequency-chart-last-fetched",
		DAY: "frequency-day",
		DAY_TODAY: "frequency-day--today",
		DAY_LABEL: "frequency-day-label",
		DAY_DATE: "frequency-day-date",
		BAR_CONTAINER: "frequency-bar-container",
		BAR: "frequency-bar",
		DAY_COUNT: "frequency-day-count"
	});
	Object.freeze({
		QUIZ_SUMMARY_ELEMENT_ID: "z_l",
		SUBMISSION_ROW_CLASS: "d_gn d_gt"
	});
	var CalendarCss = Object.freeze({
		DATE_HEADER: "calendar-date-header",
		DATE_TITLE: "date-title",
		ITEMS_CONTAINER: "calendar-items-container",
		ITEM: "calendar-item",
		ITEM_UNAVAILABLE: "not-yet-available",
		ITEM_NAME: "item-name",
		ITEM_META: "item-meta",
		ITEM_CONTENT: "item-content",
		ITEM_TIME: "item-time",
		ITEM_META_SEPARATOR: "item-meta-separator",
		ITEM_COURSE: "item-course",
		ITEM_COURSE_DOT: "item-course-dot",
		ITEM_COMPLETED_BADGE: "item-completed-badge",
		ITEM_INCOMPLETE_DOT: "item-incomplete-dot",
		START_DATE_CONTAINER: "start-date-container",
		START_DATE_VALUE: "start-date-value",
		DUE_DATE_CONTAINER: "due-date-container",
		SCROLLBAR_INDICATOR: "scrollbar-indicator",
		SCROLLBAR_NOTCH: "scrollbar-notch",
		EMPTY_STATE_ID: "loading-indicator",
		EMPTY_DAY_NOTICE: "empty-day-notice",
		FETCH_STATUS: "fetch-status",
		FETCH_SPINNER: "fetch-spinner",
		FETCHING: "fetching"
	});
	//#endregion
	//#region src/ui/panel.ts
	var settings_panel_builder = null;
	function register_settings_panel_builder(fn) {
		settings_panel_builder = fn;
	}
	var EXPANSION_STATE_KEY = "spark-expanded";
	var PANEL_WIDTH_KEY = "spark-width";
	var TOGGLE_BTN_TOP_KEY = "spark-toggle-btn-top";
	var DEFAULT_PANEL_WIDTH = 400;
	var MIN_PANEL_WIDTH = 330;
	var PANEL_SLIDE_IN_MS = 300;
	var SETTINGS_TRANSITION_MS = 250;
	var DRAG_MOVE_THRESHOLD_PX = 4;
	var CHEVRON_OPEN = "❯";
	var CHEVRON_CLOSED = "❮";
	var panel_width = DEFAULT_PANEL_WIDTH;
	var panel_container = null;
	var toggle_button = null;
	var panel_is_animating = false;
	var settings_was_open = false;
	var panel_restore_callback = null;
	var panel_open_callback = null;
	function sync_body_margin_to_panel_width() {
		document.documentElement.style.setProperty("--spark-panel-width", panel_width + "px");
		document.body.style.marginRight = panel_width + "px";
		if (toggle_button) toggle_button.style.right = panel_width + "px";
	}
	function build_panel_dom() {
		const widget_container = document.createElement("div");
		widget_container.id = PanelCss.WIDGET_ID;
		widget_container.style.width = panel_width + "px";
		const panel_el = document.createElement("div");
		panel_el.id = PanelCss.PANEL_ID;
		panel_el.style.width = panel_width + "px";
		const resize_handle = document.createElement("div");
		resize_handle.className = PanelCss.RESIZE_HANDLE;
		const calendar_container = document.createElement("div");
		calendar_container.id = PanelCss.CALENDAR_CONTAINER_ID;
		panel_el.appendChild(resize_handle);
		panel_el.appendChild(calendar_container);
		widget_container.appendChild(panel_el);
		return {
			widget_container,
			panel_el,
			resize_handle,
			calendar_container
		};
	}
	function attach_resize_handler(resize_handle, widget_container, panel_el) {
		let is_resizing = false;
		let resize_start_x = 0;
		let resize_start_width = panel_width;
		resize_handle.addEventListener("mousedown", function(e) {
			is_resizing = true;
			resize_start_x = e.clientX;
			resize_start_width = panel_width;
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
		});
		document.addEventListener("mousemove", function(e) {
			if (!is_resizing) return;
			const delta_x = e.clientX - resize_start_x;
			const new_width = Math.max(MIN_PANEL_WIDTH, resize_start_width - delta_x);
			panel_width = new_width;
			widget_container.style.width = new_width + "px";
			panel_el.style.width = new_width + "px";
			sync_body_margin_to_panel_width();
			const settings_panel = document.getElementById(SettingsCss.PANEL_ID);
			if (settings_panel) settings_panel.style.right = new_width + "px";
			localStorage.setItem(PANEL_WIDTH_KEY, new_width.toString());
		});
		document.addEventListener("mouseup", function() {
			if (is_resizing) {
				is_resizing = false;
				document.body.style.userSelect = "";
				document.body.style.cursor = "";
			}
		});
	}
	function create_panel_widget() {
		const { widget_container, panel_el, resize_handle, calendar_container } = build_panel_dom();
		attach_resize_handler(resize_handle, widget_container, panel_el);
		return {
			widget_container,
			calendar_container
		};
	}
	function clamp_button_top_position(top_px) {
		const btn_height = toggle_button ? toggle_button.offsetHeight : 40;
		const max_top = window.innerHeight - btn_height;
		return Math.max(0, Math.min(top_px, max_top));
	}
	function set_toggle_button_top(top_px) {
		const clamped = clamp_button_top_position(top_px);
		toggle_button.style.top = clamped + "px";
		toggle_button.style.transform = "none";
		localStorage.setItem(TOGGLE_BTN_TOP_KEY, clamped.toString());
	}
	function attach_drag_handler(btn) {
		let is_dragging = false;
		let drag_start_y = 0;
		let drag_start_top = 0;
		let drag_moved = false;
		btn.addEventListener("mousedown", function(e) {
			is_dragging = true;
			drag_moved = false;
			drag_start_y = e.clientY;
			drag_start_top = btn.getBoundingClientRect().top;
			document.body.style.userSelect = "none";
			e.preventDefault();
		});
		document.addEventListener("mousemove", function(e) {
			if (!is_dragging) return;
			const delta_y = e.clientY - drag_start_y;
			if (Math.abs(delta_y) > DRAG_MOVE_THRESHOLD_PX) drag_moved = true;
			set_toggle_button_top(drag_start_top + delta_y);
		});
		document.addEventListener("mouseup", function() {
			if (!is_dragging) return;
			is_dragging = false;
			document.body.style.userSelect = "";
		});
		btn.addEventListener("click", function(e) {
			if (drag_moved) {
				e.stopImmediatePropagation();
				drag_moved = false;
				return;
			}
			toggle_panel();
		});
	}
	function build_toggle_button() {
		const existing = document.getElementById(PanelCss.TOGGLE_BTN_ID);
		if (existing) existing.remove();
		const btn = document.createElement("button");
		btn.id = PanelCss.TOGGLE_BTN_ID;
		btn.setAttribute("title", PanelCss.TOGGLE_BTN_TITLE);
		btn.textContent = CHEVRON_CLOSED;
		attach_drag_handler(btn);
		return btn;
	}
	function safe_send_message(message, callback) {
		try {
			if (callback) chrome.runtime.sendMessage(message, callback);
			else chrome.runtime.sendMessage(message);
		} catch (e) {
			if (!e.message?.includes("Extension context invalidated")) console.error(e);
		}
	}
	function register_panel_restore_callback(fn) {
		panel_restore_callback = fn;
	}
	function hide_panel_immediately() {
		panel_container.classList.add(PanelCss.WIDGET_HIDDEN);
		sessionStorage.setItem(EXPANSION_STATE_KEY, "false");
		document.body.style.marginRight = "0";
		if (toggle_button) {
			toggle_button.textContent = CHEVRON_CLOSED;
			toggle_button.classList.remove(PanelCss.TOGGLE_SLIDE_IN);
			toggle_button.classList.add(PanelCss.TOGGLE_SLIDE_OUT);
			const on_toggle_out = () => {
				toggle_button.classList.remove(PanelCss.TOGGLE_SLIDE_OUT);
				toggle_button.style.right = "0px";
				toggle_button.removeEventListener("animationend", on_toggle_out);
			};
			toggle_button.addEventListener("animationend", on_toggle_out);
		}
		const on_animation_end = () => {
			panel_container.style.display = "none";
			panel_container.removeEventListener("animationend", on_animation_end);
			panel_is_animating = false;
		};
		panel_container.addEventListener("animationend", on_animation_end);
	}
	function close_panel() {
		const settings_panel = document.getElementById(SettingsCss.PANEL_ID);
		if (settings_panel && settings_panel.classList.contains(SettingsCss.OPEN)) {
			settings_was_open = true;
			settings_panel.classList.remove(SettingsCss.OPEN);
			setTimeout(hide_panel_immediately, SETTINGS_TRANSITION_MS);
		} else {
			settings_was_open = false;
			hide_panel_immediately();
		}
	}
	function reopen_settings_after_panel_slides_in() {
		settings_was_open = false;
		let settings_panel = document.getElementById(SettingsCss.PANEL_ID);
		if (!settings_panel) {
			if (!settings_panel_builder) return;
			settings_panel = settings_panel_builder();
			document.body.appendChild(settings_panel);
		}
		settings_panel.style.right = panel_width + "px";
		settings_panel.classList.add(SettingsCss.OPEN);
		if (panel_open_callback) panel_open_callback();
		setTimeout(() => {
			panel_is_animating = false;
		}, SETTINGS_TRANSITION_MS);
	}
	function open_panel() {
		panel_container.classList.remove(PanelCss.WIDGET_HIDDEN);
		sessionStorage.setItem(EXPANSION_STATE_KEY, "true");
		panel_container.style.display = "flex";
		sync_body_margin_to_panel_width();
		if (toggle_button) {
			toggle_button.textContent = CHEVRON_OPEN;
			toggle_button.classList.remove(PanelCss.TOGGLE_SLIDE_OUT);
			toggle_button.classList.add(PanelCss.TOGGLE_SLIDE_IN);
			const on_toggle_in = () => {
				toggle_button.classList.remove(PanelCss.TOGGLE_SLIDE_IN);
				toggle_button.removeEventListener("animationend", on_toggle_in);
			};
			toggle_button.addEventListener("animationend", on_toggle_in);
		}
		if (settings_was_open) setTimeout(reopen_settings_after_panel_slides_in, PANEL_SLIDE_IN_MS);
		else setTimeout(() => {
			if (panel_open_callback) panel_open_callback();
			panel_is_animating = false;
		}, PANEL_SLIDE_IN_MS);
	}
	function toggle_panel() {
		if (!panel_container || panel_is_animating) return;
		panel_is_animating = true;
		if (!panel_container.classList.contains(PanelCss.WIDGET_HIDDEN)) close_panel();
		else open_panel();
	}
	function load_saved_panel_width() {
		const saved_width = localStorage.getItem(PANEL_WIDTH_KEY);
		if (saved_width) panel_width = parseInt(saved_width, 10);
	}
	function restore_toggle_button_position() {
		const saved_top = localStorage.getItem(TOGGLE_BTN_TOP_KEY);
		if (saved_top !== null) {
			toggle_button.style.top = saved_top + "px";
			toggle_button.style.transform = "none";
		}
	}
	function determine_initial_panel_visibility() {
		const expansion_state = sessionStorage.getItem(EXPANSION_STATE_KEY);
		return expansion_state === "true" || expansion_state === null && ui_state.show_on_start;
	}
	function apply_initial_panel_state(is_visible) {
		if (is_visible) {
			toggle_button.style.right = panel_width + "px";
			toggle_button.textContent = CHEVRON_OPEN;
			sync_body_margin_to_panel_width();
		} else {
			panel_container.style.display = "none";
			panel_container.classList.add(PanelCss.WIDGET_HIDDEN);
			document.body.style.marginRight = "0";
			toggle_button.style.right = "0px";
			toggle_button.textContent = CHEVRON_CLOSED;
		}
	}
	function on_tab_visibility_changed$1() {
		if (document.visibilityState !== "visible") return;
		if (panel_container && !panel_container.classList.contains(PanelCss.WIDGET_HIDDEN)) {
			if (panel_restore_callback) panel_restore_callback();
		}
	}
	function inject_embedded_ui() {
		const existing = document.getElementById(PanelCss.WIDGET_ID);
		if (existing) existing.remove();
		document.documentElement.style.setProperty("--spark-slide-ms", PANEL_SLIDE_IN_MS + "ms");
		load_saved_panel_width();
		document.documentElement.style.setProperty("--spark-panel-width", panel_width + "px");
		const { widget_container, calendar_container } = create_panel_widget();
		panel_container = widget_container;
		toggle_button = build_toggle_button();
		restore_toggle_button_position();
		apply_initial_panel_state(determine_initial_panel_visibility());
		document.body.appendChild(panel_container);
		document.body.appendChild(toggle_button);
		document.addEventListener("visibilitychange", on_tab_visibility_changed$1);
		return calendar_container;
	}
	//#endregion
	//#region src/utils/date-utils.ts
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
	//#endregion
	//#region src/utils/color-utils.ts
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
	//#endregion
	//#region src/utils/settings-menu-utils.ts
	function create_toggle_setting(title_text, description_text, default_toggle, onChange) {
		const section = document.createElement("div");
		section.className = SettingsCss.SECTION;
		const row = document.createElement("label");
		row.className = SettingsCss.COURSE_ROW;
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = SettingsCss.COURSE_CHECKBOX;
		checkbox.checked = default_toggle;
		checkbox.addEventListener("change", () => onChange?.(checkbox.checked));
		const title = document.createElement("span");
		title.className = SettingsCss.LABEL;
		title.textContent = title_text;
		row.appendChild(checkbox);
		row.appendChild(title);
		section.appendChild(row);
		const description = document.createElement("p");
		description.className = SettingsCss.DESCRIPTION;
		description.textContent = description_text;
		section.appendChild(description);
		return {
			section,
			checkbox
		};
	}
	//#endregion
	//#region src/ui/settings-menu.ts
	function get_synced_settings() {
		return {
			days_back: ui_state.calendar_start_days_back,
			show_completed: ui_state.show_completed_items,
			show_no_due_date: ui_state.show_no_due_date_items
		};
	}
	function clamp_days_back(raw_value) {
		return Math.max(0, Math.min(365, raw_value || 0));
	}
	function broadcast_settings_changed() {
		safe_send_message({
			action: Action.BROADCAST_SETTINGS_CHANGED,
			settings: get_synced_settings()
		});
	}
	function trigger_rerender() {
		if (ui_state.on_rerender) ui_state.on_rerender();
	}
	function on_days_back_changed(input) {
		const clamped = clamp_days_back(parseInt(input.value, 10));
		input.value = clamped.toString();
		ui_state.calendar_start_days_back = clamped;
		localStorage.setItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY, clamped.toString());
		broadcast_settings_changed();
		trigger_rerender();
	}
	function on_show_completed_changed(checked) {
		ui_state.show_completed_items = checked;
		localStorage.setItem(SHOW_COMPLETED_STORAGE_KEY, checked.toString());
		broadcast_settings_changed();
		trigger_rerender();
	}
	function on_show_no_due_date_changed(checked) {
		ui_state.show_no_due_date_items = checked;
		localStorage.setItem(SHOW_NO_DUE_DATE_STORAGE_KEY, checked.toString());
		broadcast_settings_changed();
		trigger_rerender();
	}
	function on_show_on_start_changed(checked) {
		ui_state.show_on_start = checked;
		localStorage.setItem(SHOW_ON_START_STORAGE_KEY, checked.toString());
		broadcast_settings_changed();
		trigger_rerender();
	}
	function on_type_visibility_changed(type_key, is_visible) {
		if (is_visible) ui_state.hidden_types.delete(type_key);
		else ui_state.hidden_types.add(type_key);
		sessionStorage.setItem(HIDDEN_TYPES_SESSION_KEY, JSON.stringify([...ui_state.hidden_types]));
		trigger_rerender();
	}
	function on_course_visibility_changed(course_id, is_visible) {
		if (is_visible) ui_state.hidden_course_ids.delete(course_id);
		else ui_state.hidden_course_ids.add(course_id);
		sessionStorage.setItem(HIDDEN_COURSES_SESSION_KEY, JSON.stringify([...ui_state.hidden_course_ids]));
		trigger_rerender();
	}
	function build_panel_header() {
		const header = document.createElement("div");
		header.className = SettingsCss.PANEL_HEADER;
		const title = document.createElement("span");
		title.className = SettingsCss.PANEL_TITLE;
		title.textContent = "Settings";
		header.appendChild(title);
		return header;
	}
	function build_days_back_section() {
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
		input.min = 0 .toString();
		input.max = 365 .toString();
		input.value = ui_state.calendar_start_days_back.toString();
		input.addEventListener("change", () => on_days_back_changed(input));
		section.appendChild(label);
		section.appendChild(description);
		section.appendChild(input);
		return section;
	}
	function build_show_completed_section() {
		return create_toggle_setting("Show completed items", "When off, only incomplete items are shown in the calendar.", ui_state.show_completed_items, on_show_completed_changed).section;
	}
	function build_show_no_due_date_section() {
		const toggle = create_toggle_setting("Show items without deadline", "When on, activities with no due date appear in a separate \"No Due Date\" section at the end of the calendar.", ui_state.show_no_due_date_items, on_show_no_due_date_changed);
		toggle.checkbox.id = SettingsCss.SHOW_NO_DUE_DATE_INPUT_ID;
		return toggle.section;
	}
	function build_show_on_start_section() {
		return create_toggle_setting("Show on start", "When off, the side panel will start hidden in new tabs.", ui_state.show_on_start, on_show_on_start_changed).section;
	}
	function build_type_filter_row(key, type_label) {
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
	function build_types_filter_section() {
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
	function build_courses_section() {
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
	function build_course_row(course_id, course) {
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
	function build_settings_panel() {
		const panel = document.createElement("div");
		panel.id = SettingsCss.PANEL_ID;
		const body = document.createElement("div");
		body.className = SettingsCss.BODY;
		body.appendChild(build_days_back_section());
		body.appendChild(build_show_completed_section());
		body.appendChild(build_show_no_due_date_section());
		body.appendChild(build_show_on_start_section());
		body.appendChild(build_types_filter_section());
		const courses_section = build_courses_section();
		body.appendChild(courses_section);
		panel.appendChild(build_panel_header());
		panel.appendChild(body);
		if (Object.keys(ui_state.last_course_data).length > 0) {
			const courses_list = courses_section.querySelector(`#${SettingsCss.COURSES_LIST_ID}`);
			update_settings_course_list(ui_state.last_course_data, courses_list);
		}
		return panel;
	}
	function update_settings_panel() {
		const existing = document.getElementById(SettingsCss.PANEL_ID);
		if (!existing) return;
		const new_panel = build_settings_panel();
		new_panel.style.cssText = existing.style.cssText;
		if (existing.classList.contains(SettingsCss.OPEN)) new_panel.classList.add(SettingsCss.OPEN);
		existing.replaceWith(new_panel);
	}
	function update_settings_course_list(course_data, list_el = null) {
		const list = list_el || document.getElementById(SettingsCss.COURSES_LIST_ID);
		if (!list) return;
		list.innerHTML = "";
		Object.keys(course_data).forEach((course_id) => {
			list.appendChild(build_course_row(course_id, course_data[course_id]));
		});
	}
	//#endregion
	//#region src/ui/frequency-chart.ts
	var PREV_WEEK_ICON = "‹";
	var NEXT_WEEK_ICON = "›";
	var SETTINGS_ICON = "⚙";
	var REFRESH_ICON = "↻";
	var FAQ_ICON = "?";
	var PREV_BTN_TITLE = "Previous week";
	var NEXT_BTN_TITLE = "Next week";
	var SETTINGS_BTN_TITLE = "Settings";
	var REFRESH_BTN_TITLE = "Refresh";
	var FAQ_BTN_TITLE = "Help / FAQ";
	var LAST_FETCHED_PREFIX = "Last fetched: ";
	var LAST_FETCHED_EMPTY = "Last fetched: —";
	var WEEK_OF_PREFIX = "Week of ";
	function compute_display_week_start(today_week_start_ms, week_offset) {
		const start = new Date(today_week_start_ms);
		start.setDate(start.getDate() + week_offset * 7);
		return start;
	}
	function count_incomplete_items_per_day(items_by_date, week_start) {
		const counts = Array(7).fill(0);
		let max = 0;
		for (let i = 0; i < 7; i++) {
			const day = new Date(week_start);
			day.setDate(day.getDate() + i);
			const count = items_by_date[getDateKey(day)]?.filter(({ item }) => !item.completed).length ?? 0;
			counts[i] = count;
			if (count > max) max = count;
		}
		return {
			counts,
			max
		};
	}
	function format_week_label(week_start) {
		return `${WEEK_OF_PREFIX}${MONTH_NAMES_SHORT[week_start.getMonth()]} ${week_start.getDate()}`;
	}
	function is_today(date) {
		const today = /* @__PURE__ */ new Date();
		return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
	}
	function create_settings_button() {
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
	function create_refresh_button() {
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
	function create_faq_button() {
		const btn = document.createElement("button");
		btn.className = FrequencyChartCss.FAQ_BTN;
		btn.title = FAQ_BTN_TITLE;
		btn.textContent = FAQ_ICON;
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			safe_send_message({ action: Action.OPEN_FAQ });
		});
		return btn;
	}
	function create_nav_button(icon, id, title, disabled = false) {
		const btn = document.createElement("button");
		btn.className = FrequencyChartCss.NAV_BTN;
		btn.textContent = icon;
		btn.id = id;
		btn.title = title;
		btn.disabled = disabled;
		return btn;
	}
	function build_header_row() {
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
	function build_chart_row(prev_btn, grid, next_btn) {
		const row = document.createElement("div");
		row.className = FrequencyChartCss.CHART_ROW;
		row.appendChild(prev_btn);
		row.appendChild(grid);
		row.appendChild(next_btn);
		return row;
	}
	function build_last_fetched_label() {
		const el = document.createElement("div");
		el.className = FrequencyChartCss.LAST_FETCHED;
		el.textContent = ui_state.last_fetched_time ? LAST_FETCHED_PREFIX + ui_state.last_fetched_time.toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
			second: "2-digit"
		}) : LAST_FETCHED_EMPTY;
		return el;
	}
	function build_day_cell(day_date, count, max_count, on_click) {
		const cell = document.createElement("div");
		cell.className = FrequencyChartCss.DAY;
		if (is_today(day_date)) cell.classList.add(FrequencyChartCss.DAY_TODAY);
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
		bar.style.height = (max_count === 0 ? 0 : count / max_count * 100) + "%";
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
	function update_week_label_text(chart_container, week_start) {
		const label = chart_container.querySelector(`#${FrequencyChartCss.WEEK_LABEL}`);
		if (label) label.textContent = format_week_label(week_start);
	}
	function update_nav_button_states(chart_container) {
		const prev_btn = chart_container.querySelector(`#${FrequencyChartCss.PREV_BTN_ID}`);
		const next_btn = chart_container.querySelector(`#${FrequencyChartCss.NEXT_BTN_ID}`);
		if (!prev_btn || !next_btn) return;
		prev_btn.disabled = chart_container._week_offset <= 0;
		next_btn.disabled = false;
	}
	function find_header_for_date(calendar_container, target_date) {
		const headers = Array.from(calendar_container.querySelectorAll(`.${CalendarCss.DATE_HEADER}`));
		for (const header of headers) {
			const match = (header.querySelector(`.${CalendarCss.DATE_TITLE}`)?.textContent ?? "").match(/(\w+)\s+(\d+)/);
			if (!match) continue;
			const month_index = MONTH_NAMES_SHORT.findIndex((m) => m.toLowerCase().startsWith(match[1].toLowerCase()));
			const day = parseInt(match[2]);
			if (month_index === target_date.getMonth() && day === target_date.getDate()) return header;
		}
		return null;
	}
	function compute_scroll_to_header(header, calendar_container) {
		const chart_el = calendar_container.querySelector(`#${FrequencyChartCss.CONTAINER_ID}`);
		const chart_height = chart_el ? chart_el.getBoundingClientRect().height : 0;
		const container_rect = calendar_container.getBoundingClientRect();
		const header_height = header.offsetHeight;
		const items_section = header.nextElementSibling;
		if (items_section) {
			const items_top = items_section.getBoundingClientRect().top - container_rect.top + calendar_container.scrollTop;
			return Math.max(0, items_top - header_height - chart_height);
		}
		const header_top = header.getBoundingClientRect().top - container_rect.top + calendar_container.scrollTop;
		return Math.max(0, header_top - chart_height);
	}
	function populate_week_grid(chart_container, items_by_date) {
		try {
			const grid = chart_container.querySelector(`#${FrequencyChartCss.GRID}`);
			if (!grid) return;
			grid.innerHTML = "";
			const week_start = compute_display_week_start(chart_container._today_week_start_ms, chart_container._week_offset);
			update_week_label_text(chart_container, week_start);
			const { counts, max } = count_incomplete_items_per_day(items_by_date, week_start);
			const calendar_container = chart_container._calendar_container;
			for (let i = 0; i < 7; i++) {
				const day_date = new Date(week_start);
				day_date.setDate(day_date.getDate() + i);
				const cell = build_day_cell(day_date, counts[i], max, () => scroll_to_date(calendar_container, day_date));
				grid.appendChild(cell);
			}
		} catch (e) {
			console.error("Error rendering frequency chart:", e);
		}
	}
	function scroll_to_date(calendar_container, target_date) {
		try {
			const header = find_header_for_date(calendar_container, target_date);
			if (!header) return;
			const scroll_target = compute_scroll_to_header(header, calendar_container);
			calendar_container.scrollTo({
				top: scroll_target,
				behavior: "smooth"
			});
		} catch (e) {
			console.error("Error scrolling to date:", e);
		}
	}
	function create_frequency_chart(calendar_container, items_by_date, initial_week_offset = 0) {
		const today_week_start = getWeekStart(/* @__PURE__ */ new Date());
		const chart_container = document.createElement("div");
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
	function scroll_to_today() {
		const calendar_container = document.getElementById(PanelCss.CALENDAR_CONTAINER_ID);
		if (calendar_container) scroll_to_date(calendar_container, /* @__PURE__ */ new Date());
	}
	//#endregion
	//#region src/ui/calendar.ts
	var AVAILABLE_ON_PREFIX = "Available on ";
	var CREATE_EMPTY_DAY_NOTICE = false;
	var NO_UPCOMING_ASSIGNMENTS = "No upcoming assignments";
	var META_SEPARATOR = "|";
	var COURSE_DOT_SYMBOL = "●";
	var COMPLETED_BADGE_SYMBOL = "✓";
	var INCOMPLETE_DOT_SYMBOL = "•";
	var FETCHING_STATUS_LABEL = " — Fetching...";
	var NO_DUE_DATE_TITLE = "No Due Date";
	var TYPE_LABEL_SINGULAR = {
		assignments: "Assignment",
		quizzes: "Quiz",
		discussions: "Discussion"
	};
	function collect_items_by_date(course_data) {
		const items_by_date = {};
		const no_date_items = [];
		let min_date = null;
		let max_date = null;
		Object.keys(course_data).forEach((course_id) => {
			const course = course_data[course_id];
			if (ui_state.hidden_course_ids.has(course_id)) return;
			[
				{
					items: course.assignments,
					type: "assignments"
				},
				{
					items: course.quizzes,
					type: "quizzes"
				},
				{
					items: course.discussions,
					type: "discussions"
				}
			].forEach(({ items, type }) => {
				if (ui_state.hidden_types.has(type)) return;
				if (!items) return;
				Object.keys(items).forEach((item_id) => {
					const item = items[item_id];
					if (item.completed && !ui_state.show_completed_items) return;
					if (!item.due_date) {
						if (ui_state.show_no_due_date_items) no_date_items.push({
							item,
							course,
							type
						});
						return;
					}
					const date_only = getDateOnly(item.due_date);
					if (!date_only) return;
					const date_key = date_only.toISOString().split("T")[0];
					if (!items_by_date[date_key]) items_by_date[date_key] = [];
					items_by_date[date_key].push({
						item,
						course
					});
					if (!min_date || date_only < min_date) min_date = date_only;
					if (!max_date || date_only > max_date) max_date = date_only;
				});
			});
		});
		return {
			items_by_date,
			min_date,
			max_date,
			no_date_items
		};
	}
	function get_due_time_color(due_date, completed, now_date_only) {
		const due_date_only = getDateOnly(due_date);
		if (!due_date_only) return null;
		if (!completed && due_date_only < now_date_only) return OVERDUE_COLOR;
		if (due_date_only.getTime() === now_date_only.getTime()) return DUE_TODAY_COLOR;
		const tomorrow = new Date(now_date_only);
		tomorrow.setDate(tomorrow.getDate() + 1);
		if (due_date_only.getTime() === tomorrow.getTime()) return DUE_TOMORROW_COLOR;
		return null;
	}
	function build_start_date_section(start_date) {
		const container = document.createElement("div");
		container.className = CalendarCss.START_DATE_CONTAINER;
		const value = document.createElement("span");
		value.className = CalendarCss.START_DATE_VALUE;
		value.textContent = AVAILABLE_ON_PREFIX + formatFullDatetime(start_date);
		container.appendChild(value);
		return container;
	}
	function build_course_label(course) {
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
	function build_due_date_section(item, course, now_date_only) {
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
	function build_item_meta(item, course, now_date_only) {
		const meta = document.createElement("div");
		meta.className = CalendarCss.ITEM_META;
		if (item.start_date) meta.appendChild(build_start_date_section(item.start_date));
		meta.appendChild(build_due_date_section(item, course, now_date_only));
		return meta;
	}
	function build_completion_badge(completed) {
		const badge = document.createElement("div");
		badge.className = completed ? CalendarCss.ITEM_COMPLETED_BADGE : CalendarCss.ITEM_INCOMPLETE_DOT;
		badge.textContent = completed ? COMPLETED_BADGE_SYMBOL : INCOMPLETE_DOT_SYMBOL;
		return badge;
	}
	function build_item_card(item, course) {
		const now_date_only = getDateOnly(/* @__PURE__ */ new Date());
		const start_date_only = item.start_date ? getDateOnly(item.start_date) : null;
		const is_not_yet_available = start_date_only !== null && start_date_only > now_date_only;
		const link = document.createElement("a");
		link.href = item.url ?? "";
		link.className = CalendarCss.ITEM;
		if (is_not_yet_available) link.classList.add(CalendarCss.ITEM_UNAVAILABLE);
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
	function build_no_due_date_meta(course) {
		const meta = document.createElement("div");
		meta.className = CalendarCss.ITEM_META;
		meta.appendChild(build_course_label(course));
		return meta;
	}
	function build_no_due_date_item_card(no_date_item) {
		const { item, course, type } = no_date_item;
		const type_label = TYPE_LABEL_SINGULAR[type] ?? type;
		const link = document.createElement("a");
		link.href = item.url ?? "";
		link.className = CalendarCss.ITEM;
		const name_el = document.createElement("div");
		name_el.className = CalendarCss.ITEM_NAME;
		name_el.textContent = `${type_label}: ${item.name}`;
		const content = document.createElement("div");
		content.className = CalendarCss.ITEM_CONTENT;
		content.appendChild(name_el);
		content.appendChild(build_no_due_date_meta(course));
		link.appendChild(content);
		link.appendChild(build_completion_badge(item.completed));
		return link;
	}
	function build_no_due_date_section(no_date_items) {
		const fragment = document.createDocumentFragment();
		const header = document.createElement("div");
		header.className = CalendarCss.DATE_HEADER;
		const title = document.createElement("div");
		title.className = CalendarCss.DATE_TITLE;
		title.textContent = NO_DUE_DATE_TITLE;
		header.appendChild(title);
		fragment.appendChild(header);
		const items_container = document.createElement("div");
		items_container.className = CalendarCss.ITEMS_CONTAINER;
		no_date_items.forEach((no_date_item) => items_container.appendChild(build_no_due_date_item_card(no_date_item)));
		fragment.appendChild(items_container);
		return fragment;
	}
	function build_date_section(date, items) {
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
		if (items.length === 0 && CREATE_EMPTY_DAY_NOTICE);
		else items.forEach(({ item, course }) => items_container.appendChild(build_item_card(item, course)));
		fragment.appendChild(items_container);
		return fragment;
	}
	function build_calendar_list(items_by_date, start_date, end_date, calendar_container) {
		const current_date = new Date(start_date);
		while (current_date <= end_date) {
			const day_items = items_by_date[current_date.toISOString().split("T")[0]] || [];
			calendar_container.appendChild(build_date_section(current_date, day_items));
			current_date.setDate(current_date.getDate() + 1);
		}
	}
	function show_empty_state(calendar_container) {
		calendar_container.parentElement?.querySelector(`.${CalendarCss.SCROLLBAR_INDICATOR}`)?.remove();
		const empty_message = document.createElement("div");
		empty_message.id = CalendarCss.EMPTY_STATE_ID;
		empty_message.textContent = NO_UPCOMING_ASSIGNMENTS;
		calendar_container.appendChild(empty_message);
	}
	function get_preserved_week_offset(calendar_container) {
		return calendar_container.querySelector(`#${FrequencyChartCss.CONTAINER_ID}`)?._week_offset ?? 0;
	}
	function build_scrollbar_notches(item_els, scroll_height) {
		const notches = [];
		item_els.forEach((item_el) => {
			const course_el = item_el.querySelector(`.${CalendarCss.ITEM_COURSE}`);
			const course_name = course_el?.dataset.fullName || course_el?.textContent || "";
			const percent_position = item_el.offsetTop / scroll_height * 100;
			const notch = document.createElement("div");
			notch.className = CalendarCss.SCROLLBAR_NOTCH;
			notch.style.top = percent_position + "%";
			notch.style.backgroundColor = getCourseColor(course_name);
			notch.title = course_name;
			notches.push(notch);
		});
		return notches;
	}
	function sync_scrollbar_indicator(calendar_container) {
		const indicator = calendar_container.parentElement?.querySelector(`.${CalendarCss.SCROLLBAR_INDICATOR}`);
		if (!indicator) return;
		const scroll_height = calendar_container.scrollHeight;
		const item_els = calendar_container.querySelectorAll(`.${CalendarCss.ITEM}`);
		indicator.querySelectorAll(`.${CalendarCss.SCROLLBAR_NOTCH}`).forEach((notch, index) => {
			if (index < item_els.length) notch.style.top = item_els[index].offsetTop / scroll_height * 100 + "%";
		});
	}
	function mount_scrollbar_indicator(calendar_container) {
		calendar_container.parentElement?.querySelector(`.${CalendarCss.SCROLLBAR_INDICATOR}`)?.remove();
		const item_els = calendar_container.querySelectorAll(`.${CalendarCss.ITEM}`);
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
	function initialize_gui() {
		update_gui({}, true);
	}
	function add_data_status_indicator(is_stale) {
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
	function update_gui(course_data, is_from_cache = false) {
		const calendar_container = document.getElementById(PanelCss.CALENDAR_CONTAINER_ID);
		if (!calendar_container) return;
		ui_state.last_course_data = course_data;
		ensureCourseColorsAssigned(course_data);
		update_settings_course_list(course_data);
		const preserved_week_offset = get_preserved_week_offset(calendar_container);
		calendar_container.innerHTML = "";
		const { items_by_date, min_date, max_date, no_date_items } = collect_items_by_date(course_data);
		try {
			create_frequency_chart(calendar_container, items_by_date, preserved_week_offset);
		} catch (e) {
			console.error("Error creating frequency chart (non-fatal):", e);
		}
		if (is_from_cache) add_data_status_indicator(true);
		if (!min_date || !max_date) {
			if (no_date_items.length === 0) {
				show_empty_state(calendar_container);
				return;
			}
		} else {
			const today = /* @__PURE__ */ new Date();
			const start_date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
			start_date.setDate(start_date.getDate() - ui_state.calendar_start_days_back);
			build_calendar_list(items_by_date, start_date, new Date(max_date), calendar_container);
		}
		if (no_date_items.length > 0) calendar_container.appendChild(build_no_due_date_section(no_date_items));
		mount_scrollbar_indicator(calendar_container);
	}
	function set_last_fetched_time(fetch_time) {
		ui_state.last_fetched_time = fetch_time;
	}
	function register_ui_callbacks({ on_refresh, on_rerender }) {
		ui_state.on_refresh = on_refresh;
		ui_state.on_rerender = on_rerender;
	}
	function apply_settings({ days_back, show_completed, show_no_due_date }) {
		ui_state.calendar_start_days_back = days_back;
		localStorage.setItem(CALENDAR_START_DAYS_BACK_STORAGE_KEY, days_back.toString());
		if (show_completed !== void 0) {
			ui_state.show_completed_items = show_completed;
			localStorage.setItem(SHOW_COMPLETED_STORAGE_KEY, show_completed.toString());
		}
		if (show_no_due_date !== void 0) {
			ui_state.show_no_due_date_items = show_no_due_date;
			localStorage.setItem(SHOW_NO_DUE_DATE_STORAGE_KEY, show_no_due_date.toString());
		}
		const days_input = document.getElementById(SettingsCss.DAYS_BACK_INPUT_ID);
		if (days_input) days_input.value = days_back.toString();
		const completed_toggle = document.getElementById(SettingsCss.SHOW_COMPLETED_INPUT_ID);
		if (completed_toggle) completed_toggle.checked = ui_state.show_completed_items;
		const no_due_date_toggle = document.getElementById(SettingsCss.SHOW_NO_DUE_DATE_INPUT_ID);
		if (no_due_date_toggle) no_due_date_toggle.checked = ui_state.show_no_due_date_items;
	}
	//#endregion
	//#region src/content.ts
	var COURSE_DATA_KEY = "courseData";
	var LAST_FETCHED_KEY = "spark-last-fetched";
	var SETTINGS_VALUE_KEY = "spark-user-settings";
	var SCROLL_POS_SESSION_KEY = "spark-scroll-pos";
	var SPARK_INITIALIZED_FLAG = "__spark_initialized__";
	var FETCH_COOLDOWN_MS = 300 * 1e3;
	var INTERACTION_DEBOUNCE_MS = 2e3;
	var SCROLL_SAVE_DEBOUNCE_MS = 300;
	var course_data = {};
	var calendar_container = null;
	var fetch_in_flight = false;
	var remote_fetch_in_flight = false;
	var last_fetch_completed_at = 0;
	var interaction_debounce_timer;
	var scroll_save_debounce;
	function fetch_and_store_courses() {
		if (fetch_in_flight) return;
		fetch_in_flight = true;
		add_data_status_indicator(true);
		safe_send_message({ action: Action.BROADCAST_FETCH_STARTED });
		safe_send_message({ action: Action.FETCH_COURSES }, on_fetch_response);
	}
	function on_fetch_response(response) {
		fetch_in_flight = false;
		if (!response) return;
		course_data = JSON.parse(JSON.stringify(response));
		const fetched_at = /* @__PURE__ */ new Date();
		set_last_fetched_time(fetched_at);
		chrome.storage.local.set({
			[COURSE_DATA_KEY]: course_data,
			[LAST_FETCHED_KEY]: fetched_at.toISOString()
		}, on_course_data_stored);
	}
	function on_course_data_stored() {
		last_fetch_completed_at = Date.now();
		update_gui(course_data, false);
		safe_send_message({ action: Action.BROADCAST_COURSE_DATA_UPDATED });
	}
	function rerender_with_cached_data() {
		if (course_data && Object.keys(course_data).length > 0) update_gui(course_data, fetch_in_flight || remote_fetch_in_flight);
	}
	function is_any_fetch_in_flight() {
		return fetch_in_flight || remote_fetch_in_flight;
	}
	function is_fetch_cooldown_active() {
		return Date.now() - last_fetch_completed_at < FETCH_COOLDOWN_MS;
	}
	function try_smart_fetch() {
		if (is_any_fetch_in_flight()) return;
		if (is_fetch_cooldown_active()) return;
		fetch_and_store_courses();
	}
	function on_page_interaction() {
		clearTimeout(interaction_debounce_timer);
		interaction_debounce_timer = setTimeout(try_smart_fetch, INTERACTION_DEBOUNCE_MS);
	}
	function on_tab_visibility_changed() {
		if (document.visibilityState === "visible") try_smart_fetch();
	}
	function save_scroll_position() {
		if (calendar_container) sessionStorage.setItem(SCROLL_POS_SESSION_KEY, calendar_container.scrollTop.toString());
	}
	function on_calendar_scroll() {
		clearTimeout(scroll_save_debounce);
		scroll_save_debounce = setTimeout(save_scroll_position, SCROLL_SAVE_DEBOUNCE_MS);
	}
	function restore_scroll_position() {
		const saved_scroll_top = parseInt(sessionStorage.getItem(SCROLL_POS_SESSION_KEY) || "0", 10);
		if (saved_scroll_top > 0) requestAnimationFrame(() => {
			if (calendar_container) calendar_container.scrollTop = saved_scroll_top;
		});
		else scroll_to_today();
	}
	function setup_scroll_persistence() {
		calendar_container.addEventListener("scroll", on_calendar_scroll);
	}
	function on_panel_restored() {
		chrome.storage.local.get([SETTINGS_VALUE_KEY], function(result) {
			if (result[SETTINGS_VALUE_KEY]) apply_settings(result[SETTINGS_VALUE_KEY]);
			if (course_data && Object.keys(course_data).length > 0) update_gui(course_data, fetch_in_flight || remote_fetch_in_flight);
		});
	}
	function on_initial_cache_loaded(result) {
		if (result[SETTINGS_VALUE_KEY]) apply_settings(result[SETTINGS_VALUE_KEY]);
		if (result[LAST_FETCHED_KEY]) set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
		if (result[COURSE_DATA_KEY]) {
			course_data = JSON.parse(JSON.stringify(result[COURSE_DATA_KEY]));
			update_gui(course_data, true);
			restore_scroll_position();
		}
	}
	function load_initial_cached_data() {
		chrome.storage.local.get([
			COURSE_DATA_KEY,
			LAST_FETCHED_KEY,
			SETTINGS_VALUE_KEY
		], on_initial_cache_loaded);
	}
	function register_smart_fetch_listeners() {
		document.addEventListener("visibilitychange", on_tab_visibility_changed);
		document.addEventListener("mousemove", on_page_interaction);
		window.addEventListener("scroll", on_page_interaction);
	}
	function on_page_ready() {
		window[SPARK_INITIALIZED_FLAG] = true;
		register_settings_panel_builder(build_settings_panel);
		update_settings_panel();
		calendar_container = inject_embedded_ui();
		initialize_gui();
		setup_scroll_persistence();
		register_panel_restore_callback(on_panel_restored);
		register_ui_callbacks({
			on_refresh: fetch_and_store_courses,
			on_rerender: rerender_with_cached_data
		});
		register_smart_fetch_listeners();
		load_initial_cached_data();
		fetch_and_store_courses();
	}
	function reload_open_tabs() {
		if (document.readyState === "complete") on_page_ready();
		else window.addEventListener("load", on_page_ready);
	}
	function on_message_fetch_started() {
		remote_fetch_in_flight = true;
		add_data_status_indicator(true);
	}
	function on_remote_course_data_loaded(result) {
		if (result[LAST_FETCHED_KEY]) set_last_fetched_time(new Date(result[LAST_FETCHED_KEY]));
		if (result[COURSE_DATA_KEY]) update_gui(JSON.parse(JSON.stringify(result[COURSE_DATA_KEY])), fetch_in_flight);
	}
	function on_message_course_data_updated() {
		remote_fetch_in_flight = false;
		chrome.storage.local.get([COURSE_DATA_KEY, LAST_FETCHED_KEY], on_remote_course_data_loaded);
	}
	function on_message_open_url(url) {
		window.open(url, "_blank");
	}
	function on_message_settings_changed(settings) {
		apply_settings(settings);
		rerender_with_cached_data();
	}
	function handle_background_message(request) {
		if (request.action === Action.FETCH_STARTED) on_message_fetch_started();
		if (request.action === Action.COURSE_DATA_UPDATED) on_message_course_data_updated();
		if (request.action === Action.OPEN_URL) on_message_open_url(request.url);
		if (request.action === Action.TOGGLE_PANEL) toggle_panel();
		if (request.action === Action.SETTINGS_CHANGED) on_message_settings_changed(request.settings);
	}
	function initialize() {
		chrome.runtime.onMessage.addListener(handle_background_message);
		reload_open_tabs();
	}
	initialize();
	//#endregion
})();
