import type { MenuitemOptions } from "zotero-plugin-toolkit";
import { getLocaleID, getString } from "../utils/locale";
import {
  cleanBrokenEnglishItemLinks,
  createEnglishItems,
  deleteGeneratedEnglishItems,
  isLikelyChineseItem,
  isMetadataTranslatorGeneratedEnglishItem,
  processItems,
} from "./metadata";
import { extractEnglishMetadataFromItemAttachments } from "./resolver";
import type { WriteMode } from "./types";

type ItemMenu =
  _ZoteroTypes.MenuManager.MenuData<_ZoteroTypes.MenuManager.LibraryMenuContext>;

const MENU_ID = "metadatatranslator-item-menu";
const icon = `${rootURI}content/icons/favicon.svg`;

function isDevMode(): boolean {
  return String(rootURI || "").startsWith("file:");
}

function getMainWindow(): _ZoteroTypes.MainWindow {
  return Zotero.getMainWindow() as _ZoteroTypes.MainWindow;
}

function getActivePane(): any {
  return Zotero.getActiveZoteroPane?.() || getMainWindow().ZoteroPane;
}

function getSelectedItems(): Zotero.Item[] {
  const pane = getActivePane();
  return (pane?.getSelectedItems?.() || []) as Zotero.Item[];
}

function getSelectedChineseItems(): Zotero.Item[] {
  return getSelectedItems().filter(
    (item) => item && item.isRegularItem() && isLikelyChineseItem(item),
  );
}

function getSelectedGeneratedEnglishItems(): Zotero.Item[] {
  return getSelectedItems().filter(
    (item) =>
      item &&
      item.isRegularItem() &&
      isMetadataTranslatorGeneratedEnglishItem(item),
  );
}

function hasMenuTargets(): boolean {
  return (
    getSelectedChineseItems().length > 0 ||
    getSelectedGeneratedEnglishItems().length > 0
  );
}

async function runForSelectedItems(mode: WriteMode): Promise<void> {
  const targets = getSelectedChineseItems();
  if (!targets.length) return;

  await processItems(getMainWindow(), targets, mode, {
    interactive: true,
    showProgress: targets.length > 1,
    suppressNoSelectionAlert: false,
  });
}

async function translateSelectedItemsToEnglish(): Promise<void> {
  const targets = getSelectedChineseItems();
  if (!targets.length) return;

  await createEnglishItems(getMainWindow(), targets, {
    showProgress: targets.length > 1,
    suppressNoSelectionAlert: false,
  });
}

async function deleteSelectedGeneratedEnglishItems(): Promise<void> {
  const items = getSelectedItems();
  if (!items.length) return;

  await deleteGeneratedEnglishItems(getMainWindow(), items, {
    showProgress: items.length > 1,
    suppressNoSelectionAlert: false,
  });
}

async function cleanSelectedBrokenEnglishLinks(): Promise<void> {
  const targets = getSelectedChineseItems();
  if (!targets.length) return;

  await cleanBrokenEnglishItemLinks(getMainWindow(), targets, {
    showProgress: targets.length > 1,
    suppressNoSelectionAlert: false,
  });
}

function formatExtractResult(item: Zotero.Item, result: any): string {
  const source = result.source || {};

  return [
    `Zotero item: ${item.getDisplayTitle() || `#${item.id}`}`,
    "",
    `Extracted title: ${result.title || "[none]"}`,
    `Extracted authors: ${
      result.authors?.length ? result.authors.join("; ") : "[none]"
    }`,
    "",
    `Matched first author: ${source.matchedFirstAuthor || "[none]"}`,
    `Attachment: ${source.attachmentFilename || "[none]"}`,
    `Attachment kind: ${source.attachmentKind || "[none]"}`,
    `Block: ${source.blockName || "[none]"}`,
    `Page index: ${
      source.pageIndex === null || source.pageIndex === undefined
        ? "[none]"
        : String(source.pageIndex)
    }`,
    `Line index: ${
      source.lineIndex === null || source.lineIndex === undefined
        ? "[none]"
        : String(source.lineIndex)
    }`,
    "",
    "Raw:",
    source.raw || "[none]",
    "",
    `Candidate count: ${result.candidates?.length || 0}`,
  ].join("\n");
}

async function testExtractEnglishMetadata(): Promise<void> {
  const win = getMainWindow();
  const targets = getSelectedChineseItems();

  if (!targets.length) {
    win.alert(getString("error-no-regular-item"));
    return;
  }

  const logs: string[] = [];

  for (const item of targets) {
    try {
      const result = await extractEnglishMetadataFromItemAttachments(item);
      logs.push(formatExtractResult(item, result));
    } catch (e: any) {
      logs.push(
        [
          `Zotero item: ${item.getDisplayTitle() || `#${item.id}`}`,
          "",
          `Error: ${String(e?.message || e)}`,
          e?.stack ? `\nStack:\n${e.stack}` : "",
        ].join("\n"),
      );
    }
  }

  win.alert(logs.join("\n\n==============================\n\n"));
}

function makeWriteMenuManagerAction(
  l10nID: "menu-title" | "menu-authors" | "menu-container" | "menu-all",
  mode: WriteMode,
): ItemMenu {
  return {
    menuType: "menuitem",
    l10nID: getLocaleID(l10nID),
    onCommand: async () => {
      await runForSelectedItems(mode);
    },
  };
}

function makeSimpleMenuManagerAction(
  l10nID:
    | "menu-translate-english"
    | "menu-delete-generated-english"
    | "menu-clean-broken-english-links",
  onCommand: () => Promise<void>,
): ItemMenu {
  return {
    menuType: "menuitem",
    l10nID: getLocaleID(l10nID),
    onCommand,
  };
}

function makeDevMenuManagerItems(): ItemMenu[] {
  if (!isDevMode()) return [];

  return [
    { menuType: "separator" },
    {
      menuType: "menuitem",
      l10nID: getLocaleID("menu-test-extract"),
      onCommand: async () => {
        await testExtractEnglishMetadata();
      },
    },
  ];
}

function registerItemMenusByMenuManager(): boolean {
  const menuManager = (Zotero as any).MenuManager;
  if (!menuManager?.registerMenu) return false;

  menuManager.registerMenu({
    pluginID: addon.data.config.addonID,
    menuID: MENU_ID,
    target: "main/library/item",
    menus: [
      {
        menuType: "submenu",
        l10nID: getLocaleID("menu-root"),
        icon,
        onShowing: (
          _event: Event,
          context: {
            setVisible: (visible: boolean) => void;
            setEnabled: (enabled: boolean) => void;
          },
        ) => {
          const visible = hasMenuTargets();
          context.setVisible(visible);
          context.setEnabled(visible);
        },
        menus: [
          makeWriteMenuManagerAction("menu-title", "title"),
          makeWriteMenuManagerAction("menu-authors", "authors"),
          makeWriteMenuManagerAction("menu-container", "container"),
          makeSimpleMenuManagerAction(
            "menu-delete-generated-english",
            deleteSelectedGeneratedEnglishItems,
          ),
          makeSimpleMenuManagerAction(
            "menu-clean-broken-english-links",
            cleanSelectedBrokenEnglishLinks,
          ),
          { menuType: "separator" },
          makeWriteMenuManagerAction("menu-all", "all"),
          makeSimpleMenuManagerAction(
            "menu-translate-english",
            translateSelectedItemsToEnglish,
          ),
          ...makeDevMenuManagerItems(),
        ],
      },
    ],
  });

  return true;
}

function makeWriteZToolkitAction(
  label: string,
  mode: WriteMode,
): MenuitemOptions {
  return {
    tag: "menuitem",
    label,
    commandListener: async () => {
      await runForSelectedItems(mode);
    },
  };
}

function makeSimpleZToolkitAction(
  label: string,
  commandListener: () => Promise<void>,
): MenuitemOptions {
  return {
    tag: "menuitem",
    label,
    commandListener,
  };
}

function makeDevZToolkitItems(): MenuitemOptions[] {
  if (!isDevMode()) return [];

  return [
    { tag: "menuseparator" },
    {
      tag: "menuitem",
      label: getString("menu-test-extract", "label"),
      commandListener: async () => {
        await testExtractEnglishMetadata();
      },
    },
  ];
}

function registerItemMenusByZToolkit(): void {
  ztoolkit.Menu.register("item", {
    tag: "menuseparator",
    getVisibility: () => hasMenuTargets(),
  });

  ztoolkit.Menu.register("item", {
    tag: "menu",
    id: MENU_ID,
    label: getString("menu-root", "label"),
    icon,
    children: [
      makeWriteZToolkitAction(getString("menu-title", "label"), "title"),
      makeWriteZToolkitAction(getString("menu-authors", "label"), "authors"),
      makeWriteZToolkitAction(
        getString("menu-container", "label"),
        "container",
      ),
      makeSimpleZToolkitAction(
        getString("menu-delete-generated-english", "label"),
        deleteSelectedGeneratedEnglishItems,
      ),
      makeSimpleZToolkitAction(
        getString("menu-clean-broken-english-links", "label"),
        cleanSelectedBrokenEnglishLinks,
      ),
      { tag: "menuseparator" },
      makeWriteZToolkitAction(getString("menu-all", "label"), "all"),
      makeSimpleZToolkitAction(
        getString("menu-translate-english", "label"),
        translateSelectedItemsToEnglish,
      ),
      ...makeDevZToolkitItems(),
    ],
    getVisibility: () => hasMenuTargets(),
  });
}

export function registerMenu(): void {
  const version = String(Zotero.version || "");

  if (
    (version.startsWith("8") || version.startsWith("9")) &&
    (Zotero as any).MenuManager?.registerMenu
  ) {
    try {
      const ok = registerItemMenusByMenuManager();
      if (ok) return;
    } catch (e) {
      Zotero.debug(
        `[MetadataTranslator] MenuManager registration failed; fallback to ztoolkit: ${String(e)}`,
      );
    }
  }

  registerItemMenusByZToolkit();
}

export function registerItemContextMenu(): void {
  registerMenu();
}

export function unregisterItemContextMenu(_win?: Window): void {
  // Zotero MenuManager menus are managed by Zotero.
  // ztoolkit menus are removed by ztoolkit.unregisterAll() in hooks.ts.
}
