import { getString } from "../utils/locale";
import {
  buildEnglishItemDraft,
  getContainerTitle,
  resolveMetadataValuesForItem,
} from "./resolver";
import {
  dedupeValues,
  sameValueList,
  setManagedFieldValues,
  splitExtra,
} from "./extraFields";
import { getEnglishItemPlacementPreference } from "./preferences";
import type {
  EnglishItemDraft,
  EnglishItemPlacement,
  ManagedField,
  ResolvedMetadataValues,
  WriteMode,
} from "./types";
import { MANAGED_FIELD_ORDER } from "./types";

type OverwriteDecision = {
  action: "overwrite" | "skip" | "cancel";
  applyToSameField: boolean;
  applyToAllFields: boolean;
};

type BatchState = {
  overwriteAllByField: Partial<Record<ManagedField, boolean>>;
  overwriteAllFields: boolean;
  skipAllByField: Partial<Record<ManagedField, boolean>>;
  skipAllFields: boolean;
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

export const EXTRA_SOURCE_ITEM_KEY = "metadata-translator-source-item-key";
export const EXTRA_ENGLISH_ITEM_KEY = "metadata-translator-english-item-key";

const BIB_FIELDS_TO_COPY = [
  "date",
  "volume",
  "issue",
  "pages",
  "numPages",
  "DOI",
  "url",
  "accessDate",
  "ISSN",
  "ISBN",
  "publisher",
  "place",
  "series",
  "seriesNumber",
  "edition",
  "archive",
  "archiveLocation",
  "libraryCatalog",
  "callNumber",
  "rights",
];

const CONTAINER_FIELDS = [
  "publicationTitle",
  "proceedingsTitle",
  "bookTitle",
  "seriesTitle",
  "websiteTitle",
];

function createHTML<K extends keyof HTMLElementTagNameMap>(
  win: Window,
  tag: K,
): HTMLElementTagNameMap[K] {
  return win.document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    tag,
  ) as HTMLElementTagNameMap[K];
}

function askOverwrite(
  win: Window,
  fieldName: ManagedField,
  itemTitle: string,
  totalItems: number,
  targetFieldCount: number,
): Promise<OverwriteDecision> {
  return new Promise((resolve) => {
    const doc = win.document;
    const mount = doc.documentElement ?? doc.body;

    if (!mount) {
      resolve({
        action: "cancel",
        applyToSameField: false,
        applyToAllFields: false,
      });
      return;
    }

    const canApplyToSameField = totalItems > 1;
    const canApplyToAllFields = targetFieldCount > 1;
    const shouldShowOptions = canApplyToSameField || canApplyToAllFields;

    const overlay = createHTML(win, "div");
    const panel = createHTML(win, "div");
    const title = createHTML(win, "div");
    const message = createHTML(win, "div");
    const buttons = createHTML(win, "div");

    let sameFieldCheckbox: HTMLInputElement | null = null;
    let allFieldsCheckbox: HTMLInputElement | null = null;

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.28)",
    });

    Object.assign(panel.style, {
      width: "min(520px, calc(100vw - 64px))",
      padding: "18px",
      borderRadius: "10px",
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
      background: "var(--material-background, Canvas)",
      color: "var(--fill-primary, CanvasText)",
      font: "message-box",
    });

    Object.assign(title.style, {
      fontSize: "1.12em",
      fontWeight: "650",
      marginBottom: "10px",
    });

    Object.assign(message.style, {
      lineHeight: "1.45",
      marginBottom: shouldShowOptions ? "12px" : "16px",
      whiteSpace: "pre-wrap",
    });

    Object.assign(buttons.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      justifyContent: "flex-end",
    });

    title.textContent = getString("prompt-overwrite-title");
    message.textContent = getString("prompt-overwrite-message", {
      args: { title: itemTitle, field: fieldName },
    });

    if (shouldShowOptions) {
      const options = createHTML(win, "div");

      Object.assign(options.style, {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        margin: "10px 0 16px",
        padding: "10px",
        borderRadius: "8px",
        background: "var(--fill-senary, rgba(127, 127, 127, 0.08))",
      });

      const makeCheckboxRow = (
        text: string,
      ): {
        label: HTMLLabelElement;
        checkbox: HTMLInputElement;
      } => {
        const label = createHTML(win, "label");
        const checkbox = createHTML(win, "input");

        checkbox.type = "checkbox";

        Object.assign(label.style, {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          userSelect: "none",
        });

        label.appendChild(checkbox);
        label.appendChild(doc.createTextNode(text));

        return { label, checkbox };
      };

      if (canApplyToSameField) {
        const row = makeCheckboxRow(
          getString("prompt-overwrite-apply-same-field"),
        );
        sameFieldCheckbox = row.checkbox;
        options.appendChild(row.label);
      }

      if (canApplyToAllFields) {
        const row = makeCheckboxRow(
          getString("prompt-overwrite-apply-all-fields"),
        );
        allFieldsCheckbox = row.checkbox;
        options.appendChild(row.label);
      }

      sameFieldCheckbox?.addEventListener("change", () => {
        if (sameFieldCheckbox?.checked && allFieldsCheckbox) {
          allFieldsCheckbox.checked = false;
        }
      });

      allFieldsCheckbox?.addEventListener("change", () => {
        if (allFieldsCheckbox?.checked && sameFieldCheckbox) {
          sameFieldCheckbox.checked = false;
        }
      });

      panel.appendChild(title);
      panel.appendChild(message);
      panel.appendChild(options);
    } else {
      panel.appendChild(title);
      panel.appendChild(message);
    }

    const cleanup = (decision: OverwriteDecision) => {
      win.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      resolve(decision);
    };

    const makeDecision = (
      action: OverwriteDecision["action"],
    ): OverwriteDecision => ({
      action,
      applyToSameField: !!sameFieldCheckbox?.checked,
      applyToAllFields: !!allFieldsCheckbox?.checked,
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cleanup(makeDecision("cancel"));
      }
    };

    win.addEventListener("keydown", onKeyDown, true);

    const overwriteButton = createHTML(win, "button");
    overwriteButton.type = "button";
    overwriteButton.textContent = getString("button-overwrite");
    overwriteButton.addEventListener("click", () => {
      cleanup(makeDecision("overwrite"));
    });

    const skipButton = createHTML(win, "button");
    skipButton.type = "button";
    skipButton.textContent = getString("button-skip");
    skipButton.addEventListener("click", () => {
      cleanup(makeDecision("skip"));
    });

    const cancelButton = createHTML(win, "button");
    cancelButton.type = "button";
    cancelButton.textContent = getString("button-cancel");
    cancelButton.addEventListener("click", () => {
      cleanup(makeDecision("cancel"));
    });

    buttons.appendChild(overwriteButton);
    buttons.appendChild(skipButton);
    buttons.appendChild(cancelButton);

    panel.appendChild(buttons);
    overlay.appendChild(panel);
    mount.appendChild(overlay);

    overwriteButton.focus();
  });
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

export function normalizeRegularItems(items: Zotero.Item[]): Zotero.Item[] {
  return (items || []).filter((item) => item && item.isRegularItem());
}

export function getUpdatesForMode(
  mode: WriteMode,
  resolved: ResolvedMetadataValues,
): Partial<Record<ManagedField, string[]>> {
  const updates: Partial<Record<ManagedField, string[]>> = {};

  if (mode === "title" || mode === "all") {
    updates["original-title"] = resolved.title;
  }

  if (mode === "authors" || mode === "all") {
    updates["original-author"] = resolved.authors;
  }

  if (mode === "container" || mode === "all") {
    updates["original-container-title"] = resolved.containerTitles;
  }

  return updates;
}

export function getTargetFieldsForMode(mode: WriteMode): ManagedField[] {
  if (mode === "title") return ["original-title"];
  if (mode === "authors") return ["original-author"];
  if (mode === "container") return ["original-container-title"];

  return [...MANAGED_FIELD_ORDER];
}

function applyDecisionToState(
  state: BatchState,
  field: ManagedField,
  decision: OverwriteDecision,
): void {
  if (decision.action === "cancel") return;

  if (decision.applyToAllFields) {
    if (decision.action === "overwrite") {
      state.overwriteAllFields = true;
    } else {
      state.skipAllFields = true;
    }
    return;
  }

  if (decision.applyToSameField) {
    if (decision.action === "overwrite") {
      state.overwriteAllByField[field] = true;
    } else {
      state.skipAllByField[field] = true;
    }
  }
}

async function maybeApplyUpdates(
  win: _ZoteroTypes.MainWindow,
  item: Zotero.Item,
  state: BatchState,
  totalItems: number,
  updates: Partial<Record<ManagedField, string[]>>,
  mode: WriteMode,
  options: Required<ProcessOptions>,
): Promise<"changed" | "unchanged" | "cancel"> {
  const currentExtra = String(item.getField("extra") || "");
  const parsed = splitExtra(currentExtra);

  const finalUpdates: Partial<Record<ManagedField, string[]>> = {};
  const fields = getTargetFieldsForMode(mode);

  for (const field of fields) {
    const values = dedupeValues(updates[field] || []);
    if (!values.length) continue;

    const alreadyPresent = parsed.present.has(field);
    const existingValues = parsed.managed[field] || [];

    if (alreadyPresent) {
      if (sameValueList(existingValues, values)) {
        continue;
      }

      if (!options.interactive) {
        continue;
      }

      if (state.skipAllFields || state.skipAllByField[field]) {
        continue;
      }

      if (!state.overwriteAllFields && !state.overwriteAllByField[field]) {
        const decision = await askOverwrite(
          win,
          field,
          item.getDisplayTitle() || `#${item.id}`,
          totalItems,
          fields.length,
        );

        if (decision.action === "cancel") return "cancel";

        applyDecisionToState(state, field, decision);

        if (decision.action === "skip") {
          continue;
        }
      }
    }

    finalUpdates[field] = values;
  }

  if (!Object.keys(finalUpdates).length) return "unchanged";

  const changed = setManagedFieldValues(item, finalUpdates);
  return changed ? "changed" : "unchanged";
}

export function isLikelyChineseItem(item: Zotero.Item): boolean {
  const hasChinese = (text: string) => /[\u3400-\u9fff]/.test(text || "");

  const language = String(item.getField("language") || "")
    .trim()
    .toLowerCase();

  if (language === "zh-cn") return true;

  if (hasChinese(String(item.getField("title") || ""))) return true;
  if (hasChinese(getContainerTitle(item))) return true;

  for (const creator of item.getCreators()) {
    const c: any = creator;
    const text = String(c.lastName || c.name || c.firstName || "");
    if (hasChinese(text)) return true;
  }

  return false;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimBlankEdges(lines: string[]): string[] {
  const out = [...lines];

  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();

  return out;
}

function getExtraLineValue(extra: string, key: string): string {
  const re = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:\\s*(.*)$`, "i");

  for (const line of String(extra || "").split(/\r?\n/)) {
    const match = line.match(re);
    if (match) return String(match[1] || "").trim();
  }

  return "";
}

function upsertExtraLine(extra: string, key: string, value: string): string {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return String(extra || "");

  const line = `${key}: ${normalizedValue}`;
  const re = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`, "i");
  const lines = String(extra || "") ? String(extra || "").split(/\r?\n/) : [];

  let replaced = false;

  const updated = lines.map((oldLine) => {
    if (re.test(oldLine)) {
      replaced = true;
      return line;
    }

    return oldLine;
  });

  if (!replaced) {
    updated.push(line);
  }

  return trimBlankEdges(updated).join("\n");
}

function removeExtraLine(extra: string, key: string): string {
  const re = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`, "i");

  return trimBlankEdges(
    String(extra || "")
      .split(/\r?\n/)
      .filter((line) => !re.test(line)),
  ).join("\n");
}

function setExtraLine(item: Zotero.Item, key: string, value: string): boolean {
  const oldExtra = String(item.getField("extra") || "");
  const newExtra = upsertExtraLine(oldExtra, key, value);

  if (newExtra === oldExtra) return false;

  item.setField("extra", newExtra);
  return true;
}

function removeExtraKey(item: Zotero.Item, key: string): boolean {
  const oldExtra = String(item.getField("extra") || "");
  const newExtra = removeExtraLine(oldExtra, key);

  if (newExtra === oldExtra) return false;

  item.setField("extra", newExtra);
  return true;
}

function getItemKey(item: Zotero.Item): string {
  return String((item as any).key || "").trim();
}

export function getGeneratedEnglishSourceKey(item: Zotero.Item): string {
  return getExtraLineValue(
    String(item.getField("extra") || ""),
    EXTRA_SOURCE_ITEM_KEY,
  );
}

export function getGeneratedEnglishItemKey(item: Zotero.Item): string {
  return getExtraLineValue(
    String(item.getField("extra") || ""),
    EXTRA_ENGLISH_ITEM_KEY,
  );
}

export function isMetadataTranslatorGeneratedEnglishItem(
  item: Zotero.Item,
): boolean {
  return !!getGeneratedEnglishSourceKey(item);
}

async function findItemByKey(
  libraryID: number,
  key: string,
): Promise<Zotero.Item | null> {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return null;

  const itemsAPI: any = Zotero.Items;

  try {
    if (typeof itemsAPI.getByLibraryAndKeyAsync === "function") {
      const item = await itemsAPI.getByLibraryAndKeyAsync(
        libraryID,
        normalizedKey,
      );
      return item || null;
    }

    if (typeof itemsAPI.getByLibraryAndKey === "function") {
      const item = itemsAPI.getByLibraryAndKey(libraryID, normalizedKey);
      return item || null;
    }

    if (typeof itemsAPI.getIDFromLibraryAndKey === "function") {
      const id = itemsAPI.getIDFromLibraryAndKey(libraryID, normalizedKey);
      if (id) return itemsAPI.get(id) || null;
    }
  } catch (e) {
    Zotero.debug(`[MetadataTranslator] find item by key failed: ${String(e)}`);
  }

  return null;
}

function findCollectionByKey(libraryID: number, key: string): any | null {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return null;

  const collectionsAPI: any = Zotero.Collections;

  try {
    if (typeof collectionsAPI.getByLibraryAndKey === "function") {
      return (
        collectionsAPI.getByLibraryAndKey(libraryID, normalizedKey) || null
      );
    }

    const collections =
      collectionsAPI.getByLibrary?.(libraryID) ||
      collectionsAPI.getAll?.(libraryID) ||
      [];

    return (
      collections.find(
        (collection: any) => String(collection.key || "") === normalizedKey,
      ) || null
    );
  } catch (e) {
    Zotero.debug(
      `[MetadataTranslator] find collection by key failed: ${String(e)}`,
    );
  }

  return null;
}

function copyFieldIfPresent(
  sourceItem: Zotero.Item,
  targetItem: Zotero.Item,
  field: string,
): void {
  try {
    const value = sourceItem.getField(field);
    if (value !== undefined && value !== null && String(value).trim()) {
      targetItem.setField(field, value);
    }
  } catch {
    // Some fields are not valid for every item type.
  }
}

function getContainerFieldForNewItem(sourceItem: Zotero.Item): string {
  for (const field of CONTAINER_FIELDS) {
    try {
      const value = String(sourceItem.getField(field) || "").trim();
      if (value) return field;
    } catch {
      // Ignore invalid fields for this item type.
    }
  }

  return "publicationTitle";
}

function setContainerTitleForNewItem(
  sourceItem: Zotero.Item,
  targetItem: Zotero.Item,
  containerTitle: string | undefined,
): void {
  const value = String(containerTitle || "").trim();
  if (!value) return;

  const sourceContainerField = getContainerFieldForNewItem(sourceItem);

  try {
    targetItem.setField(sourceContainerField, value);
  } catch {
    // Ignore invalid source container field for target item type.
  }

  if (sourceContainerField !== "publicationTitle") {
    try {
      targetItem.setField("publicationTitle", value);
    } catch {
      // Not all item types support publicationTitle.
    }
  }
}

function setCreators(
  targetItem: Zotero.Item,
  creators: EnglishItemDraft["creators"],
): void {
  if (!creators?.length) return;

  const item: any = targetItem;

  if (typeof item.setCreators === "function") {
    item.setCreators(creators);
    return;
  }

  if (typeof item.setCreator === "function") {
    creators.forEach((creator, index) => {
      item.setCreator(index, creator);
    });
  }
}

function setItemCollections(
  targetItem: Zotero.Item,
  collectionIDs: number[],
): void {
  const target: any = targetItem;

  if (!collectionIDs.length) return;

  if (typeof target.setCollections === "function") {
    target.setCollections(collectionIDs);
  }
}

function copyCollections(
  sourceItem: Zotero.Item,
  targetItem: Zotero.Item,
): void {
  const source: any = sourceItem;

  try {
    const collections = source.getCollections?.() || [];
    setItemCollections(targetItem, collections);
  } catch {
    // Collection copying is best-effort.
  }
}

function applyEnglishItemPlacement(
  sourceItem: Zotero.Item,
  targetItem: Zotero.Item,
  placement?: EnglishItemPlacement,
): void {
  const pref = getEnglishItemPlacementPreference();

  const effectivePlacement: EnglishItemPlacement = placement || {
    mode: pref.mode,
    collectionKey: pref.collectionKey,
  };

  if (effectivePlacement.mode === "custom") {
    const collectionID =
      effectivePlacement.collectionID ||
      findCollectionByKey(
        (sourceItem as any).libraryID,
        effectivePlacement.collectionKey,
      )?.id;

    if (collectionID) {
      setItemCollections(targetItem, [collectionID]);
      return;
    }
  }

  copyCollections(sourceItem, targetItem);
}

function addRelatedItem(item: Zotero.Item, relatedItem: Zotero.Item): void {
  (item as any).addRelatedItem(relatedItem);
}

function removeRelatedItem(item: Zotero.Item, relatedItem: Zotero.Item): void {
  (item as any).removeRelatedItem(relatedItem);
}

async function linkRelatedItems(
  sourceItem: Zotero.Item,
  targetItem: Zotero.Item,
): Promise<void> {
  addRelatedItem(sourceItem, targetItem);
  addRelatedItem(targetItem, sourceItem);

  await sourceItem.saveTx();
  await targetItem.saveTx();
}

async function unlinkRelatedItems(
  sourceItem: Zotero.Item,
  targetItem: Zotero.Item,
): Promise<void> {
  removeRelatedItem(sourceItem, targetItem);
  removeRelatedItem(targetItem, sourceItem);

  await sourceItem.saveTx();
  await targetItem.saveTx();
}

function buildGeneratedItemExtra(sourceItem: Zotero.Item): string {
  let extra = "";

  const originalTitle = String(sourceItem.getField("title") || "").trim();
  const sourceKey = getItemKey(sourceItem);

  extra = upsertExtraLine(extra, "original-title", originalTitle);
  extra = upsertExtraLine(extra, EXTRA_SOURCE_ITEM_KEY, sourceKey);

  return extra;
}

async function markSourceItemWithGeneratedKey(
  sourceItem: Zotero.Item,
  targetItem: Zotero.Item,
): Promise<void> {
  const targetKey = getItemKey(targetItem);
  if (!targetKey) return;

  const changed = setExtraLine(sourceItem, EXTRA_ENGLISH_ITEM_KEY, targetKey);

  if (changed) {
    await sourceItem.saveTx();
  }
}

async function moveItemToTrash(item: Zotero.Item): Promise<void> {
  const itemsAPI: any = Zotero.Items;

  if (typeof itemsAPI.trashTx === "function") {
    await itemsAPI.trashTx(item.id);
    return;
  }

  if (typeof itemsAPI.trash === "function") {
    await itemsAPI.trash(item.id);
    return;
  }

  (item as any).deleted = true;
  await item.saveTx();
}

export async function createEnglishItemFromDraft(
  sourceItem: Zotero.Item,
  draft: EnglishItemDraft,
  placement?: EnglishItemPlacement,
): Promise<Zotero.Item> {
  if (!draft.title) {
    throw new Error(
      getString("error-english-title-missing", {
        args: {
          title: sourceItem.getDisplayTitle() || `#${sourceItem.id}`,
        },
      }),
    );
  }

  const source: any = sourceItem;
  const ZoteroItem = (Zotero as any).Item;
  const targetItem = new ZoteroItem(source.itemTypeID) as Zotero.Item;

  (targetItem as any).libraryID = source.libraryID;

  targetItem.setField("title", draft.title);
  targetItem.setField("language", "en");
  targetItem.setField("extra", buildGeneratedItemExtra(sourceItem));

  setContainerTitleForNewItem(sourceItem, targetItem, draft.publicationTitle);

  for (const field of BIB_FIELDS_TO_COPY) {
    copyFieldIfPresent(sourceItem, targetItem, field);
  }

  setCreators(targetItem, draft.creators);
  applyEnglishItemPlacement(sourceItem, targetItem, placement);

  await targetItem.saveTx();

  await markSourceItemWithGeneratedKey(sourceItem, targetItem);
  await linkRelatedItems(sourceItem, targetItem);

  return targetItem;
}

export async function createEnglishItemFromItem(
  item: Zotero.Item,
  placement?: EnglishItemPlacement,
): Promise<Zotero.Item> {
  const draft = await buildEnglishItemDraft(item);
  return createEnglishItemFromDraft(item, draft, placement);
}

export async function createEnglishItems(
  win: _ZoteroTypes.MainWindow,
  items: Zotero.Item[],
  options: Pick<ProcessOptions, "showProgress" | "suppressNoSelectionAlert"> & {
    placement?: EnglishItemPlacement;
  } = {},
): Promise<void> {
  const merged = {
    showProgress: options.showProgress ?? true,
    suppressNoSelectionAlert: options.suppressNoSelectionAlert ?? false,
    placement: options.placement,
  };

  const regularItems = normalizeRegularItems(items);

  if (!regularItems.length) {
    if (!merged.suppressNoSelectionAlert) {
      win.alert(getString("error-no-regular-item"));
    }
    return;
  }

  const progress = createBatchProgress(
    regularItems.length,
    merged.showProgress,
  );
  const errors: BatchError[] = [];
  let processed = 0;

  for (const item of regularItems) {
    try {
      await createEnglishItemFromItem(item, merged.placement);
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

async function deleteGeneratedEnglishItem(
  generatedItem: Zotero.Item,
): Promise<void> {
  const sourceKey = getGeneratedEnglishSourceKey(generatedItem);
  const libraryID = (generatedItem as any).libraryID;

  const sourceItem = await findItemByKey(libraryID, sourceKey);

  if (sourceItem) {
    const linkedEnglishKey = getGeneratedEnglishItemKey(sourceItem);
    if (linkedEnglishKey === getItemKey(generatedItem)) {
      if (removeExtraKey(sourceItem, EXTRA_ENGLISH_ITEM_KEY)) {
        await sourceItem.saveTx();
      }
    }

    await unlinkRelatedItems(sourceItem, generatedItem);
  }

  await moveItemToTrash(generatedItem);
}

async function deleteGeneratedEnglishItemForSource(
  sourceItem: Zotero.Item,
): Promise<void> {
  const englishKey = getGeneratedEnglishItemKey(sourceItem);
  if (!englishKey) return;

  const generatedItem = await findItemByKey(
    (sourceItem as any).libraryID,
    englishKey,
  );

  if (!generatedItem) {
    if (removeExtraKey(sourceItem, EXTRA_ENGLISH_ITEM_KEY)) {
      await sourceItem.saveTx();
    }
    return;
  }

  const sourceKey = getGeneratedEnglishSourceKey(generatedItem);
  if (sourceKey !== getItemKey(sourceItem)) {
    return;
  }

  await unlinkRelatedItems(sourceItem, generatedItem);
  await moveItemToTrash(generatedItem);

  if (removeExtraKey(sourceItem, EXTRA_ENGLISH_ITEM_KEY)) {
    await sourceItem.saveTx();
  }
}

export async function deleteGeneratedEnglishItems(
  win: _ZoteroTypes.MainWindow,
  items: Zotero.Item[],
  options: Pick<
    ProcessOptions,
    "showProgress" | "suppressNoSelectionAlert"
  > = {},
): Promise<void> {
  const regularItems = normalizeRegularItems(items);
  const progress = createBatchProgress(
    regularItems.length,
    options.showProgress ?? regularItems.length > 1,
  );

  const errors: BatchError[] = [];
  let processed = 0;

  for (const item of regularItems) {
    try {
      if (isMetadataTranslatorGeneratedEnglishItem(item)) {
        await deleteGeneratedEnglishItem(item);
      } else {
        await deleteGeneratedEnglishItemForSource(item);
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

export async function cleanBrokenEnglishItemLinks(
  win: _ZoteroTypes.MainWindow,
  items: Zotero.Item[],
  options: Pick<
    ProcessOptions,
    "showProgress" | "suppressNoSelectionAlert"
  > = {},
): Promise<void> {
  const regularItems = normalizeRegularItems(items);
  const progress = createBatchProgress(
    regularItems.length,
    options.showProgress ?? regularItems.length > 1,
  );

  const errors: BatchError[] = [];
  let processed = 0;

  for (const item of regularItems) {
    try {
      const englishKey = getGeneratedEnglishItemKey(item);

      if (englishKey) {
        const generatedItem = await findItemByKey(
          (item as any).libraryID,
          englishKey,
        );

        const shouldClean =
          !generatedItem ||
          getGeneratedEnglishSourceKey(generatedItem) !== getItemKey(item);

        if (shouldClean && removeExtraKey(item, EXTRA_ENGLISH_ITEM_KEY)) {
          await item.saveTx();
        }
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
    overwriteAllByField: {},
    overwriteAllFields: false,
    skipAllByField: {},
    skipAllFields: false,
  };

  const progress = createBatchProgress(
    regularItems.length,
    merged.showProgress,
  );
  const errors: BatchError[] = [];
  let processed = 0;

  for (const item of regularItems) {
    try {
      const resolved = await resolveMetadataValuesForItem(item);
      const updates = getUpdatesForMode(mode, resolved);

      const result = await maybeApplyUpdates(
        win,
        item,
        state,
        regularItems.length,
        updates,
        mode,
        merged,
      );

      if (result === "cancel") break;

      if (result === "changed") {
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
