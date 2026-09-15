import { COURSE_DATA, IS_FETCHING, LAST_FETCH_COMPLETED_AT, SCROLL_POS } from "../shared/constants/storage-keys";
import { RegistryItem, apply_item_change, get_value, set_value, sync_registry } from "../shared/utils/registry-utils";

const registry: RegistryItem[] = [
    { key: LAST_FETCH_COMPLETED_AT, default: new Date(0), scope: "local", transform: (v) => v ? new Date(v) : new Date(0), value: new Date(0) },
    { key: IS_FETCHING, default: false, scope: "local", value: false },
    { key: COURSE_DATA, default: {}, scope: "local", value: {}},
    { key: SCROLL_POS, default: 0, scope: "session", value: 0 },
];

export const get_state = (key: string): any => get_value(registry, key);
export const set_state = (key: string, value: any): Promise<void> => set_value(registry, key, value);
export const apply_state_change = (key: string, raw: any): void => apply_item_change(registry, key, raw);

export async function initialize_state(): Promise<void> {
    await sync_registry(registry);
}
