type StorageArea = "local" | "session" | "sync";

async function get_storage(key: string, area: StorageArea = "local"): Promise<any> {
    try {
        const result = await chrome.storage[area].get(key);
        return result[key];
    } catch (error) {
        console.error(`Error retrieving ${key} from ${area}:`, error);
        return undefined;
    }
}

async function set_storage(key: string, value: any, area: StorageArea = "local"): Promise<void> {
    try {
        await chrome.storage[area].set({ [key]: value });
    } catch (error) {
        console.error(`Failed to save ${key} to ${area} storage:`, error);
        throw error; // Rethrow so the caller's Failure branch triggers
    }
}