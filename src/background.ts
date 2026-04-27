// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { get_course_content } from "./api/brightspace";
import { Action } from "./shared/actions";

export const SETTINGS_VALUE_KEY = "spark-user-settings";
export const D2L_URL_FILTER = "/d2l/";
export const FAQ_URL = "https://camcattay.github.io/spark-for-brightspace/faq.html";
const UNINSTALL_URL = "https://camcattay.github.io/spark-for-brightspace/uninstall.html";
const SPARK_INITIALIZED_FLAG = "__spark_initialized__";
const SESSION_INITIALIZED_KEY = "worker_initialized";
const CLIENT_ID_KEY = "spark-client-id";

function generate_client_id(): string {
    return crypto.randomUUID();
}

function store_client_id(client_id: string): void {
    chrome.storage.local.set({ [CLIENT_ID_KEY]: client_id });
}

// Generates a persistent anonymous client ID on first install and stores it.
// Used to distinguish unique users in analytics without collecting any personal data.
function handle_install(details: chrome.runtime.InstalledDetails): void {
    if (details.reason !== "install") return;
    store_client_id(generate_client_id());
}

function is_d2l_tab(url: string | undefined): boolean {
    return !!url && url.includes(D2L_URL_FILTER);
}

function broadcast_to_d2l_tabs(sender_tab_id: number | undefined, message: Record<string, unknown>): void {
    chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
            if (tab.id !== sender_tab_id && is_d2l_tab(tab.url)) {
                chrome.tabs.sendMessage(tab.id!, message).catch(() => {});
            }
        });
    });
}

function handle_fetch_courses(sender: chrome.runtime.MessageSender, send_response: (response: unknown) => void): boolean {
    get_course_content(sender.tab?.url ?? "").then(function(data) {
        send_response(data);
    });
    return true;
}

function handle_open_faq(): void {
    chrome.tabs.create({ url: FAQ_URL });
}

function handle_fetch_started(sender: chrome.runtime.MessageSender): void {
    broadcast_to_d2l_tabs(sender.tab?.id, { action: Action.FETCH_STARTED });
}

function handle_course_data_updated(sender: chrome.runtime.MessageSender): void {
    broadcast_to_d2l_tabs(sender.tab?.id, { action: Action.COURSE_DATA_UPDATED });
}

function save_settings(settings: unknown): void {
    chrome.storage.local.set({ [SETTINGS_VALUE_KEY]: settings });
}

function handle_settings_changed(sender: chrome.runtime.MessageSender, settings: unknown): void {
    save_settings(settings);
    broadcast_to_d2l_tabs(sender.tab?.id, { action: Action.SETTINGS_CHANGED, settings });
}

function handle_message(
    request: Record<string, unknown>,
    sender: chrome.runtime.MessageSender,
    send_response: (response: unknown) => void,
): boolean | void {
    if (request.action === Action.FETCH_COURSES) {
        return handle_fetch_courses(sender, send_response);
    }
    if (request.action === Action.OPEN_FAQ) {
        handle_open_faq();
        return;
    }
    if (request.action === Action.BROADCAST_FETCH_STARTED) {
        handle_fetch_started(sender);
        return;
    }
    if (request.action === Action.BROADCAST_COURSE_DATA_UPDATED) {
        handle_course_data_updated(sender);
        return;
    }
    if (request.action === Action.BROADCAST_SETTINGS_CHANGED) {
        handle_settings_changed(sender, request.settings);
        return;
    }
}

function handle_icon_clicked(tab: chrome.tabs.Tab): void {
    if (is_d2l_tab(tab.url)) {
        chrome.tabs.sendMessage(tab.id!, { action: Action.TOGGLE_PANEL });
    }
}

function is_content_script_active(flag: string): boolean {
    return (window as unknown as Record<string, unknown>)[flag] === true;
}

function inject_content_script(tab: chrome.tabs.Tab): void {
    chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: is_content_script_active,
        args: [SPARK_INITIALIZED_FLAG],
    }).then(results => {
        if (results && results[0] && results[0].result === true) return;
        chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            files: ["/dist/content.js"]
        }).catch(() => {});
        chrome.scripting.insertCSS({
            target: { tabId: tab.id! },
            files: ["/styles/sidepanel.css"]
        }).catch(() => {});
    }).catch(() => {});
}

function inject_into_open_d2l_tabs(): void {
    chrome.tabs.query({}, function(tabs) {
        tabs.filter(tab => is_d2l_tab(tab.url)).forEach(inject_content_script);
    });
}

// Runs once per service-worker lifecycle (session storage is wiped on first install,
// extension re-enable, and browser restart). Injects the content script into any
// already-open D2L tabs that don't have it yet, so users never need to reload.
function initialize_worker_session(): void {
    chrome.storage.session.get([SESSION_INITIALIZED_KEY], (result) => {
        if (result[SESSION_INITIALIZED_KEY]) return;
        chrome.storage.session.set({ [SESSION_INITIALIZED_KEY]: true });
        inject_into_open_d2l_tabs();
    });
}

function initialize(): void {
    chrome.runtime.setUninstallURL(UNINSTALL_URL);
    chrome.runtime.onInstalled.addListener(handle_install);
    chrome.runtime.onMessage.addListener(handle_message);
    chrome.action.onClicked.addListener(handle_icon_clicked);
    initialize_worker_session();
}

initialize();
