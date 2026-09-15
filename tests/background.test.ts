// Verifies message handler dispatch, chrome API calls, cross-tab broadcasting,
// and the action button handler.
// Note: panel open/closed state is managed per-tab via sessionStorage - no cross-tab panel sync.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import type { MockInstance } from "vitest";
import { Action } from "../src/shared/actions";

// Typed aliases for the listener shapes background.ts registers
type MessageHandler = (
    request: Record<string, unknown>,
    sender: { tab?: { id?: number; url?: string } },
    send_response: (...args: unknown[]) => unknown,
) => unknown;
type ClickHandler = (tab: { id?: number; url?: string }) => void;

let on_message: MessageHandler;
let on_action_clicked: ClickHandler;
let mock_get_course_content: MockInstance;

// These constants originate in background.ts and are imported via dynamic import below.
// Declared here so helpers and tests can reference them after beforeEach sets their values.
let SETTINGS_VALUE_KEY: string;
let D2L_URL_FILTER: string;
let FAQ_URL: string;

// Returns a fake tab whose URL contains D2L_URL_FILTER
function make_d2l_tab(id: number) {
    return { id, url: `https://example.com${D2L_URL_FILTER}home` };
}

// Returns a fake tab whose URL does not contain D2L_URL_FILTER
function make_other_tab(id: number) {
    return { id, url: "https://example.com/other" };
}

beforeEach(async () => {
    vi.resetModules();

    // Register mock before importing the module under test so background.ts gets the mock
    vi.doMock("../src/api/brightspace", () => ({
        get_course_content: vi.fn(),
    }));

    const mock_chrome = {
        runtime: {
            onMessage: { addListener: vi.fn() },
            onInstalled: { addListener: vi.fn() },
            setUninstallURL: vi.fn(),
        },
        tabs: {
            query: vi.fn(),
            sendMessage: vi.fn().mockResolvedValue(undefined),
            create: vi.fn(),
        },
        storage: {
            local: { set: vi.fn(), get: vi.fn(), remove: vi.fn() },
            session: {
                set: vi.fn(),
                // returning empty object means worker_initialized is falsy - init code runs
                get: vi.fn().mockImplementation(
                    (_keys: unknown, cb: (r: Record<string, unknown>) => void) => cb({})
                ),
            },
        },
        action: { onClicked: { addListener: vi.fn() } },
        scripting: {
            executeScript: vi.fn().mockResolvedValue([{ result: false }]),
            insertCSS: vi.fn().mockResolvedValue(undefined),
        },
    };
    (globalThis as unknown as Record<string, unknown>)["chrome"] = mock_chrome;

    const bg = await import("../src/background");
    SETTINGS_VALUE_KEY = bg.SETTINGS_VALUE_KEY;
    D2L_URL_FILTER = bg.D2L_URL_FILTER;
    FAQ_URL = bg.FAQ_URL;

    const brightspace = await import("../src/api/brightspace");
    mock_get_course_content = vi.mocked(brightspace.get_course_content);

    on_message = mock_chrome.runtime.onMessage.addListener.mock.calls[0][0] as MessageHandler;
    on_action_clicked = mock_chrome.action.onClicked.addListener.mock.calls[0][0] as ClickHandler;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe(Action.FETCH_COURSES, () => {
    test("calls get_course_content with the sender tab URL and sends the result back", async () => {
        const course_data = { 101: { name: "Math 101" } };
        const send_response = vi.fn();
        const sender = { tab: { id: 1, url: "https://example.com/d2l/home" } };
        mock_get_course_content.mockResolvedValue(course_data);

        on_message({ action: Action.FETCH_COURSES }, sender, send_response);
        await Promise.resolve(); // flush resolved promise microtask

        expect(mock_get_course_content).toHaveBeenCalledWith(sender.tab.url);
        expect(send_response).toHaveBeenCalledWith(course_data);
    });

    test("returns true to keep the message channel open for the async response", () => {
        mock_get_course_content.mockResolvedValue({});
        const result = on_message({ action: Action.FETCH_COURSES }, { tab: { id: 1, url: "" } }, vi.fn());
        expect(result).toBe(true);
    });
});

describe(Action.OPEN_FAQ, () => {
    test("opens a new tab pointing to the FAQ URL", () => {
        on_message({ action: Action.OPEN_FAQ }, { tab: { id: 1 } }, vi.fn());
        const chrome = (globalThis as unknown as Record<string, { tabs: { create: MockInstance } }>)["chrome"];
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url: FAQ_URL });
    });
});

describe(Action.BROADCAST_FETCH_STARTED, () => {
    test("sends fetchStarted to other D2L tabs", () => {
        const other_d2l_tab = make_d2l_tab(2);
        const chrome = (globalThis as unknown as Record<string, { tabs: { query: MockInstance; sendMessage: MockInstance } }>)["chrome"];
        chrome.tabs.query.mockImplementation((_q: unknown, cb: (tabs: unknown[]) => void) => cb([other_d2l_tab]));

        on_message({ action: Action.BROADCAST_FETCH_STARTED }, { tab: { id: 1 } }, vi.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.FETCH_STARTED });
    });
});

describe(Action.BROADCAST_COURSE_DATA_UPDATED, () => {
    test("sends courseDataUpdated to other D2L tabs", () => {
        const other_d2l_tab = make_d2l_tab(2);
        const chrome = (globalThis as unknown as Record<string, { tabs: { query: MockInstance; sendMessage: MockInstance } }>)["chrome"];
        chrome.tabs.query.mockImplementation((_q: unknown, cb: (tabs: unknown[]) => void) => cb([other_d2l_tab]));

        on_message({ action: Action.BROADCAST_COURSE_DATA_UPDATED }, { tab: { id: 1 } }, vi.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.COURSE_DATA_UPDATED });
    });
});

describe(Action.BROADCAST_SETTINGS_CHANGED, () => {
    test("persists the new settings object to local storage", () => {
        const chrome = (globalThis as unknown as Record<string, {
            tabs: { query: MockInstance };
            storage: { local: { set: MockInstance } };
        }>)["chrome"];
        chrome.tabs.query.mockImplementation((_q: unknown, cb: (tabs: unknown[]) => void) => cb([]));
        const settings = { theme: "dark" };

        on_message({ action: Action.BROADCAST_SETTINGS_CHANGED, settings }, { tab: { id: 1 } }, vi.fn());

        expect(chrome.storage.local.set).toHaveBeenCalledWith({ [SETTINGS_VALUE_KEY]: settings });
    });

    test("relays settingsChanged with the settings payload to other D2L tabs", () => {
        const other_d2l_tab = make_d2l_tab(2);
        const chrome = (globalThis as unknown as Record<string, { tabs: { query: MockInstance; sendMessage: MockInstance } }>)["chrome"];
        chrome.tabs.query.mockImplementation((_q: unknown, cb: (tabs: unknown[]) => void) => cb([other_d2l_tab]));
        const settings = { theme: "dark" };

        on_message({ action: Action.BROADCAST_SETTINGS_CHANGED, settings }, { tab: { id: 1 } }, vi.fn());

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: Action.SETTINGS_CHANGED, settings });
    });
});

describe("chrome.action.onClicked", () => {
    test("sends toggle_panel when the clicked tab is a D2L tab", () => {
        const tab = make_d2l_tab(3);
        const chrome = (globalThis as unknown as Record<string, { tabs: { sendMessage: MockInstance } }>)["chrome"];
        on_action_clicked(tab);

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, { action: Action.TOGGLE_PANEL });
    });

    test("does not send toggle_panel when the clicked tab is not a D2L tab", () => {
        const tab = make_other_tab(3);
        const chrome = (globalThis as unknown as Record<string, { tabs: { sendMessage: MockInstance } }>)["chrome"];
        on_action_clicked(tab);

        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
});
