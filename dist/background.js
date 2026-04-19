//#region \0rolldown/runtime.js
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
//#endregion
//#region src/api/brightspace.js
async function fetch_course_data(base_url, endpoint) {
	try {
		const data = await get_brightspace_data(base_url + endpoint);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		console.warn(`Failed to fetch ${endpoint}:`, error);
		return [];
	}
}
async function get_brightspace_quizzes(base_url, course_id) {
	return fetch_course_data(base_url, `/d2l/api/le/1.67/${course_id}/quizzes/`);
}
/**
* Fetches the number of completed attempts for a quiz from the quiz summary page.
* Reads the server-rendered HTML and extracts the count from the element with id="z_l".
* Falls back to regex matching anywhere in the page body.
* @param {string} base_url - The base URL of the Brightspace instance
* @param {number|string} quiz_id - The quiz ID (qi parameter)
* @param {number|string} org_id - The org unit ID (ou parameter)
* @returns {Promise<number>} The number of completed attempts, or 0 if not found
*/
async function get_quiz_attempt_count(base_url, quiz_id, org_id) {
	try {
		const url = `${base_url}/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${quiz_id}&ou=${org_id}`;
		const response = await fetch(url, { credentials: "include" });
		if (!response.ok) return 0;
		const html = await response.text();
		const zl_element_match = html.match(/id=["']z_l["'][^>]*>([^<]*)/);
		if (zl_element_match) {
			const completed_match = zl_element_match[1].match(/Completed\s*-\s*(\d+)/);
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
async function get_brightspace_assignments(base_url, course_id) {
	return fetch_course_data(base_url, `/d2l/api/le/1.82/${course_id}/dropbox/folders/`);
}
async function get_assignment_submissions(base_url, course_id, assignment_id) {
	try {
		const submissions_url = base_url + `/d2l/api/le/1.82/${course_id}/dropbox/folders/${assignment_id}/submissions/`;
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
		const history_url = base_url + `/d2l/lms/dropbox/user/folders_history.d2l?db=${assignment_id}&grpid=0&isprv=0&bp=0&ou=${course_id}`;
		const response = await fetch(history_url, { credentials: "include" });
		if (!response.ok) return [];
		return (await response.text()).includes("class=\"d_gn d_gt\"") ? [{ Submissions: [{ Id: "history" }] }] : [];
	} catch (error) {
		console.warn(`Failed to fetch submission history for assignment ${assignment_id}:`, error);
		return [];
	}
}
async function get_discussion_topic_posts(base_url, course_id, forum_id, topic_id) {
	try {
		const posts = await get_brightspace_data(base_url + `/d2l/api/le/1.82/${course_id}/discussions/forums/${forum_id}/topics/${topic_id}/posts/`);
		return Array.isArray(posts) ? posts : [];
	} catch (error) {
		console.warn(`Failed to fetch posts for topic ${topic_id}:`, error);
		return [];
	}
}
async function get_brightspace_discussion_forums(base_url, course_id) {
	const forums_url = base_url + `/d2l/api/le/1.82/${course_id}/discussions/forums/`;
	try {
		const forums = await get_brightspace_data(forums_url);
		return Array.isArray(forums) ? forums : [];
	} catch (error) {
		console.warn(`Failed to fetch discussion forums for course ${course_id}:`, error);
		return [];
	}
}
async function get_brightspace_discussion_topics(base_url, course_id, forum_id) {
	const topics_url = base_url + `/d2l/api/le/1.82/${course_id}/discussions/forums/${forum_id}/topics/`;
	try {
		const topics = await get_brightspace_data(topics_url);
		return Array.isArray(topics) ? topics : [];
	} catch (error) {
		console.warn(`Failed to fetch discussion topics for course ${course_id}, forum ${forum_id}:`, error);
		return [];
	}
}
async function get_current_user_id(base_url) {
	try {
		const response = await fetch(base_url + "/d2l/api/lp/1.49/users/whoami");
		if (!response.ok) return null;
		const data = await response.json();
		return parseInt(data.Identifier, 10);
	} catch (error) {
		console.warn("Failed to fetch current user ID:", error);
		return null;
	}
}
async function get_base_url(tab_url) {
	const url = new URL(tab_url);
	return url.protocol + "//" + url.host;
}
async function get_brightspace_data(url) {
	const data = await (await fetch(url)).json();
	if ("Next" in data) if (!data.Next) return data.Objects;
	else return data.Objects.concat(await get_brightspace_data(data.Next));
	else if ("PagingInfo" in data && data.PagingInfo && data.PagingInfo.HasMoreItems) {
		const current_page = new URL(url);
		current_page.searchParams.set("bookmark", data.PagingInfo.Bookmark);
		const next_page_items = await get_brightspace_data(current_page.toString());
		return data.Items.concat(next_page_items);
	}
	if (Array.isArray(data)) return data;
	return data.Items || data.Object || data.Objects || [];
}
/**
* Clears a start date if it's already in the past (item is already available).
* @param {string|null} start_date - ISO date string or null
* @returns {string|null} The original date if in the future, null if past or null
*/
function clear_past_start_date(start_date) {
	if (!start_date) return null;
	const start_date_obj = new Date(start_date);
	const now = /* @__PURE__ */ new Date();
	return new Date(start_date_obj.getFullYear(), start_date_obj.getMonth(), start_date_obj.getDate()) <= new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? null : start_date;
}
async function get_brightspace_courses(base_url) {
	return (await get_brightspace_data(base_url + "/d2l/api/lp/1.43/enrollments/myenrollments/")).filter(function(course) {
		return course.Access.CanAccess && course.Access.IsActive && course.OrgUnit.Type.Id === 3;
	});
}
async function build_course_data(all_courses, all_items) {
	const course_data = {};
	all_courses.forEach((courseData) => {
		const course = new Course(courseData.OrgUnit.Id, courseData.OrgUnit.Name, courseData.HomeUrl);
		course_data[course.id] = course;
	});
	all_items.forEach((itemData) => {
		const item = new Item(itemData.ItemId, itemData.ItemName, itemData.ItemUrl, itemData.DueDate || itemData.EndDate, !!itemData.DateCompleted, itemData.StartDate || null);
		const course = course_data[itemData.OrgUnitId];
		if (course) switch (itemData.ActivityType) {
			case 3:
				course.addAssignment(item);
				break;
			case 4:
				course.addQuiz(item);
				break;
			case 5:
				course.addDiscussion(item);
				break;
			default: console.warn(`Unused ActivityType: ${itemData.ActivityType}`);
		}
	});
	return course_data;
}
async function get_course_content(tabUrl) {
	const base_url = await get_base_url(tabUrl);
	const all_courses = await get_brightspace_courses(base_url);
	await all_courses.map((course) => course.OrgUnit.Id).join(",");
	const current_user_id = await get_current_user_id(base_url);
	let course_items = [];
	for (const course of all_courses) {
		const course_quizzes = await get_brightspace_quizzes(base_url, course.OrgUnit.Id);
		const attempt_counts = await Promise.all(course_quizzes.map((quiz) => get_quiz_attempt_count(base_url, quiz.QuizId, course.OrgUnit.Id)));
		const quiz_items = course_quizzes.map(function(quiz, index) {
			const attempt_count = attempt_counts[index];
			return {
				OrgUnitId: course.OrgUnit.Id,
				ItemId: quiz.QuizId,
				ItemName: quiz.Name,
				ItemType: ActivityType.QUIZ,
				ItemUrl: base_url + `/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${course.OrgUnit.Id}&qi=${quiz.QuizId}&cfql=0`,
				StartDate: clear_past_start_date(quiz.start_date),
				DueDate: quiz.DueDate || quiz.EndDate,
				ActivityType: ActivityType.QUIZ,
				DateCompleted: attempt_count > 0 ? (/* @__PURE__ */ new Date()).toISOString() : null
			};
		});
		course_items = course_items.concat(quiz_items);
		const course_assignments = await get_brightspace_assignments(base_url, course.OrgUnit.Id);
		const assignment_submissions = await Promise.all(course_assignments.map((assignment) => get_assignment_submissions(base_url, course.OrgUnit.Id, assignment.Id)));
		const assignment_items = course_assignments.map(function(assignment, index) {
			const has_submission = assignment_submissions[index].some((s) => s.Submissions && s.Submissions.length > 0);
			return {
				OrgUnitId: course.OrgUnit.Id,
				ItemId: assignment.Id,
				ItemName: assignment.Name,
				ItemType: ActivityType.DROPBOX,
				ItemUrl: base_url + `/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${assignment.Id}&grpid=0&isprv=0&bp=0&ou=${course.OrgUnit.Id}`,
				StartDate: clear_past_start_date(assignment.Availability?.start_date),
				DueDate: assignment.DueDate || assignment.Availability?.EndDate,
				ActivityType: ActivityType.DROPBOX,
				DateCompleted: has_submission ? (/* @__PURE__ */ new Date()).toISOString() : null
			};
		});
		course_items = course_items.concat(assignment_items);
		const discussion_forums = await get_brightspace_discussion_forums(base_url, course.OrgUnit.Id);
		for (const forum of discussion_forums) {
			const discussion_topics = await get_brightspace_discussion_topics(base_url, course.OrgUnit.Id, forum.ForumId);
			const topic_posts = await Promise.all(discussion_topics.map((topic) => get_discussion_topic_posts(base_url, course.OrgUnit.Id, forum.ForumId, topic.TopicId)));
			const discussion_items = discussion_topics.map(function(topic, index) {
				const posts = topic_posts[index];
				const has_posted = current_user_id !== null && posts.some((p) => p.PostingUserId === current_user_id);
				return {
					OrgUnitId: course.OrgUnit.Id,
					ItemId: topic.TopicId,
					ItemName: topic.Name,
					ItemType: ActivityType.DISCUSSION,
					ItemUrl: base_url + `/d2l/le/${course.OrgUnit.Id}/discussions/topics/${topic.TopicId}/View`,
					StartDate: clear_past_start_date(topic.start_date),
					DueDate: topic.EndDate || topic.start_date,
					ActivityType: ActivityType.DISCUSSION,
					DateCompleted: has_posted ? (/* @__PURE__ */ new Date()).toISOString() : null
				};
			});
			course_items = course_items.concat(discussion_items);
		}
	}
	return await build_course_data(all_courses, course_items);
}
var ActivityType, Course, Item;
var init_brightspace = __esmMin((() => {
	ActivityType = Object.freeze({
		DROPBOX: 3,
		QUIZ: 4,
		DISCUSSION: 5
	});
	Course = class {
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
	Item = class {
		constructor(id, name, url, due_date, completed, start_date = null) {
			this.id = id;
			this.name = name;
			this.url = url;
			this.due_date = due_date;
			this.start_date = start_date;
			this.completed = completed;
		}
	};
	if (typeof module !== "undefined" && module.exports) module.exports = {
		ActivityType,
		get_course_content,
		build_course_data,
		clear_past_start_date,
		get_brightspace_data,
		get_quiz_attempt_count,
		get_assignment_submissions,
		get_assignment_submissions_from_history
	};
}));
//#endregion
//#region src/shared/actions.js
var Action;
var init_actions = __esmMin((() => {
	Action = Object.freeze({
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
}));
//#endregion
//#region src/background.js
var require_background = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	init_brightspace();
	init_actions();
	var SCROLL_POS_KEY = "spark-scroll-pos";
	var ACTIVE_TAB_KEY = "spark-active-panel-tab";
	var SETTINGS_OPEN_KEY = "spark-settings-open";
	var SETTINGS_VALUE_KEY = "spark-user-settings";
	var D2L_URL_FILTER = "/d2l/";
	var FAQ_URL = "https://camcattay.github.io/spark-for-brightspace/faq.html";
	function broadcast_to_d2l_tabs(sender_tab_id, message) {
		chrome.tabs.query({}, function(tabs) {
			tabs.forEach((tab) => {
				if (tab.id !== sender_tab_id && tab.url && tab.url.includes(D2L_URL_FILTER)) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
			});
		});
	}
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (request.action === Action.FETCH_COURSES) {
			get_course_content(sender.tab.url).then(function(data) {
				sendResponse(data);
			});
			return true;
		}
		if (request.action === Action.OPEN_FAQ) {
			chrome.tabs.create({ url: FAQ_URL });
			return;
		}
		if (request.action === Action.PANEL_OPENED) {
			const active_tab_id = sender.tab.id;
			chrome.storage.local.set({ [ACTIVE_TAB_KEY]: active_tab_id });
			broadcast_to_d2l_tabs(active_tab_id, { action: Action.CLOSE_PANEL });
			return;
		}
		if (request.action === Action.PANEL_CLOSED) {
			chrome.storage.local.get([ACTIVE_TAB_KEY], function(result) {
				if (result[ACTIVE_TAB_KEY] === sender.tab.id) chrome.storage.local.remove(ACTIVE_TAB_KEY);
			});
			return;
		}
		if (request.action === Action.SAVE_SCROLL_POSITION) {
			chrome.storage.local.set({ [SCROLL_POS_KEY]: request.position });
			return;
		}
		if (request.action === Action.GET_SCROLL_POSITION) {
			chrome.storage.local.get([SCROLL_POS_KEY], function(result) {
				sendResponse({ position: result[SCROLL_POS_KEY] || 0 });
			});
			return true;
		}
		if (request.action === Action.BROADCAST_FETCH_STARTED) {
			broadcast_to_d2l_tabs(sender.tab.id, { action: Action.FETCH_STARTED });
			return;
		}
		if (request.action === Action.BROADCAST_COURSE_DATA_UPDATED) {
			broadcast_to_d2l_tabs(sender.tab.id, { action: Action.COURSE_DATA_UPDATED });
			return;
		}
		if (request.action === Action.BROADCAST_SETTINGS_CHANGED) {
			chrome.storage.local.set({ [SETTINGS_VALUE_KEY]: request.settings });
			broadcast_to_d2l_tabs(sender.tab.id, {
				action: Action.SETTINGS_CHANGED,
				settings: request.settings
			});
			return;
		}
		if (request.action === Action.BROADCAST_SETTINGS_OPENED) {
			chrome.storage.local.set({ [SETTINGS_OPEN_KEY]: true });
			broadcast_to_d2l_tabs(sender.tab.id, { action: Action.SETTINGS_OPENED });
			return;
		}
		if (request.action === Action.BROADCAST_SETTINGS_CLOSED) {
			chrome.storage.local.set({ [SETTINGS_OPEN_KEY]: false });
			broadcast_to_d2l_tabs(sender.tab.id, { action: Action.SETTINGS_CLOSED });
			return;
		}
	});
	chrome.action.onClicked.addListener((tab) => {
		if (tab.url && tab.url.includes(D2L_URL_FILTER)) chrome.tabs.sendMessage(tab.id, { action: Action.TOGGLE_PANEL });
	});
	if (typeof module !== "undefined" && module.exports) module.exports = {
		SCROLL_POS_KEY,
		ACTIVE_TAB_KEY,
		SETTINGS_OPEN_KEY,
		SETTINGS_VALUE_KEY,
		D2L_URL_FILTER,
		FAQ_URL
	};
}));
//#endregion
export default require_background();
