const EXPANSION_STATE_KEY = "d2l-todolist-expanded";
const PANEL_WIDTH_KEY = "d2l-todolist-width";

let panelWidth = 350;
let container, toggleBtn;
let isAnimating = false;
let isDataStale = false;
let scrollbarWidth = 0;

function updateBodyMargin() {
    document.body.style.marginRight = panelWidth + "px";
}

function updateToggleButtonPosition() {
    if (!toggleBtn) return;

    const isHidden = container && container.classList.contains("hidden");

    if (isHidden) {
        toggleBtn.style.right = scrollbarWidth + "px";
    } else {
        toggleBtn.style.right = (panelWidth + scrollbarWidth) + "px";
    }
}

function updateToggleButtonState(btn, isExpanded) {
    btn.textContent = isExpanded ? "▶" : "◀";
    btn.title = isExpanded ? "Collapse Calendar" : "Expand Calendar";
}

function togglePanel() {
    if (!container || isAnimating) return;
    isAnimating = true;

    container.classList.toggle("hidden");
    const isHidden = container.classList.contains("hidden");
    localStorage.setItem(EXPANSION_STATE_KEY, isHidden ? "false" : "true");
    updateToggleButtonState(toggleBtn, !isHidden);
    updateToggleButtonPosition();

    if (isHidden) {
        document.body.style.marginRight = "0";
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

function createEmbeddedCalendarUI() {
    const newContainer = document.createElement("div");
    newContainer.id = "d2l-todolist-widget";
    newContainer.style.width = panelWidth + "px";

    const panel = document.createElement("div");
    panel.id = "d2l-todolist-panel";
    panel.style.width = panelWidth + "px";

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "d2l-todolist-resize-handle";

    const calendarContainer = document.createElement("div");
    calendarContainer.id = "calendar-container";

    panel.appendChild(resizeHandle);
    panel.appendChild(calendarContainer);
    newContainer.appendChild(panel);

    const newToggleBtn = document.createElement("button");
    newToggleBtn.id = "d2l-todolist-toggle";
    newToggleBtn.className = "d2l-todolist-toggle";
    newToggleBtn.textContent = "◀";
    newToggleBtn.title = "Toggle Calendar";

    newToggleBtn.addEventListener("click", togglePanel);

    // Resize functionality
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
        const newWidth = Math.max(250, startWidth - deltaX);

        panelWidth = newWidth;
        newContainer.style.width = newWidth + "px";
        panel.style.width = newWidth + "px";
        updateBodyMargin();
        updateToggleButtonPosition();

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

function injectEmbeddedUI() {
    const existing = document.getElementById("d2l-todolist-widget");
    if (existing) existing.remove();

    const existingToggleBtn = document.getElementById("d2l-todolist-toggle");
    if (existingToggleBtn) existingToggleBtn.remove();

    const savedWidth = localStorage.getItem(PANEL_WIDTH_KEY);
    if (savedWidth) {
        panelWidth = parseInt(savedWidth, 10);
    }

    const { container: newContainer, calendarContainer, toggleBtn: newToggleBtn } = createEmbeddedCalendarUI();
    container = newContainer;
    toggleBtn = newToggleBtn;

    const savedState = localStorage.getItem(EXPANSION_STATE_KEY);
    const shouldShowPanel = savedState === null || savedState === "true";

    if (!shouldShowPanel) {
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
    updateToggleButtonPosition();

    return calendarContainer;
}
