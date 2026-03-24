function createScrollbarIndicator(calendarContainer) {
    const existingIndicator = calendarContainer.parentElement.querySelector(".scrollbar-indicator");
    if (existingIndicator) existingIndicator.remove();

    const indicator = document.createElement("div");
    indicator.className = "scrollbar-indicator";

    const assignments = calendarContainer.querySelectorAll(".calendar-item");
    if (assignments.length === 0) return;

    const containerHeight = calendarContainer.clientHeight;
    const scrollHeight = calendarContainer.scrollHeight;
    if (scrollHeight <= containerHeight) return;

    assignments.forEach((assignmentEl) => {
        const courseName = assignmentEl.querySelector(".item-course")?.textContent || "";
        const courseColor = getCourseColor(courseName);
        const positionInContainer = assignmentEl.offsetTop;
        const percentPosition = (positionInContainer / scrollHeight) * 100;

        const notch = document.createElement("div");
        notch.className = "scrollbar-notch";
        notch.style.top = percentPosition + "%";
        notch.style.backgroundColor = courseColor;
        notch.title = courseName;

        indicator.appendChild(notch);
    });

    calendarContainer.parentElement.appendChild(indicator);

    calendarContainer.addEventListener("scroll", () => {
        updateScrollbarIndicator(calendarContainer);
    });
}

function updateScrollbarIndicator(calendarContainer) {
    const indicator = calendarContainer.parentElement.querySelector(".scrollbar-indicator");
    if (!indicator) return;

    const scrollHeight = calendarContainer.scrollHeight;
    const assignments = calendarContainer.querySelectorAll(".calendar-item");
    const notches = indicator.querySelectorAll(".scrollbar-notch");

    notches.forEach((notch, index) => {
        if (index < assignments.length) {
            const positionInContainer = assignments[index].offsetTop;
            const percentPosition = (positionInContainer / scrollHeight) * 100;
            notch.style.top = percentPosition + "%";
        }
    });
}

function createAssignmentElement(assignment, course) {
    const assignmentContainer = document.createElement("a");
    assignmentContainer.className = "calendar-item";

    const now = new Date();
    const nowDateOnly = getDateOnly(now);
    const startDateOnly = assignment.startDate ? getDateOnly(assignment.startDate) : null;
    const isNotYetAvailable = startDateOnly && startDateOnly > nowDateOnly;

    if (isNotYetAvailable) {
        assignmentContainer.classList.add("not-yet-available");
        assignmentContainer.style.pointerEvents = "none";
    }

    const itemName = document.createElement("div");
    itemName.className = "item-name";
    itemName.textContent = assignment.name;
    assignmentContainer.appendChild(itemName);

    const itemMeta = document.createElement("div");
    itemMeta.className = "item-meta";

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

    assignmentContainer.addEventListener("click", function(e) {
        e.preventDefault();
        if (!isNotYetAvailable) {
            window.open(assignment.url, '_blank');
        }
    });

    return assignmentContainer;
}

function initializeGUI() {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) return;

    calendarContainer.innerHTML = "";
    const loadingIndicator = document.createElement("div");
    loadingIndicator.id = "loading-indicator";
    loadingIndicator.textContent = "Loading assignments...";
    calendarContainer.appendChild(loadingIndicator);
}

function addDataStatusIndicator(isStale) {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) return;

    const existingIndicator = calendarContainer.querySelector(".data-status-indicator");
    if (existingIndicator) existingIndicator.remove();

    if (isStale) {
        const indicator = document.createElement("div");
        indicator.className = "data-status-indicator loading";
        indicator.innerHTML = '<span class="spinner"></span> Fetching latest data...';
        calendarContainer.appendChild(indicator);
    }
}

function updateGUI(courseData, isFromCache = false) {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) return;

    ensureCourseColorsAssigned(courseData);

    calendarContainer.innerHTML = "";
    isDataStale = isFromCache;

    if (isFromCache) {
        addDataStatusIndicator(true);
    }

    // Collect all items with due dates
    const itemsByDate = {};
    let minDate = null;
    let maxDate = null;

    Object.keys(courseData).forEach((courseId) => {
        const course = courseData[courseId];

        const itemCollections = [
            { items: course.assignments },
            { items: course.quizzes },
            { items: course.discussions }
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

                            if (!minDate || dateOnly < minDate) minDate = dateOnly;
                            if (!maxDate || dateOnly > maxDate) maxDate = dateOnly;
                        }
                    }
                });
            }
        });
    });

    // Empty state
    if (!minDate || !maxDate) {
        if (isFromCache) addDataStatusIndicator(true);
        const emptyMessage = document.createElement("div");
        emptyMessage.id = "loading-indicator";
        emptyMessage.textContent = "No upcoming assignments";
        calendarContainer.appendChild(emptyMessage);
        return;
    }

    // Generate calendar from today to maxDate
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(maxDate);

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const items = itemsByDate[dateKey] || [];

        const dateHeader = document.createElement("div");
        dateHeader.className = "calendar-date-header";
        const dateHeaderText = formatDateHeader(currentDate);
        dateHeader.innerHTML = `<div class="date-title">${dateHeaderText}</div>`;
        calendarContainer.appendChild(dateHeader);

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
        currentDate.setDate(currentDate.getDate() + 1);
    }

    createScrollbarIndicator(calendarContainer);
}
