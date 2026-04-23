import { config } from "../../package.json";
import {
    isLikelyChineseJournalArticle,
    processItems,
} from "./metadata";

const PREF_AUTO = `${config.prefsPrefix}.autoProcessNew`;

function getMainWin(): _ZoteroTypes.MainWindow {
    return Zotero.getMainWindow() as _ZoteroTypes.MainWindow;
}

export async function runAutoProcessForNewItems(
    ids: Array<string | number>,
) {
    if (!Zotero.Prefs.get(PREF_AUTO, true)) {
        return;
    }

    const numIds = ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));

    if (!numIds.length) {
        return;
    }

    const items = (await Zotero.Items.getAsync(numIds)) as Zotero.Item[];

    const targets = items.filter(
        (item) => item.isRegularItem() && isLikelyChineseJournalArticle(item),
    );

    if (!targets.length) {
        return;
    }

    await processItems(getMainWin(), targets, "both", {
        interactive: false,
        showProgress: targets.length > 1,
        suppressNoSelectionAlert: true,
    });
}