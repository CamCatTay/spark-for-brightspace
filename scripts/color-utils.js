// Saturation level for course colors (0-100, where 100 is fully saturated)
const COLOR_SATURATION = 80;

// Lightness level for course colors (0-100, where 0 is dark/black, 50 is normal, 100 is bright/white)
const COLOR_LIGHTNESS = 60;

// Color pool defined by hue, with saturation and lightness applied from constants
const COLOR_POOL_HSL = [
    [0],      // Red
    [30],     // Orange
    [45],     // Yellow
    [105],    // Green
    [228],    // Blue
    [330],    // Pink
    [270],    // Purple
];

// { courseName: colorHex } - assigned lexicographically
let courseColorMap = {};

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

function getColorFromPool(index) {
    const [hue] = COLOR_POOL_HSL[index % COLOR_POOL_HSL.length];
    return hslToHex(hue, COLOR_SATURATION, COLOR_LIGHTNESS);
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
