export type WriteMode = "title" | "authors" | "container" | "all";

export type ManagedField =
  | "original-title"
  | "original-container-title"
  | "original-author";

export const MANAGED_FIELD_ORDER: ManagedField[] = [
  "original-title",
  "original-container-title",
  "original-author",
];

export type MetadataSourcePreferences = {
  title: {
    useFile: boolean;
  };
  author: {
    useFile: boolean;
    usePinyin: boolean;
  };
  containerTitle: {
    useMap: boolean;
  };
};

export type EnglishItemPlacementMode = "same-level" | "custom";

export type EnglishItemPlacementPreference = {
  mode: EnglishItemPlacementMode;
  collectionKey: string;
};

export type EnglishItemPlacement = EnglishItemPlacementPreference & {
  collectionID?: number;
};

export type ResolvedMetadataValues = {
  title: string[];
  authors: string[];
  containerTitles: string[];
  diagnostics: string[];
};

export type EnglishItemDraft = {
  title?: string;
  creators?: Array<{
    creatorType: "author";
    firstName: string;
    lastName: string;
  }>;
  publicationTitle?: string;
  diagnostics: string[];
};
