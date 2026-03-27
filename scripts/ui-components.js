// Words that mark the start of administrative suffixes in course names.
// Everything from the first matching word onward will be stripped.
const COURSE_NAME_TRIM_WORDS = [
    "Section",
    "XLS",
    "Group",
    "Spring",
    "Fall",
    "Winter",
    "Summer",
];

// How many days before today the calendar should start.
// Set to 0 to start from today; increase to show past items.
const CALENDAR_START_DAYS_BACK = 30;

function truncateCourseName(name) {
    if (!name) return name;
    const pattern = COURSE_NAME_TRIM_WORDS
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    return name.replace(new RegExp(`\\s*(${pattern})\\b.*$`, "i"), "").trim();
}

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
        const courseEl = assignmentEl.querySelector(".item-course");
        const courseName = courseEl?.dataset.fullName || courseEl?.textContent || "";
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
    }

    const itemName = document.createElement("div");
    itemName.className = "item-name";
    itemName.textContent = assignment.name;

    const itemMeta = document.createElement("div");
    itemMeta.className = "item-meta";

    if (assignment.startDate) {
        const startDateContainer = document.createElement("div");
        startDateContainer.className = "start-date-container";

        const startDateValue = document.createElement("span");
        startDateValue.className = "start-date-value";
        startDateValue.textContent = formatFullDatetime(assignment.startDate);
        startDateContainer.appendChild(startDateValue);

        itemMeta.appendChild(startDateContainer);
    }

    const dueContainer = document.createElement("div");
    dueContainer.className = "due-date-container";

    const dueTime = document.createElement("span");
    dueTime.className = "item-time";
    dueTime.textContent = formatTimeFromDate(assignment.dueDate);
    dueContainer.appendChild(dueTime);

    const metaSeparator = document.createElement("span");
    metaSeparator.className = "item-meta-separator";
    metaSeparator.textContent = "|";
    dueContainer.appendChild(metaSeparator);

    const itemCourse = document.createElement("span");
    itemCourse.className = "item-course";
    itemCourse.textContent = truncateCourseName(course.name);
    itemCourse.dataset.fullName = course.name;
    itemCourse.style.color = getCourseColor(course.name);
    itemCourse.style.fontWeight = "bold";
    dueContainer.appendChild(itemCourse);

    itemMeta.appendChild(dueContainer);

    const itemContent = document.createElement("div");
    itemContent.className = "item-content";
    itemContent.appendChild(itemName);
    itemContent.appendChild(itemMeta);
    assignmentContainer.appendChild(itemContent);

    assignmentContainer.addEventListener("click", function(e) {
        e.preventDefault();
        window.open(assignment.url, '_blank');
    });

    const badge = document.createElement("div");
    badge.className = assignment.completed ? "item-completed-badge" : "item-incomplete-dot";
    badge.textContent = assignment.completed ? "✓" : "•";
    assignmentContainer.appendChild(badge);

    return assignmentContainer;
}

function initializeGUI() {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) return;
    addDataStatusIndicator(true);
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
            { items: course.assignments, showCompleted: true },
            { items: course.quizzes, showCompleted: true },
            { items: course.discussions, showCompleted: true }
        ];

        itemCollections.forEach(({ items, showCompleted }) => {
            if (items) {
                Object.keys(items).forEach((itemId) => {
                    const item = items[itemId];
                    if (item.dueDate && (!item.completed || showCompleted)) {
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
        const emptyMessage = document.createElement("div");
        emptyMessage.id = "loading-indicator";
        emptyMessage.textContent = "No upcoming assignments";
        calendarContainer.appendChild(emptyMessage);
        return;
    }

    // Create frequency chart at the top
    try {
        if (typeof createFrequencyChart === 'function' && typeof getWeekStart === 'function' && typeof getDateKey === 'function') {
            createFrequencyChart(calendarContainer, itemsByDate);
        }
    } catch (e) {
        console.error("Error creating frequency chart (non-fatal):", e);
    }

    // Generate calendar from CALENDAR_START_DAYS_BACK days before today to maxDate
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startDate.setDate(startDate.getDate() - CALENDAR_START_DAYS_BACK);
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

function createFrequencyChart(calendarContainer, itemsByDate) {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get the week containing today
    const today = new Date();
    const todayWeekStart = getWeekStart(today);

    // Create chart container
    const chartContainer = document.createElement("div");
    chartContainer.className = "frequency-chart-container";
    chartContainer.id = "frequency-chart";

    // Store current week and offset
    chartContainer._todayWeekStart = todayWeekStart.getTime();
    chartContainer._weekOffset = 0; // 0 = current week, 1 = next week, -1 = prev week (not allowed)
    chartContainer._calendarContainer = calendarContainer; // Store for click-to-scroll

    const prevBtn = document.createElement("button");
    prevBtn.className = "frequency-chart-btn";
    prevBtn.textContent = "‹";
    prevBtn.disabled = true;
    prevBtn.id = "frequency-chart-prev";
    prevBtn.title = "Previous week";

    const nextBtn = document.createElement("button");
    nextBtn.className = "frequency-chart-btn";
    nextBtn.textContent = "›";
    nextBtn.id = "frequency-chart-next";
    nextBtn.title = "Next week";

    // Create grid container
    const grid = document.createElement("div");
    grid.className = "frequency-chart-grid";
    grid.id = "frequency-chart-grid";

    // Week label row (label + FAQ button)
    const weekLabelRow = document.createElement("div");
    weekLabelRow.className = "frequency-chart-header-row";

    const weekLabel = document.createElement("div");
    weekLabel.className = "frequency-chart-week-label";
    weekLabel.id = "frequency-chart-week-label";
    const panelToggleBtn = document.createElement("button");
    panelToggleBtn.className = "spark-panel-toggle";
    panelToggleBtn.title = "Close panel";
    panelToggleBtn.textContent = "\u25b6";
    panelToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePanel();
    });
    weekLabelRow.appendChild(panelToggleBtn);

    weekLabelRow.appendChild(weekLabel);

    const faqBtn = document.createElement("button");
    faqBtn.className = "faq-btn";
    faqBtn.title = "Help / FAQ";
    faqBtn.textContent = "?";
    faqBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        safeSendMessage({ action: "openFaq" });
    });
    weekLabelRow.appendChild(faqBtn);

    chartContainer.appendChild(weekLabelRow);

    // Wrap grid + side buttons in a single row
    const chartRow = document.createElement("div");
    chartRow.className = "frequency-chart-row";
    chartRow.appendChild(prevBtn);
    chartRow.appendChild(grid);
    chartRow.appendChild(nextBtn);
    chartContainer.appendChild(chartRow);

    // Initial render
    try {
        renderFrequencyChart(chartContainer, itemsByDate, todayWeekStart, 0, calendarContainer);
    } catch (e) {
        console.error("Error rendering frequency chart:", e);
    }

    // Add button event listeners with error handling
    prevBtn.addEventListener("click", () => {
        try {
            const offset = chartContainer._weekOffset;
            if (offset > 0) {
                chartContainer._weekOffset = offset - 1;
                renderFrequencyChart(chartContainer, itemsByDate, todayWeekStart, chartContainer._weekOffset, calendarContainer);
                updateFrequencyNavButtons(chartContainer);
            }
        } catch (e) {
            console.error("Error in prev button click:", e);
        }
    });

    nextBtn.addEventListener("click", () => {
        try {
            chartContainer._weekOffset += 1;
            renderFrequencyChart(chartContainer, itemsByDate, todayWeekStart, chartContainer._weekOffset, calendarContainer);
            updateFrequencyNavButtons(chartContainer);
        } catch (e) {
            console.error("Error in next button click:", e);
        }
    });

    // Insert at the beginning of the calendar
    try {
        calendarContainer.insertBefore(chartContainer, calendarContainer.firstChild);
    } catch (e) {
        console.error("Error inserting frequency chart:", e);
        calendarContainer.appendChild(chartContainer);
    }
}

function renderFrequencyChart(chartContainer, itemsByDate, todayWeekStart, weekOffset, calendarContainer) {
    try {
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const grid = chartContainer.querySelector("#frequency-chart-grid");
        if (!grid) return; // Safety check

        grid.innerHTML = "";
        if (!calendarContainer) calendarContainer = chartContainer._calendarContainer; // Fallback

        // Calculate the week to display - convert timestamp back to Date if needed
        let displayWeekStart;
        if (typeof todayWeekStart === 'number') {
            displayWeekStart = new Date(todayWeekStart);
        } else {
            displayWeekStart = new Date(todayWeekStart.getFullYear(), todayWeekStart.getMonth(), todayWeekStart.getDate());
        }
        displayWeekStart.setDate(displayWeekStart.getDate() + (weekOffset * 7));

        // Update week label
        const weekLabelEl = chartContainer.querySelector("#frequency-chart-week-label");
        if (weekLabelEl) {
            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            weekLabelEl.textContent = `Week of ${monthNames[displayWeekStart.getMonth()]} ${displayWeekStart.getDate()}`;
        }

        // Count assignments by day of the week
        const weekCounts = [0, 0, 0, 0, 0, 0, 0];
        let maxCount = 0;

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(displayWeekStart);
            dayDate.setDate(dayDate.getDate() + i);
            const dateKey = getDateKey(dayDate);
            const count = itemsByDate[dateKey]?.length || 0;
            weekCounts[i] = count;
            maxCount = Math.max(maxCount, count);
        }


        // Create day cells
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(displayWeekStart);
            dayDate.setDate(dayDate.getDate() + i);
            const count = weekCounts[i];
            const heightPercent = maxCount === 0 ? 0 : (count / maxCount) * 100;

            const dayCell = document.createElement("div");
            dayCell.className = "frequency-day";

            const dayLabel = document.createElement("div");
            dayLabel.className = "frequency-day-label";
            dayLabel.textContent = dayLabels[i];
            dayCell.appendChild(dayLabel);

            const dateNum = document.createElement("div");
            dateNum.className = "frequency-day-date";
            dateNum.textContent = dayDate.getDate();
            dayCell.appendChild(dateNum);

            const barContainer = document.createElement("div");
            barContainer.className = "frequency-bar-container";

            const bar = document.createElement("div");
            bar.className = "frequency-bar";
            bar.style.height = heightPercent + "%";
            barContainer.appendChild(bar);
            dayCell.appendChild(barContainer);

            const countLabel = document.createElement("div");
            countLabel.className = "frequency-day-count";
            countLabel.textContent = count > 0 ? count : "—";
            dayCell.appendChild(countLabel);

            // Add click handler to scroll to this date
            if (calendarContainer) {
                dayCell.style.cursor = "pointer";
                dayCell.addEventListener("click", () => {
                    scrollToDate(calendarContainer, dayDate);
                });
            }

            grid.appendChild(dayCell);
        }
    } catch (e) {
        console.error("Error in renderFrequencyChart:", e);
    }
}

function scrollToDate(calendarContainer, targetDate) {
    try {
        const dateHeaders = Array.from(calendarContainer.querySelectorAll(".calendar-date-header"));

        for (const header of dateHeaders) {
            const titleText = header.querySelector(".date-title")?.textContent || "";
            const dateMatch = titleText.match(/(\w+)\s+(\d+)/);

            if (dateMatch) {
                const monthStr = dateMatch[1];
                const day = parseInt(dateMatch[2]);

                const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const monthIndex = months.findIndex(m => m.startsWith(monthStr.toLowerCase()));

                if (monthIndex >= 0 && day === targetDate.getDate() && monthIndex === targetDate.getMonth()) {
                    // .calendar-date-header is position:sticky, so getBoundingClientRect().top
                    // returns the "stuck" position when scrolled past — not its natural layout position.
                    // Instead, measure its non-sticky sibling (.calendar-items-container) which always
                    // reflects the true layout position in the scrollable content.
                    const chartEl = calendarContainer.querySelector("#frequency-chart");
                    const chartHeight = chartEl ? chartEl.getBoundingClientRect().height : 0;
                    const containerRect = calendarContainer.getBoundingClientRect();

                    const itemsContainer = header.nextElementSibling;
                    let targetScroll;
                    if (itemsContainer) {
                        const itemsRect = itemsContainer.getBoundingClientRect();
                        // Absolute position of the items container within scrollable content
                        const itemsAbsolutePos = itemsRect.top - containerRect.top + calendarContainer.scrollTop;
                        // The header sits directly above the items container; offsetHeight is unaffected by sticky
                        targetScroll = Math.max(0, itemsAbsolutePos - header.offsetHeight - chartHeight);
                    } else {
                        // Fallback for a header with no following sibling
                        const headerRect = header.getBoundingClientRect();
                        const absolutePos = headerRect.top - containerRect.top + calendarContainer.scrollTop;
                        targetScroll = Math.max(0, absolutePos - chartHeight);
                    }

                    calendarContainer.scrollTo({ top: targetScroll, behavior: "smooth" });
                    return;
                }
            }
        }
    } catch (e) {
        console.error("Error scrolling to date:", e);
    }
}

function updateFrequencyNavButtons(chartContainer) {
    try {
        const prevBtn = chartContainer.querySelector("#frequency-chart-prev");
        const nextBtn = chartContainer.querySelector("#frequency-chart-next");
        if (!prevBtn || !nextBtn) return;

        const offset = chartContainer._weekOffset || 0;

        // Prev button disabled when at current week
        prevBtn.disabled = offset <= 0;

        // Next button always enabled (no upper limit)
        nextBtn.disabled = false;
    } catch (e) {
        console.error("Error updating frequency nav buttons:", e);
    }
}
