import { expect } from "chai";
import {
  cleanBrokenEnglishItemLinks,
  createEnglishItemFromDraft,
  deleteGeneratedEnglishItems,
} from "../src/modules/metadata";
import type { EnglishItemDraft } from "../src/modules/types";

let nextKeyIndex = 1;
const itemsByKey = new Map<string, FakeItem>();
const trashedKeys = new Set<string>();

class FakeItem {
  public id: number;
  public itemTypeID: number;
  public libraryID: number;
  public key: string;
  public fields: Record<string, string>;
  public creators: any[];
  public collections: number[];
  public relatedKeys: string[];
  public saveCount: number;

  constructor(itemTypeID = 4) {
    this.id = Math.floor(Math.random() * 100000);
    this.itemTypeID = itemTypeID;
    this.libraryID = 1;
    this.key = `NEWKEY${nextKeyIndex++}`;
    this.fields = {};
    this.creators = [];
    this.collections = [];
    this.relatedKeys = [];
    this.saveCount = 0;
    itemsByKey.set(this.key, this);
  }

  isRegularItem() {
    return true;
  }

  getField(field: string) {
    return this.fields[field] || "";
  }

  setField(field: string, value: string) {
    this.fields[field] = String(value);
  }

  getCreators() {
    return this.creators;
  }

  setCreators(creators: any[]) {
    this.creators = creators;
  }

  getCollections() {
    return this.collections;
  }

  setCollections(collections: number[]) {
    this.collections = collections;
  }

  addRelatedItem(item: FakeItem) {
    if (!this.relatedKeys.includes(item.key)) {
      this.relatedKeys.push(item.key);
    }
  }

  removeRelatedItem(item: FakeItem) {
    this.relatedKeys = this.relatedKeys.filter((key) => key !== item.key);
  }

  getDisplayTitle() {
    return this.fields.title || "";
  }

  async saveTx() {
    this.saveCount += 1;
  }
}

function registerItem(item: FakeItem) {
  itemsByKey.set(item.key, item);
}

function installZoteroItemMock(version = "8.0.0") {
  nextKeyIndex = 1;
  itemsByKey.clear();
  trashedKeys.clear();

  (globalThis as any).Zotero = {
    version,
    Item: FakeItem,
    Items: {
      getByLibraryAndKey: (_libraryID: number, key: string) =>
        itemsByKey.get(key) || null,
      trashTx: async (id: number) => {
        const item = [...itemsByKey.values()].find((x) => x.id === id);
        if (item) trashedKeys.add(item.key);
      },
    },
    Collections: {
      getByLibraryAndKey: (_libraryID: number, key: string) => {
        if (key === "COLLKEY99") {
          return {
            id: 99,
            key: "COLLKEY99",
            name: "Translated",
          };
        }

        return null;
      },
    },
    CreatorTypes: {
      getName: (creatorTypeID: number) =>
        creatorTypeID === 1 ? "author" : "editor",
    },
    Prefs: {
      get: (key: string) => {
        if (key.endsWith(".englishItem.placement")) return "same-level";
        if (key.endsWith(".englishItem.collectionKey")) return "";
        return undefined;
      },
      set: () => undefined,
    },
    debug: () => undefined,
  };

  (globalThis as any).addon = {
    data: {
      config: {
        addonName: "Metadata Translator",
        addonRef: "metadatatranslator",
      },
      locale: {
        current: {
          formatMessagesSync: () => [
            {
              value: "No English title was found.",
              attributes: null,
            },
          ],
        },
      },
    },
  };

  (globalThis as any).ztoolkit = {
    ProgressWindow: class {
      createLine() {
        return this;
      }
      show() {
        return this;
      }
      changeLine() {
        return this;
      }
      startCloseTimer() {
        return this;
      }
    },
  };
}

function makeWindow() {
  return {
    alert: () => undefined,
  } as unknown as _ZoteroTypes.MainWindow;
}

describe("createEnglishItemFromDraft", function () {
  beforeEach(function () {
    installZoteroItemMock("8.0.0");
  });

  it("creates an English item using translated title, authors, and container title", async function () {
    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).libraryID = 7;
    (source as any).key = "SRC12345";
    (source as any).collections = [10, 20];
    registerItem(source as unknown as FakeItem);

    source.setField("title", "中文标题");
    source.setField("publicationTitle", "电力系统自动化");
    source.setField("date", "2024");
    source.setField("volume", "48");
    source.setField("issue", "12");
    source.setField("pages", "1-9");
    source.setField("DOI", "10.1234/example");
    source.setField("url", "https://example.org/paper");
    source.setField("language", "zh-CN");
    source.setField("extra", "publicationTag: 中文核心");

    const draft: EnglishItemDraft = {
      title:
        "Spatial Organization of Basal-like Niches in Nasopharyngeal Carcinoma",
      publicationTitle: "Automation of Electric Power Systems",
      creators: [
        {
          creatorType: "author",
          lastName: "Zhang",
          firstName: "Lingling",
        },
        {
          creatorType: "author",
          lastName: "Li",
          firstName: "Qiang",
        },
      ],
      diagnostics: ["title:file", "author:pinyin", "container-title:map"],
    };

    const created = (await createEnglishItemFromDraft(
      source,
      draft,
    )) as unknown as FakeItem;

    expect(created.itemTypeID).to.equal(4);
    expect(created.libraryID).to.equal(7);

    expect(created.fields.title).to.equal(draft.title);
    expect(created.fields.publicationTitle).to.equal(
      "Automation of Electric Power Systems",
    );
    expect(created.fields.language).to.equal("en");

    expect(created.fields.date).to.equal("2024");
    expect(created.fields.volume).to.equal("48");
    expect(created.fields.issue).to.equal("12");
    expect(created.fields.pages).to.equal("1-9");
    expect(created.fields.DOI).to.equal("10.1234/example");
    expect(created.fields.url).to.equal("https://example.org/paper");

    expect(created.fields.extra).to.equal(
      [
        "original-title: 中文标题",
        "metadata-translator-source-item-key: SRC12345",
      ].join("\n"),
    );

    expect(source.getField("extra")).to.equal(
      [
        "publicationTag: 中文核心",
        `metadata-translator-english-item-key: ${created.key}`,
      ].join("\n"),
    );

    expect(created.collections).to.deep.equal([10, 20]);
    expect(created.creators).to.deep.equal(draft.creators);
  });

  it("creates an English item in a custom collection", async function () {
    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).key = "SRCCUSTOM";
    (source as any).collections = [10, 20];
    registerItem(source as unknown as FakeItem);

    source.setField("title", "中文标题");

    const draft: EnglishItemDraft = {
      title: "Spatial Organization of Basal-like Niches",
      publicationTitle: "Automation of Electric Power Systems",
      creators: [],
      diagnostics: [],
    };

    const created = (await createEnglishItemFromDraft(source, draft, {
      mode: "custom",
      collectionKey: "COLLKEY99",
      collectionID: 99,
    })) as unknown as FakeItem;

    expect(created.collections).to.deep.equal([99]);
  });

  it("sets related items on Zotero 8", async function () {
    installZoteroItemMock("8.0.0");

    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).key = "SRCREL01";
    registerItem(source as unknown as FakeItem);
    source.setField("title", "中文标题");

    const draft: EnglishItemDraft = {
      title: "Spatial Organization of Basal-like Niches",
      publicationTitle: "Automation of Electric Power Systems",
      creators: [],
      diagnostics: [],
    };

    const created = (await createEnglishItemFromDraft(
      source,
      draft,
    )) as unknown as FakeItem;

    expect((source as unknown as FakeItem).relatedKeys).to.deep.equal([
      created.key,
    ]);

    expect(created.relatedKeys).to.deep.equal(["SRCREL01"]);
  });

  it("sets related items on Zotero 7", async function () {
    installZoteroItemMock("7.0.0");

    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).key = "SRCREL02";
    registerItem(source as unknown as FakeItem);
    source.setField("title", "中文标题");

    const draft: EnglishItemDraft = {
      title: "Spatial Organization of Basal-like Niches",
      publicationTitle: "Automation of Electric Power Systems",
      creators: [],
      diagnostics: [],
    };

    const created = (await createEnglishItemFromDraft(
      source,
      draft,
    )) as unknown as FakeItem;

    expect((source as unknown as FakeItem).relatedKeys).to.deep.equal([
      created.key,
    ]);

    expect(created.relatedKeys).to.deep.equal(["SRCREL02"]);
  });

  it("deletes generated English items for source items and cleans source links", async function () {
    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).key = "SRCDELETE";
    registerItem(source as unknown as FakeItem);
    source.setField("title", "中文标题");
    source.setField("extra", "metadata-translator-english-item-key: ENDELETE");

    const generated = new FakeItem(4) as unknown as Zotero.Item;
    (generated as any).key = "ENDELETE";
    registerItem(generated as unknown as FakeItem);
    generated.setField(
      "extra",
      "metadata-translator-source-item-key: SRCDELETE",
    );

    await deleteGeneratedEnglishItems(makeWindow(), [source], {
      showProgress: false,
    });

    expect(trashedKeys.has("ENDELETE")).to.equal(true);
    expect(source.getField("extra")).to.equal("");
  });

  it("deletes selected generated English items and cleans source links", async function () {
    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).key = "SRCDELETE2";
    registerItem(source as unknown as FakeItem);
    source.setField("title", "中文标题");
    source.setField("extra", "metadata-translator-english-item-key: ENDELETE2");

    const generated = new FakeItem(4) as unknown as Zotero.Item;
    (generated as any).key = "ENDELETE2";
    registerItem(generated as unknown as FakeItem);
    generated.setField(
      "extra",
      "metadata-translator-source-item-key: SRCDELETE2",
    );

    await deleteGeneratedEnglishItems(makeWindow(), [generated], {
      showProgress: false,
    });

    expect(trashedKeys.has("ENDELETE2")).to.equal(true);
    expect(source.getField("extra")).to.equal("");
  });

  it("unlinks related items when deleting generated English items", async function () {
    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).key = "SRCUNLINK";
    registerItem(source as unknown as FakeItem);
    source.setField("title", "中文标题");
    source.setField("extra", "metadata-translator-english-item-key: ENUNLINK");

    const generated = new FakeItem(4) as unknown as Zotero.Item;
    (generated as any).key = "ENUNLINK";
    registerItem(generated as unknown as FakeItem);
    generated.setField(
      "extra",
      "metadata-translator-source-item-key: SRCUNLINK",
    );

    (source as unknown as FakeItem).relatedKeys = ["ENUNLINK"];
    (generated as unknown as FakeItem).relatedKeys = ["SRCUNLINK"];

    await deleteGeneratedEnglishItems(makeWindow(), [source], {
      showProgress: false,
    });

    expect((source as unknown as FakeItem).relatedKeys).to.deep.equal([]);
    expect((generated as unknown as FakeItem).relatedKeys).to.deep.equal([]);
    expect(trashedKeys.has("ENUNLINK")).to.equal(true);
    expect(source.getField("extra")).to.equal("");
  });

  it("cleans broken English item links", async function () {
    const source = new FakeItem(4) as unknown as Zotero.Item;
    (source as any).key = "SRCBROKEN";
    registerItem(source as unknown as FakeItem);
    source.setField("title", "中文标题");
    source.setField("extra", "metadata-translator-english-item-key: MISSING");

    await cleanBrokenEnglishItemLinks(makeWindow(), [source], {
      showProgress: false,
    });

    expect(source.getField("extra")).to.equal("");
  });

  it("throws when the English draft has no title", async function () {
    const source = new FakeItem(4) as unknown as Zotero.Item;
    source.setField("title", "中文标题");

    const draft: EnglishItemDraft = {
      title: "",
      publicationTitle: "Automation of Electric Power Systems",
      creators: [],
      diagnostics: [],
    };

    let error = "";

    try {
      await createEnglishItemFromDraft(source, draft);
    } catch (e: any) {
      error = String(e?.message || e);
    }

    expect(error).to.contain("No English title");
  });
});
