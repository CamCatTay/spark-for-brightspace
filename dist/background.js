Object.freeze({
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
Object.freeze({
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
Object.freeze({
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
var BrightspaceHtml = Object.freeze({
	QUIZ_SUMMARY_ELEMENT_ID: "z_l",
	SUBMISSION_ROW_CLASS: "d_gn d_gt"
});
Object.freeze({
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
var ActivityType = Object.freeze({
	DROPBOX: 3,
	QUIZ: 4,
	DISCUSSION: 5
});
var ApiVersion = Object.freeze({
	LP_ENROLLMENTS: "1.43",
	LP_WHOAMI: "1.49",
	LE_QUIZZES: "1.67",
	LE: "1.82"
});
var Course = class {
	constructor(id, name, url) {
		this.id = id;
		this.name = name;
		this.url = url;
		this.quizzes = {};
		this.assignments = {};
		this.discussions = {};
	}
	addQuiz(item) {
		this.quizzes[item.id] = item;
	}
	addAssignment(item) {
		this.assignments[item.id] = item;
	}
	addDiscussion(item) {
		this.discussions[item.id] = item;
	}
};
var Item = class {
	constructor(id, name, url, due_date, completed, start_date = null) {
		this.id = id;
		this.name = name;
		this.url = url;
		this.due_date = due_date;
		this.start_date = start_date;
		this.completed = completed;
	}
};
async function fetch_api_endpoint(base_url, endpoint) {
	try {
		const data = await fetch_paged_api_data(base_url + endpoint);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		console.warn(`Failed to fetch ${endpoint}:`, error);
		return [];
	}
}
async function fetch_quizzes(base_url, course_id) {
	return fetch_api_endpoint(base_url, `/d2l/api/le/${ApiVersion.LE_QUIZZES}/${course_id}/quizzes/`);
}
async function get_quiz_attempt_count(base_url, quiz_id, org_id) {
	try {
		const url = `${base_url}/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${quiz_id}&ou=${org_id}`;
		const response = await fetch(url, { credentials: "include" });
		if (!response.ok) return 0;
		const html = await response.text();
		const element_id_pattern = new RegExp(`id=["']${BrightspaceHtml.QUIZ_SUMMARY_ELEMENT_ID}["'][^>]*>([^<]*)`);
		const element_match = html.match(element_id_pattern);
		if (element_match) {
			const completed_match = element_match[1].match(/Completed\s*-\s*(\d+)/);
			if (completed_match) return parseInt(completed_match[1], 10);
		}
		const fallback_match = html.match(/Completed\s*-\s*(\d+)/);
		if (fallback_match) return parseInt(fallback_match[1], 10);
		return 0;
	} catch (error) {
		console.warn(`Failed to fetch quiz attempt count for quiz ${quiz_id}:`, error);
		return 0;
	}
}
async function fetch_assignments(base_url, course_id) {
	return fetch_api_endpoint(base_url, `/d2l/api/le/${ApiVersion.LE}/${course_id}/dropbox/folders/`);
}
async function get_assignment_submissions(base_url, course_id, assignment_id) {
	try {
		const submissions_url = `${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/dropbox/folders/${assignment_id}/submissions/`;
		const data = await (await fetch(submissions_url)).json();
		if (!Array.isArray(data) && data.Errors) return await get_assignment_submissions_from_history(base_url, course_id, assignment_id);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		console.warn(`Failed to fetch submissions for assignment ${assignment_id}:`, error);
		return [];
	}
}
async function get_assignment_submissions_from_history(base_url, course_id, assignment_id) {
	try {
		const history_url = `${base_url}/d2l/lms/dropbox/user/folders_history.d2l?db=${assignment_id}&grpid=0&isprv=0&bp=0&ou=${course_id}`;
		const response = await fetch(history_url, { credentials: "include" });
		if (!response.ok) return [];
		return (await response.text()).includes(`class="${BrightspaceHtml.SUBMISSION_ROW_CLASS}"`) ? [{ Submissions: [{ Id: "history" }] }] : [];
	} catch (error) {
		console.warn(`Failed to fetch submission history for assignment ${assignment_id}:`, error);
		return [];
	}
}
async function fetch_topic_posts(base_url, course_id, forum_id, topic_id) {
	try {
		const posts = await fetch_paged_api_data(`${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/discussions/forums/${forum_id}/topics/${topic_id}/posts/`);
		return Array.isArray(posts) ? posts : [];
	} catch (error) {
		console.warn(`Failed to fetch posts for topic ${topic_id}:`, error);
		return [];
	}
}
async function fetch_discussion_forums(base_url, course_id) {
	try {
		const forums = await fetch_paged_api_data(`${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/discussions/forums/`);
		return Array.isArray(forums) ? forums : [];
	} catch (error) {
		console.warn(`Failed to fetch discussion forums for course ${course_id}:`, error);
		return [];
	}
}
async function fetch_discussion_topics(base_url, course_id, forum_id) {
	try {
		const topics = await fetch_paged_api_data(`${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/discussions/forums/${forum_id}/topics/`);
		return Array.isArray(topics) ? topics : [];
	} catch (error) {
		console.warn(`Failed to fetch discussion topics for course ${course_id}, forum ${forum_id}:`, error);
		return [];
	}
}
async function fetch_current_user_id(base_url) {
	try {
		const response = await fetch(`${base_url}/d2l/api/lp/${ApiVersion.LP_WHOAMI}/users/whoami`);
		if (!response.ok) return null;
		const data = await response.json();
		return parseInt(data.Identifier, 10);
	} catch (error) {
		console.warn("Failed to fetch current user ID:", error);
		return null;
	}
}
function extract_base_url(tab_url) {
	const url = new URL(tab_url);
	return url.protocol + "//" + url.host;
}
async function fetch_paged_api_data(url) {
	const data = await (await fetch(url)).json();
	if ("Next" in data) {
		const paged = data;
		if (!paged.Next) return paged.Objects;
		else return paged.Objects.concat(await fetch_paged_api_data(paged.Next));
	}
	if ("PagingInfo" in data && data.PagingInfo && data.PagingInfo.HasMoreItems) {
		const paginated = data;
		const next_page_url = new URL(url);
		next_page_url.searchParams.set("bookmark", paginated.PagingInfo.Bookmark);
		const next_page_items = await fetch_paged_api_data(next_page_url.toString());
		return paginated.Items.concat(next_page_items);
	}
	if (Array.isArray(data)) return data;
	return data.Items || data.Object || data.Objects || [];
}
function clear_past_start_date(start_date) {
	if (!start_date) return null;
	const start_date_obj = new Date(start_date);
	const now = /* @__PURE__ */ new Date();
	return new Date(start_date_obj.getFullYear(), start_date_obj.getMonth(), start_date_obj.getDate()) <= new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? null : start_date;
}
async function fetch_active_courses(base_url) {
	return (await fetch_paged_api_data(`${base_url}/d2l/api/lp/${ApiVersion.LP_ENROLLMENTS}/enrollments/myenrollments/`)).filter(function(course) {
		return course.Access.CanAccess && course.Access.IsActive && course.OrgUnit.Type.Id === 3;
	});
}
function build_courses_map(all_courses) {
	const courses_map = {};
	all_courses.forEach(function(course_data) {
		const course = new Course(course_data.OrgUnit.Id, course_data.OrgUnit.Name, course_data.HomeUrl);
		courses_map[course.id] = course;
	});
	return courses_map;
}
function add_items_to_courses(courses_map, all_items) {
	all_items.forEach(function(item_data) {
		const item = new Item(item_data.ItemId, item_data.ItemName, item_data.ItemUrl, item_data.DueDate || item_data.EndDate, !!item_data.DateCompleted, item_data.StartDate || null);
		const course = courses_map[item_data.OrgUnitId];
		if (!course) return;
		switch (item_data.ActivityType) {
			case ActivityType.DROPBOX:
				course.addAssignment(item);
				break;
			case ActivityType.QUIZ:
				course.addQuiz(item);
				break;
			case ActivityType.DISCUSSION:
				course.addDiscussion(item);
				break;
			default: console.warn(`Unused ActivityType: ${item_data.ActivityType}`);
		}
	});
}
function build_course_data(all_courses, all_items) {
	const courses_map = build_courses_map(all_courses);
	add_items_to_courses(courses_map, all_items);
	return courses_map;
}
function build_quiz_item(base_url, course_id, quiz, attempt_count) {
	return {
		OrgUnitId: course_id,
		ItemId: quiz.QuizId,
		ItemName: quiz.Name,
		ItemType: ActivityType.QUIZ,
		ItemUrl: `${base_url}/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${course_id}&qi=${quiz.QuizId}&cfql=0`,
		StartDate: clear_past_start_date(quiz.start_date),
		DueDate: quiz.DueDate || quiz.EndDate,
		ActivityType: ActivityType.QUIZ,
		DateCompleted: attempt_count > 0 ? (/* @__PURE__ */ new Date()).toISOString() : null
	};
}
function build_assignment_item(base_url, course_id, assignment, has_submission) {
	return {
		OrgUnitId: course_id,
		ItemId: assignment.Id,
		ItemName: assignment.Name,
		ItemType: ActivityType.DROPBOX,
		ItemUrl: `${base_url}/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${assignment.Id}&grpid=0&isprv=0&bp=0&ou=${course_id}`,
		StartDate: clear_past_start_date(assignment.Availability?.start_date),
		DueDate: assignment.DueDate || assignment.Availability?.EndDate,
		ActivityType: ActivityType.DROPBOX,
		DateCompleted: has_submission ? (/* @__PURE__ */ new Date()).toISOString() : null
	};
}
function build_discussion_item(base_url, course_id, topic, has_posted) {
	return {
		OrgUnitId: course_id,
		ItemId: topic.TopicId,
		ItemName: topic.Name,
		ItemType: ActivityType.DISCUSSION,
		ItemUrl: `${base_url}/d2l/le/${course_id}/discussions/topics/${topic.TopicId}/View`,
		StartDate: clear_past_start_date(topic.start_date),
		DueDate: topic.EndDate || topic.start_date,
		ActivityType: ActivityType.DISCUSSION,
		DateCompleted: has_posted ? (/* @__PURE__ */ new Date()).toISOString() : null
	};
}
async function fetch_quiz_items_for_course(base_url, course) {
	const quizzes = await fetch_quizzes(base_url, course.OrgUnit.Id);
	const attempt_counts = await Promise.all(quizzes.map((quiz) => get_quiz_attempt_count(base_url, quiz.QuizId, course.OrgUnit.Id)));
	return quizzes.map((quiz, index) => build_quiz_item(base_url, course.OrgUnit.Id, quiz, attempt_counts[index]));
}
async function fetch_assignment_items_for_course(base_url, course) {
	const assignments = await fetch_assignments(base_url, course.OrgUnit.Id);
	const all_submissions = await Promise.all(assignments.map((assignment) => get_assignment_submissions(base_url, course.OrgUnit.Id, assignment.Id)));
	return assignments.map(function(assignment, index) {
		const has_submission = all_submissions[index].some((s) => s.Submissions && s.Submissions.length > 0);
		return build_assignment_item(base_url, course.OrgUnit.Id, assignment, has_submission);
	});
}
async function fetch_discussion_items_for_course(base_url, course, current_user_id) {
	const forums = await fetch_discussion_forums(base_url, course.OrgUnit.Id);
	const all_items = [];
	for (const forum of forums) {
		const topics = await fetch_discussion_topics(base_url, course.OrgUnit.Id, forum.ForumId);
		const all_posts = await Promise.all(topics.map((topic) => fetch_topic_posts(base_url, course.OrgUnit.Id, forum.ForumId, topic.TopicId)));
		const discussion_items = topics.map(function(topic, index) {
			const has_posted = current_user_id !== null && all_posts[index].some((p) => p.PostingUserId === current_user_id);
			return build_discussion_item(base_url, course.OrgUnit.Id, topic, has_posted);
		});
		all_items.push(...discussion_items);
	}
	return all_items;
}
async function fetch_items_for_course(base_url, course, current_user_id) {
	const quiz_items = await fetch_quiz_items_for_course(base_url, course);
	const assignment_items = await fetch_assignment_items_for_course(base_url, course);
	const discussion_items = await fetch_discussion_items_for_course(base_url, course, current_user_id);
	return [
		...quiz_items,
		...assignment_items,
		...discussion_items
	];
}
async function fetch_all_course_items(base_url, courses, current_user_id) {
	const all_items = [];
	for (const course of courses) {
		const course_items = await fetch_items_for_course(base_url, course, current_user_id);
		all_items.push(...course_items);
	}
	return all_items;
}
async function get_course_content(tab_url) {
	const base_url = extract_base_url(tab_url);
	const all_courses = await fetch_active_courses(base_url);
	return build_course_data(all_courses, await fetch_all_course_items(base_url, all_courses, await fetch_current_user_id(base_url)));
}
//#endregion
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
//#endregion
//#region src/background.ts
var SETTINGS_VALUE_KEY = "spark-user-settings";
var FAQ_URL = "https://camcattay.github.io/spark-for-brightspace/faq.html";
var UNINSTALL_URL = "https://camcattay.github.io/spark-for-brightspace/uninstall.html";
var SPARK_INITIALIZED_FLAG = "__spark_initialized__";
var SESSION_INITIALIZED_KEY = "worker_initialized";
var CLIENT_ID_KEY = "spark-client-id";
function generate_client_id() {
	return crypto.randomUUID();
}
function store_client_id(client_id) {
	chrome.storage.local.set({ [CLIENT_ID_KEY]: client_id });
}
function handle_install(details) {
	if (details.reason !== "install") return;
	store_client_id(generate_client_id());
}
function is_d2l_tab(url) {
	return !!url && url.includes("/d2l/");
}
function broadcast_to_d2l_tabs(sender_tab_id, message) {
	chrome.tabs.query({}, function(tabs) {
		tabs.forEach((tab) => {
			if (tab.id !== sender_tab_id && is_d2l_tab(tab.url)) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
		});
	});
}
function handle_fetch_courses(sender, send_response) {
	get_course_content(sender.tab?.url ?? "").then(function(data) {
		send_response(data);
	});
	return true;
}
function handle_open_faq() {
	chrome.tabs.create({ url: FAQ_URL });
}
function handle_fetch_started(sender) {
	broadcast_to_d2l_tabs(sender.tab?.id, { action: Action.FETCH_STARTED });
}
function handle_course_data_updated(sender) {
	broadcast_to_d2l_tabs(sender.tab?.id, { action: Action.COURSE_DATA_UPDATED });
}
function save_settings(settings) {
	chrome.storage.local.set({ [SETTINGS_VALUE_KEY]: settings });
}
function handle_settings_changed(sender, settings) {
	save_settings(settings);
	broadcast_to_d2l_tabs(sender.tab?.id, {
		action: Action.SETTINGS_CHANGED,
		settings
	});
}
function handle_message(request, sender, send_response) {
	if (request.action === Action.FETCH_COURSES) return handle_fetch_courses(sender, send_response);
	if (request.action === Action.OPEN_FAQ) {
		handle_open_faq();
		return;
	}
	if (request.action === Action.BROADCAST_FETCH_STARTED) {
		handle_fetch_started(sender);
		return;
	}
	if (request.action === Action.BROADCAST_COURSE_DATA_UPDATED) {
		handle_course_data_updated(sender);
		return;
	}
	if (request.action === Action.BROADCAST_SETTINGS_CHANGED) {
		handle_settings_changed(sender, request.settings);
		return;
	}
}
function handle_icon_clicked(tab) {
	if (is_d2l_tab(tab.url)) chrome.tabs.sendMessage(tab.id, { action: Action.TOGGLE_PANEL });
}
function is_content_script_active(flag) {
	return window[flag] === true;
}
function inject_content_script(tab) {
	chrome.scripting.executeScript({
		target: { tabId: tab.id },
		func: is_content_script_active,
		args: [SPARK_INITIALIZED_FLAG]
	}).then((results) => {
		if (results && results[0] && results[0].result === true) return;
		chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ["/dist/content.js"]
		}).catch(() => {});
		chrome.scripting.insertCSS({
			target: { tabId: tab.id },
			files: ["/styles/sidepanel.css"]
		}).catch(() => {});
	}).catch(() => {});
}
function inject_into_open_d2l_tabs() {
	chrome.tabs.query({}, function(tabs) {
		tabs.filter((tab) => is_d2l_tab(tab.url)).forEach(inject_content_script);
	});
}
function initialize_worker_session() {
	chrome.storage.session.get([SESSION_INITIALIZED_KEY], (result) => {
		if (result[SESSION_INITIALIZED_KEY]) return;
		chrome.storage.session.set({ [SESSION_INITIALIZED_KEY]: true });
		inject_into_open_d2l_tabs();
	});
}
function initialize() {
	chrome.runtime.setUninstallURL(UNINSTALL_URL);
	chrome.runtime.onInstalled.addListener(handle_install);
	chrome.runtime.onMessage.addListener(handle_message);
	chrome.action.onClicked.addListener(handle_icon_clicked);
	initialize_worker_session();
}
initialize();
//#endregion
