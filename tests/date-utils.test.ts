import { describe, test, expect } from "vitest";
import {
    formatTimeFromDate,
    formatFullDatetime,
    getDateOnly,
    formatDateHeader,
    getWeekStart,
    getDateKey,
} from "../src/utils/date-utils";

describe("formatTimeFromDate", () => {
    test("returns \"No time\" for null", () => {
        expect(formatTimeFromDate(null)).toBe("No time");
    });

    test("returns \"No time\" for undefined", () => {
        expect(formatTimeFromDate(undefined)).toBe("No time");
    });

    test("returns a non-empty string for a valid ISO date", () => {
        const result = formatTimeFromDate("2025-04-15T14:30:00");
        expect(typeof result).toBe("string");
        expect(result).not.toBe("No time");
    });

    test("includes AM or PM in the result", () => {
        const result = formatTimeFromDate("2025-04-15T14:30:00");
        expect(result).toMatch(/AM|PM/);
    });
});

describe("formatFullDatetime", () => {
    test("returns \"No date\" for null", () => {
        expect(formatFullDatetime(null)).toBe("No date");
    });

    test("returns \"No date\" for undefined", () => {
        expect(formatFullDatetime(undefined)).toBe("No date");
    });

    test("returns a non-empty string for a valid ISO date", () => {
        const result = formatFullDatetime("2025-01-15T10:30:00");
        expect(typeof result).toBe("string");
        expect(result).not.toBe("No date");
    });

    test("includes a recognizable month abbreviation", () => {
        const result = formatFullDatetime("2025-01-15T10:30:00");
        expect(result).toMatch(/Jan/);
    });
});

describe("getDateOnly", () => {
    test("returns null for null input", () => {
        expect(getDateOnly(null)).toBeNull();
    });

    test("returns a Date object for a valid date string", () => {
        const result = getDateOnly("2025-06-20T12:00:00");
        expect(result).toBeInstanceOf(Date);
    });

    test("zeroes out the time portion", () => {
        const result = getDateOnly("2025-06-20T23:59:59") as Date;
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
    });

    test("preserves the correct calendar date", () => {
        const result = getDateOnly("2025-06-20T12:00:00") as Date;
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(5); // June is 0-indexed
        expect(result.getDate()).toBe(20);
    });
});

describe("getDateKey", () => {
    test("returns a YYYY-MM-DD formatted string", () => {
        const date = new Date("2025-11-03T00:00:00.000Z");
        expect(getDateKey(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe("getWeekStart", () => {
    test("returns a Monday for a Wednesday input", () => {
        const wednesday = new Date(2025, 3, 16); // April 16 2025 is a Wednesday
        const monday = getWeekStart(wednesday);
        expect(monday.getDay()).toBe(1); // 1 = Monday
        expect(monday.getDate()).toBe(14);
    });

    test("returns the same Monday when input is already Monday", () => {
        const monday = new Date(2025, 3, 14); // April 14 2025 is a Monday
        const result = getWeekStart(monday);
        expect(result.getDay()).toBe(1);
        expect(result.getDate()).toBe(14);
    });
});

describe("formatDateHeader", () => {
    test("labels today as \"Today\"", () => {
        const today = new Date();
        const result = formatDateHeader(today);
        expect(result).toContain("Today");
    });

    test("labels tomorrow as \"Tomorrow\"", () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const result = formatDateHeader(tomorrow);
        expect(result).toContain("Tomorrow");
    });

    test("does not label a past date as Today or Tomorrow", () => {
        const past = new Date(2020, 0, 1); // Jan 1, 2020
        const result = formatDateHeader(past);
        expect(result).not.toContain("Today");
        expect(result).not.toContain("Tomorrow");
    });

    test("includes the month abbreviation for a past date", () => {
        const past = new Date(2020, 0, 1); // January
        const result = formatDateHeader(past);
        expect(result).toContain("Jan");
    });
});
