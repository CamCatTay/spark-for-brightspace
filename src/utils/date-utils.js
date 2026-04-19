// date-utils.js
// Date formatting and comparison helpers used across the UI layer.

export function formatTimeFromDate(dateString) {
    if (!dateString) return "No time";
    try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
        return "No time";
    }
}

export function formatFullDatetime(dateString) {
    if (!dateString) return "No date";
    try {
        const date = new Date(dateString);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${monthNames[date.getMonth()]} ${date.getDate()}`;
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${dateStr}, ${timeStr}`;
    } catch (e) {
        return "No date";
    }
}

export function getDateOnly(dateString) {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    } catch (e) {
        return null;
    }
}

export function formatDateHeader(date) {
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

export function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.getFullYear(), d.getMonth(), diff);
}

export function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

// Allow importing in Node.js / Jest without breaking browser content script loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatTimeFromDate, formatFullDatetime, getDateOnly, formatDateHeader, getWeekStart, getDateKey };
}
