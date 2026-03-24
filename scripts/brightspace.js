/**
 * @typedef {Object} BrightspaceItem
 * @property {string} UserId
 * @property {string} OrgUnitId
 * @property {number} ItemId
 * @property {string} ItemName
 * @property {number} ItemType
 * @property {string} [ItemUrl]
 * @property {string} [StartDate]
 * @property {string} [EndDate]
 * @property {string} [DueDate]
 * @property {number} CompletionType
 * @property {string} [DateCompleted]
 * @property {number} ActivityType
 * @property {boolean} IsExempt
 */

import { getTestCourseContent } from './brightspace-test-data.js';

// TEST MODE: Set to true to use fake course data for testing
const TEST_MODE = false;

class Course {
    constructor(id, name, url) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.files = {};
        this.quizzes = {};
        this.assignments = {};
        this.discussions = {};
        this.checklist = {};
    }
    addFile(item) {
        this.files[item.id] = item;
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
    addChecklist(item) {
        this.checklist[item.id] = item;
    }
}

class Item {
    constructor(id, name, url, dueDate, completed, startDate = null) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.dueDate = dueDate;
        this.startDate = startDate;
        this.completed = completed;
    }
}

export async function getBaseURL(tabUrl) {
    const url = new URL(tabUrl);
    return url.protocol + "//" + url.host;
}

export async function getBrightspaceData(url) {
    const response = await fetch(url);
    const data = await response.json();

    if ("Next" in data) { // check if there is next page for course data
        if (!data.Next) {
            return data.Objects;
        } else {
            return data.Objects.concat(await getBrightspaceData(data.Next));
        }
    }
    else if ("PagingInfo" in data && data.PagingInfo && data.PagingInfo.HasMoreItems) { // check if there is next page for enrollment data
        const currentPage = new URL(url);
        currentPage.searchParams.set("bookmark", data.PagingInfo.Bookmark); //append ?bookmark=... for next page

        const nextPageItems = await getBrightspaceData(currentPage.toString());
        return data.Items.concat(nextPageItems);
    }
    if (Array.isArray(data)) {
        return data;
    }
    return data.Items || data.Object || data.Objects || [];
}

// yeah .join was better approach. benchmarked both and this is nearly 2x faster
export async function getCourseIds(courses) {
    return courses.map(
        function(course) {
            return course.OrgUnit.Id
        }).join(",");
}

/**
 * Clears a start date if it's already in the past (item is already available).
 * @param {string|null} startDate - ISO date string or null
 * @returns {string|null} The original date if in the future, null if past or null
 */
function clearPastStartDate(startDate) {
    if (!startDate) return null;
    const startDateObj = new Date(startDate);
    const now = new Date();
    const startDateOnly = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startDateOnly <= nowOnly ? null : startDate;
}

// utility for getCourseContent
export async function getBrightspaceCourses(baseURL) {
    const coursesURL = baseURL + "/d2l/api/lp/1.43/enrollments/myenrollments/";
    const allCourses = await getBrightspaceData(coursesURL);
    return allCourses.filter(function(course) {
        return course.Access.CanAccess && course.Access.IsActive && course.OrgUnit.Type.Id === 3;
    });
}

// Fetch quizzes and tests for a specific course
export async function getBrightspaceQuizzes(baseURL, courseId) {
    const quizzesURL = baseURL + `/d2l/api/le/1.67/${courseId}/quizzes/`;
    try {
        const quizzes = await getBrightspaceData(quizzesURL);
        return Array.isArray(quizzes) ? quizzes : [];
    } catch (error) {
        console.warn(`Failed to fetch quizzes for course ${courseId}:`, error);
        return [];
    }
}

// Fetch assignments (dropbox folders) for a specific course
export async function getBrightspaceAssignments(baseURL, courseId) {
    const assignmentsURL = baseURL + `/d2l/api/le/1.82/${courseId}/dropbox/folders/`;
    try {
        const assignments = await getBrightspaceData(assignmentsURL);
        return Array.isArray(assignments) ? assignments : [];
    } catch (error) {
        console.warn(`Failed to fetch assignments for course ${courseId}:`, error);
        return [];
    }
}

// Fetch discussion forums for a specific course
export async function getBrightspaceDiscussionForums(baseURL, courseId) {
    const forumsURL = baseURL + `/d2l/api/le/1.82/${courseId}/discussions/forums/`;
    try {
        const forums = await getBrightspaceData(forumsURL);
        return Array.isArray(forums) ? forums : [];
    } catch (error) {
        console.warn(`Failed to fetch discussion forums for course ${courseId}:`, error);
        return [];
    }
}

// Fetch discussion topics for a specific forum
export async function getBrightspaceDiscussionTopics(baseURL, courseId, forumId) {
    const topicsURL = baseURL + `/d2l/api/le/1.82/${courseId}/discussions/forums/${forumId}/topics/`;
    try {
        const topics = await getBrightspaceData(topicsURL);
        return Array.isArray(topics) ? topics : [];
    } catch (error) {
        console.warn(`Failed to fetch discussion topics for course ${courseId}, forum ${forumId}:`, error);
        return [];
    }
}


export async function getCourseContent(tabUrl) {
    // Return fake data if in test mode
    if (TEST_MODE) {
        return getTestCourseContent(mapData);
    }

    const baseURL = await getBaseURL(tabUrl);
    const allCourses = await getBrightspaceCourses(baseURL);
    const courseIdsCSV = await getCourseIds(allCourses);

    // Increase the date range by 1 day on either side to account for time zone differences
    let startDate = new Date(allCourses[0].Access.StartDate);
    let endDate = new Date(allCourses[0].Access.EndDate);

    startDate.setDate(startDate.getDate() - 1); // Subtract 1 day from the start date
    endDate.setDate(endDate.getDate() + 1); // Add 1 day to the end date

    const nonGradedItemsUrl = baseURL +
    "/d2l/api/le/1.67/content/myItems/?startDateTime=null&endDateTime=null&orgUnitIdsCSV=" +
    courseIdsCSV;

    const gradedItemsUrl = baseURL +
    "/d2l/api/le/1.67/content/myItems/?startDateTime=" +
    startDate +
    "&endDateTime=" +
    endDate +
    "&orgUnitIdsCSV=" +
    courseIdsCSV;

    const gradedItems = await getBrightspaceData(gradedItemsUrl);
    let nonGradedItems = await getBrightspaceData(nonGradedItemsUrl);
    nonGradedItems = nonGradedItems.filter(function(item) {
        return item.ActivityType === 1;
    });

    // Filter out quizzes (ActivityType 4), assignments (ActivityType 3), and discussions (ActivityType 5) from both lists - we'll fetch them separately
    const filteredGradedItems = gradedItems.filter(function(item) {
        return item.ActivityType !== 4 && item.ActivityType !== 3 && item.ActivityType !== 5;
    });

    let courseItems = filteredGradedItems.concat(nonGradedItems);

    // Fetch quizzes and assignments for each course and add them to courseItems
    for (const course of allCourses) {
        const courseQuizzes = await getBrightspaceQuizzes(baseURL, course.OrgUnit.Id);
        const quizItems = courseQuizzes.map(function(quiz) {
            return {
                UserId: course.UserId,
                OrgUnitId: course.OrgUnit.Id,
                ItemId: quiz.QuizId,
                ItemName: quiz.Name,
                ItemType: 4, // Quiz
                ItemUrl: baseURL + `/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${course.OrgUnit.Id}&qi=${quiz.QuizId}&cfql=0`,
                StartDate: clearPastStartDate(quiz.StartDate),
                EndDate: quiz.EndDate,
                DueDate: quiz.DueDate || quiz.EndDate, // Use EndDate if DueDate is null
                CompletionType: 1,
                ActivityType: 4, // Quiz
                IsExempt: false
            };
        });
        courseItems = courseItems.concat(quizItems);

        const courseAssignments = await getBrightspaceAssignments(baseURL, course.OrgUnit.Id);
        
        const assignmentItems = courseAssignments.map(function(assignment) {
            const item = {
                UserId: course.UserId,
                OrgUnitId: course.OrgUnit.Id,
                ItemId: assignment.Id,
                ItemName: assignment.Name,
                ItemType: 3, // Assignment
                ItemUrl: baseURL + `/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${assignment.Id}&grpid=0&isprv=0&bp=0&ou=${course.OrgUnit.Id}`,
                StartDate: clearPastStartDate(assignment.Availability?.StartDate),
                EndDate: assignment.Availability?.EndDate,
                DueDate: assignment.DueDate || assignment.Availability?.EndDate,
                CompletionType: assignment.CompletionType,
                ActivityType: 3, // Assignment
                IsExempt: false
            };
            return item;
        });
        courseItems = courseItems.concat(assignmentItems);

        const discussionForums = await getBrightspaceDiscussionForums(baseURL, course.OrgUnit.Id);
        
        for (const forum of discussionForums) {
            const discussionTopics = await getBrightspaceDiscussionTopics(baseURL, course.OrgUnit.Id, forum.ForumId);
            
            const discussionItems = discussionTopics.map(function(topic) {
                const item = {
                    UserId: course.UserId,
                    OrgUnitId: course.OrgUnit.Id,
                    ItemId: topic.TopicId,
                    ItemName: topic.Name,
                    ItemType: 5, // Discussion
                    ItemUrl: baseURL + `/d2l/le/${course.OrgUnit.Id}/discussions/topics/${topic.TopicId}/View`,
                    StartDate: clearPastStartDate(topic.StartDate),
                    EndDate: topic.EndDate,
                    DueDate: topic.EndDate || topic.StartDate,
                    CompletionType: 0,
                    ActivityType: 5, // Discussion
                    IsExempt: false
                };
                return item;
            });
            courseItems = courseItems.concat(discussionItems);
        }
    }

    const courseMap = await mapData(allCourses, courseItems);

    return courseMap;
}

export async function mapData(courses, items) {
    const courseMap = {};

    // Iterate through courses and convert them into Course objects
    courses.forEach(courseData => {
        const course = new Course(
            courseData.OrgUnit.Id,
            courseData.OrgUnit.Name,
            courseData.HomeUrl
        );
        courseMap[course.id] = course;

    });

    // Iterate through items and convert them into Item objects
    items.forEach(itemData => {
        const item = new Item(
            itemData.ItemId,
            itemData.ItemName,
            itemData.ItemUrl,
            itemData.DueDate || itemData.EndDate, // Use EndDate if DueDate is null
            !!itemData.DateCompleted, // Item is completed if DateCompleted exists
            itemData.StartDate || null // Start date when item becomes available
        );

        const course = courseMap[itemData.OrgUnitId];

        // Add the item to the appropriate course map
        if (course) {
            switch (itemData.ActivityType) {
                case 1: // File
                    course.addFile(item);
                    break;
                case 3: // Assignment
                    course.addAssignment(item);
                    break;
                case 4: // Quiz
                    course.addQuiz(item);
                    break;
                case 5: // DiscussionForum
                    course.addDiscussion(item);
                    break;
                case 10: // Checklist
                    course.addChecklist(item);
                    break;
                default:
                    console.warn(`Unused ActivityType: ${itemData.ActivityType}`);
            }
        }
    });

    // Return the processed data
    return courseMap;
}
