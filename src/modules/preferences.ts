import { config } from "../../package.json";
import type {
  EnglishItemPlacementMode,
  EnglishItemPlacementPreference,
  MetadataSourcePreferences,
} from "./types";

const PREFIX = config.prefsPrefix;

export const PREF_AUTO_PROCESS_NEW = `${PREFIX}.autoProcessNew`;
export const PREF_AUTO_CREATE_ENGLISH_ITEM = `${PREFIX}.autoCreateEnglishItem`;
export const PREF_CONTAINER_MAP_JSON = `${PREFIX}.containerTitle.userMapJSON`;
export const PREF_ENGLISH_ITEM_PLACEMENT = `${PREFIX}.englishItem.placement`;
export const PREF_ENGLISH_ITEM_COLLECTION_KEY = `${PREFIX}.englishItem.collectionKey`;

const PREFS = {
  titleFile: `${PREFIX}.title.useFile`,
  authorFile: `${PREFIX}.author.useFile`,
  authorPinyin: `${PREFIX}.author.usePinyin`,
  containerMap: `${PREFIX}.containerTitle.useMap`,
};

export const DEFAULT_PREFS = {
  autoProcessNew: false,
  autoCreateEnglishItem: false,
  englishItemPlacement: "same-level" as EnglishItemPlacementMode,
  englishItemCollectionKey: "",
  titleFile: true,
  authorFile: true,
  authorPinyin: true,
  containerMap: true,
  containerMapJSON: "",
};

function hasChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text || "");
}

export function normalizeJournalMapKey(text: string): string {
  const raw = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";
  return hasChinese(raw) ? raw : raw.toLowerCase();
}

export function normalizeJournalMapObject(
  obj: unknown,
): Record<string, string> {
  const out: Record<string, string> = {};

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return out;
  }

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = normalizeJournalMapKey(k);
    const value = String(v ?? "").trim();

    if (!key || !value) continue;

    out[key] = value;
  }

  return out;
}

function getBoolPref(key: string, fallback: boolean): boolean {
  const value = Zotero.Prefs.get(key, true);
  if (typeof value === "boolean") return value;
  return fallback;
}

function getStringPref(key: string, fallback = ""): string {
  const value = Zotero.Prefs.get(key, true);
  if (typeof value === "string") return value;
  return fallback;
}

function normalizePlacementMode(value: string): EnglishItemPlacementMode {
  return value === "custom" ? "custom" : "same-level";
}

export function setBoolPref(key: string, value: boolean): void {
  Zotero.Prefs.set(key, value, true);
}

export function setStringPref(key: string, value: string): void {
  Zotero.Prefs.set(key, value, true);
}

export function isAutoProcessNewItemsEnabled(): boolean {
  return getBoolPref(PREF_AUTO_PROCESS_NEW, DEFAULT_PREFS.autoProcessNew);
}

export function isAutoCreateEnglishItemEnabled(): boolean {
  return getBoolPref(
    PREF_AUTO_CREATE_ENGLISH_ITEM,
    DEFAULT_PREFS.autoCreateEnglishItem,
  );
}

export function getEnglishItemPlacementPreference(): EnglishItemPlacementPreference {
  return {
    mode: normalizePlacementMode(
      getStringPref(
        PREF_ENGLISH_ITEM_PLACEMENT,
        DEFAULT_PREFS.englishItemPlacement,
      ),
    ),
    collectionKey: getStringPref(
      PREF_ENGLISH_ITEM_COLLECTION_KEY,
      DEFAULT_PREFS.englishItemCollectionKey,
    ).trim(),
  };
}

export function setEnglishItemPlacementMode(
  mode: EnglishItemPlacementMode,
): void {
  setStringPref(PREF_ENGLISH_ITEM_PLACEMENT, normalizePlacementMode(mode));
}

export function setEnglishItemCollectionKey(collectionKey: string): void {
  setStringPref(PREF_ENGLISH_ITEM_COLLECTION_KEY, collectionKey.trim());
}

export function getMetadataSourcePreferences(): MetadataSourcePreferences {
  return {
    title: {
      useFile: getBoolPref(PREFS.titleFile, DEFAULT_PREFS.titleFile),
    },
    author: {
      useFile: getBoolPref(PREFS.authorFile, DEFAULT_PREFS.authorFile),
      usePinyin: getBoolPref(PREFS.authorPinyin, DEFAULT_PREFS.authorPinyin),
    },
    containerTitle: {
      useMap: getBoolPref(PREFS.containerMap, DEFAULT_PREFS.containerMap),
    },
  };
}

export function getContainerMapJSONPreference(): string {
  return getStringPref(PREF_CONTAINER_MAP_JSON, DEFAULT_PREFS.containerMapJSON);
}

export function setContainerMapJSONPreference(value: string): void {
  setStringPref(PREF_CONTAINER_MAP_JSON, value);
}

export function loadPreferenceJournalMap(): Record<string, string> {
  const text = getContainerMapJSONPreference().trim();
  if (!text) return {};

  try {
    const obj = JSON.parse(text);
    return normalizeJournalMapObject(obj);
  } catch (e) {
    Zotero.debug(
      `[MetadataTranslator] load preference journal map failed: ${e}`,
    );
    return {};
  }
}

export function validateJournalMapJSON(text: string): {
  valid: boolean;
  message: string;
  normalizedJSON: string;
} {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      valid: true,
      message: "empty",
      normalizedJSON: "",
    };
  }

  try {
    const obj = JSON.parse(raw);

    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return {
        valid: false,
        message: "Journal mapping must be a JSON object.",
        normalizedJSON: "",
      };
    }

    const normalized = normalizeJournalMapObject(obj);

    return {
      valid: true,
      message: "ok",
      normalizedJSON: JSON.stringify(normalized, null, 2),
    };
  } catch (e: any) {
    return {
      valid: false,
      message: String(e?.message || e),
      normalizedJSON: "",
    };
  }
}

export function getPreferenceKey(
  key: "titleFile" | "authorFile" | "authorPinyin" | "containerMap",
): string {
  return PREFS[key];
}
