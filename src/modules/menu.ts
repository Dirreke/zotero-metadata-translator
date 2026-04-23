import { getString } from "../utils/locale";
import {
    processSelectedItems,
    showUserJournalMapPath,
} from "./metadata";

const MENU_ROOT_ID = "metadatatranslator-itemmenu-root";
const MENU_SEP_ID = "metadatatranslator-itemmenu-sep";

function getSelectedRegularItems(win: _ZoteroTypes.MainWindow): Zotero.Item[] {
    const items = (win.ZoteroPane.getSelectedItems() || []) as Zotero.Item[];
    return items.filter((item) => item && item.isRegularItem());
}

function createMenuItem(
    doc: Document,
    label: string,
    callback: () => void | Promise<void>,
) {
    const mi = doc.createXULElement("menuitem");
    mi.setAttribute("label", label);
    mi.addEventListener("command", () => {
        void callback();
    });
    return mi;
}

function updateMenuVisibility(win: _ZoteroTypes.MainWindow) {
    const menu = win.document.getElementById(MENU_ROOT_ID) as any;
    if (!menu) return;
    menu.hidden = getSelectedRegularItems(win).length === 0;
}

export function registerItemContextMenu(win: _ZoteroTypes.MainWindow) {
    const doc = win.document;
    const popup = doc.getElementById("zotero-itemmenu") as any;
    if (!popup) return;

    if (doc.getElementById(MENU_ROOT_ID)) {
        updateMenuVisibility(win);
        return;
    }

    const sep = doc.createXULElement("menuseparator");
    sep.id = MENU_SEP_ID;

    const menu = doc.createXULElement("menu");
    menu.id = MENU_ROOT_ID;
    menu.setAttribute("label", getString("menu-root"));

    const menupopup = doc.createXULElement("menupopup");

    menupopup.appendChild(
        createMenuItem(doc, getString("menu-authors"), async () => {
            await processSelectedItems(win, "authors");
        }),
    );

    menupopup.appendChild(
        createMenuItem(doc, getString("menu-container"), async () => {
            await processSelectedItems(win, "container");
        }),
    );

    menupopup.appendChild(
        createMenuItem(doc, getString("menu-both"), async () => {
            await processSelectedItems(win, "both");
        }),
    );

    menupopup.appendChild(doc.createXULElement("menuseparator"));

    menupopup.appendChild(
        createMenuItem(doc, getString("menu-map-path"), async () => {
            await showUserJournalMapPath(win);
        }),
    );

    menu.appendChild(menupopup);

    const popupShowingListener = () => {
        updateMenuVisibility(win);
    };

    popup.addEventListener("popupshowing", popupShowingListener);

    const menuAny = menu as any;
    menuAny._popupHost = popup;
    menuAny._popupListener = popupShowingListener;

    popup.appendChild(sep);
    popup.appendChild(menu);

    updateMenuVisibility(win);
}

export function unregisterItemContextMenu(win: Window) {
    const menu = win.document.getElementById(MENU_ROOT_ID) as any;
    if (menu?._popupHost && menu?._popupListener) {
        menu._popupHost.removeEventListener("popupshowing", menu._popupListener);
    }

    win.document.getElementById(MENU_ROOT_ID)?.remove();
    win.document.getElementById(MENU_SEP_ID)?.remove();
}