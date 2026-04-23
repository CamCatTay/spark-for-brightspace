// Internal functions are exposed via the module.exports compat block at the bottom of the source.

let brightspace;
let ActivityType;

// Simulates a fetch response that returns JSON (no .ok check needed by caller)
function mock_json(data) {
    return { json: jest.fn().mockResolvedValue(data) };
}

// Simulates a fetch response that exposes both .ok and .json() (e.g. whoami)
function mock_json_ok(data, ok = true) {
    return { ok, json: jest.fn().mockResolvedValue(data) };
}

// Simulates a fetch response that exposes both .ok and .text() (e.g. quiz summary, history page)
function mock_text(html, ok = true) {
    return { ok, text: jest.fn().mockResolvedValue(html) };
}

beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    brightspace   = require('../src/api/brightspace.js');
    ActivityType  = brightspace.ActivityType;
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('clear_past_start_date', () => {
    test('returns null for null input', () => {
        expect(brightspace.clear_past_start_date(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
        expect(brightspace.clear_past_start_date(undefined)).toBeNull();
    });

    test('returns null for a past date', () => {
        expect(brightspace.clear_past_start_date('2020-01-01T00:00:00Z')).toBeNull();
    });

    test('returns null for today (item already available)', () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0); // noon today
        expect(brightspace.clear_past_start_date(today.toISOString())).toBeNull();
    });

    test('returns the original date string for a future date', () => {
        const future = '2099-12-31T00:00:00Z';
        expect(brightspace.clear_past_start_date(future)).toBe(future);
    });
});

describe('get_brightspace_data', () => {
    test('returns a plain array response directly', async () => {
        const data = [{ id: 1 }, { id: 2 }];
        global.fetch.mockResolvedValue(mock_json(data));

        const result = await brightspace.get_brightspace_data('https://example.com/api');
        expect(result).toEqual(data);
    });

    test('returns Objects when Next is null (final page of course-data pagination)', async () => {
        global.fetch.mockResolvedValue(mock_json({ Next: null, Objects: [{ id: 1 }] }));

        const result = await brightspace.get_brightspace_data('https://example.com/api');
        expect(result).toEqual([{ id: 1 }]);
    });

    test('concatenates pages when Next URL is present', async () => {
        global.fetch
            .mockResolvedValueOnce(mock_json({ Next: 'https://example.com/api?page=2', Objects: [{ id: 1 }] }))
            .mockResolvedValueOnce(mock_json({ Next: null, Objects: [{ id: 2 }] }));

        const result = await brightspace.get_brightspace_data('https://example.com/api');
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('handles PagingInfo pagination across two pages', async () => {
        global.fetch
            .mockResolvedValueOnce(mock_json({ PagingInfo: { HasMoreItems: true, Bookmark: 'bm1' }, Items: [{ id: 1 }] }))
            .mockResolvedValueOnce(mock_json({ PagingInfo: { HasMoreItems: false }, Items: [{ id: 2 }] }));

        const result = await brightspace.get_brightspace_data('https://example.com/api');
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        // Second call must include the bookmark
        expect(global.fetch.mock.calls[1][0]).toContain('bookmark=bm1');
    });

    test('falls back to data.Items from a non-paginated object response', async () => {
        global.fetch.mockResolvedValue(mock_json({ Items: [{ id: 1 }] }));

        const result = await brightspace.get_brightspace_data('https://example.com/api');
        expect(result).toEqual([{ id: 1 }]);
    });

    test('returns empty array when object has no recognised shape', async () => {
        global.fetch.mockResolvedValue(mock_json({ SomeUnknownKey: 'value' }));

        const result = await brightspace.get_brightspace_data('https://example.com/api');
        expect(result).toEqual([]);
    });
});

describe('get_quiz_attempt_count', () => {
    test('returns 0 when the HTTP response is not OK', async () => {
        global.fetch.mockResolvedValue({ ok: false, text: jest.fn() });

        const result = await brightspace.get_quiz_attempt_count('https://example.com', 1, 100);
        expect(result).toBe(0);
    });

    test('extracts count from the z_l element (primary path)', async () => {
        const html = `<span id="z_l">Completed - 2</span>`;
        global.fetch.mockResolvedValue(mock_text(html));

        const result = await brightspace.get_quiz_attempt_count('https://example.com', 1, 100);
        expect(result).toBe(2);
    });

    test('uses fallback regex when z_l element is absent', async () => {
        const html = `<div>Some content Completed - 3 attempts recorded</div>`;
        global.fetch.mockResolvedValue(mock_text(html));

        const result = await brightspace.get_quiz_attempt_count('https://example.com', 1, 100);
        expect(result).toBe(3);
    });

    test('uses fallback regex when z_l element exists but lacks completion text', async () => {
        const html = `<span id="z_l">In Progress</span><p>Completed - 1 attempt</p>`;
        global.fetch.mockResolvedValue(mock_text(html));

        // z_l element text has no "Completed - N", but fallback finds it elsewhere
        const result = await brightspace.get_quiz_attempt_count('https://example.com', 1, 100);
        expect(result).toBe(1);
    });

    test('returns 0 when neither pattern matches', async () => {
        const html = `<div>No completion info here</div>`;
        global.fetch.mockResolvedValue(mock_text(html));

        const result = await brightspace.get_quiz_attempt_count('https://example.com', 1, 100);
        expect(result).toBe(0);
    });

    test('returns 0 on network error', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        const result = await brightspace.get_quiz_attempt_count('https://example.com', 1, 100);
        expect(result).toBe(0);
    });
});

describe('get_assignment_submissions', () => {
    test('returns the submissions array on success', async () => {
        const submissions = [{ Submissions: [{ Id: '1' }] }];
        global.fetch.mockResolvedValue(mock_json(submissions));

        const result = await brightspace.get_assignment_submissions('https://example.com', 101, 10);
        expect(result).toEqual(submissions);
    });

    test('returns empty array when API returns a non-array without Errors', async () => {
        global.fetch.mockResolvedValue(mock_json({ SomeOtherKey: 'value' }));

        const result = await brightspace.get_assignment_submissions('https://example.com', 101, 10);
        expect(result).toEqual([]);
    });

    test('falls back to history page when API returns an Errors object — submission found', async () => {
        const error_body = { Errors: [{ Message: 'Folder closed' }] };
        const history_html = `<table><tr><td class="d_gn d_gt">submitted.pdf</td></tr></table>`;
        global.fetch
            .mockResolvedValueOnce(mock_json(error_body))
            .mockResolvedValueOnce(mock_text(history_html));

        const result = await brightspace.get_assignment_submissions('https://example.com', 101, 10);
        expect(result).toEqual([{ Submissions: [{ Id: 'history' }] }]);
    });

    test('falls back to history page when API returns Errors — no submission found', async () => {
        const error_body = { Errors: [{ Message: 'Folder closed' }] };
        const history_html = `<table><tr><td>No rows</td></tr></table>`;
        global.fetch
            .mockResolvedValueOnce(mock_json(error_body))
            .mockResolvedValueOnce(mock_text(history_html));

        const result = await brightspace.get_assignment_submissions('https://example.com', 101, 10);
        expect(result).toEqual([]);
    });

    test('returns empty array on network error', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        const result = await brightspace.get_assignment_submissions('https://example.com', 101, 10);
        expect(result).toEqual([]);
    });
});

describe('get_assignment_submissions_from_history', () => {
    test('returns a synthetic submission when the history table has a data row', async () => {
        const html = `<table><tr><td class="d_gn d_gt">file.pdf</td></tr></table>`;
        global.fetch.mockResolvedValue(mock_text(html));

        const result = await brightspace.get_assignment_submissions_from_history('https://example.com', 101, 10);
        expect(result).toEqual([{ Submissions: [{ Id: 'history' }] }]);
    });

    test('returns empty array when no submission rows are found', async () => {
        const html = `<table><tr><td>No submissions yet</td></tr></table>`;
        global.fetch.mockResolvedValue(mock_text(html));

        const result = await brightspace.get_assignment_submissions_from_history('https://example.com', 101, 10);
        expect(result).toEqual([]);
    });

    test('returns empty array when the HTTP response is not OK', async () => {
        global.fetch.mockResolvedValue({ ok: false, text: jest.fn() });

        const result = await brightspace.get_assignment_submissions_from_history('https://example.com', 101, 10);
        expect(result).toEqual([]);
    });

    test('returns empty array on network error', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        const result = await brightspace.get_assignment_submissions_from_history('https://example.com', 101, 10);
        expect(result).toEqual([]);
    });
});

// Must match the OrgUnit Type.Id for a standard course section in the Brightspace API
const COURSE_ORG_UNIT_TYPE_ID = 3;

const MOCK_COURSES = [
    {
        OrgUnit: { Id: 101, Name: 'Math 101', Type: { Id: COURSE_ORG_UNIT_TYPE_ID } },
        HomeUrl: 'https://example.com/d2l/home/101',
        Access: { CanAccess: true, IsActive: true, StartDate: '2026-01-01', EndDate: '2026-05-15' },
    },
];

function make_item(overrides) {
    return {
        OrgUnitId: 101,
        ItemId: 1,
        ItemName: 'Item 1',
        ItemUrl: 'https://example.com/item/1',
        DueDate: '2026-04-01T00:00:00Z',
        EndDate: null,
        DateCompleted: null,
        StartDate: null,
        ActivityType: ActivityType.QUIZ,
        ...overrides,
    };
}

describe('build_course_data', () => {
    test('creates Course objects keyed by course ID', async () => {
        const result = await brightspace.build_course_data(MOCK_COURSES, []);

        expect(result[101]).toBeDefined();
        expect(result[101].name).toBe('Math 101');
        expect(result[101].url).toBe('https://example.com/d2l/home/101');
    });

    test('adds a quiz to the correct course', async () => {
        const items = [make_item({ ItemId: 1, ItemName: 'Quiz 1', ActivityType: ActivityType.QUIZ })];
        const result = await brightspace.build_course_data(MOCK_COURSES, items);

        expect(result[101].quizzes[1]).toBeDefined();
        expect(result[101].quizzes[1].name).toBe('Quiz 1');
    });

    test('adds an assignment to the correct course', async () => {
        const items = [make_item({ ItemId: 10, ItemName: 'Assignment 1', ActivityType: ActivityType.DROPBOX })];
        const result = await brightspace.build_course_data(MOCK_COURSES, items);

        expect(result[101].assignments[10]).toBeDefined();
        expect(result[101].assignments[10].name).toBe('Assignment 1');
    });

    test('adds a discussion to the correct course', async () => {
        const items = [make_item({ ItemId: 200, ItemName: 'Topic 1', ActivityType: ActivityType.DISCUSSION })];
        const result = await brightspace.build_course_data(MOCK_COURSES, items);

        expect(result[101].discussions[200]).toBeDefined();
        expect(result[101].discussions[200].name).toBe('Topic 1');
    });

    test('marks item as completed when DateCompleted is set', async () => {
        const items = [make_item({ DateCompleted: new Date().toISOString(), ActivityType: ActivityType.DROPBOX })];
        const result = await brightspace.build_course_data(MOCK_COURSES, items);

        expect(result[101].assignments[1].completed).toBe(true);
    });

    test('marks item as not completed when DateCompleted is null', async () => {
        const items = [make_item({ DateCompleted: null })];
        const result = await brightspace.build_course_data(MOCK_COURSES, items);

        expect(result[101].quizzes[1].completed).toBe(false);
    });

    test('falls back to EndDate when DueDate is null', async () => {
        const items = [make_item({ DueDate: null, EndDate: '2026-03-05T00:00:00Z' })];
        const result = await brightspace.build_course_data(MOCK_COURSES, items);

        expect(result[101].quizzes[1].due_date).toBe('2026-03-05T00:00:00Z');
    });

    test('silently ignores items whose OrgUnitId does not match any course', async () => {
        const items = [make_item({ OrgUnitId: 999 })];
        const result = await brightspace.build_course_data(MOCK_COURSES, items);

        expect(Object.keys(result[101].quizzes)).toHaveLength(0);
    });

    test('emits a console warning for an unrecognised ActivityType', async () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const items = [make_item({ ActivityType: 99 })];
        await brightspace.build_course_data(MOCK_COURSES, items);

        expect(spy).toHaveBeenCalledWith(expect.stringContaining('99'));
    });
});

describe('get_course_content', () => {
    const BASE_URL = 'https://learn.example.com';
    const TAB_URL  = `${BASE_URL}/d2l/home`;

    // Sets up fetch mocks for a single course with one quiz, one assignment,
    // one forum containing one topic, and one post by user 42.
    function setup_one_course_full_mocks({ posting_user_id = 42, attempt_count = 1, has_submission = true } = {}) {
        const quiz_html          = `<span id="z_l">Completed - ${attempt_count}</span>`;
        const submissions_response = has_submission
            ? [{ Submissions: [{ Id: '1' }] }]
            : [];

        global.fetch
            // 1. enrollments
            .mockResolvedValueOnce(mock_json({
                PagingInfo: { HasMoreItems: false },
                Items: [{
                    OrgUnit: { Id: 101, Name: 'Math 101', Type: { Id: 3 } },
                    HomeUrl: `${BASE_URL}/d2l/home/101`,
                    Access: { CanAccess: true, IsActive: true, StartDate: '2026-01-01T00:00:00Z', EndDate: '2026-05-15T23:59:59Z' },
                }],
            }))
            // 2. whoami
            .mockResolvedValueOnce(mock_json_ok({ Identifier: '42' }))
            // 3. quizzes
            .mockResolvedValueOnce(mock_json([{
                QuizId: 1, Name: 'Quiz 1',
                StartDate: null, EndDate: '2026-03-01T23:59:00Z', DueDate: '2026-03-01T23:59:00Z',
            }]))
            // 4. quiz attempt count (HTML page)
            .mockResolvedValueOnce(mock_text(quiz_html))
            // 5. assignments
            .mockResolvedValueOnce(mock_json([{
                Id: 10, Name: 'Assignment 1',
                DueDate: '2026-04-01T23:59:00Z',
                Availability: { StartDate: null, EndDate: '2026-04-01T23:59:00Z' },
                CompletionType: 1,
            }]))
            // 6. assignment submissions
            .mockResolvedValueOnce(mock_json(submissions_response))
            // 7. discussion forums
            .mockResolvedValueOnce(mock_json([{ ForumId: 100, Name: 'Forum 1' }]))
            // 8. discussion topics
            .mockResolvedValueOnce(mock_json([{
                TopicId: 200, Name: 'Topic 1',
                StartDate: null, EndDate: '2026-04-15T23:59:00Z',
            }]))
            // 9. topic posts
            .mockResolvedValueOnce(mock_json([{ PostingUserId: posting_user_id }]));
    }

    test('returns course data keyed by course ID', async () => {
        setup_one_course_full_mocks();

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101]).toBeDefined();
        expect(result[101].name).toBe('Math 101');
    });

    test('quiz is marked completed when the attempt count is greater than 0', async () => {
        setup_one_course_full_mocks({ attempt_count: 1 });

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101].quizzes[1].completed).toBe(true);
    });

    test('quiz is not completed when the attempt count is 0', async () => {
        setup_one_course_full_mocks({ attempt_count: 0 });

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101].quizzes[1].completed).toBe(false);
    });

    test('assignment is marked completed when a submission exists', async () => {
        setup_one_course_full_mocks({ has_submission: true });

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101].assignments[10].completed).toBe(true);
    });

    test('assignment is not completed when there are no submissions', async () => {
        setup_one_course_full_mocks({ has_submission: false });

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101].assignments[10].completed).toBe(false);
    });

    test('discussion is marked completed when current user has posted', async () => {
        setup_one_course_full_mocks({ posting_user_id: 42 }); // current user is 42

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101].discussions[200].completed).toBe(true);
    });

    test('discussion is not completed when current user has not posted', async () => {
        setup_one_course_full_mocks({ posting_user_id: 99 }); // different user

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101].discussions[200].completed).toBe(false);
    });

    test('inactive and non-type-3 courses are excluded from results', async () => {
        global.fetch
            // enrollments — one active course, one inactive
            .mockResolvedValueOnce(mock_json({
                PagingInfo: { HasMoreItems: false },
                Items: [
                    {
                        OrgUnit: { Id: 101, Name: 'Active Course', Type: { Id: COURSE_ORG_UNIT_TYPE_ID } },
                        HomeUrl: `${BASE_URL}/d2l/home/101`,
                        Access: { CanAccess: true, IsActive: true, StartDate: '2026-01-01T00:00:00Z', EndDate: '2026-05-15T23:59:59Z' },
                    },
                    {
                        OrgUnit: { Id: 202, Name: 'Inactive Course', Type: { Id: COURSE_ORG_UNIT_TYPE_ID } },
                        HomeUrl: `${BASE_URL}/d2l/home/202`,
                        Access: { CanAccess: true, IsActive: false, StartDate: '2025-01-01T00:00:00Z', EndDate: '2025-05-15T23:59:59Z' },
                    },
                ],
            }))
            // whoami
            .mockResolvedValueOnce(mock_json_ok({ Identifier: '42' }))
            // quizzes, assignments, forums (all empty) for course 101 only
            .mockResolvedValueOnce(mock_json([]))
            .mockResolvedValueOnce(mock_json([]))
            .mockResolvedValueOnce(mock_json([]));

        const result = await brightspace.get_course_content(TAB_URL);
        expect(result[101]).toBeDefined();
        expect(result[202]).toBeUndefined();
    });
});
