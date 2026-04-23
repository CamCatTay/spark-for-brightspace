// courseColorMap is module-level state, so we re-require the module fresh before
// each test that needs a clean slate using jest.resetModules().

let colorUtils;

beforeEach(() => {
    jest.resetModules();
    colorUtils = require('../src/utils/color-utils.js');
});

describe('COLOR_POOL', () => {
    test('contains at least one color', () => {
        expect(colorUtils.COLOR_POOL.length).toBeGreaterThan(0);
    });

    test('all entries are valid hex color strings', () => {
        colorUtils.COLOR_POOL.forEach(color => {
            expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });
});

describe('getColorFromPool', () => {
    test('returns the first color for index 0', () => {
        expect(colorUtils.getColorFromPool(0)).toBe(colorUtils.COLOR_POOL[0]);
    });

    test('wraps around when index exceeds pool length', () => {
        const poolSize = colorUtils.COLOR_POOL.length;
        expect(colorUtils.getColorFromPool(poolSize)).toBe(colorUtils.COLOR_POOL[0]);
        expect(colorUtils.getColorFromPool(poolSize + 1)).toBe(colorUtils.COLOR_POOL[1]);
    });

    test('returns a valid hex color string', () => {
        const result = colorUtils.getColorFromPool(2);
        expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});

describe('ensureCourseColorsAssigned', () => {
    test('assigns a color to each course', () => {
        const courseData = {
            '101': { name: 'Math 101' },
            '202': { name: 'History 202' },
        };
        colorUtils.ensureCourseColorsAssigned(courseData);
        expect(colorUtils.getCourseColor('Math 101')).not.toBe('#808080');
        expect(colorUtils.getCourseColor('History 202')).not.toBe('#808080');
    });

    test('assigns colors deterministically (alphabetical order)', () => {
        // "Alpha" sorts before "Zeta", so Alpha gets index 0 and Zeta gets index 1
        const courseData = {
            '1': { name: 'Zeta Course' },
            '2': { name: 'Alpha Course' },
        };
        colorUtils.ensureCourseColorsAssigned(courseData);
        expect(colorUtils.getCourseColor('Alpha Course')).toBe(colorUtils.COLOR_POOL[0]);
        expect(colorUtils.getCourseColor('Zeta Course')).toBe(colorUtils.COLOR_POOL[1]);
    });

    test('does not reassign an already-assigned course color', () => {
        const courseData = { '1': { name: 'Stable Course' } };
        colorUtils.ensureCourseColorsAssigned(courseData);
        const firstColor = colorUtils.getCourseColor('Stable Course');

        // Call again — color must remain the same
        colorUtils.ensureCourseColorsAssigned(courseData);
        expect(colorUtils.getCourseColor('Stable Course')).toBe(firstColor);
    });
});

describe('getCourseColor', () => {
    test('returns the grey fallback for an unknown course', () => {
        expect(colorUtils.getCourseColor('Unknown Course')).toBe('#808080');
    });

    test('returns a valid hex color after assignment', () => {
        colorUtils.ensureCourseColorsAssigned({ '1': { name: 'CS 101' } });
        const color = colorUtils.getCourseColor('CS 101');
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});
