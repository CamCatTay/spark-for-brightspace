// Copyright (c) 2026 CamCatTay. All rights reserved.
// See LICENSE file for terms of use.

import { get_state } from "../core/state";
import { IS_FETCHING } from "../shared/constants/storage-keys";
import { CalendarCss, FrequencyChartCss } from "../shared/constants/ui";

const FETCHING_STATUS_LABEL = " ! Fetching...";
const LAST_FETCHED_PREFIX = "Last fetched: ";
const LAST_FETCHED_EMPTY = "Last fetched: —";

export function show_fetching_indicator(): void {
    const container = document.querySelector(`.${FrequencyChartCss.LAST_FETCHED_CONTAINER}`);
    if (!container || container.classList.contains(CalendarCss.FETCH_STATUS)) return;

    const fetch_status = document.createElement("span");
    const label_text = document.createTextNode(FETCHING_STATUS_LABEL);
    const spinner = document.createElement("span");

    fetch_status.className = CalendarCss.FETCH_STATUS;
    spinner.className = CalendarCss.FETCH_SPINNER;

    fetch_status.appendChild(label_text);
    fetch_status.appendChild(spinner);
    container.appendChild(fetch_status);

    container.classList.add(CalendarCss.FETCH_STATUS);
}

export function hide_fetching_indicator(): void {
    /* Remove class, has no visual effect
    const container = document.querySelector(`.${FrequencyChartCss.LAST_FETCHED_CONTAINER}`);
    container?.classList.remove(CalendarCss.FETCH_STATUS);
    */
    document.querySelector(`.${CalendarCss.FETCH_STATUS}`)?.remove();
}

export function update_fetching_indicator(): void {
    const is_shown = get_state(IS_FETCHING)
    if (is_shown) {
        show_fetching_indicator();
    } else {
        hide_fetching_indicator();
    }
}

export function update_last_fetched_label(time: Date | null): void {
    const last_fetched_el = document.querySelector(`.${FrequencyChartCss.LAST_FETCHED_CONTAINER}`);
    if (!last_fetched_el) return;

    last_fetched_el.firstChild!.textContent = time
        ? LAST_FETCHED_PREFIX + time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
        : LAST_FETCHED_EMPTY;
}
