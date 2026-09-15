// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

// Fetches and transforms course data from the Brightspace REST API into
// structured Course and Item objects consumed by the UI.

import type { CourseShape } from "../shared/types";
import { BrightspaceHtml } from "../shared/constants/ui";

export interface BrightspaceItem {
    OrgUnitId: number;
    ItemId: number;
    ItemName: string;
    ItemType?: number;
    ItemUrl?: string;
    StartDate?: string | null;
    DueDate?: string | null;
    EndDate?: string | null;
    DateCompleted?: string | null;
    ActivityType: number;
}

export interface BrightspaceCourseInfo {
    OrgUnit: { Id: number; Name: string; Type: { Id: number } };
    Access: { CanAccess: boolean; IsActive: boolean };
    HomeUrl: string;
}

export interface BrightspaceQuiz {
    QuizId: number;
    Name: string;
    DueDate?: string | null;
    EndDate?: string | null;
    StartDate?: string | null;
}

export interface BrightspaceAssignment {
    Id: number;
    Name: string;
    DueDate?: string | null;
    Availability?: { EndDate?: string | null; StartDate?: string | null };
}

export interface BrightspaceDiscussionTopic {
    TopicId: number;
    Name: string;
    EndDate?: string | null;
    StartDate?: string | null;
}

interface BrightspaceSubmission {
    Submissions: Array<{ Id: string | number }>;
}

interface BrightspaceDiscussionForum {
    ForumId: number;
}

interface BrightspacePost {
    PostingUserId: number;
}

interface PagedResponse<T> {
    Next: string | null;
    Objects: T[];
}

interface PaginatedResponse<T> {
    PagingInfo: { HasMoreItems: boolean; Bookmark: string };
    Items: T[];
}

// Must match OrgUnit.Type.Id for a standard course section in the Brightspace API
export const COURSE_ORG_UNIT_TYPE_ID = 3;

export const ActivityType = Object.freeze({
    DROPBOX: 3,
    QUIZ: 4,
    DISCUSSION: 5
});

const ApiVersion = Object.freeze({
    LP_ENROLLMENTS: "1.43",
    LP_WHOAMI: "1.49",
    LE_QUIZZES: "1.67",
    LE: "1.82",
});

class Course {
    id: number;
    name: string;
    url: string;
    quizzes: Record<string, Item>;
    assignments: Record<string, Item>;
    discussions: Record<string, Item>;

    constructor(id: number, name: string, url: string) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.quizzes = {};
        this.assignments = {};
        this.discussions = {};
    }
    addQuiz(item: Item): void {
        this.quizzes[item.id] = item;
    }
    addAssignment(item: Item): void {
        this.assignments[item.id] = item;
    }
    addDiscussion(item: Item): void {
        this.discussions[item.id] = item;
    }
}

class Item {
    id: number;
    name: string;
    url?: string | null;
    due_date?: string | null;
    start_date?: string | null;
    completed: boolean;

    constructor(id: number, name: string, url: string | undefined, due_date: string | null | undefined, completed: boolean, start_date: string | null = null) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.due_date = due_date;
        this.start_date = start_date;
        this.completed = completed;
    }
}

async function fetch_api_endpoint(base_url: string, endpoint: string): Promise<unknown[]> {
    try {
        const data = await fetch_paged_api_data(base_url + endpoint);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn(`Failed to fetch ${endpoint}:`, error);
        return [];
    }
}

async function fetch_quizzes(base_url: string, course_id: number): Promise<BrightspaceQuiz[]> {
    return fetch_api_endpoint(base_url, `/d2l/api/le/${ApiVersion.LE_QUIZZES}/${course_id}/quizzes/`) as Promise<BrightspaceQuiz[]>;
}

/*
Can get quiz available date by scraping quiz submission page.
Keep in case it's needed in the future
export async function get_quiz_available_date(base_url: string, quiz_id: number, org_id: number): Promise<Date | null> {
    const regex = /Available on\s+(.+?)(?=\suntil|$)/;
    try {
        const url = `${base_url}/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${quiz_id}&ou=${org_id}`;
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return null;
        const html = await response.text();

        const element_id_pattern = new RegExp(`id=["']${BrightspaceHtml.QUIZ_AVAILABLE_ELEMENT_ID}["'][^>]*>([^<]*)`);
        const element_match = html.match(element_id_pattern);
        if (element_match) {
            const completed_match = element_match[1].match(regex);
            if (completed_match) {
                return new Date(completed_match[1]);
            }
        }

        return null;
    } catch (error) {
        console.warn(`Failed to fetch available date for quiz ${quiz_id}:`, error);
        return null;
    }
}
*/

export async function get_quiz_attempt_count(base_url: string, quiz_id: number, org_id: number): Promise<number> {
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

async function fetch_assignments(base_url: string, course_id: number): Promise<BrightspaceAssignment[]> {
    return fetch_api_endpoint(base_url, `/d2l/api/le/${ApiVersion.LE}/${course_id}/dropbox/folders/`) as Promise<BrightspaceAssignment[]>;
}

export async function get_assignment_submissions(base_url: string, course_id: number, assignment_id: number): Promise<BrightspaceSubmission[]> {
    try {
        const submissions_url = `${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/dropbox/folders/${assignment_id}/submissions/`;
        const response = await fetch(submissions_url);
        const data = await response.json();

        if (!Array.isArray(data) && data.Errors) {
            return await get_assignment_submissions_from_history(base_url, course_id, assignment_id);
        }

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn(`Failed to fetch submissions for assignment ${assignment_id}:`, error);
        return [];
    }
}

// Fallback for when the submissions endpoint is closed: scrapes the submission
// history page and returns a synthetic entry if any submission rows are found.
export async function get_assignment_submissions_from_history(base_url: string, course_id: number, assignment_id: number): Promise<BrightspaceSubmission[]> {
    try {
        const history_url = `${base_url}/d2l/lms/dropbox/user/folders_history.d2l?db=${assignment_id}&grpid=0&isprv=0&bp=0&ou=${course_id}`;
        const response = await fetch(history_url, { credentials: "include" });
        if (!response.ok) return [];
        const html = await response.text();
        const has_submission = html.includes(`class="${BrightspaceHtml.SUBMISSION_ROW_CLASS}"`);
        return has_submission ? [{ Submissions: [{ Id: "history" }] }] : [];
    } catch (error) {
        console.warn(`Failed to fetch submission history for assignment ${assignment_id}:`, error);
        return [];
    }
}

async function fetch_topic_posts(base_url: string, course_id: number, forum_id: number, topic_id: number): Promise<BrightspacePost[]> {
    try {
        const posts_url = `${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/discussions/forums/${forum_id}/topics/${topic_id}/posts/`;
        const posts = await fetch_paged_api_data(posts_url);
        return Array.isArray(posts) ? posts as BrightspacePost[] : [];
    } catch (error) {
        console.warn(`Failed to fetch posts for topic ${topic_id}:`, error);
        return [];
    }
}

async function fetch_discussion_forums(base_url: string, course_id: number): Promise<BrightspaceDiscussionForum[]> {
    try {
        const forums_url = `${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/discussions/forums/`;
        const forums = await fetch_paged_api_data(forums_url);
        return Array.isArray(forums) ? forums as BrightspaceDiscussionForum[] : [];
    } catch (error) {
        console.warn(`Failed to fetch discussion forums for course ${course_id}:`, error);
        return [];
    }
}

async function fetch_discussion_topics(base_url: string, course_id: number, forum_id: number): Promise<BrightspaceDiscussionTopic[]> {
    try {
        const topics_url = `${base_url}/d2l/api/le/${ApiVersion.LE}/${course_id}/discussions/forums/${forum_id}/topics/`;
        const topics = await fetch_paged_api_data(topics_url);
        return Array.isArray(topics) ? topics as BrightspaceDiscussionTopic[] : [];
    } catch (error) {
        console.warn(`Failed to fetch discussion topics for course ${course_id}, forum ${forum_id}:`, error);
        return [];
    }
}

async function fetch_current_user_id(base_url: string): Promise<number | null> {
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

function extract_base_url(tab_url: string): string {
    const url = new URL(tab_url);
    return url.protocol + "//" + url.host;
}

export async function fetch_paged_api_data(url: string): Promise<unknown[]> {
    const response = await fetch(url);
    const data = await response.json();

    if ("Next" in data) {
        const paged = data as PagedResponse<unknown>;
        if (!paged.Next) {
            return paged.Objects;
        } else {
            return paged.Objects.concat(await fetch_paged_api_data(paged.Next));
        }
    }

    if ("PagingInfo" in data && data.PagingInfo && data.PagingInfo.HasMoreItems) {
        const paginated = data as PaginatedResponse<unknown>;
        const next_page_url = new URL(url);
        next_page_url.searchParams.set("bookmark", paginated.PagingInfo.Bookmark);
        const next_page_items = await fetch_paged_api_data(next_page_url.toString());
        return paginated.Items.concat(next_page_items);
    }

    if (Array.isArray(data)) {
        return data;
    }
    return data.Items || data.Object || data.Objects || [];
}

export function set_non_future_date_null(start_date: string | null | undefined): string | null {
    if (!start_date) return null;
    const start_date_obj = new Date(start_date);
    const now = new Date();
    const start_date_only = new Date(start_date_obj.getFullYear(), start_date_obj.getMonth(), start_date_obj.getDate());
    const now_only = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start_date_only <= now_only ? null : start_date;
}

async function fetch_active_courses(base_url: string): Promise<BrightspaceCourseInfo[]> {
    const courses_url = `${base_url}/d2l/api/lp/${ApiVersion.LP_ENROLLMENTS}/enrollments/myenrollments/`;
    const all_enrollments = await fetch_paged_api_data(courses_url);
    return (all_enrollments as BrightspaceCourseInfo[]).filter(function(course) {
        return course.Access.CanAccess && course.Access.IsActive && course.OrgUnit.Type.Id === COURSE_ORG_UNIT_TYPE_ID;
    });
}

export function build_courses_map(all_courses: BrightspaceCourseInfo[]): Record<string, Course> {
    const courses_map: Record<string, Course> = {};
    all_courses.forEach(function(course_data) {
        const course = new Course(
            course_data.OrgUnit.Id,
            course_data.OrgUnit.Name,
            course_data.HomeUrl
        );
        courses_map[course.id] = course;
    });
    return courses_map;
}

export function add_items_to_courses(courses_map: Record<string, Course>, all_items: BrightspaceItem[]): void {
    all_items.forEach(function(item_data) {
        const item = new Item(
            item_data.ItemId,
            item_data.ItemName,
            item_data.ItemUrl,
            item_data.DueDate || item_data.EndDate,
            !!item_data.DateCompleted,
            item_data.StartDate || null
        );

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
            default:
                console.warn(`Unused ActivityType: ${item_data.ActivityType}`);
        }
    });
}

export function build_course_data(all_courses: BrightspaceCourseInfo[], all_items: BrightspaceItem[]): Record<string, Course> {
    const courses_map = build_courses_map(all_courses);
    add_items_to_courses(courses_map, all_items);
    return courses_map;
}

export function build_quiz_item(base_url: string, course_id: number, quiz: BrightspaceQuiz, attempt_count: number, /*available_date: Date | null*/): BrightspaceItem {
    return {
        OrgUnitId: course_id,
        ItemId: quiz.QuizId,
        ItemName: quiz.Name,
        ItemType: ActivityType.QUIZ,
        ItemUrl: `${base_url}/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${course_id}&qi=${quiz.QuizId}&cfql=0`,
        StartDate: set_non_future_date_null(quiz.StartDate), //2026-05-05T10:00:00.000Z
        DueDate: quiz.DueDate || quiz.EndDate,
        ActivityType: ActivityType.QUIZ,
        DateCompleted: attempt_count > 0 ? new Date().toISOString() : null,
    };
}

export function build_assignment_item(base_url: string, course_id: number, assignment: BrightspaceAssignment, has_submission: boolean): BrightspaceItem {
    return {
        OrgUnitId: course_id,
        ItemId: assignment.Id,
        ItemName: assignment.Name,
        ItemType: ActivityType.DROPBOX,
        ItemUrl: `${base_url}/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${assignment.Id}&grpid=0&isprv=0&bp=0&ou=${course_id}`,
        StartDate: set_non_future_date_null(assignment.Availability?.StartDate),
        DueDate: assignment.DueDate || assignment.Availability?.EndDate,
        ActivityType: ActivityType.DROPBOX,
        DateCompleted: has_submission ? new Date().toISOString() : null,
    };
}

export function build_discussion_item(base_url: string, course_id: number, topic: BrightspaceDiscussionTopic, has_posted: boolean): BrightspaceItem {
    return {
        OrgUnitId: course_id,
        ItemId: topic.TopicId,
        ItemName: topic.Name,
        ItemType: ActivityType.DISCUSSION,
        ItemUrl: `${base_url}/d2l/le/${course_id}/discussions/topics/${topic.TopicId}/View`,
        StartDate: set_non_future_date_null(topic.StartDate),
        DueDate: topic.EndDate || topic.StartDate,
        ActivityType: ActivityType.DISCUSSION,
        DateCompleted: has_posted ? new Date().toISOString() : null,
    };
}

async function fetch_quiz_items_for_course(base_url: string, course: BrightspaceCourseInfo): Promise<BrightspaceItem[]> {
    const quizzes = await fetch_quizzes(base_url, course.OrgUnit.Id);
    const attempt_counts = await Promise.all(
        quizzes.map(quiz => get_quiz_attempt_count(base_url, quiz.QuizId, course.OrgUnit.Id))
    );
    /*
    const attempt_dates = await Promise.all(
        quizzes.map(quiz => get_quiz_available_date(base_url, quiz.QuizId, course.OrgUnit.Id))
    )
    */
    return quizzes.map((quiz, index) => build_quiz_item(base_url, course.OrgUnit.Id, quiz, attempt_counts[index], /*attempt_dates[index]*/));
}

async function fetch_assignment_items_for_course(base_url: string, course: BrightspaceCourseInfo): Promise<BrightspaceItem[]> {
    const assignments = await fetch_assignments(base_url, course.OrgUnit.Id);
    const all_submissions = await Promise.all(
        assignments.map(assignment => get_assignment_submissions(base_url, course.OrgUnit.Id, assignment.Id))
    );
    return assignments.map(function(assignment, index) {
        const has_submission = all_submissions[index].some(s => s.Submissions && s.Submissions.length > 0);
        return build_assignment_item(base_url, course.OrgUnit.Id, assignment, has_submission);
    });
}

async function fetch_discussion_items_for_course(base_url: string, course: BrightspaceCourseInfo, current_user_id: number | null): Promise<BrightspaceItem[]> {
    const forums = await fetch_discussion_forums(base_url, course.OrgUnit.Id);
    const all_items: BrightspaceItem[] = [];

    for (const forum of forums) {
        const topics = await fetch_discussion_topics(base_url, course.OrgUnit.Id, forum.ForumId);
        const all_posts = await Promise.all(
            topics.map(topic => fetch_topic_posts(base_url, course.OrgUnit.Id, forum.ForumId, topic.TopicId))
        );
        const discussion_items = topics.map(function(topic, index) {
            const has_posted = current_user_id !== null && all_posts[index].some(p => p.PostingUserId === current_user_id);
            return build_discussion_item(base_url, course.OrgUnit.Id, topic, has_posted);
        });
        all_items.push(...discussion_items);
    }

    return all_items;
}

async function fetch_items_for_course(base_url: string, course: BrightspaceCourseInfo, current_user_id: number | null): Promise<BrightspaceItem[]> {
    const quiz_items = await fetch_quiz_items_for_course(base_url, course);
    const assignment_items = await fetch_assignment_items_for_course(base_url, course);
    const discussion_items = await fetch_discussion_items_for_course(base_url, course, current_user_id);
    return [...quiz_items, ...assignment_items, ...discussion_items];
}

async function fetch_all_course_items(base_url: string, courses: BrightspaceCourseInfo[], current_user_id: number | null): Promise<BrightspaceItem[]> {
    const all_items: BrightspaceItem[] = [];
    for (const course of courses) {
        const course_items = await fetch_items_for_course(base_url, course, current_user_id);
        all_items.push(...course_items);
    }
    return all_items;
}

export async function get_course_content(tab_url: string): Promise<Record<string, CourseShape>> {
    const base_url = extract_base_url(tab_url);
    const all_courses = await fetch_active_courses(base_url);
    const current_user_id = await fetch_current_user_id(base_url);
    const all_items = await fetch_all_course_items(base_url, all_courses, current_user_id);
    return build_course_data(all_courses, all_items);
}


