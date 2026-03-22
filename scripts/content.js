function getTimeTaken(startTime, endTime) {
    return (endTime - startTime).toFixed(2)/1000;
}

function getMondayOfCurrentWeek(date) {
    const day = date.getDay();
    const difference = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(difference));
}

function formatTimeFromDate(dateString) {
    if (!dateString) return "No time";
    try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
        return "No time";
    }
}

function getDateOnly(dateString) {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    } catch (e) {
        return null;
    }
}

function createAssignmentElement(assignment, course) {
    const assignmentContainer = document.createElement("a");
    assignmentContainer.className = "calendar-item";

    const itemName = document.createElement("div");
    itemName.className = "item-name";
    itemName.textContent = assignment.name;
    assignmentContainer.appendChild(itemName);

    const itemMeta = document.createElement("div");
    itemMeta.className = "item-meta";
    
    const itemTime = document.createElement("span");
    itemTime.className = "item-time";
    itemTime.textContent = formatTimeFromDate(assignment.dueDate);
    itemMeta.appendChild(itemTime);

    const itemCourse = document.createElement("span");
    itemCourse.className = "item-course";
    itemCourse.textContent = course.name;
    itemMeta.appendChild(itemCourse);

    assignmentContainer.appendChild(itemMeta);

    // Add click listener to open assignment URL
    assignmentContainer.addEventListener("click", function(e) {
        e.preventDefault();
        window.open(assignment.url, '_blank');
    });

    return assignmentContainer;
}

function formatDateHeader(date) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const title = `${monthNames[date.getMonth()]} ${date.getDate()}`;
    let label = dayNames[date.getDay()];

    if (dateOnly.getTime() === todayOnly.getTime()) {
        label = `Today - ${label}`;
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
        label = `Tomorrow - ${label}`;
    }

    return { title, label };
}

function initializeGUI(courseData) {
    const calendarContainer = document.getElementById("calendar-container");

    if (!calendarContainer) {
        return;
    }

    const currentDate = new Date();
    const mondayDate = getMondayOfCurrentWeek(new Date(currentDate));
    console.log("Monday of current week:", mondayDate);

    // Show loading indicator
    calendarContainer.innerHTML = "";
    const loadingIndicator = document.createElement("div");
    loadingIndicator.id = "loading-indicator";
    loadingIndicator.textContent = "Loading assignments...";
    calendarContainer.appendChild(loadingIndicator);
}

function updateGUI(courseData) {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) {
        console.warn("Calendar container not found");
        return;
    }

    // Clear existing content
    calendarContainer.innerHTML = "";

    // Collect all items with due dates
    const itemsByDate = {}; // { dateKey: [{ assignment, course }, ...] }
    let minDate = null;
    let maxDate = null;

    Object.keys(courseData).forEach((courseId) => {
        const course = courseData[courseId];

        const itemCollections = [
            { items: course.assignments, type: 'assignment' },
            { items: course.quizzes, type: 'quiz' },
            { items: course.discussions, type: 'discussion' }
        ];

        itemCollections.forEach(({ items }) => {
            if (items) {
                Object.keys(items).forEach((itemId) => {
                    const item = items[itemId];
                    if (item.dueDate && !item.completed) {
                        const dateOnly = getDateOnly(item.dueDate);
                        if (dateOnly) {
                            const dateKey = dateOnly.toISOString().split('T')[0];
                            if (!itemsByDate[dateKey]) {
                                itemsByDate[dateKey] = [];
                            }
                            itemsByDate[dateKey].push({ item, course });

                            // Track min and max dates
                            if (!minDate || dateOnly < minDate) minDate = dateOnly;
                            if (!maxDate || dateOnly > maxDate) maxDate = dateOnly;
                        }
                    }
                });
            }
        });
    });

    // If no items, show empty state
    if (!minDate || !maxDate) {
        const emptyMessage = document.createElement("div");
        emptyMessage.id = "loading-indicator";
        emptyMessage.textContent = "No upcoming assignments";
        calendarContainer.appendChild(emptyMessage);
        return;
    }

    // Generate all dates from today to maxDate
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(maxDate);

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const items = itemsByDate[dateKey] || [];

        // Create date header
        const dateHeader = document.createElement("div");
        dateHeader.className = "calendar-date-header";
        const { title, label } = formatDateHeader(currentDate);
        dateHeader.innerHTML = `<div class="date-title">${title}</div><div class="date-label">${label}</div>`;
        calendarContainer.appendChild(dateHeader);

        // Create items container
        const itemsContainer = document.createElement("div");
        itemsContainer.className = "calendar-items-container";

        if (items.length === 0) {
            const emptyNotice = document.createElement("div");
            emptyNotice.className = "empty-day-notice";
            emptyNotice.textContent = "No assignments due";
            itemsContainer.appendChild(emptyNotice);
        } else {
            items.forEach(({ item, course }) => {
                const element = createAssignmentElement(item, course);
                itemsContainer.appendChild(element);
            });
        }

        calendarContainer.appendChild(itemsContainer);

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

window.addEventListener("load", () => {
    console.log("D2L-Todolist loaded")

    const startTime = performance.now();
    const COURSE_DATA_KEY = "courseData";
    const courseData = {};
    const oldCourseDataMap = new Map(); // {courseId, complete: false}
    const dateContainerMap = new Map(); // {date, dateContainer}

    // initialize GUI with loading indicator
    initializeGUI(courseData);

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY], function(result) {
        if (result.courseData) {
            Object.assign(courseData, result.courseData);
            updateGUI(courseData);
            console.log("Course data from storage:", courseData);
            console.log("It took " + getTimeTaken(startTime, performance.now()) + "s to load stored course data");
        }
    });

    // Fetch new data from API to override stored data
    chrome.runtime.sendMessage({ action: "fetchCourses" }, function(response) {
        // save course data to storage and update display
        chrome.storage.local.set({ courseData: response }, function() {
            Object.assign(courseData, response);
            updateGUI(courseData);
            console.log("Updated with fetched course data");
        });

        console.log("Fetched course data:", courseData);
        console.log("It took " + getTimeTaken(startTime, performance.now()) + "s to fetch course data");
    });

    // setup UI and create oldCourseDataMap

    // save course data before unloading/leaving the page (and periodically)

});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
});
