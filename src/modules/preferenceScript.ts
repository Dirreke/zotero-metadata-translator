import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  DEFAULT_PREFS,
  getContainerMapJSONPreference,
  getEnglishItemPlacementPreference,
  getPreferenceKey,
  PREF_AUTO_CREATE_ENGLISH_ITEM,
  PREF_AUTO_PROCESS_NEW,
  setBoolPref,
  setContainerMapJSONPreference,
  setEnglishItemCollectionKey,
  setEnglishItemPlacementMode,
  validateJournalMapJSON,
} from "./preferences";
import type { EnglishItemPlacementMode } from "./types";

type CollectionOption = {
  id: number;
  key: string;
  name: string;
  path: string;
};

function bindCheckbox(
  win: Window,
  id: string,
  prefKey: string,
  fallback: boolean,
): void {
  const checkbox = win.document.querySelector(`#${id}`) as any;
  if (!checkbox) return;

  const value = Zotero.Prefs.get(prefKey, true);
  checkbox.checked = typeof value === "boolean" ? value : fallback;

  checkbox.addEventListener("command", () => {
    setBoolPref(prefKey, !!checkbox.checked);
  });
}

function prefID(suffix: string): string {
  return `zotero-prefpane-${config.addonRef}-${suffix}`;
}

function getMapExample(): string {
  return JSON.stringify(
    {
      中国电机工程学报: "Proceedings of the CSEE",
      电力系统自动化: "Automation of Electric Power Systems",
      电网技术: "Power System Technology",
    },
    null,
    2,
  );
}

function getMainWindow(): any {
  try {
    return Zotero.getMainWindow?.();
  } catch {
    return null;
  }
}

function getActivePane(win: Window): any {
  try {
    return (
      Zotero.getActiveZoteroPane?.() ||
      (win as any).ZoteroPane ||
      getMainWindow()?.ZoteroPane ||
      null
    );
  } catch {
    return (win as any).ZoteroPane || getMainWindow()?.ZoteroPane || null;
  }
}

function getCurrentLibraryID(win: Window): number {
  const pane = getActivePane(win);

  try {
    const id = pane?.getSelectedLibraryID?.();
    if (Number.isFinite(Number(id))) return Number(id);
  } catch {
    // Fall through.
  }

  try {
    const collection = pane?.getSelectedCollection?.();
    if (Number.isFinite(Number(collection?.libraryID))) {
      return Number(collection.libraryID);
    }
  } catch {
    // Fall through.
  }

  const userLibraryID = Number((Zotero as any).Libraries?.userLibraryID);
  return Number.isFinite(userLibraryID) ? userLibraryID : 1;
}

function asArray(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    if (typeof value[Symbol.iterator] === "function") {
      return [...value];
    }
  } catch {
    // Fall through.
  }

  return [];
}

function getCollectionByID(id: number): any | null {
  const api: any = Zotero.Collections;

  try {
    if (typeof api.get === "function") {
      return api.get(id) || null;
    }
  } catch {
    // Ignore.
  }

  return null;
}

function resolveCollection(value: any): any | null {
  if (!value) return null;

  if (typeof value === "number") {
    return getCollectionByID(value);
  }

  if (typeof value === "object") {
    return value;
  }

  return null;
}

function getCollectionName(collection: any): string {
  try {
    return String(collection.getName?.() || collection.name || "");
  } catch {
    return String(collection.name || "");
  }
}

function getCollectionParentID(collection: any): number | null {
  const value =
    collection.parentID ??
    collection.parentCollectionID ??
    collection.parent?.id ??
    null;

  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getCollectionChildren(collection: any): any[] {
  const out: any[] = [];

  try {
    if (typeof collection.getChildCollections === "function") {
      out.push(...asArray(collection.getChildCollections()));
    }
  } catch {
    // Ignore.
  }

  try {
    if (typeof collection.getChildCollections === "function") {
      out.push(...asArray(collection.getChildCollections(false)));
    }
  } catch {
    // Ignore.
  }

  try {
    if (Array.isArray(collection.childCollections)) {
      out.push(...collection.childCollections);
    }
  } catch {
    // Ignore.
  }

  return out.map(resolveCollection).filter(Boolean);
}

function getSeedCollections(libraryID: number): any[] {
  const api: any = Zotero.Collections;
  const out: any[] = [];

  try {
    out.push(...asArray(api.getByLibrary?.(libraryID)));
  } catch {
    // Ignore.
  }

  try {
    out.push(...asArray(api.getAll?.(libraryID)));
  } catch {
    // Ignore.
  }

  try {
    out.push(
      ...asArray(api.getAll?.()).filter(
        (collection: any) => Number(collection?.libraryID) === libraryID,
      ),
    );
  } catch {
    // Ignore.
  }

  return out.map(resolveCollection).filter(Boolean);
}

function getCollectionsForLibrary(libraryID: number): CollectionOption[] {
  const seen = new Map<number, CollectionOption>();
  const rawByID = new Map<number, any>();

  const rememberRaw = (collection: any) => {
    const id = Number(collection?.id);
    if (Number.isFinite(id) && id > 0) {
      rawByID.set(id, collection);
    }
  };

  const addCollection = (collection: any, inheritedPath = "") => {
    const id = Number(collection?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const key = String(collection.key || "").trim();
    const name = getCollectionName(collection);
    if (!key || !name) return;

    rememberRaw(collection);

    const path = inheritedPath ? `${inheritedPath} / ${name}` : name;
    const existing = seen.get(id);

    if (!existing || (!existing.path.includes(" / ") && path.includes(" / "))) {
      seen.set(id, {
        id,
        key,
        name,
        path,
      });
    }

    for (const child of getCollectionChildren(collection)) {
      addCollection(child, path);
    }
  };

  const seeds = getSeedCollections(libraryID);

  for (const collection of seeds) {
    rememberRaw(collection);
  }

  // First pass: add all collections as they are returned by Zotero.
  for (const collection of seeds) {
    addCollection(collection);
  }

  // Second pass: if Zotero exposes parentID, reconstruct nested paths even if
  // getByLibrary()/getAll() returned a flat list.
  const pathCache = new Map<number, string>();

  const getPathFromParent = (collection: any): string => {
    const id = Number(collection.id);

    if (pathCache.has(id)) return pathCache.get(id)!;

    const name = getCollectionName(collection);
    const parentID = getCollectionParentID(collection);

    if (!parentID || !rawByID.has(parentID)) {
      pathCache.set(id, name);
      return name;
    }

    const path = `${getPathFromParent(rawByID.get(parentID))} / ${name}`;
    pathCache.set(id, path);
    return path;
  };

  for (const collection of rawByID.values()) {
    const id = Number(collection.id);
    const option = seen.get(id);
    if (!option) continue;

    const parentPath = getPathFromParent(collection);
    option.path = parentPath;
  }

  return [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function setStatus(
  status: HTMLElement | null,
  message: string,
  ok = true,
): void {
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("metadata-translator-status-error", !ok);
}

function createOption(
  win: Window,
  value: string,
  text: string,
): HTMLOptionElement {
  const option = win.document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "option",
  ) as HTMLOptionElement;

  option.value = value;
  option.textContent = text;

  return option;
}

function populateCollectionSelect(
  win: Window,
  select: HTMLSelectElement,
  status: HTMLElement | null,
): void {
  const pref = getEnglishItemPlacementPreference();
  const libraryID = getCurrentLibraryID(win);
  const collections = getCollectionsForLibrary(libraryID);

  select.textContent = "";

  if (!collections.length) {
    const option = createOption(
      win,
      "",
      getString("pref-english-collection-empty"),
    );

    option.disabled = true;
    select.appendChild(option);

    setStatus(status, getString("pref-english-collection-empty-note"), false);
    return;
  }

  let hasStoredKey = false;

  for (const collection of collections) {
    const option = createOption(win, collection.key, collection.path);
    option.title = collection.key;

    if (collection.key === pref.collectionKey) {
      option.selected = true;
      hasStoredKey = true;
    }

    select.appendChild(option);
  }

  if (pref.collectionKey && !hasStoredKey) {
    const option = createOption(
      win,
      pref.collectionKey,
      getString("pref-english-collection-missing", {
        args: { key: pref.collectionKey },
      }),
    );

    option.selected = true;
    select.insertBefore(option, select.firstChild);

    setStatus(status, getString("pref-english-collection-missing-note"), false);
    return;
  }

  if (!pref.collectionKey && select.options.length) {
    select.selectedIndex = 0;
  }

  setStatus(status, "");
}

function bindEnglishItemPlacement(win: Window): void {
  const sameRadio = win.document.querySelector(
    `#${prefID("english-placement-same")}`,
  ) as HTMLInputElement | null;

  const customRadio = win.document.querySelector(
    `#${prefID("english-placement-custom")}`,
  ) as HTMLInputElement | null;

  const collectionSelect = win.document.querySelector(
    `#${prefID("english-collection-select")}`,
  ) as HTMLSelectElement | null;

  const refreshButton = win.document.querySelector(
    `#${prefID("english-collection-refresh")}`,
  ) as HTMLButtonElement | null;

  const status = win.document.querySelector(
    `#${prefID("english-collection-status")}`,
  ) as HTMLElement | null;

  const customControls = win.document.querySelector(
    `#${prefID("english-placement-custom-controls")}`,
  ) as HTMLElement | null;

  if (!sameRadio || !customRadio || !collectionSelect) return;

  const pref = getEnglishItemPlacementPreference();

  sameRadio.checked = pref.mode === "same-level";
  customRadio.checked = pref.mode === "custom";

  populateCollectionSelect(win, collectionSelect, status);

  const updateEnabledState = () => {
    const enabled = customRadio.checked;

    collectionSelect.disabled = !enabled;
    if (refreshButton) refreshButton.disabled = !enabled;

    customControls?.classList.toggle(
      "metadata-translator-custom-controls-disabled",
      !enabled,
    );
  };

  const setMode = (mode: EnglishItemPlacementMode) => {
    setEnglishItemPlacementMode(mode);

    sameRadio.checked = mode === "same-level";
    customRadio.checked = mode === "custom";

    updateEnabledState();
  };

  sameRadio.addEventListener("change", () => {
    if (sameRadio.checked) {
      setMode("same-level");
    }
  });

  customRadio.addEventListener("change", () => {
    if (customRadio.checked) {
      setMode("custom");

      if (collectionSelect.value) {
        setEnglishItemCollectionKey(collectionSelect.value);
      }
    }
  });

  collectionSelect.addEventListener("change", () => {
    setEnglishItemCollectionKey(collectionSelect.value);
    setMode("custom");
    setStatus(status, "");
  });

  refreshButton?.addEventListener("click", () => {
    populateCollectionSelect(win, collectionSelect, status);
    updateEnabledState();
  });

  updateEnabledState();
}

function bindContainerMapEditor(win: Window): void {
  const textarea = win.document.querySelector(
    `#${prefID("container-map-json")}`,
  ) as HTMLTextAreaElement | null;

  const saveButton = win.document.querySelector(
    `#${prefID("container-map-save")}`,
  ) as HTMLButtonElement | null;

  const clearButton = win.document.querySelector(
    `#${prefID("container-map-clear")}`,
  ) as HTMLButtonElement | null;

  const exampleButton = win.document.querySelector(
    `#${prefID("container-map-example")}`,
  ) as HTMLButtonElement | null;

  const status = win.document.querySelector(
    `#${prefID("container-map-status")}`,
  ) as HTMLElement | null;

  if (!textarea) return;

  textarea.value =
    getContainerMapJSONPreference() || DEFAULT_PREFS.containerMapJSON;

  textarea.placeholder = getMapExample();

  const setMapStatus = (message: string, ok = true) => {
    setStatus(status, message, ok);
  };

  saveButton?.addEventListener("click", () => {
    const result = validateJournalMapJSON(textarea.value);

    if (!result.valid) {
      setMapStatus(
        `${getString("pref-container-map-status-invalid")} ${result.message}`,
        false,
      );
      return;
    }

    textarea.value = result.normalizedJSON;
    setContainerMapJSONPreference(result.normalizedJSON);
    setMapStatus(getString("pref-container-map-status-saved"), true);
  });

  clearButton?.addEventListener("click", () => {
    textarea.value = "";
    setContainerMapJSONPreference(DEFAULT_PREFS.containerMapJSON);
    setMapStatus(getString("pref-container-map-status-cleared"), true);
  });

  exampleButton?.addEventListener("click", () => {
    textarea.value = getMapExample();
    setMapStatus(getString("pref-container-map-status-example"), true);
  });
}

export async function registerPrefsScripts(win: Window): Promise<void> {
  bindCheckbox(
    win,
    prefID("auto-process"),
    PREF_AUTO_PROCESS_NEW,
    DEFAULT_PREFS.autoProcessNew,
  );

  bindCheckbox(
    win,
    prefID("auto-create-english-item"),
    PREF_AUTO_CREATE_ENGLISH_ITEM,
    DEFAULT_PREFS.autoCreateEnglishItem,
  );

  bindEnglishItemPlacement(win);

  bindCheckbox(
    win,
    prefID("title-file"),
    getPreferenceKey("titleFile"),
    DEFAULT_PREFS.titleFile,
  );

  bindCheckbox(
    win,
    prefID("author-file"),
    getPreferenceKey("authorFile"),
    DEFAULT_PREFS.authorFile,
  );

  bindCheckbox(
    win,
    prefID("author-pinyin"),
    getPreferenceKey("authorPinyin"),
    DEFAULT_PREFS.authorPinyin,
  );

  bindCheckbox(
    win,
    prefID("container-map"),
    getPreferenceKey("containerMap"),
    DEFAULT_PREFS.containerMap,
  );

  bindContainerMapEditor(win);
}
