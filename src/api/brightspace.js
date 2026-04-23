// Fetches and transforms course data from the Brightspace REST API into
// structured Course and Item objects consumed by the UI.

/**
 * @typedef {Object} BrightspaceItem
 * @property {string} OrgUnitId
 * @property {number} ItemId
 * @property {string} ItemName
 * @property {number} ItemType
 * @property {string} [ItemUrl]
 * @property {string} [StartDate]
 * @property {string} [DueDate]
 * @property {string} [DateCompleted]
 * @property {number} ActivityType
 */

const ActivityType = Object.freeze({
    DROPBOX: 3,
    QUIZ: 4,
    DISCUSSION: 5
});
class Course {
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
}

class Item {
    constructor(id, name, url, due_date, completed, start_date = null) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.due_date = due_date;
        this.start_date = start_date;
        this.completed = completed;
    }
}

// Fetch items from a Brightspace API endpoint for a specific course
async function fetch_course_data(base_url, endpoint) {
    try {
        const data = await get_brightspace_data(base_url + endpoint);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn(`Failed to fetch ${endpoint}:`, error);
        return [];
    }
}

// Fetch quizzes and tests for a specific course
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
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return 0;
        const html = await response.text();

        // Primary: extract inline text content of the element with id="z_l"
        const zl_element_match = html.match(/id=["']z_l["'][^>]*>([^<]*)/);
        if (zl_element_match) {
            const completed_match = zl_element_match[1].match(/Completed\s*-\s*(\d+)/);
            if (completed_match) return parseInt(completed_match[1], 10);
        }

        // Fallback: match "Completed - <N>" anywhere in the page body
        const fallback_match = html.match(/Completed\s*-\s*(\d+)/);
        if (fallback_match) return parseInt(fallback_match[1], 10);

        return 0;
    } catch (error) {
        console.warn(`Failed to fetch quiz attempt count for quiz ${quiz_id}:`, error);
        return 0;
    }
}

// Fetch assignments (contain dropbox folders) for a specific course
async function get_brightspace_assignments(base_url, course_id) {
    return fetch_course_data(base_url, `/d2l/api/le/1.82/${course_id}/dropbox/folders/`);
}

// Fetch submissions for a specific dropbox folder (assignment).
// If the API returns an error (e.g. professor closed the folder), falls back to
// scraping the submission history page and checking for any submission rows.
async function get_assignment_submissions(base_url, course_id, assignment_id) {
    try {
        const submissions_url = base_url + `/d2l/api/le/1.82/${course_id}/dropbox/folders/${assignment_id}/submissions/`;
        const response = await fetch(submissions_url);
        const data = await response.json();

        // API returned an error object (e.g. folder closed by professor)
        if (!Array.isArray(data) && data.Errors) {
            return await get_assignment_submissions_from_history(base_url, course_id, assignment_id);
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn(`Failed to fetch submissions for assignment ${assignment_id}:`, error);
        return [];
    }
}

// Fallback: scrape the submission history page and return a synthetic submissions
// array with one entry if any submission rows (td.d_gn.d_gt) are found.
async function get_assignment_submissions_from_history(base_url, course_id, assignment_id) {
    try {
        const history_url = base_url + `/d2l/lms/dropbox/user/folders_history.d2l?db=${assignment_id}&grpid=0&isprv=0&bp=0&ou=${course_id}`;
        const response = await fetch(history_url, { credentials: 'include' });
        if (!response.ok) return [];
        const html = await response.text();
        // If the history table has at least one data row the user submitted
        const has_submission = html.includes('class="d_gn d_gt"');
        return has_submission ? [{ Submissions: [{ Id: 'history' }] }] : [];
    } catch (error) {
        console.warn(`Failed to fetch submission history for assignment ${assignment_id}:`, error);
        return [];
    }
}

// Fetch posts for a specific discussion topic
async function get_discussion_topic_posts(base_url, course_id, forum_id, topic_id) {
    try {
        const posts_url = base_url + `/d2l/api/le/1.82/${course_id}/discussions/forums/${forum_id}/topics/${topic_id}/posts/`;
        const posts = await get_brightspace_data(posts_url);
        return Array.isArray(posts) ? posts : [];
    } catch (error) {
        console.warn(`Failed to fetch posts for topic ${topic_id}:`, error);
        return [];
    }
}

// Fetch discussion forums for a specific course
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

// Fetch discussion topics for a specific forum
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

// Get the current user's numeric ID
async function get_current_user_id(base_url) {
    try {
        const response = await fetch(base_url + '/d2l/api/lp/1.49/users/whoami');
        if (!response.ok) return null;
        const data = await response.json();
        return parseInt(data.Identifier, 10);
    } catch (error) {
        console.warn('Failed to fetch current user ID:', error);
        return null;
    }
}

// Fetches the base URL (protocol + host) from a full URL string (e.g. "https://example.com" )
async function get_base_url(tab_url) {
    const url = new URL(tab_url);
    return url.protocol + "//" + url.host;
}

// Fetches all pages of a paginated Brightspace API endpoint and returns the combined results.
async function get_brightspace_data(url) {
    const response = await fetch(url);
    const data = await response.json();

    if ("Next" in data) { // check if there is next page for course data
        if (!data.Next) {
            return data.Objects;
        } else {
            return data.Objects.concat(await get_brightspace_data(data.Next));
        }
    }
    else if ("PagingInfo" in data && data.PagingInfo && data.PagingInfo.HasMoreItems) { // check if there is next page for enrollment data
        const current_page = new URL(url);
        current_page.searchParams.set("bookmark", data.PagingInfo.Bookmark); //append ?bookmark=... for next page

        const next_page_items = await get_brightspace_data(current_page.toString());
        return data.Items.concat(next_page_items);
    }
    if (Array.isArray(data)) {
        return data;
    }
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
    const now = new Date();
    const start_date_only = new Date(start_date_obj.getFullYear(), start_date_obj.getMonth(), start_date_obj.getDate());
    const now_only = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start_date_only <= now_only ? null : start_date;
}

// Fetch active courses
async function get_brightspace_courses(base_url) {
    const courses_url = base_url + "/d2l/api/lp/1.43/enrollments/myenrollments/";
    const all_courses = await get_brightspace_data(courses_url);
    return all_courses.filter(function(course) {
        return course.Access.CanAccess && course.Access.IsActive && course.OrgUnit.Type.Id === 3;
    });
}

// Takes in processed course and item data, constructs Course objects with their associated items,
// and returns them as a structured collection of course data for easy querying
async function build_course_data(all_courses, all_items) {
    const course_data = {};

    // Iterate through courses and convert them into Course objects
    all_courses.forEach(courseData => {
        const course = new Course(
            courseData.OrgUnit.Id,
            courseData.OrgUnit.Name,
            courseData.HomeUrl
        );
        course_data[course.id] = course;

    });

    // Iterate through items and convert them into Item objects
    all_items.forEach(itemData => {
        const item = new Item(
            itemData.ItemId,
            itemData.ItemName,
            itemData.ItemUrl,
            itemData.DueDate || itemData.EndDate, // Use EndDate if DueDate is null
            !!itemData.DateCompleted, // Item is completed if DateCompleted exists
            itemData.StartDate || null // Start date when item becomes available
        );

        const course = course_data[itemData.OrgUnitId];

        // Add the item to the appropriate course map
        if (course) {
            switch (itemData.ActivityType) {
                case 3: // Assignment
                    course.addAssignment(item);
                    break;
                case 4: // Quiz
                    course.addQuiz(item);
                    break;
                case 5: // DiscussionForum
                    course.addDiscussion(item);
                    break;
                default:
                    console.warn(`Unused ActivityType: ${itemData.ActivityType}`);
            }
        }
    });

    // Return the processed data
    return course_data;
}

export async function get_course_content(tabUrl) {
    const base_url = await get_base_url(tabUrl);
    const all_courses = await get_brightspace_courses(base_url);
    const course_ids_csv = await all_courses.map(course => course.OrgUnit.Id).join(","); // e.g courseId1, courseId2, ...
    const current_user_id = await get_current_user_id(base_url);

    let course_items = [];

    // Fetch quizzes and assignments for each course and add them to course_items
    for (const course of all_courses) {

        const course_quizzes = await get_brightspace_quizzes(base_url, course.OrgUnit.Id);

        // Fetch attempt counts for all quizzes in this course in parallel
        // attempt count > 0 means the quiz has been completed at least once, so
        // we manually add a completion date causing the quiz to be marked completed in calendar
        const attempt_counts = await Promise.all(
            course_quizzes.map(quiz => get_quiz_attempt_count(base_url, quiz.QuizId, course.OrgUnit.Id))
        );

        const quiz_items = course_quizzes.map(function(quiz, index) {
            const attempt_count = attempt_counts[index];
            return {
                OrgUnitId: course.OrgUnit.Id,
                ItemId: quiz.QuizId,
                ItemName: quiz.Name,
                ItemType: ActivityType.QUIZ,
                ItemUrl: base_url + `/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${course.OrgUnit.Id}&qi=${quiz.QuizId}&cfql=0`,
                StartDate: clear_past_start_date(quiz.start_date),
                DueDate: quiz.DueDate || quiz.EndDate, // Use EndDate if DueDate is null
                ActivityType: ActivityType.QUIZ,
                DateCompleted: attempt_count > 0 ? new Date().toISOString() : null
            };
        });
        course_items = course_items.concat(quiz_items);

        const course_assignments = await get_brightspace_assignments(base_url, course.OrgUnit.Id);

        // Fetch submissions for all assignments in this course in parallel
        const assignment_submissions = await Promise.all(
            course_assignments.map(assignment => get_assignment_submissions(base_url, course.OrgUnit.Id, assignment.Id))
        );

        const assignment_items = course_assignments.map(function(assignment, index) {
            const submissions = assignment_submissions[index];
            const has_submission = submissions.some(s => s.Submissions && s.Submissions.length > 0);
            const item = {
                OrgUnitId: course.OrgUnit.Id,
                ItemId: assignment.Id,
                ItemName: assignment.Name,
                ItemType: ActivityType.DROPBOX,
                ItemUrl: base_url + `/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${assignment.Id}&grpid=0&isprv=0&bp=0&ou=${course.OrgUnit.Id}`,
                StartDate: clear_past_start_date(assignment.Availability?.start_date),
                DueDate: assignment.DueDate || assignment.Availability?.EndDate,
                ActivityType: ActivityType.DROPBOX,
                DateCompleted: has_submission ? new Date().toISOString() : null
            };
            return item;
        });
        course_items = course_items.concat(assignment_items);

        const discussion_forums = await get_brightspace_discussion_forums(base_url, course.OrgUnit.Id);

        for (const forum of discussion_forums) {
            const discussion_topics = await get_brightspace_discussion_topics(base_url, course.OrgUnit.Id, forum.ForumId);

            // Fetch posts for all topics in this forum in parallel
            const topic_posts = await Promise.all(
                discussion_topics.map(topic => get_discussion_topic_posts(base_url, course.OrgUnit.Id, forum.ForumId, topic.TopicId))
            );

            const discussion_items = discussion_topics.map(function(topic, index) {
                const posts = topic_posts[index];
                const has_posted = current_user_id !== null && posts.some(p => p.PostingUserId === current_user_id);
                const item = {
                    OrgUnitId: course.OrgUnit.Id,
                    ItemId: topic.TopicId,
                    ItemName: topic.Name,
                    ItemType: ActivityType.DISCUSSION,
                    ItemUrl: base_url + `/d2l/le/${course.OrgUnit.Id}/discussions/topics/${topic.TopicId}/View`,
                    StartDate: clear_past_start_date(topic.start_date),
                    DueDate: topic.EndDate || topic.start_date,
                    ActivityType: ActivityType.DISCUSSION,
                    DateCompleted: has_posted ? new Date().toISOString() : null
                };
                return item;
            });
            course_items = course_items.concat(discussion_items);
        }
    }

    const course_data = await build_course_data(all_courses, course_items);

    return course_data;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ActivityType,
        get_course_content,
        build_course_data,
        clear_past_start_date,
        get_brightspace_data,
        get_quiz_attempt_count,
        get_assignment_submissions,
        get_assignment_submissions_from_history,
    };
}
