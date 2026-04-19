// background.test.js
// Tests for src/background.js
// Verifies message handler dispatch, chrome API calls, cross-tab broadcasting,
// and the action button handler.
// Note: panel open/closed state is managed per-tab via sessionStorage — no cross-tab panel sync.

jest.mock('/src/api/brightspace.js', () => ({
    get_course_content: jest.fn()
}));

// ============================================================
// Constants
// ============================================================

// Stub chrome before the require so background.js side effects don't throw.
// beforeEach replaces this with proper jest mocks for each test.
global.chrome = {
    runtime: { onMessage: { addListener: () => {} } },
    tabs:    { query: () => {}, sendMessage: () => {}, create: () => {} },
    storage: { local: { set: () => {}, get: () => {}, remove: () => {} } },
    action:  { onClicked: { addListener: () => {} } }
};

// Imported directly from background.js to guarantee parity — never duplicate these here
const {
    SCROLL_POS_KEY,
    SETTINGS_OPEN_KEY,
    SETTINGS_VALUE_KEY,
    D2L_URL_FILTER,
    FAQ_URL,
} = require('../src/background.js');

const { Action } = require("../src/shared/actions.js");

// ============================================================
// Mock Helpers
// ============================================================

// Returns a fake tab whose URL contains D2L_URL_FILTER
function make_d2l_tab(id) {
    return { id, url: `https://example.com${D2L_URL_FILTER}home` };
}

// Returns a fake tab whose URL does not contain D2L_URL_FILTER
function make_other_tab(id) {
    return { id, url: 'https://example.com/other' };
}

// ============================================================
// Setup
// ============================================================

let on_message;
let on_action_clicked;
let mock_get_course_content;

beforeEach(() => {
    jest.resetModules();

    global.chrome = {
        runtime: { onMessage: { addListener: jest.fn() } },
        tabs: {
            query: jest.fn(),
            sendMessage: jest.fn().mockResolvedValue(undefined),
            create: jest.fn()
        },
        storage: {
            local: {
                set: jest.fn(),
                get: jest.fn(),
                remove: jest.fn()
            }
        },
        action: { onClicked: { addListener: jest.fn() } }
    };

    // Require mock module first so background.js shares the same cached instance
    mock_get_course_content = require('/src/api/brightspace.js').get_course_content;
    require('../src/background.js');

    on_message        = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    on_action_clicked = chrome.action.onClicked.addListener.mock.calls[0][0];
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ============================================================
// fetchCourses
// ============================================================

describe(Action.FETCH_COURSES, () => {
    test('calls get_course_content with the sender tab URL and sends the result back', async () => {
        const course_data  = { 101: { name: 'Math 101' } };
        const send_response = jest.fn();
        const sender        = { tab: { id: 1, url: 'https://example.com/d2l/home' } };
        mock_get_course_content.mockResolvedValue(course_data);

        on_message({ action: Action.FETCH_COURSES }, sender, send_response);
        await Promise.resolve(); // flush resolved promise microtask

        expect(mock_get_course_content).toHaveBeenCalledWith(sender.tab.url);
        expect(send_response).toHaveBeenCalledWith(course_data);
    });

    test('returns true to keep the message channel open for the async response', () => {
        mock_get_course_content.mockResolvedValue({});
        const result = on_message({ action: Action.FETCH_COURSES }, { tab: { id: 1, url: '' } }, jest.fn());
        expect(result).toBe(true);
    });
});

// ============================================================
// openFaq
// ============================================================

describe(Action.OPEN_FAQ, () => {
    test('opens a new tab pointing to the FAQ URL', () => {
        on_message({ action: Action.OPEN_FAQ }, { tab: { id: 1 } }, jest.fn());
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url: FAQ_URL });
    });
});

// ============================================================
// saveScrollPosition
// ============================================================

describe(Action.SAVE_SCROLL_POSITION, () => {
    test('persists the position value to local storage', () => {
        on_message({ action: Action.SAVE_SCROLL_POSITION, position: 350 }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SCROLL_POS_KEY]: 350 });
    });
});

// ============================================================
// getScrollPosition
// ============================================================

describe(Action.GET_SCROLL_POSITION, () => {
    test('responds with the stored scroll position', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ [SCROLL_POS_KEY]: 200 }));
        const send_response = jest.fn();

        on_message({ action: Action.GET_SCROLL_POSITION }, { tab: { id: 1 } }, send_response);

        expect(send_response).toHaveBeenCalledWith({ position: 200 });
    });

    test('responds with 0 when no position has been stored', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));
        const send_response = jest.fn();

        on_message({ action: Action.GET_SCROLL_POSITION }, { tab: { id: 1 } }, send_response);

        expect(send_response).toHaveBeenCalledWith({ position: 0 });
    });

    test('returns true to keep the message channel open for the async response', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));
        const result = on_message({ action: Action.GET_SCROLL_POSITION }, { tab: { id: 1 } }, jest.fn());
        expect(result).toBe(true);
    });
});

// ============================================================
// broadcastFetchStarted
// ============================================================

describe(Action.BROADCAST_FETCH_STARTED, () => {
    test('sends fetchStarted to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: Action.BROADCAST_FETCH_STARTED }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.FETCH_STARTED });
    });
});

// ============================================================
// broadcastCourseDataUpdated
// ============================================================

describe(Action.BROADCAST_COURSE_DATA_UPDATED, () => {
    test('sends courseDataUpdated to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: Action.BROADCAST_COURSE_DATA_UPDATED }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.COURSE_DATA_UPDATED });
    });
});

// ============================================================
// broadcastSettingsChanged
// ============================================================

describe(Action.BROADCAST_SETTINGS_CHANGED, () => {
    test('persists the new settings object to local storage', () => {
        chrome.tabs.query.mockImplementation((q, cb) => cb([]));
        const settings = { theme: 'dark' };

        on_message({ action: Action.BROADCAST_SETTINGS_CHANGED, settings }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_VALUE_KEY]: settings });
    });

    test('relays settingsChanged with the settings payload to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));
        const settings = { theme: 'dark' };

        on_message({ action: Action.BROADCAST_SETTINGS_CHANGED, settings }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.SETTINGS_CHANGED, settings });
    });
});

// ============================================================
// broadcastSettingsOpened
// ============================================================

describe(Action.BROADCAST_SETTINGS_OPENED, () => {
    test('persists open state as true in local storage', () => {
        chrome.tabs.query.mockImplementation((q, cb) => cb([]));

        on_message({ action: Action.BROADCAST_SETTINGS_OPENED }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_OPEN_KEY]: true });
    });

    test('sends settingsOpened to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: Action.BROADCAST_SETTINGS_OPENED }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.SETTINGS_OPENED });
    });
});

// ============================================================
// broadcastSettingsClosed
// ============================================================

describe(Action.BROADCAST_SETTINGS_CLOSED, () => {
    test('persists open state as false in local storage', () => {
        chrome.tabs.query.mockImplementation((q, cb) => cb([]));

        on_message({ action: Action.BROADCAST_SETTINGS_CLOSED }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_OPEN_KEY]: false });
    });

    test('sends settingsClosed to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: Action.BROADCAST_SETTINGS_CLOSED }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.SETTINGS_CLOSED });
    });
});

// ============================================================
// Action Button Handler
// ============================================================

describe('chrome.action.onClicked', () => {
    test('sends toggle_panel when the clicked tab is a D2L tab', () => {
        const tab = make_d2l_tab(3);
        on_action_clicked(tab);

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, { action: Action.TOGGLE_PANEL });
    });

    test('does not send toggle_panel when the clicked tab is not a D2L tab', () => {
        const tab = make_other_tab(3);
        on_action_clicked(tab);

        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
});
