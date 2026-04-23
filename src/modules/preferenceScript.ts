import { config } from "../../package.json";

const PREF_AUTO = `${config.prefsPrefix}.autoProcessNew`;

export async function registerPrefsScripts(_window: Window) {
  const checkbox = _window.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-auto-process`,
  ) as any;

  if (!checkbox) return;

  checkbox.checked = !!Zotero.Prefs.get(PREF_AUTO, true);

  checkbox.addEventListener("command", () => {
    Zotero.Prefs.set(PREF_AUTO, !!checkbox.checked, true);
  });
}