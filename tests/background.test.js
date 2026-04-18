// background.test.js
// Tests for src/background.js
// Verifies message handler dispatch, chrome API calls, cross-tab broadcasting,
// and the action button handler.

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
    ACTIVE_TAB_KEY,
    SETTINGS_OPEN_KEY,
    SETTINGS_VALUE_KEY,
    D2L_URL_FILTER,
    FAQ_URL,
} = require('../src/background.js');

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

describe('fetchCourses', () => {
    test('calls get_course_content with the sender tab URL and sends the result back', async () => {
        const course_data  = { 101: { name: 'Math 101' } };
        const send_response = jest.fn();
        const sender        = { tab: { id: 1, url: 'https://example.com/d2l/home' } };
        mock_get_course_content.mockResolvedValue(course_data);

        on_message({ action: 'fetchCourses' }, sender, send_response);
        await Promise.resolve(); // flush resolved promise microtask

        expect(mock_get_course_content).toHaveBeenCalledWith(sender.tab.url);
        expect(send_response).toHaveBeenCalledWith(course_data);
    });

    test('returns true to keep the message channel open for the async response', () => {
        mock_get_course_content.mockResolvedValue({});
        const result = on_message({ action: 'fetchCourses' }, { tab: { id: 1, url: '' } }, jest.fn());
        expect(result).toBe(true);
    });
});

// ============================================================
// openFaq
// ============================================================

describe('openFaq', () => {
    test('opens a new tab pointing to the FAQ URL', () => {
        on_message({ action: 'openFaq' }, { tab: { id: 1 } }, jest.fn());
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url: FAQ_URL });
    });
});

// ============================================================
// panelOpened
// ============================================================

describe('panelOpened', () => {
    test('stores the sender tab ID as the active tab', () => {
        chrome.tabs.query.mockImplementation((q, cb) => cb([]));

        on_message({ action: 'panelOpened' }, { tab: { id: 5 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [ACTIVE_TAB_KEY]: 5 });
    });

    test('sends closePanel to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: 'panelOpened' }, { tab: { id: 5 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: 'closePanel' });
    });

    test('does not send closePanel back to the sender tab', () => {
        const sender_tab = make_d2l_tab(5);
        chrome.tabs.query.mockImplementation((q, cb) => cb([sender_tab]));

        on_message({ action: 'panelOpened' }, { tab: { id: 5 } }, jest.fn());

        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    test('does not send closePanel to non-D2L tabs', () => {
        const non_d2l = make_other_tab(9);
        chrome.tabs.query.mockImplementation((q, cb) => cb([non_d2l]));

        on_message({ action: 'panelOpened' }, { tab: { id: 5 } }, jest.fn());

        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
});

// ============================================================
// panelClosed
// ============================================================

describe('panelClosed', () => {
    test('removes the active tab key when the sender is the recorded active tab', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ [ACTIVE_TAB_KEY]: 7 }));

        on_message({ action: 'panelClosed' }, { tab: { id: 7 } }, jest.fn());

        expect(chrome.storage.local.remove).toHaveBeenCalledWith(ACTIVE_TAB_KEY);
    });

    test('does not remove the key when the sender is a different tab', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ [ACTIVE_TAB_KEY]: 7 }));

        on_message({ action: 'panelClosed' }, { tab: { id: 99 } }, jest.fn());

        expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });
});

// ============================================================
// saveScrollPosition
// ============================================================

describe('saveScrollPosition', () => {
    test('persists the position value to local storage', () => {
        on_message({ action: 'saveScrollPosition', position: 350 }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SCROLL_POS_KEY]: 350 });
    });
});

// ============================================================
// getScrollPosition
// ============================================================

describe('getScrollPosition', () => {
    test('responds with the stored scroll position', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({ [SCROLL_POS_KEY]: 200 }));
        const send_response = jest.fn();

        on_message({ action: 'getScrollPosition' }, { tab: { id: 1 } }, send_response);

        expect(send_response).toHaveBeenCalledWith({ position: 200 });
    });

    test('responds with 0 when no position has been stored', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));
        const send_response = jest.fn();

        on_message({ action: 'getScrollPosition' }, { tab: { id: 1 } }, send_response);

        expect(send_response).toHaveBeenCalledWith({ position: 0 });
    });

    test('returns true to keep the message channel open for the async response', () => {
        chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));
        const result = on_message({ action: 'getScrollPosition' }, { tab: { id: 1 } }, jest.fn());
        expect(result).toBe(true);
    });
});

// ============================================================
// broadcastFetchStarted
// ============================================================

describe('broadcastFetchStarted', () => {
    test('sends fetchStarted to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: 'broadcastFetchStarted' }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: 'fetchStarted' });
    });
});

// ============================================================
// broadcastCourseDataUpdated
// ============================================================

describe('broadcastCourseDataUpdated', () => {
    test('sends courseDataUpdated to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: 'broadcastCourseDataUpdated' }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: 'courseDataUpdated' });
    });
});

// ============================================================
// broadcastSettingsChanged
// ============================================================

describe('broadcastSettingsChanged', () => {
    test('persists the new settings object to local storage', () => {
        chrome.tabs.query.mockImplementation((q, cb) => cb([]));
        const settings = { theme: 'dark' };

        on_message({ action: 'broadcastSettingsChanged', settings }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_VALUE_KEY]: settings });
    });

    test('relays settingsChanged with the settings payload to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));
        const settings = { theme: 'dark' };

        on_message({ action: 'broadcastSettingsChanged', settings }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: 'settingsChanged', settings });
    });
});

// ============================================================
// broadcastSettingsOpened
// ============================================================

describe('broadcastSettingsOpened', () => {
    test('persists open state as true in local storage', () => {
        chrome.tabs.query.mockImplementation((q, cb) => cb([]));

        on_message({ action: 'broadcastSettingsOpened' }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_OPEN_KEY]: true });
    });

    test('sends settingsOpened to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: 'broadcastSettingsOpened' }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: 'settingsOpened' });
    });
});

// ============================================================
// broadcastSettingsClosed
// ============================================================

describe('broadcastSettingsClosed', () => {
    test('persists open state as false in local storage', () => {
        chrome.tabs.query.mockImplementation((q, cb) => cb([]));

        on_message({ action: 'broadcastSettingsClosed' }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_OPEN_KEY]: false });
    });

    test('sends settingsClosed to other D2L tabs', () => {
        const other_d2l_tab = make_d2l_tab(2);
        chrome.tabs.query.mockImplementation((q, cb) => cb([other_d2l_tab]));

        on_message({ action: 'broadcastSettingsClosed' }, { tab: { id: 1 } }, jest.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: 'settingsClosed' });
    });
});

// ============================================================
// Action Button Handler
// ============================================================

describe('chrome.action.onClicked', () => {
    test('sends togglePanel when the clicked tab is a D2L tab', () => {
        const tab = make_d2l_tab(3);
        on_action_clicked(tab);

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, { action: 'togglePanel' });
    });

    test('does not send togglePanel when the clicked tab is not a D2L tab', () => {
        const tab = make_other_tab(3);
        on_action_clicked(tab);

        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
});
