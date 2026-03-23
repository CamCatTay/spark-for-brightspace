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

/**
 * Generates a single fake BrightspaceItem for testing
 * @param {number} itemId - Unique item ID
 * @param {string} courseId - Course ID
 * @param {string} [itemName] - Optional item name
 * @param {number} [activityType] - Optional activity type (3=Assignment, 4=Quiz, 5=Discussion)
 * @returns {BrightspaceItem} A fake BrightspaceItem
 */
function generateFakeBrightspaceItem(itemId, courseId, itemName, activityType = 3) {
    // Generate a random due date between tomorrow and 30 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30) + 1);

    const activityNames = {
        3: "Assignment",
        4: "Quiz",
        5: "Discussion"
    };

    const name = itemName || `${activityNames[activityType] || "Item"} ${itemId}`;

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
    const activityTypes = [3, 4, 5]; // Assignment, Quiz, Discussion

    for (let i = 1; i <= count; i++) {
        const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        items.push(generateFakeBrightspaceItem(i, courseId, `Test Item ${i}`, activityType));
    }

    return items;
}

/**
 * Generates fake courses and items for testing purposes
 * @param {Function} mapData - The mapData function from brightspace.js
 * @returns {Object} CourseMap with fake data
 */
export async function getTestCourseContent(mapData) {
    // Create fake course data matching the API structure
    const fakeCourses = [
        {
            OrgUnit: {
                Id: 1001,
                Name: "Test Course 1",
                Type: { Id: 3 }
            },
            HomeUrl: "https://example.brightspace.com/d2l/home/1001"
        },
        {
            OrgUnit: {
                Id: 1002,
                Name: "Test Course 2",
                Type: { Id: 3 }
            },
            HomeUrl: "https://example.brightspace.com/d2l/home/1002"
        }
    ];

    // Generate fake items for each course
    const fakeItems = [];
    fakeCourses.forEach(course => {
        const courseItems = generateFakeBrightspaceItems(5, course.OrgUnit.Id);
        fakeItems.push(...courseItems);
    });

    // Use mapData to process into proper Course objects
    const courseMap = await mapData(fakeCourses, fakeItems);

    console.log("Using TEST MODE - fake course data loaded");
    return courseMap;
}
