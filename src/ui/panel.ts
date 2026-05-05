// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { SettingsCss } from "../shared/constants/ui";
import { PanelCss } from "../shared/constants/ui";
import { TOGGLE_PANEL, OPEN_URL } from "../shared/constants/actions";
import { get_setting } from "../core/settings";
import { SHOW_ON_START } from "../shared/constants/storage-keys";

// Registered by content.ts to avoid a circular import between panel and settings-menu.
let settings_panel_builder: (() => HTMLElement) | null = null;

export function register_settings_panel_builder(fn: () => HTMLElement): void {
    settings_panel_builder = fn;
}

const EXPANSION_STATE_KEY = "spark-expanded";
const PANEL_WIDTH_KEY = "spark-width";
const TOGGLE_BTN_TOP_KEY = "spark-toggle-btn-top";

const DEFAULT_PANEL_WIDTH = 500;
const MIN_PANEL_WIDTH = 330;
const PANEL_SLIDE_IN_MS = 300;
const SETTINGS_TRANSITION_MS = 250;
const DRAG_MOVE_THRESHOLD_PX = 4;

const CHEVRON_OPEN = "\u276F";
const CHEVRON_CLOSED = "\u276E";

export let panel_width: number = DEFAULT_PANEL_WIDTH;
let panel_container: HTMLElement | null = null;
let toggle_button: HTMLButtonElement | null = null;
let panel_is_animating: boolean = false;
let settings_was_open: boolean = false;
let panel_restore_callback: (() => void) | null = null;
let panel_open_callback: (() => void) | null = null;

function sync_body_margin_to_panel_width(): void {
    document.documentElement.style.setProperty("--spark-panel-width", panel_width + "px");
    document.body.style.marginRight = panel_width + "px";
    if (toggle_button) toggle_button.style.right = panel_width + "px";
}

function build_panel_dom(): {
    widget_container: HTMLDivElement;
    panel_el: HTMLDivElement;
    resize_handle: HTMLDivElement;
    calendar_container: HTMLDivElement;
} {
    const widget_container = document.createElement("div");
    widget_container.id = PanelCss.WIDGET_ID;
    widget_container.style.width = panel_width + "px";

    const panel_el = document.createElement("div");
    panel_el.id = PanelCss.PANEL_ID;
    panel_el.style.width = panel_width + "px";

    const resize_handle = document.createElement("div");
    resize_handle.className = PanelCss.RESIZE_HANDLE;

    const calendar_container = document.createElement("div");
    calendar_container.id = PanelCss.CALENDAR_CONTAINER_ID;

    panel_el.appendChild(resize_handle);
    panel_el.appendChild(calendar_container);
    widget_container.appendChild(panel_el);

    return { widget_container, panel_el, resize_handle, calendar_container };
}

function attach_resize_handler(
    resize_handle: HTMLElement,
    widget_container: HTMLElement,
    panel_el: HTMLElement
): void {
    let is_resizing = false;
    let resize_start_x = 0;
    let resize_start_width = panel_width;

    resize_handle.addEventListener("mousedown", function(e) {
        is_resizing = true;
        resize_start_x = e.clientX;
        resize_start_width = panel_width;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
    });

    document.addEventListener("mousemove", function(e) {
        if (!is_resizing) return;

        const delta_x = e.clientX - resize_start_x;
        const new_width = Math.max(MIN_PANEL_WIDTH, resize_start_width - delta_x);

        panel_width = new_width;
        widget_container.style.width = new_width + "px";
        panel_el.style.width = new_width + "px";
        sync_body_margin_to_panel_width();

        const settings_panel = document.getElementById(SettingsCss.PANEL_ID);
        if (settings_panel) settings_panel.style.right = new_width + "px";

        chrome.storage.local.set({PANEL_WIDTH_KEY: new_width.toString()});
    });

    document.addEventListener("mouseup", function() {
        if (is_resizing) {
            is_resizing = false;
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        }
    });
}

function create_panel_widget(): { widget_container: HTMLDivElement; calendar_container: HTMLDivElement } {
    const { widget_container, panel_el, resize_handle, calendar_container } = build_panel_dom();
    attach_resize_handler(resize_handle, widget_container, panel_el);
    return { widget_container, calendar_container };
}

function clamp_button_top_position(top_px: number): number {
    const btn_height = toggle_button ? toggle_button.offsetHeight : 40;
    const max_top = window.innerHeight - btn_height;
    return Math.max(0, Math.min(top_px, max_top));
}

function set_toggle_button_top(top_px: number): void {
    const clamped = clamp_button_top_position(top_px);
    toggle_button!.style.top = clamped + "px";
    toggle_button!.style.transform = "none";
    chrome.storage.local.set({TOGGLE_BTN_TOP_KEY: clamped.toString()});
}

function attach_drag_handler(btn: HTMLButtonElement): void {
    let is_dragging = false;
    let drag_start_y = 0;
    let drag_start_top = 0;
    let drag_moved = false;

    btn.addEventListener("mousedown", function(e) {
        is_dragging = true;
        drag_moved = false;
        drag_start_y = e.clientY;
        drag_start_top = btn.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
        e.preventDefault();
    });

    document.addEventListener("mousemove", function(e) {
        if (!is_dragging) return;
        const delta_y = e.clientY - drag_start_y;
        if (Math.abs(delta_y) > DRAG_MOVE_THRESHOLD_PX) drag_moved = true;
        set_toggle_button_top(drag_start_top + delta_y);
    });

    document.addEventListener("mouseup", function() {
        if (!is_dragging) return;
        is_dragging = false;
        document.body.style.userSelect = "";
    });

    btn.addEventListener("click", function(e) {
        if (drag_moved) {
            e.stopImmediatePropagation();
            drag_moved = false;
            return;
        }
        toggle_panel();
    });
}

function build_toggle_button(): HTMLButtonElement {
    const existing = document.getElementById(PanelCss.TOGGLE_BTN_ID);
    if (existing) existing.remove();

    const btn = document.createElement("button");
    btn.id = PanelCss.TOGGLE_BTN_ID;
    btn.setAttribute("title", PanelCss.TOGGLE_BTN_TITLE);
    btn.textContent = CHEVRON_CLOSED;

    attach_drag_handler(btn);
    return btn;
}

// Swallows invalidated-context errors that fire when the extension is reloaded
// while a page is still open; re-logs all other errors.
export function safe_send_message(message: Record<string, unknown>, callback?: (response: unknown) => void): void {
    try {
        if (callback) {
            chrome.runtime.sendMessage(message, callback);
        } else {
            chrome.runtime.sendMessage(message);
        }
    } catch (e) {
        if (!(e as Error).message?.includes("Extension context invalidated")) {
            console.error(e);
        }
    }
}

export function register_panel_restore_callback(fn: () => void): void {
    panel_restore_callback = fn;
}

export function register_panel_open_callback(fn: () => void): void {
    panel_open_callback = fn;
}

function hide_panel_immediately(): void {
    panel_container!.classList.add(PanelCss.WIDGET_HIDDEN);
    sessionStorage.setItem(EXPANSION_STATE_KEY, "false");
    document.body.style.marginRight = "0";
    if (toggle_button) {
        toggle_button.textContent = CHEVRON_CLOSED;
        toggle_button.classList.remove(PanelCss.TOGGLE_SLIDE_IN);
        toggle_button.classList.add(PanelCss.TOGGLE_SLIDE_OUT);
        const on_toggle_out = () => {
            toggle_button!.classList.remove(PanelCss.TOGGLE_SLIDE_OUT);
            toggle_button!.style.right = "0px";
            toggle_button!.removeEventListener("animationend", on_toggle_out);
        };
        toggle_button.addEventListener("animationend", on_toggle_out);
    }
    const on_animation_end = () => {
        panel_container!.style.display = "none";
        panel_container!.removeEventListener("animationend", on_animation_end);
        panel_is_animating = false;
    };
    panel_container!.addEventListener("animationend", on_animation_end);
}

function close_panel(): void {
    const settings_panel = document.getElementById(SettingsCss.PANEL_ID);
    const is_settings_open = settings_panel && settings_panel.classList.contains(SettingsCss.OPEN);

    if (is_settings_open) {
        settings_was_open = true;
        settings_panel.classList.remove(SettingsCss.OPEN);
        setTimeout(hide_panel_immediately, SETTINGS_TRANSITION_MS);
    } else {
        settings_was_open = false;
        hide_panel_immediately();
    }
}

function reopen_settings_after_panel_slides_in(): void {
    settings_was_open = false;
    let settings_panel = document.getElementById(SettingsCss.PANEL_ID);
    if (!settings_panel) {
        if (!settings_panel_builder) return;
        settings_panel = settings_panel_builder();
        document.body.appendChild(settings_panel);
    }
    settings_panel.style.right = panel_width + "px";
    settings_panel.classList.add(SettingsCss.OPEN);
    if (panel_open_callback) panel_open_callback();
    setTimeout(() => { panel_is_animating = false; }, SETTINGS_TRANSITION_MS);
}

function open_panel(): void {
    panel_container!.classList.remove(PanelCss.WIDGET_HIDDEN);
    sessionStorage.setItem(EXPANSION_STATE_KEY, "true");
    panel_container!.style.display = "flex";
    sync_body_margin_to_panel_width();
    if (toggle_button) {
        toggle_button.textContent = CHEVRON_OPEN;
        toggle_button.classList.remove(PanelCss.TOGGLE_SLIDE_OUT);
        toggle_button.classList.add(PanelCss.TOGGLE_SLIDE_IN);
        const on_toggle_in = () => {
            toggle_button!.classList.remove(PanelCss.TOGGLE_SLIDE_IN);
            toggle_button!.removeEventListener("animationend", on_toggle_in);
        };
        toggle_button.addEventListener("animationend", on_toggle_in);
    }

    if (settings_was_open) {
        setTimeout(reopen_settings_after_panel_slides_in, PANEL_SLIDE_IN_MS);
    } else {
        setTimeout(() => {
            if (panel_open_callback) panel_open_callback();
            panel_is_animating = false;
        }, PANEL_SLIDE_IN_MS);
    }
}

export function toggle_panel(): void {
    if (!panel_container || panel_is_animating) return;
    panel_is_animating = true;

    const is_panel_visible = !panel_container.classList.contains(PanelCss.WIDGET_HIDDEN);
    if (is_panel_visible) {
        close_panel();
    } else {
        open_panel();
    }
}

async function load_saved_panel_width(): Promise<void> {
    const result = await chrome.storage.local.get([PANEL_WIDTH_KEY]);
    if (result[PANEL_WIDTH_KEY]) {
        panel_width = result[PANEL_WIDTH_KEY];
    }
}

async function restore_toggle_button_position(): Promise<void> {
    const result = await chrome.storage.local.get([TOGGLE_BTN_TOP_KEY]);
    if (result[TOGGLE_BTN_TOP_KEY]) {
        toggle_button!.style.top = result[TOGGLE_BTN_TOP_KEY] + "px";
        toggle_button!.style.transform = "none";
    }
}

function determine_initial_panel_visibility(): boolean {
    const expansion_state = sessionStorage.getItem(EXPANSION_STATE_KEY);
    return expansion_state === "true" || (expansion_state === null && get_setting(SHOW_ON_START));
}

function apply_initial_panel_state(is_visible: boolean): void {
    if (is_visible) {
        toggle_button!.style.right = panel_width + "px";
        toggle_button!.textContent = CHEVRON_OPEN;
        sync_body_margin_to_panel_width();
    } else {
        panel_container!.style.display = "none";
        panel_container!.classList.add(PanelCss.WIDGET_HIDDEN);
        document.body.style.marginRight = "0";
        toggle_button!.style.right = "0px";
        toggle_button!.textContent = CHEVRON_CLOSED;
    }
}

function on_tab_visibility_changed(): void {
    if (document.visibilityState !== "visible") return;
    if (panel_container && !panel_container.classList.contains(PanelCss.WIDGET_HIDDEN)) {
        if (panel_restore_callback) panel_restore_callback();
    }
}

export function inject_embedded_ui(): HTMLElement {
    const existing = document.getElementById(PanelCss.WIDGET_ID);
    if (existing) existing.remove();

    document.documentElement.style.setProperty("--spark-slide-ms", PANEL_SLIDE_IN_MS + "ms");

    load_saved_panel_width();
    document.documentElement.style.setProperty("--spark-panel-width", panel_width + "px");

    const { widget_container, calendar_container } = create_panel_widget();
    panel_container = widget_container;

    toggle_button = build_toggle_button();
    restore_toggle_button_position();

    const is_visible = determine_initial_panel_visibility();
    apply_initial_panel_state(is_visible);

    document.body.appendChild(panel_container);
    document.body.appendChild(toggle_button);
    document.addEventListener("visibilitychange", on_tab_visibility_changed);

    return calendar_container;
}

chrome.runtime.onMessage.addListener((request: any) => {
    if (request.action === TOGGLE_PANEL) toggle_panel();
    else if (request.action === OPEN_URL) window.open(request.url, "_blank");
});
