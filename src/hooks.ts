import { createZToolkit } from "./utils/ztoolkit";
import { getString, initLocale } from "./utils/locale";
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

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // 按模板方式：每个主窗口创建 ztoolkit
  addon.data.ztoolkit = createZToolkit();

  registerItemContextMenu(win);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  unregisterItemContextMenu(win);
}

function onShutdown(): void {
  if (notifierID) {
    Zotero.Notifier.unregisterObserver(notifierID);
    notifierID = null;
  }

  for (const win of Zotero.getMainWindows()) {
    unregisterItemContextMenu(win);
  }

  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();

  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * 模板风格：事件只做分发
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  if (
    event === "add" &&
    type === "item"
  ) {
    await runAutoProcessForNewItems(ids);
  } else {
    return;
  }
}

/**
 * 模板风格：偏好页事件只做分发
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      await registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(_type: string) {
  // 当前插件未使用快捷键，保留模板钩子
}

function onDialogEvents(_type: string) {
  // 当前插件未使用 dialog helper，保留模板钩子
}

function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
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
  onShortcuts,
  onDialogEvents,
};