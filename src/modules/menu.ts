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

function getMainWindow(): _ZoteroTypes.MainWindow {
    return Zotero.getMainWindow() as _ZoteroTypes.MainWindow;
}

function getSelectedItems(): Zotero.Item[] {
    const pane = Zotero.getActiveZoteroPane?.() || getMainWindow().ZoteroPane;
    return (pane.getSelectedItems?.() || []) as Zotero.Item[];
}

function getChineseItems(items?: Zotero.Item[]): Zotero.Item[] {
    return (items || []).filter(
        (item) => item && item.isRegularItem() && isLikelyChineseItem(item),
    );
}

function getSelectedChineseItems(): Zotero.Item[] {
    return getChineseItems(getSelectedItems());
}

function hasSelectedChineseItems(): boolean {
    return getSelectedChineseItems().length > 0;
}

async function runForSelectedItems(mode: WriteMode) {
    const targets = getSelectedChineseItems();
    if (!targets.length) return;

    await processItems(getMainWindow(), targets, mode);
}

async function showJournalMapPath() {
    await showUserJournalMapPath(getMainWindow());
}

/**
 * Zotero 8/9: MenuManager
 *
 * Do not set fallback labels in onShown.
 * MenuManager handles .label from Fluent by l10nID.
 */
function registerItemMenusByMenuManager(): boolean {
    const menuManager = (Zotero as any).MenuManager;
    if (!menuManager?.registerMenu) return false;

    function makeItemMenu(
        l10nID: "menu-authors" | "menu-container" | "menu-both",
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

    const menus: ItemMenu[] = [
        {
            menuType: "submenu",
            l10nID: getLocaleID("menu-root"),
            icon,
            onShowing: (_event, context) => {
                const visible = hasSelectedChineseItems();
                context.setVisible(visible);
                context.setEnabled(visible);
            },
            menus: [
                makeItemMenu("menu-authors", "authors"),
                makeItemMenu("menu-container", "container"),
                makeItemMenu("menu-both", "both"),
                {
                    menuType: "separator",
                },
                {
                    menuType: "menuitem",
                    l10nID: getLocaleID("menu-map-path"),
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
 * Zotero 7: ztoolkit.Menu.register
 */
function registerItemMenusByZToolkit() {
    function makeItemMenu(label: string, mode: WriteMode): MenuitemOptions {
        return {
            tag: "menuitem",
            label,
            commandListener: async () => {
                await runForSelectedItems(mode);
            },
        };
    }

    ztoolkit.Menu.register("item", {
        tag: "menuseparator",
        getVisibility: () => hasSelectedChineseItems(),
    });

    ztoolkit.Menu.register("item", {
        tag: "menu",
        id: "metadata-translator-item-menu",
        label: getString("menu-root", "label"),
        icon,
        children: [
            makeItemMenu(getString("menu-authors", "label"), "authors"),
            makeItemMenu(getString("menu-container", "label"), "container"),
            makeItemMenu(getString("menu-both", "label"), "both"),
            {
                tag: "menuseparator",
            },
            {
                tag: "menuitem",
                label: getString("menu-map-path", "label"),
                commandListener: async () => {
                    await showJournalMapPath();
                },
            },
        ],
        getVisibility: () => hasSelectedChineseItems(),
        styles: {
            fill: "var(--fill-secondary)",
            stroke: "currentColor",
        },
    });
}

export function registerMenu() {
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
                `[MetadataTranslator] MenuManager registration failed; fallback to ztoolkit: ${e}`,
            );
        }
    }

    registerItemMenusByZToolkit();
}

export function registerItemContextMenu() {
    registerMenu();
}

export function unregisterItemContextMenu() {
    // MenuManager menus are handled by Zotero.
    // ztoolkit menus are cleaned by ztoolkit.unregisterAll() in hooks.ts.
}