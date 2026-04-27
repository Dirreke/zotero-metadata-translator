import {
  createEnglishItems,
  isLikelyChineseItem,
  processItems,
} from "./metadata";
import {
  isAutoCreateEnglishItemEnabled,
  isAutoProcessNewItemsEnabled,
} from "./preferences";

function getMainWin(): _ZoteroTypes.MainWindow {
  return Zotero.getMainWindow() as _ZoteroTypes.MainWindow;
}

export async function runAutoProcessForNewItems(
  ids: Array<string | number>,
): Promise<void> {
  const autoProcess = isAutoProcessNewItemsEnabled();
  const autoCreateEnglishItem = isAutoCreateEnglishItemEnabled();

  if (!autoProcess && !autoCreateEnglishItem) {
    return;
  }

  const numIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (!numIds.length) return;

  const items = (await Zotero.Items.getAsync(numIds)) as Zotero.Item[];

  const targets = items.filter(
    (item) => item.isRegularItem() && isLikelyChineseItem(item),
  );

  if (!targets.length) return;

  const win = getMainWin();

  if (autoProcess) {
    await processItems(win, targets, "all", {
      interactive: false,
      showProgress: targets.length > 1,
      suppressNoSelectionAlert: true,
    });
  }

  if (autoCreateEnglishItem) {
    await createEnglishItems(win, targets, {
      showProgress: targets.length > 1,
      suppressNoSelectionAlert: true,
    });
  }
}
