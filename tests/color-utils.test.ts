import { describe, test, expect, beforeEach } from "vitest";
import {
    COLOR_POOL,
    getColorFromPool,
    ensureCourseColorsAssigned,
    getCourseColor,
    _resetColorMap,
} from "../src/utils/color-utils";

// Reset module-level color map before each test so assignments don't bleed across tests.
beforeEach(() => {
    _resetColorMap();
});

describe("COLOR_POOL", () => {
    test("contains at least one color", () => {
        expect(COLOR_POOL.length).toBeGreaterThan(0);
    });

    test("all entries are valid hex color strings", () => {
        COLOR_POOL.forEach(color => {
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });
});

describe("getColorFromPool", () => {
    test("returns the first color for index 0", () => {
        expect(getColorFromPool(0)).toBe(COLOR_POOL[0]);
    });

    test("wraps around when index exceeds pool length", () => {
        const pool_size = COLOR_POOL.length;
        expect(getColorFromPool(pool_size)).toBe(COLOR_POOL[0]);
        expect(getColorFromPool(pool_size + 1)).toBe(COLOR_POOL[1]);
    });

    test("returns a valid hex color string", () => {
        const result = getColorFromPool(2);
        expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});

describe("ensureCourseColorsAssigned", () => {
    test("assigns a color to each course", () => {
        const course_data = {
            "101": { name: "Math 101" },
            "202": { name: "History 202" },
        };
        ensureCourseColorsAssigned(course_data);
        expect(getCourseColor("Math 101")).not.toBe("#808080");
        expect(getCourseColor("History 202")).not.toBe("#808080");
    });

    test("assigns colors deterministically (alphabetical order)", () => {
        // "Alpha" sorts before "Zeta", so Alpha gets index 0 and Zeta gets index 1
        const course_data = {
            "1": { name: "Zeta Course" },
            "2": { name: "Alpha Course" },
        };
        ensureCourseColorsAssigned(course_data);
        expect(getCourseColor("Alpha Course")).toBe(COLOR_POOL[0]);
        expect(getCourseColor("Zeta Course")).toBe(COLOR_POOL[1]);
    });

    test("does not reassign an already-assigned course color", () => {
        const course_data = { "1": { name: "Stable Course" } };
        ensureCourseColorsAssigned(course_data);
        const first_color = getCourseColor("Stable Course");

        // Call again - color must remain the same
        ensureCourseColorsAssigned(course_data);
        expect(getCourseColor("Stable Course")).toBe(first_color);
    });
});

describe("getCourseColor", () => {
    test("returns the grey fallback for an unknown course", () => {
        expect(getCourseColor("Unknown Course")).toBe("#808080");
    });

    test("returns a valid hex color after assignment", () => {
        ensureCourseColorsAssigned({ "1": { name: "CS 101" } });
        const color = getCourseColor("CS 101");
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});
