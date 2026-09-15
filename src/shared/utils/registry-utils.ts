import { chrome_storage_get, chrome_storage_set } from "./chrome-storage-utils";

export type Scope = "sync" | "local" | "session";

export interface RegistryItem {
    key: string;
    default: any;
    scope: Scope;
    transform?: (v: any) => any;
    value: any;
}

export function get_value(registry: RegistryItem[], key: string): any {
    return registry.find(i => i.key === key)?.value;
}

export function apply_item_change(registry: RegistryItem[], key: string, raw: any): void {
    const item = registry.find(i => i.key === key);
    if (!item) return;
    item.value = item.transform ? item.transform(raw) : raw;
}

export function apply_bundle(registry: RegistryItem[], bundle: Record<string, any>, scope: Scope): void {
    for (const item of registry.filter(i => i.scope === scope)) {
        const raw = bundle[item.key] ?? item.default;
        item.value = item.transform ? item.transform(raw) : raw;
    }
}

export async function set_value(
    registry: RegistryItem[],
    key: string,
    raw_value: any,
    sync_bundle_key?: string
): Promise<void> {
    const item = registry.find(i => i.key === key);
    if (!item) return;

    item.value = item.transform ? item.transform(raw_value) : raw_value;

    if (item.scope === "sync" && sync_bundle_key) {
        const current = await chrome_storage_get(sync_bundle_key, "sync") ?? {};
        await chrome_storage_set(sync_bundle_key, { ...current, [key]: raw_value }, "sync");
    } else {
        await chrome_storage_set(key, raw_value, item.scope);
    }
}

export async function sync_registry(registry: RegistryItem[], sync_bundle_key?: string): Promise<void> {
    const scopes = ["sync", "local", "session"] as const;

    await Promise.all(scopes.map(async (scope) => {
        const items_in_scope = registry.filter(i => i.scope === scope);
        if (items_in_scope.length === 0) return;

        let data: Record<string, any>;
        if (scope === "sync" && sync_bundle_key) {
            data = await chrome_storage_get(sync_bundle_key, "sync") ?? {};
        } else {
            const keys = items_in_scope.map(i => i.key);
            data = await chrome.storage[scope].get(keys);
        }

        for (const item of items_in_scope) {
            const raw = data[item.key] ?? item.default;
            item.value = item.transform ? item.transform(raw) : raw;
        }
    }));
}
