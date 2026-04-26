import type { MenuitemOptions } from "zotero-plugin-toolkit";
import { getLocaleID, getString } from "../utils/locale";
import {
    isLikelyChineseItem,
    processItems,
    showUserJournalMapPath,
} from "./metadata";

type WriteMode = "authors" | "container" | "both";

type ItemMenu =
    _ZoteroTypes.MenuManager.MenuData<_ZoteroTypes.MenuManager.LibraryMenuContext>;

const icon = `${rootURI}/content/icons/favicon.svg`;

let menuRegistered = false;

function getMainWin(): _ZoteroTypes.MainWindow {
    return Zotero.getMainWindow() as _ZoteroTypes.MainWindow;
}

function getSelectedItemsFromMainWindow(): Zotero.Item[] {
    const win = getMainWin();
    return (win.ZoteroPane.getSelectedItems() || []) as Zotero.Item[];
}

function getChineseJournalArticles(items?: Zotero.Item[]): Zotero.Item[] {
    return (items || []).filter(
        (item) =>
            item && item.isRegularItem() && isLikelyChineseItem(item),
    );
}

function getSelectedChineseJournalArticles(): Zotero.Item[] {
    return getChineseJournalArticles(getSelectedItemsFromMainWindow());
}

function hasSelectedChineseJournalArticles(): boolean {
    return getSelectedChineseJournalArticles().length > 0;
}

async function runForSelectedItems(mode: WriteMode) {
    const targets = getSelectedChineseJournalArticles();
    if (!targets.length) return;

    await processItems(getMainWin(), targets, mode);
}

async function showJournalMapPath() {
    await showUserJournalMapPath(getMainWin());
}

/**
 * Zotero 8/9 path.
 *
 * This follows the newer Zotero.MenuManager style.
 */
function registerItemMenuByMenuManager() {
    const menuManager = (Zotero as any).MenuManager;
    if (!menuManager?.registerMenu) return false;

    function makeActionMenu(
        l10nID: string,
        mode: WriteMode,
    ): ItemMenu {
        return {
            menuType: "menuitem",
            l10nID: getLocaleID(l10nID as any),
            onShowing: (_event, context) => {
                const targets = getChineseJournalArticles(context.items);
                context.setVisible(targets.length > 0);
                context.setEnabled(targets.length > 0);
            },
            onCommand: async (_event, context) => {
                const targets = getChineseJournalArticles(context.items);
                if (!targets.length) return;

                await processItems(getMainWin(), targets, mode);
            },
        };
    }

    const menus: ItemMenu[] = [
        {
            menuType: "submenu",
            l10nID: getLocaleID("menu-root"),
            icon,
            onShowing: (_event, context) => {
                const targets = getChineseJournalArticles(context.items);
                context.setVisible(targets.length > 0);
                context.setEnabled(targets.length > 0);
            },
            menus: [
                makeActionMenu("menu-authors", "authors"),
                makeActionMenu("menu-container", "container"),
                makeActionMenu("menu-both", "both"),
                {
                    menuType: "separator",
                },
                {
                    menuType: "menuitem",
                    l10nID: getLocaleID("menu-map-path"),
                    onShowing: (_event, context) => {
                        const targets = getChineseJournalArticles(context.items);
                        context.setVisible(targets.length > 0);
                        context.setEnabled(targets.length > 0);
                    },
                    onCommand: async () => {
                        await showJournalMapPath();
                    },
                },
            ],
        },
    ];

    menuManager.registerMenu({
        pluginID: addon.data.config.addonID,
        menuID: "metadata-translator-item-menu",
        target: "main/library/item",
        menus,
    });

    return true;
}

/**
 * Zotero 7 path.
 *
 * This follows the older zotero-plugin-toolkit menu registration style.
 * The referenced zotero-format-metadata version uses this fallback for
 * non-Zotero-8 versions.
 */
function registerItemMenuByZToolkit() {
    const separator: MenuitemOptions = {
        tag: "menuseparator",
        getVisibility: () => hasSelectedChineseJournalArticles(),
    };

    function makeActionMenu(
        label: string,
        mode: WriteMode,
    ): MenuitemOptions {
        return {
            tag: "menuitem",
            label,
            commandListener: async () => {
                await runForSelectedItems(mode);
            },
            getVisibility: () => hasSelectedChineseJournalArticles(),
        };
    }

    ztoolkit.Menu.register("item", separator);

    ztoolkit.Menu.register("item", {
        tag: "menu",
        label: getString("menu-root"),
        id: "metadata-translator-item-menu",
        icon,
        children: [
            makeActionMenu(getString("menu-authors"), "authors"),
            makeActionMenu(getString("menu-container"), "container"),
            makeActionMenu(getString("menu-both"), "both"),
            {
                tag: "menuseparator",
            },
            {
                tag: "menuitem",
                label: getString("menu-map-path"),
                commandListener: async () => {
                    await showJournalMapPath();
                },
                getVisibility: () => hasSelectedChineseJournalArticles(),
            },
        ],
        getVisibility: () => hasSelectedChineseJournalArticles(),
        styles: {
            fill: "var(--fill-secondary)",
            stroke: "currentColor",
        },
    });
}

export function registerItemContextMenu() {
    if (menuRegistered) return;

    if ((Zotero as any).MenuManager?.registerMenu) {
        registerItemMenuByMenuManager();
    } else {
        registerItemMenuByZToolkit();
    }

    menuRegistered = true;
}

export function unregisterItemContextMenu() {
    menuRegistered = false;
}