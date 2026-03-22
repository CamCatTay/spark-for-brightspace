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
    openUrl() {
        openUrl(this.url);
    }
}

class Item {
    constructor(id, name, url, dueDate, completed) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.dueDate = dueDate;
        this.completed = completed; // this needs to be persistent across sessions
    }

    markComplete() {
        this.completed = true;
    }

    markIncomplete() {
        this.completed = false;
    }

    openUrl() {
        openUrl(this.url);
    }
}

async function openUrl(url) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const tabId = tabs[0].id; // Get the active tab's ID
        chrome.tabs.sendMessage(tabId, { action: "openUrl", url: url});
    });
};

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
    return "Items" in data ? data.Items : data.Object; // if data has "Items" then return Items else return Object
}

// yeah .join was better approach. benchmarked both and this is nearly 2x faster
export async function getCourseIds(courses) {
    return courses.map(
        function(course) {
            return course.OrgUnit.Id
        }).join(",");
}

// utility for getCourseContent
export async function getBrightspaceCourses(baseURL) {
    const coursesURL = baseURL + "/d2l/api/lp/1.43/enrollments/myenrollments/";
    const allCourses = await getBrightspaceData(coursesURL);
    return allCourses.filter(function(course) {
        return course.Access.CanAccess && course.Access.IsActive && course.OrgUnit.Type.Id === 3;
    });
}


export async function getCourseContent(tabUrl) {
    // Return fake data if in test mode
    if (TEST_MODE) {
        return getTestCourseContent();
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

    const courseItems = gradedItems.concat(nonGradedItems);
    const courseMap = await mapData(allCourses, courseItems);

    return courseMap;
}

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
 * @returns {Object} CourseMap with fake data
 */
export async function getTestCourseContent() {
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
            itemData.DueDate,
            !!itemData.DateCompleted // Item is completed if DateCompleted exists
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
