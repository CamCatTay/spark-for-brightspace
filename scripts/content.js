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

const EXPANSION_STATE_KEY = "d2l-todolist-expanded";
const PANEL_WIDTH_KEY = "d2l-todolist-width";
let panelWidth = 350; // Default width
let container, toggleBtn;
let isAnimating = false; // Prevent multiple simultaneous animations
let isDataStale = false; // Track if displayed data is from cache

function updateBodyMargin() {
    // Always maintain the margin-right for DOM balance
    document.body.style.marginRight = panelWidth + "px";
}

function createEmbeddedCalendarUI() {
    // Create the outer container
    const newContainer = document.createElement("div");
    newContainer.id = "d2l-todolist-widget";
    newContainer.style.width = panelWidth + "px";

    // Create the panel
    const panel = document.createElement("div");
    panel.id = "d2l-todolist-panel";
    panel.style.width = panelWidth + "px";

    // Create resize handle
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "d2l-todolist-resize-handle";

    // Create the calendar container
    const calendarContainer = document.createElement("div");
    calendarContainer.id = "calendar-container";

    panel.appendChild(resizeHandle);
    panel.appendChild(calendarContainer);
    newContainer.appendChild(panel);

    // Create the toggle button (tab at top right) - add to container but we'll move it to body later
    const newToggleBtn = document.createElement("button");
    newToggleBtn.id = "d2l-todolist-toggle";
    newToggleBtn.className = "d2l-todolist-toggle";
    newToggleBtn.textContent = "◀";
    newToggleBtn.title = "Toggle Calendar";

    // Add toggle functionality with state persistence
    newToggleBtn.addEventListener("click", function() {
        if (isAnimating) return; // Prevent multiple simultaneous animations
        isAnimating = true;

        newContainer.classList.toggle("hidden");
        const isHidden = newContainer.classList.contains("hidden");
        localStorage.setItem(EXPANSION_STATE_KEY, isHidden ? "false" : "true");
        updateToggleButtonState(newToggleBtn, !isHidden);
        // Update margin based on visibility
        if (isHidden) {
            document.body.style.marginRight = "0";
            // Wait for animation to complete before actually hiding
            const animationHandler = () => {
                newContainer.style.display = "none";
                newContainer.removeEventListener("animationend", animationHandler);
                isAnimating = false;
            };
            newContainer.addEventListener("animationend", animationHandler);
        } else {
            newContainer.style.display = "flex";
            updateBodyMargin();
            isAnimating = false;
        }
    });

    // Add resize functionality
    let isResizing = false;
    let startX = 0;
    let startWidth = panelWidth;

    resizeHandle.addEventListener("mousedown", function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = panelWidth;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
    });

    document.addEventListener("mousemove", function(e) {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = Math.max(250, startWidth - deltaX); // Minimum 250px width

        panelWidth = newWidth;
        newContainer.style.width = newWidth + "px";
        panel.style.width = newWidth + "px";
        updateBodyMargin();

        localStorage.setItem(PANEL_WIDTH_KEY, newWidth.toString());
    });

    document.addEventListener("mouseup", function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        }
    });

    return { container: newContainer, calendarContainer, toggleBtn: newToggleBtn, panel };
}

function updateToggleButtonState(toggleBtn, isExpanded) {
    toggleBtn.textContent = isExpanded ? "▶" : "◀";
    toggleBtn.title = isExpanded ? "Collapse Calendar" : "Expand Calendar";
}

function injectEmbeddedUI() {
    // Remove existing widget if it exists
    const existing = document.getElementById("d2l-todolist-widget");
    if (existing) {
        existing.remove();
    }

    // Remove existing toggle button if it exists
    const existingToggleBtn = document.getElementById("d2l-todolist-toggle");
    if (existingToggleBtn) {
        existingToggleBtn.remove();
    }

    // Load saved panel width
    const savedWidth = localStorage.getItem(PANEL_WIDTH_KEY);
    if (savedWidth) {
        panelWidth = parseInt(savedWidth, 10);
    }

    // Create and inject the UI
    const { container: newContainer, calendarContainer, toggleBtn: newToggleBtn, panel } = createEmbeddedCalendarUI();
    container = newContainer;
    toggleBtn = newToggleBtn;

    // Load saved expansion state (default to showing panel)
    const savedState = localStorage.getItem(EXPANSION_STATE_KEY);
    const shouldShowPanel = savedState === null || savedState === "true";

    if (!shouldShowPanel) {
        // Don't animate on page load, just hide it immediately
        container.style.display = "none";
        container.classList.add("hidden");
    }

    updateToggleButtonState(toggleBtn, shouldShowPanel);
    if (shouldShowPanel) {
        updateBodyMargin();
    } else {
        document.body.style.marginRight = "0";
    }

    document.body.appendChild(toggleBtn);
    document.body.appendChild(container);

    return calendarContainer;
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

function addDataStatusIndicator(isStale) {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) return;

    // Remove existing status indicator
    const existingIndicator = calendarContainer.querySelector(".data-status-indicator");
    if (existingIndicator) {
        existingIndicator.remove();
    }

    if (isStale) {
        const indicator = document.createElement("div");
        indicator.className = "data-status-indicator loading";
        indicator.innerHTML = '<span class="spinner"></span> Fetching latest data...';
        calendarContainer.appendChild(indicator);
    }
}

function updateGUI(courseData, isFromCache = false) {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) {
        console.warn("Calendar container not found");
        return;
    }

    // Clear existing content
    calendarContainer.innerHTML = "";
    isDataStale = isFromCache;

    // Show status indicator if data is from cache
    if (isFromCache) {
        addDataStatusIndicator(true);
    }

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
        if (isFromCache) {
            addDataStatusIndicator(true);
        }
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
    let courseData = {};

    // Inject the embedded UI
    injectEmbeddedUI();
    initializeGUI(courseData);

    // Load stored data first for immediate display
    chrome.storage.local.get([COURSE_DATA_KEY], function(result) {
        if (result.courseData) {
            courseData = JSON.parse(JSON.stringify(result.courseData)); // Deep copy
            updateGUI(courseData, true); // Mark as from cache
            console.log("Course data from storage:", courseData);
            console.log("It took " + getTimeTaken(startTime, performance.now()) + "s to load stored course data");
        }
    });

    // Fetch new data from API to override stored data
    chrome.runtime.sendMessage({ action: "fetchCourses" }, function(response) {
        if (response) {
            // Completely replace courseData with fresh data
            courseData = JSON.parse(JSON.stringify(response)); // Deep copy
            
            // save course data to storage and update display
            chrome.storage.local.set({ courseData: courseData }, function() {
                updateGUI(courseData, false); // Mark as fresh data
                console.log("Updated with fetched course data");
            });
        }

        console.log("Fetched course data:", courseData);
        console.log("It took " + getTimeTaken(startTime, performance.now()) + "s to fetch course data");
    });
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "openUrl") {
        window.open(request.url, '_blank');
    }
    if (request.action === "togglePanel") {
        if (container && !isAnimating) {
            isAnimating = true;

            container.classList.toggle("hidden");
            const isHidden = container.classList.contains("hidden");
            localStorage.setItem(EXPANSION_STATE_KEY, isHidden ? "false" : "true");
            updateToggleButtonState(toggleBtn, !isHidden);
            // Update margin based on visibility
            if (isHidden) {
                document.body.style.marginRight = "0";
                // Wait for animation to complete before actually hiding
                const animationHandler = () => {
                    container.style.display = "none";
                    container.removeEventListener("animationend", animationHandler);
                    isAnimating = false;
                };
                container.addEventListener("animationend", animationHandler);
            } else {
                container.style.display = "flex";
                updateBodyMargin();
                isAnimating = false;
            }
        }
    }
});
