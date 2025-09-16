class Course {
    constructor(id, name, url) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.files = new Map();
        this.quizzes = new Map();
        this.assignments = new Map();
    }
    addFile(item) {
        this.files.set(item.id, item);
    }
    addQuiz(item) {
        this.quizzes.set(item.id, item);
    }
    addAssignment(item) {
        this.assignments.set(item.id, item);
    }
    addDiscussion(item) {
        this.discussions.set(item.id, item);
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
    const baseURL = await getBaseURL(tabUrl);
    const allCourses = await getBrightspaceCourses(baseURL);
    const courseIdsCSV = await getCourseIds(allCourses);

    // IMPORTANT: Increase the date range by 1 day on either side to account for time zone differences
    let startDate = allCourses[0].Access.StartDate;
    let endDate = allCourses[0].Access.EndDate

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

    return courseItems;
}
    

export async function getMasterData(tabUrl) {
    const data = getBrightspaceCourses(tabUrl);
    const courseItems = getCourseContent(tabUrl)
}