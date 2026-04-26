import { SettingsCss } from "../ui/dom-constants";

export function create_toggle_setting(title_text: string, description_text: string, default_toggle: boolean, onChange?: (checked: boolean) => void) {
    const section = document.createElement("div");
    section.className = SettingsCss.SECTION;

    const row = document.createElement("label");
    row.className = SettingsCss.COURSE_ROW;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = SettingsCss.COURSE_CHECKBOX;
    checkbox.checked = default_toggle;
    checkbox.addEventListener("change", () => onChange?.(checkbox.checked));

    const title = document.createElement("span");
    title.className = SettingsCss.LABEL;
    title.textContent = title_text;

    row.appendChild(checkbox);
    row.appendChild(title);
    section.appendChild(row);

    const description = document.createElement("p");
    description.className = SettingsCss.DESCRIPTION;
    description.textContent = description_text;
    section.appendChild(description);

    return {
        section: section,
        checkbox: checkbox
    };
}