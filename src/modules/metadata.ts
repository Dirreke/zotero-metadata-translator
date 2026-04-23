import { creatorToDisplayName } from "../utils/pinyin";
import {
    getContainerTitle,
    getUserJournalMapPath,
    resolveOriginalContainerTitle,
} from "../utils/journalMap";
import { getString } from "../utils/locale";

type WriteMode = "authors" | "container" | "both";
type OverwriteAction = "current" | "all" | "cancel";

type BatchState = {
    overwriteAuthorsAll: boolean;
    overwriteContainerAll: boolean;
};

type BatchError = {
    title: string;
    message: string;
};

export type ProcessOptions = {
    interactive?: boolean;
    showProgress?: boolean;
    suppressNoSelectionAlert?: boolean;
};

function removeFieldLines(extra: string, fieldName: string): string[] {
    const lines = (extra || "").split(/\r?\n/);
    const re = new RegExp(`^${fieldName}\\s*:`, "i");
    return lines.filter((line) => !re.test(line.trim()));
}

function appendFieldLines(
    preservedLines: string[],
    fieldName: string,
    values: string[],
): string {
    const deduped = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
    const newLines = deduped.map((v) => `${fieldName}: ${v}`);
    return [...preservedLines.filter((x) => x.trim() !== ""), ...newLines].join(
        "\n",
    );
}

function setExtraMultiLine(
    item: Zotero.Item,
    fieldName: string,
    values: string[],
): boolean {
    const oldExtra = String(item.getField("extra") || "");
    const preserved = removeFieldLines(oldExtra, fieldName);
    const newExtra = appendFieldLines(preserved, fieldName, values);

    if (newExtra === oldExtra) return false;
    item.setField("extra", newExtra);
    return true;
}

function hasExtraField(item: Zotero.Item, fieldName: string): boolean {
    const extra = String(item.getField("extra") || "");
    const re = new RegExp(`^${fieldName}\\s*:`, "im");
    return re.test(extra);
}

function getAuthorValues(item: Zotero.Item): string[] {
    const creators = item.getCreators().filter((c: any) => {
        try {
            return Zotero.CreatorTypes.getName(c.creatorTypeID) === "author";
        } catch {
            return false;
        }
    });

    return creators.map((c: any) => creatorToDisplayName(c)).filter(Boolean);
}

function getPromptService() {
    if (typeof Services !== "undefined" && Services?.prompt) {
        return Services.prompt;
    }

    try {
        return ChromeUtils.importESModule(
            "resource://gre/modules/Services.sys.mjs",
        ).Services.prompt;
    } catch {
        return ChromeUtils.import("resource://gre/modules/Services.jsm").Services
            .prompt;
    }
}

function askOverwrite(
    win: Window,
    fieldName: "original-author" | "original-container-title",
    itemTitle: string,
    totalItems: number,
): OverwriteAction {
    const ps = getPromptService();
    const multi = totalItems > 1;

    if (multi) {
        const flags =
            ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING +
            ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING +
            ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;

        const index = ps.confirmEx(
            win,
            getString("prompt-overwrite-title"),
            getString("prompt-overwrite-message", {
                args: { title: itemTitle, field: fieldName },
            }),
            flags,
            getString("button-overwrite"),      // button0
            getString("button-cancel"),         // button1
            getString("button-overwrite-all"),  // button2
            null,
            { value: false },
        );

        if (index === 0) return "current";
        if (index === 2) return "all";
        return "cancel";
    }

    const flags =
        ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING +
        ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;

    const index = ps.confirmEx(
        win,
        getString("prompt-overwrite-title"),
        getString("prompt-overwrite-message", {
            args: { title: itemTitle, field: fieldName },
        }),
        flags,
        getString("button-overwrite"),
        getString("button-cancel"),
        null,
        null,
        { value: false },
    );

    if (index === 0) return "current";
    return "cancel";
}

function createBatchProgress(total: number, enabled: boolean) {
    if (!enabled || total <= 1) return null;

    const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
        closeOnClick: false,
        closeTime: -1,
    })
        .createLine({
            text: `0/${total}`,
            type: "default",
            progress: 0,
        })
        .show();

    return pw;
}

function updateBatchProgress(pw: any, current: number, total: number) {
    if (!pw) return;
    pw.changeLine({
        text: `${current}/${total}`,
        progress: Math.round((current / total) * 100),
    });
}

function finishBatchProgress(pw: any, processed: number, total: number) {
    if (!pw) return;
    pw.changeLine({
        text: `${processed}/${total}`,
        progress: total > 0 ? Math.round((processed / total) * 100) : 100,
    });
    pw.startCloseTimer(800);
}

async function maybeWriteAuthors(
    win: _ZoteroTypes.MainWindow,
    item: Zotero.Item,
    state: BatchState,
    totalItems: number,
    options: Required<ProcessOptions>,
): Promise<"changed" | "unchanged" | "cancel"> {
    const values = getAuthorValues(item);
    if (!values.length) return "unchanged";

    const alreadyExists = hasExtraField(item, "original-author");
    if (alreadyExists) {
        if (!options.interactive) return "unchanged";

        if (!state.overwriteAuthorsAll) {
            const action = askOverwrite(
                win,
                "original-author",
                item.getDisplayTitle() || `#${item.id}`,
                totalItems,
            );

            if (action === "cancel") return "cancel";
            if (action === "all") state.overwriteAuthorsAll = true;
        }
    }

    const changed = setExtraMultiLine(item, "original-author", values);
    return changed ? "changed" : "unchanged";
}

async function maybeWriteContainer(
    win: _ZoteroTypes.MainWindow,
    item: Zotero.Item,
    state: BatchState,
    totalItems: number,
    options: Required<ProcessOptions>,
): Promise<"changed" | "unchanged" | "cancel"> {
    const containerTitle = getContainerTitle(item);
    if (!containerTitle) return "unchanged";

    const resolved = await resolveOriginalContainerTitle(containerTitle);
    if (!resolved) return "unchanged";

    const alreadyExists = hasExtraField(item, "original-container-title");
    if (alreadyExists) {
        if (!options.interactive) return "unchanged";

        if (!state.overwriteContainerAll) {
            const action = askOverwrite(
                win,
                "original-container-title",
                item.getDisplayTitle() || `#${item.id}`,
                totalItems,
            );

            if (action === "cancel") return "cancel";
            if (action === "all") state.overwriteContainerAll = true;
        }
    }

    const changed = setExtraMultiLine(item, "original-container-title", [
        resolved,
    ]);
    return changed ? "changed" : "unchanged";
}

function normalizeRegularItems(items: Zotero.Item[]): Zotero.Item[] {
    return (items || []).filter((item) => item && item.isRegularItem());
}

function showBatchErrors(win: Window, errors: BatchError[]) {
    if (!errors.length) return;

    const text = errors
        .slice(0, 10)
        .map((e, i) => `${i + 1}. ${e.title}\n${e.message}`)
        .join("\n\n");

    const tail =
        errors.length > 10 ? `\n\n${getString("error-batch-error-tail")}` : "";

    win.alert(
        `${getString("error-batch-error-title")}：${errors.length}\n\n${text}${tail}`,
    );
}

export function isLikelyChineseItem(item: Zotero.Item): boolean {
    const hasChinese = (text: string) => /[\u3400-\u9fff]/.test(text || "");

    if (hasChinese(String(item.getField("title") || ""))) return true;
    if (hasChinese(getContainerTitle(item))) return true;

    for (const c of item.getCreators()) {
        const cAny = c as any;
        const text = String(c.lastName || cAny.name || c.firstName || "");
        if (hasChinese(text)) return true;
    }

    return false;
}

export function isLikelyChineseJournalArticle(item: Zotero.Item): boolean {
    try {
        const itemTypeName = Zotero.ItemTypes.getName(item.itemTypeID);
        return itemTypeName === "journalArticle" && isLikelyChineseItem(item);
    } catch {
        return false;
    }
}

export async function processItems(
    win: _ZoteroTypes.MainWindow,
    items: Zotero.Item[],
    mode: WriteMode,
    options: ProcessOptions = {},
): Promise<void> {
    const merged: Required<ProcessOptions> = {
        interactive: options.interactive ?? true,
        showProgress: options.showProgress ?? true,
        suppressNoSelectionAlert: options.suppressNoSelectionAlert ?? false,
    };

    const regularItems = normalizeRegularItems(items);

    if (!regularItems.length) {
        if (!merged.suppressNoSelectionAlert) {
            win.alert(getString("error-no-regular-item"));
        }
        return;
    }

    const state: BatchState = {
        overwriteAuthorsAll: false,
        overwriteContainerAll: false,
    };

    const progress = createBatchProgress(regularItems.length, merged.showProgress);
    const errors: BatchError[] = [];
    let processed = 0;

    for (const item of regularItems) {
        try {
            let changed = false;

            if (mode === "authors" || mode === "both") {
                const r1 = await maybeWriteAuthors(
                    win,
                    item,
                    state,
                    regularItems.length,
                    merged,
                );
                if (r1 === "cancel") break;
                changed = r1 === "changed" || changed;
            }

            if (mode === "container" || mode === "both") {
                const r2 = await maybeWriteContainer(
                    win,
                    item,
                    state,
                    regularItems.length,
                    merged,
                );
                if (r2 === "cancel") break;
                changed = r2 === "changed" || changed;
            }

            if (changed) {
                await item.saveTx();
            }
        } catch (e: any) {
            errors.push({
                title: item.getDisplayTitle() || `#${item.id}`,
                message: String(e?.message || e),
            });
        }

        processed += 1;
        updateBatchProgress(progress, processed, regularItems.length);
    }

    finishBatchProgress(progress, processed, regularItems.length);

    if (errors.length) {
        showBatchErrors(win, errors);
    }
}

export async function processSelectedItems(
    win: _ZoteroTypes.MainWindow,
    mode: WriteMode,
    options: ProcessOptions = {},
): Promise<void> {
    const items = win.ZoteroPane.getSelectedItems() as Zotero.Item[];
    await processItems(win, items, mode, options);
}

export async function showUserJournalMapPath(
    win: _ZoteroTypes.MainWindow,
): Promise<void> {
    const path = await getUserJournalMapPath();
    win.alert(`${getString("journal-map-path")}\n${path}`);
}