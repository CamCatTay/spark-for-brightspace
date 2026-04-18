// color-utils.js
// Assigns and retrieves consistent hex colors for courses using a fixed color pool.

// Color pool as direct hex values for easy fine-tuning
const COLOR_POOL = [
    "#e05555",  // Red
    "#e07c2e",  // Orange
    "#c9a800",  // Yellow
    "#3aaa4e",  // Green
    "#4a6ee0",  // Blue
    "#d94f9e",  // Pink
    "#8c52d4",  // Purple
];

// { courseName: colorHex } - assigned lexicographically
let courseColorMap = {};

function getColorFromPool(index) {
    return COLOR_POOL[index % COLOR_POOL.length];
}

function ensureCourseColorsAssigned(courseData) {
    const allCourseNames = new Set();
    Object.keys(courseData).forEach((courseId) => {
        allCourseNames.add(courseData[courseId].name);
    });

    const sortedNames = Array.from(allCourseNames).sort();
    sortedNames.forEach((name, index) => {
        if (!courseColorMap[name]) {
            courseColorMap[name] = getColorFromPool(index);
        }
    });
}

function getCourseColor(courseName) {
    return courseColorMap[courseName] || "#808080";
}

// Allow importing in Node.js / Jest without breaking browser content script loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { COLOR_POOL, getColorFromPool, ensureCourseColorsAssigned, getCourseColor, _resetColorMap: () => { courseColorMap = {}; } };
}
