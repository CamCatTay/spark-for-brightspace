const EXPANSION_STATE_KEY = "d2l-todolist-expanded";
const PANEL_WIDTH_KEY = "d2l-todolist-width";

function safeSendMessage(message, callback) {
    try {
        if (callback) {
            chrome.runtime.sendMessage(message, callback);
        } else {
            chrome.runtime.sendMessage(message);
        }
    } catch (e) {
        if (!e.message?.includes("Extension context invalidated")) {
            console.error(e);
        }
    }
}

let panelWidth = 350;
let container, toggleBtn;
let isAnimating = false;
let isDataStale = false;
let scrollbarWidth = 0;
// True when the panel was closed by another tab taking over (not by the user).
let wasClosedSilently = false;
// Callback invoked when the panel is restored after a silent close.
let _onPanelRestore = null;

function registerPanelRestoreCallback(fn) {
    _onPanelRestore = fn;
}

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

    wasClosedSilently = false;
    safeSendMessage({ action: isHidden ? "panelClosed" : "panelOpened" });

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

// Close the panel without changing the user's saved preference.
// Used when another tab takes over as the active panel.
// Deliberately skips animation — the user is not watching this tab.
function closePanelSilently() {
    if (!container || container.classList.contains("hidden")) return;
    wasClosedSilently = true;
    container.classList.add("hidden");
    container.style.display = "none";
    updateToggleButtonState(toggleBtn, false);
    updateToggleButtonPosition();
    document.body.style.marginRight = "0";
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

    // Claim the active panel slot if starting visible.
    if (shouldShowPanel) {
        safeSendMessage({ action: "panelOpened" });
    }

    // When the user switches back to this tab and the panel was silently
    // closed by another tab, re-open it and reclaim the active slot.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && wasClosedSilently) {
            const state = localStorage.getItem(EXPANSION_STATE_KEY);
            if (state === null || state === "true") {
                wasClosedSilently = false;
                // Hard-reset animation guard — any in-flight animationend handlers
                // from the silent close are now irrelevant.
                isAnimating = false;
                container.style.display = "flex";
                container.classList.remove("hidden");
                updateToggleButtonState(toggleBtn, true);
                updateBodyMargin();
                updateToggleButtonPosition();
                safeSendMessage({ action: "panelOpened" });
                if (_onPanelRestore) _onPanelRestore();
            }
        }
    });

    return calendarContainer;
}
