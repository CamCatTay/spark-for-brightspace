import { COURSE_NAME_TRIM_WORDS } from "../../core/settings";

export function truncate_course_name(name: string): string {
    if (!name) return name;
    const pattern = COURSE_NAME_TRIM_WORDS
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    return name.replace(new RegExp(`\\s*(${pattern})\\b.*$`, "i"), "").trim();
}
