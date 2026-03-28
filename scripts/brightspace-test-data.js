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

const FAKE_COURSE_NAMES = [
    "Data Structures and Algorithms Section 01 Fall 2026",
    "Academic Writing and Communication Section 02 Fall 2026",
    "Calculus II Section 01 Fall 2026",
    "Introduction to Psychology Section 03 Fall 2026",
    "Modern World History Section 01 Fall 2026",
];

const FAKE_ASSIGNMENT_NAMES = [
    "Lab Report 1: Variables and Control Flow",
    "Essay Draft: Comparative Analysis",
    "Problem Set 3: Integration Techniques",
    "Research Proposal Outline",
    "Case Study: Cognitive Bias in Decision Making",
    "Lab Report 2: Sorting Algorithm Performance",
    "Annotated Bibliography",
    "Midterm Project: Data Visualization",
    "Reflection Journal Entry 2",
    "Group Project: Literature Review",
    "Assignment 4: Recursive Functions",
    "Final Essay: Argument and Counterargument",
];

const FAKE_QUIZ_NAMES = [
    "Quiz 1: Chapter 1-3 Review",
    "Quiz 2: Binary Trees",
    "Midterm Exam",
    "Quiz 3: Grammar and Syntax",
    "Quiz 4: Limits and Derivatives",
    "Chapter 5 Knowledge Check",
    "Weekly Quiz: Psychological Disorders",
    "Quiz 6: World War II Overview",
    "Final Exam Review Quiz",
    "Pop Quiz: Stack and Queue",
];

const FAKE_DISCUSSION_NAMES = [
    "Discussion: Ethical Implications of AI",
    "Week 2 Reflection: Course Themes",
    "Peer Review: Draft Exchange",
    "Discussion: Is history cyclical?",
    "Forum: Real-world Applications of Sorting",
    "Discussion: Nature vs. Nurture",
    "Weekly Forum: Current Events Response",
    "Discussion: Big O Notation in Practice",
    "Forum: Rhetorical Strategies in Media",
    "Discussion: Mental Health Stigma",
];

// Common due times used in academic settings
const FAKE_DUE_TIMES = [
    { hour: 23, minute: 59 },
    { hour: 23, minute: 59 },
    { hour: 23, minute: 59 },
    { hour: 11, minute: 59 },
    { hour: 17, minute: 0  },
    { hour: 8,  minute: 0  },
    { hour: 12, minute: 0  },
];

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a single fake BrightspaceItem for testing
 * @param {number} itemId - Unique item ID
 * @param {string} courseId - Course ID
 * @param {number} [activityType] - Optional activity type (3=Assignment, 4=Quiz, 5=Discussion)
 * @returns {BrightspaceItem} A fake BrightspaceItem
 */
function generateFakeBrightspaceItem(itemId, courseId, activityType = 3) {
    // Random due date between start of this week and 30 days from now
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const dueDate = new Date(startOfWeek);
    dueDate.setDate(startOfWeek.getDate() + Math.floor(Math.random() * (today.getDay() + 31)));

    const time = pickRandom(FAKE_DUE_TIMES);
    dueDate.setHours(time.hour, time.minute, 0, 0);

    const namePool = activityType === 3 ? FAKE_ASSIGNMENT_NAMES
                   : activityType === 4 ? FAKE_QUIZ_NAMES
                   : FAKE_DISCUSSION_NAMES;
    const name = pickRandom(namePool);

    return {
        UserId: "user123",
        OrgUnitId: courseId.toString(),
        ItemId: itemId,
        ItemName: name,
        ItemType: activityType,
        ItemUrl: `https://example.brightspace.com/d2l/le/content/${courseId}/viewContent/${itemId}`,
        DueDate: dueDate.toISOString(),
        CompletionType: 1,
        ActivityType: activityType,
        IsExempt: false
    };
}

/**
 * Generates multiple fake BrightspaceItems for testing
 * @param {number} count - Number of items to generate
 * @param {string} courseId - Course ID
 * @returns {BrightspaceItem[]} Array of fake BrightspaceItems
 */
function generateFakeBrightspaceItems(count, courseId) {
    const items = [];
    const activityTypes = [3, 4, 5];

    for (let i = 1; i <= count; i++) {
        const activityType = pickRandom(activityTypes);
        items.push(generateFakeBrightspaceItem(i, courseId, activityType));
    }

    return items;
}

/**
 * Generates fake courses and items for testing purposes
 * @param {Function} mapData - The mapData function from brightspace.js
 * @returns {Object} CourseMap with fake data
 */
export async function getTestCourseContent(mapData) {
    const fakeCourses = FAKE_COURSE_NAMES.map((name, i) => ({
        OrgUnit: {
            Id: 1001 + i,
            Name: name,
            Type: { Id: 3 }
        },
        HomeUrl: `https://example.brightspace.com/d2l/home/${1001 + i}`
    }));

    const fakeItems = [];
    fakeCourses.forEach(course => {
        const courseItems = generateFakeBrightspaceItems(15, course.OrgUnit.Id);
        fakeItems.push(...courseItems);
    });

    const courseMap = await mapData(fakeCourses, fakeItems);

    console.log("Using TEST MODE - fake course data loaded");
    return courseMap;
}
