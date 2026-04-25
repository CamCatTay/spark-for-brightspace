let section_class = "settings-section";
let row_class = "settings-course-row";
let checkbox_class = "settings-course-checkbox";
let description_class = "settings-description"
let title_class = "settings-course-name"

export function create_toggle_setting(title_text: string, description_text: string, default_toggle: boolean, onChange?: (checked: boolean) => void) {
    const section = document.createElement("div");
    section.className = section_class;

    const row = document.createElement("label");
    row.className = row_class

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = checkbox_class;
    checkbox.checked = default_toggle;
    checkbox.addEventListener("change", () => onChange?.(checkbox.checked));

    const title = document.createElement("span");
    title.className = title_class;
    title.textContent = title_text;

    row.appendChild(checkbox);
    row.appendChild(title);
    section.appendChild(row);

    const description = document.createElement("p");
    description.className = description_class;
    description.textContent = description_text;
    section.appendChild(description);

    return {
        section: section,
        checkbox: checkbox
    };
}