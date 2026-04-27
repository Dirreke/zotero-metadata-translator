import { createZToolkit } from "./utils/ztoolkit";
import {
  getString,
  initLocale,
  registerMainWindowLocale,
  unregisterMainWindowLocale,
} from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import {
  registerItemContextMenu,
  unregisterItemContextMenu,
} from "./modules/menu";
import { runAutoProcessForNewItems } from "./modules/notifier";

let notifierID: string | null = null;

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerPrefsPane();
  registerNotifier();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: Window): Promise<void> {
  addon.data.ztoolkit = createZToolkit();

  registerMainWindowLocale(win);
  registerItemContextMenu();
}

async function onMainWindowUnload(win: Window): Promise<void> {
  unregisterItemContextMenu();
  unregisterMainWindowLocale(win);
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  if (notifierID) {
    Zotero.Notifier.unregisterObserver(notifierID);
    notifierID = null;
  }

  unregisterItemContextMenu();

  ztoolkit.unregisterAll();

  addon.data.alive = false;

  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  _extraData: { [key: string]: any },
) {
  if (event !== "add" || type !== "item") {
    return;
  }

  await runAutoProcessForNewItems(ids);
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      await registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
    stylesheets: [`${rootURI}/content/preferences.css`],
  });
}

function registerNotifier() {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: Array<string | number>,
      extraData: { [key: string]: any },
    ) => {
      if (!addon?.data.alive) {
        if (notifierID) {
          Zotero.Notifier.unregisterObserver(notifierID);
          notifierID = null;
        }
        return;
      }

      await addon.hooks.onNotify(event, type, ids, extraData);
    },
  };

  notifierID = Zotero.Notifier.registerObserver(callback, ["item"]);
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};
