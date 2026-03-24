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

function formatFullDatetime(dateString) {
    if (!dateString) return "No date";
    try {
        const date = new Date(dateString);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${monthNames[date.getMonth()]} ${date.getDate()}`;
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${dateStr} at ${timeStr}`;
    } catch (e) {
        return "No date";
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

// Saturation level for course colors (0-100, where 100 is fully saturated)
const COLOR_SATURATION = 60;

// Lightness level for course colors (0-100, where 0 is dark/black, 50 is normal, 100 is bright/white)
const COLOR_LIGHTNESS = 50;

// Color pool defined by hue, with saturation and lightness applied from constants
// Format: [hue (0-360)]
const COLOR_POOL_HSL = [
    [0],      // Red
    [30],     // Orange
    [60],     // Yellow
    [120],    // Green
    [240],    // Blue
    [330],    // Pink
    [255],    // Purple
];

// Convert HSL to Hex color
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// Get color from pool with applied saturation and lightness constants
function getColorFromPool(index) {
    const [hue] = COLOR_POOL_HSL[index % COLOR_POOL_HSL.length];
    return hslToHex(hue, COLOR_SATURATION, COLOR_LIGHTNESS);
}

let panelWidth = 350; // Default width
let container, toggleBtn;
let isAnimating = false; // Prevent multiple simultaneous animations
let isDataStale = false; // Track if displayed data is from cache
let scrollbarWidth = 0; // Store scrollbar width
let courseColorMap = {}; // { courseName: colorHex } - assigned lexicographically

function ensureCourseColorsAssigned(courseData) {
    // Collect all unique course names from the current courseData
    const allCourseNames = new Set();
    Object.keys(courseData).forEach((courseId) => {
        const course = courseData[courseId];
        allCourseNames.add(course.name);
    });

    // Sort lexicographically and assign colors
    const sortedNames = Array.from(allCourseNames).sort();
    sortedNames.forEach((name, index) => {
        if (!courseColorMap[name]) {
            courseColorMap[name] = getColorFromPool(index);
        }
    });
}

function getCourseColor(courseName) {
    return courseColorMap[courseName] || "#808080"; // Fallback gray if not assigned
}

function createScrollbarIndicator(calendarContainer) {
    // Remove existing indicator if present
    const existingIndicator = calendarContainer.parentElement.querySelector(".scrollbar-indicator");
    if (existingIndicator) {
        existingIndicator.remove();
    }

    // Create indicator overlay
    const indicator = document.createElement("div");
    indicator.className = "scrollbar-indicator";

    // Collect all assignments with their positions
    const assignments = calendarContainer.querySelectorAll(".calendar-item");
    
    if (assignments.length === 0) {
        return; // No assignments to show
    }

    // Calculate total scrollable height
    const containerHeight = calendarContainer.clientHeight;
    const scrollHeight = calendarContainer.scrollHeight;
    
    if (scrollHeight <= containerHeight) {
        return; // Content fits, no scrollbar needed
    }

    // Create notch for each assignment
    assignments.forEach((assignmentEl) => {
        const courseName = assignmentEl.querySelector(".item-course")?.textContent || "";
        const courseColor = getCourseColor(courseName);
        
        // Get position of assignment relative to scroll container
        const rect = assignmentEl.getBoundingClientRect();
        const containerRect = calendarContainer.getBoundingClientRect();
        const positionInContainer = assignmentEl.offsetTop;
        const percentPosition = (positionInContainer / scrollHeight) * 100;

        // Create notch element
        const notch = document.createElement("div");
        notch.className = "scrollbar-notch";
        notch.style.top = percentPosition + "%";
        notch.style.backgroundColor = courseColor;
        notch.title = courseName;

        indicator.appendChild(notch);
    });

    // Add indicator to the panel (positioned relative to panel)
    calendarContainer.parentElement.appendChild(indicator);
    
    // Update notch positions on scroll
    calendarContainer.addEventListener("scroll", () => {
        updateScrollbarIndicator(calendarContainer);
    });
}

function updateScrollbarIndicator(calendarContainer) {
    const indicator = calendarContainer.parentElement.querySelector(".scrollbar-indicator");
    if (!indicator) return;

    const scrollHeight = calendarContainer.scrollHeight;
    const containerHeight = calendarContainer.clientHeight;
    const assignments = calendarContainer.querySelectorAll(".calendar-item");

    const notches = indicator.querySelectorAll(".scrollbar-notch");
    
    notches.forEach((notch, index) => {
        if (index < assignments.length) {
            const assignmentEl = assignments[index];
            const positionInContainer = assignmentEl.offsetTop;
            const percentPosition = (positionInContainer / scrollHeight) * 100;
            notch.style.top = percentPosition + "%";
        }
    });
}

function updateBodyMargin() {
    // Always maintain the margin-right for DOM balance
    document.body.style.marginRight = panelWidth + "px";
}

function updateToggleButtonPosition() {
    if (!toggleBtn) return;
    
    const isHidden = container && container.classList.contains("hidden");
    
    if (isHidden) {
        // Position on the right side when panel is closed
        toggleBtn.style.right = scrollbarWidth + "px";
    } else {
        // Position at the left edge of the panel when it's open
        toggleBtn.style.right = (panelWidth + scrollbarWidth) + "px";
    }
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
        updateToggleButtonPosition(); // Update button position
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
        updateToggleButtonPosition(); // Update button position during resize

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
    updateToggleButtonPosition(); // Initial position update

    return calendarContainer;
}

function createAssignmentElement(assignment, course) {
    const assignmentContainer = document.createElement("a");
    assignmentContainer.className = "calendar-item";

    // Check if assignment is not yet available (start date is after today)
    const now = new Date();
    const nowDateOnly = getDateOnly(now);
    const startDateOnly = assignment.startDate ? getDateOnly(assignment.startDate) : null;
    const isNotYetAvailable = startDateOnly && startDateOnly > nowDateOnly;
    
    console.log("Rendering: " + assignment.name + " | startDate: " + assignment.startDate + " | startDateOnly: " + (startDateOnly ? startDateOnly.toISOString() : null) + " | nowDateOnly: " + nowDateOnly.toISOString() + " | isNotYetAvailable: " + isNotYetAvailable);
    
    if (isNotYetAvailable) {
        assignmentContainer.classList.add("not-yet-available");
        assignmentContainer.style.pointerEvents = "none"; // Disable click on unavailable items
    }

    const itemName = document.createElement("div");
    itemName.className = "item-name";
    itemName.textContent = assignment.name;
    assignmentContainer.appendChild(itemName);

    const itemMeta = document.createElement("div");
    itemMeta.className = "item-meta";

    // Display start date if it exists
    if (assignment.startDate) {
        const startDateContainer = document.createElement("div");
        startDateContainer.className = "start-date-container";
        
        const startDateLabel = document.createElement("span");
        startDateLabel.className = "start-date-label";
        startDateLabel.textContent = "Available: ";
        startDateContainer.appendChild(startDateLabel);
        
        const startDateValue = document.createElement("span");
        startDateValue.className = "start-date-value";
        startDateValue.textContent = formatFullDatetime(assignment.startDate);
        startDateContainer.appendChild(startDateValue);
        
        itemMeta.appendChild(startDateContainer);
    }

    // Display due date
    const dueContainer = document.createElement("div");
    dueContainer.className = "due-date-container";
    
    const dueLabel = document.createElement("span");
    dueLabel.className = "due-date-label";
    dueLabel.textContent = "Due: ";
    dueContainer.appendChild(dueLabel);
    
    const dueTime = document.createElement("span");
    dueTime.className = "item-time";
    dueTime.textContent = formatTimeFromDate(assignment.dueDate);
    dueContainer.appendChild(dueTime);
    
    itemMeta.appendChild(dueContainer);

    const itemCourse = document.createElement("span");
    itemCourse.className = "item-course";
    itemCourse.textContent = course.name;
    itemCourse.style.color = getCourseColor(course.name);
    itemCourse.style.fontWeight = "bold";
    itemMeta.appendChild(itemCourse);

    assignmentContainer.appendChild(itemMeta);

    // Add click listener to open assignment URL
    assignmentContainer.addEventListener("click", function(e) {
        e.preventDefault();
        if (!isNotYetAvailable) {
            window.open(assignment.url, '_blank');
        }
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
        label = `Today · ${label}`;
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
        label = `Tomorrow · ${label}`;
    }

    return `${title} · ${label}`;
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

    // Ensure all courses have colors assigned lexicographically
    ensureCourseColorsAssigned(courseData);

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
        const dateHeaderText = formatDateHeader(currentDate);
        dateHeader.innerHTML = `<div class="date-title">${dateHeaderText}</div>`;
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

    // Create scrollbar indicator after all content is rendered
    createScrollbarIndicator(calendarContainer);
}

window.addEventListener("load", () => {
    console.log("D2L-Todolist loaded")

    const startTime = performance.now();
    const COURSE_DATA_KEY = "courseData";
    let courseData = {};

    // Inject the embedded UI
    injectEmbeddedUI();
    initializeGUI(courseData);

    // Calculate and store scrollbar width
    scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    updateToggleButtonPosition(); // Set initial position

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
            updateToggleButtonPosition(); // Update button position
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
