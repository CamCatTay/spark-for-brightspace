import { WHATS_NEW_PENDING } from "../shared/constants/storage-keys";
import { PanelCss } from "../shared/constants/ui";
import { WHATS_NEW_CONTENT } from "./whats-new-content";

const OVERLAY_CLASS = "spark-whats-new-overlay";
const CONTENT_CLASS = "spark-whats-new-content";
const CLOSE_BUTTON_CLASS = "spark-whats-new-close";
const HEADER_CLASS = "spark-whats-new-header";
const EYEBROW_CLASS = "spark-whats-new-eyebrow";
const SECTION_CLASS = "spark-whats-new-section";
const LIST_CLASS = "spark-whats-new-list";
const NOTE_CLASS = "spark-whats-new-note";

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || changes[WHATS_NEW_PENDING]?.newValue !== false) return;
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
});

export async function show_whats_new_if_pending(): Promise<void> {
    const result = await chrome.storage.local.get(WHATS_NEW_PENDING);
    if (!result[WHATS_NEW_PENDING]) return;

    const panel = document.getElementById(PanelCss.PANEL_ID);
    if (!panel) return;

    const overlay = document.createElement("section");
    overlay.className = OVERLAY_CLASS;
    overlay.setAttribute("aria-label", WHATS_NEW_CONTENT.title);

    const close_button = document.createElement("button");
    close_button.className = CLOSE_BUTTON_CLASS;
    close_button.type = "button";
    close_button.textContent = "×";
    close_button.setAttribute("aria-label", "Close what's new");
    close_button.addEventListener("click", () => {
        overlay.remove();
        chrome.storage.local.set({ [WHATS_NEW_PENDING]: false });
    });

    const content = document.createElement("div");
    content.className = CONTENT_CLASS;

    const header = document.createElement("header");
    header.className = HEADER_CLASS;

    const eyebrow = document.createElement("p");
    eyebrow.className = EYEBROW_CLASS;
    eyebrow.textContent = "RELEASE NOTES";

    const title = document.createElement("h2");
    title.textContent = WHATS_NEW_CONTENT.title;
    header.append(eyebrow, title);
    content.appendChild(header);

    WHATS_NEW_CONTENT.items.forEach((item) => {
        const trimmed_item = item.trim();
        if (/^=+$/.test(trimmed_item)) return;

        const section_title = trimmed_item.match(/^\[(.+)\]$/);
        if (section_title) {
            const section = document.createElement("section");
            section.className = SECTION_CLASS;

            const heading = document.createElement("h3");
            heading.textContent = section_title[1];
            section.appendChild(heading);
            content.appendChild(section);
            return;
        }

        const section = content.lastElementChild;
        if (section?.classList.contains(SECTION_CLASS) && trimmed_item.startsWith("- ")) {
            let list = section.querySelector<HTMLUListElement>(`.${LIST_CLASS}`);
            if (!list) {
                list = document.createElement("ul");
                list.className = LIST_CLASS;
                section.appendChild(list);
            }

            const list_item = document.createElement("li");
            list_item.textContent = trimmed_item.slice(2);
            list.appendChild(list_item);
            return;
        }

        const note = document.createElement("p");
        note.className = NOTE_CLASS;
        note.textContent = trimmed_item;
        (section?.classList.contains(SECTION_CLASS) ? section : content).appendChild(note);
    });

    overlay.append(close_button, content);
    panel.appendChild(overlay);
}