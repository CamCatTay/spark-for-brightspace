import { SettingsCss } from "../shared/constants/ui";
import { chrome_storage_get, chrome_storage_set } from "../shared/utils/chrome-storage-utils";
import { USER_SETTINGS, SPARK_DARK_MODE, D2L_DARK_MODE } from "../shared/constants/storage-keys";
import { get_setting } from "../core/settings";

export function sync_theme_to_dom(spark_dark: boolean, d2l_dark: boolean): void {
    const html = document.documentElement;
    html.classList.toggle(SettingsCss.SPARK_DARK_MODE, spark_dark);
    html.classList.toggle(SettingsCss.SPARK_D2L_DARK_MODE, d2l_dark);
}

export async function set_dark_mode(enabled: boolean): Promise<void> {
    const current = await chrome_storage_get(USER_SETTINGS, "sync") ?? {};
    await chrome_storage_set(USER_SETTINGS, { ...current, [SPARK_DARK_MODE]: enabled }, "sync");
    sync_theme_to_dom(get_setting(SPARK_DARK_MODE), get_setting(D2L_DARK_MODE));
}
