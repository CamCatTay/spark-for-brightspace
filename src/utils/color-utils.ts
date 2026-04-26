// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

export const COLOR_POOL = [
    "#e05555",
    "#e07c2e",
    "#c9a800",
    "#3aaa4e",
    "#4a6ee0",
    "#d94f9e",
    "#8c52d4",
];

let courseColorMap: Record<string, string> = {};

export function getColorFromPool(index: number): string {
    return COLOR_POOL[index % COLOR_POOL.length];
}

export function ensureCourseColorsAssigned(courseData: Record<string, { name: string }>): void {
    const allCourseNames = new Set<string>();
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

export function getCourseColor(courseName: string): string {
    return courseColorMap[courseName] || "#808080";
}

// Resets the internal color map — only used in tests to ensure isolation between test cases.
export function _resetColorMap(): void {
    courseColorMap = {};
}
