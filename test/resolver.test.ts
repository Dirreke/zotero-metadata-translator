import { expect } from "chai";
import {
  buildEnglishItemDraft,
  extractEnglishMetadataFromText,
  resolveMetadataValuesForItem,
  resolveOriginalContainerTitle,
} from "../src/modules/resolver";

const ZH_TITLE = "中文标题";
const BASE_EN_TITLE =
  "Spatial Organization of Basal-like Niches in Nasopharyngeal Carcinoma";
const BASE_ABSTRACT =
  "Abstract: This study investigates spatial organization of basal-like niches in nasopharyngeal carcinoma.";
const BASE_BODY =
  "Introduction: Spatial organization of tumor niches can reveal mechanisms of metastatic colonization.";
const BASE_KEYWORDS =
  "Keywords: nasopharyngeal carcinoma; basal-like niche; spatial transcriptomics";

function installZoteroMock(containerMapJSON = "") {
  (globalThis as any).Zotero = {
    CreatorTypes: {
      getName: (creatorTypeID: number) =>
        creatorTypeID === 1 ? "author" : "editor",
    },
    Prefs: {
      get: (key: string) => {
        if (key.endsWith(".containerTitle.userMapJSON")) {
          return containerMapJSON;
        }

        if (key.endsWith(".title.useFile")) return true;
        if (key.endsWith(".author.useFile")) return true;
        if (key.endsWith(".author.usePinyin")) return true;
        if (key.endsWith(".containerTitle.useMap")) return true;

        return undefined;
      },
      set: () => undefined,
    },
    Items: {
      get: () => null,
      getAsync: async () => [],
    },
    debug: () => undefined,
  };
}

function makeItem(fields: Record<string, string>, creators: any[] = []) {
  return {
    id: 1,
    isRegularItem: () => true,
    getField: (field: string) => fields[field] || "",
    getCreators: () => creators,
    getAttachments: () => [],
    getDisplayTitle: () => fields.title || "",
  } as unknown as Zotero.Item;
}

function author(lastName: string, firstName = "") {
  return {
    creatorTypeID: 1,
    lastName,
    firstName,
  };
}

function editor(lastName: string, firstName = "") {
  return {
    creatorTypeID: 2,
    lastName,
    firstName,
  };
}

function makeStructuredText(titleLine: string, authorLine: string): string {
  return [
    ZH_TITLE,
    titleLine,
    authorLine,
    BASE_ABSTRACT,
    BASE_KEYWORDS,
    BASE_BODY,
  ].join("\n");
}

function makeSameWindowText(titleLine: string, authorLine: string): string {
  return [
    ZH_TITLE,
    `${titleLine} ${authorLine}`,
    BASE_ABSTRACT,
    BASE_KEYWORDS,
    BASE_BODY,
  ].join("\n");
}

describe("resolver", function () {
  beforeEach(function () {
    installZoteroMock(
      JSON.stringify({
        电力系统自动化: "Automation of Electric Power Systems",
        中国电机工程学报: "Proceedings of the CSEE",
      }),
    );
  });

  describe("container title mapping", function () {
    it("resolves original-container-title from preference journal map", async function () {
      const resolved = await resolveOriginalContainerTitle("电力系统自动化");

      expect(resolved).to.equal("Automation of Electric Power Systems");
    });

    it("normalizes English journal map keys as lowercase", async function () {
      installZoteroMock(
        JSON.stringify({
          "Power System Technology": "Power System Technology",
        }),
      );

      const resolved = await resolveOriginalContainerTitle(
        "POWER SYSTEM TECHNOLOGY",
      );

      expect(resolved).to.equal("Power System Technology");
    });

    it("returns empty string for unmatched container title", async function () {
      const resolved = await resolveOriginalContainerTitle("不存在的期刊");

      expect(resolved).to.equal("");
    });
  });

  describe("English metadata extraction from indexed text", function () {
    it("extracts English title and authors from title-line plus author-line structure", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正"), author("王玲玲")],
      );

      const text = makeStructuredText(
        BASE_EN_TITLE,
        "LI Yuan-Zheng, WANG Lingling",
      );

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Li Yuanzheng");
      expect(result.authors).to.include("Wang Lingling");
      expect(result.source.blockName).to.equal("first");
      expect(result.source.matchedFirstAuthor).to.equal("Li Yuanzheng");
    });

    it("extracts English title and authors from same-window fallback", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正"), author("王玲玲")],
      );

      const text = makeSameWindowText(
        BASE_EN_TITLE,
        "LI Yuan-Zheng, WANG Lingling",
      );

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Li Yuanzheng");
      expect(result.authors).to.include("Wang Lingling");
    });

    it("normalizes extracted Chinese author romanization from PDF or Snapshot text", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("张玲玲"), author("李元正")],
      );

      const text = makeStructuredText(
        BASE_EN_TITLE,
        "ZHANG Ling-ling, LI Yuan-Zheng",
      );

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Zhang Lingling");
      expect(result.authors).to.include("Li Yuanzheng");
    });

    it("matches polyphonic given-name romanization from indexed text", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("曾乐乐")],
      );

      const text = makeStructuredText(BASE_EN_TITLE, "Zeng Leyue");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.deep.equal(["Zeng Leyue"]);
      expect(result.source.matchedFirstAuthor).to.equal("Zeng Leyue");
    });

    it("handles Lv/Lyu candidates for 吕 in attachment text", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("吕强")],
      );

      const text = makeStructuredText(BASE_EN_TITLE, "LYU Qiang");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Lyu Qiang");
    });

    it("handles compound surnames in attachment text", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("欧阳娜娜")],
      );

      const text = makeStructuredText(BASE_EN_TITLE, "OUYANG Nana");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Ouyang Nana");
    });

    it("strips numeric footnote markers after title lines", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正"), author("王玲玲")],
      );

      const text = makeStructuredText(
        `${BASE_EN_TITLE}[1]`,
        "LI Yuan-Zheng, WANG Lingling",
      );

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Li Yuanzheng");
      expect(result.authors).to.include("Wang Lingling");
    });

    it("strips symbol footnote markers after title lines", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正"), author("王玲玲")],
      );

      const text = makeStructuredText(
        `${BASE_EN_TITLE}*`,
        "LI Yuan-Zheng, WANG Lingling",
      );

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Li Yuanzheng");
      expect(result.authors).to.include("Wang Lingling");
    });

    it("strips mixed footnote markers after same-window titles", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正"), author("王玲玲")],
      );

      const text = makeSameWindowText(
        `${BASE_EN_TITLE}[1]*`,
        "LI Yuan-Zheng, WANG Lingling",
      );

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Li Yuanzheng");
      expect(result.authors).to.include("Wang Lingling");
    });

    it("ignores numbered reference entries on tail pages", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正")],
      );

      const text = [
        ZH_TITLE,
        BASE_BODY,
        [
          "[1] Spatial Organization of Basal-like Niches in Nasopharyngeal Carcinoma LI Yuan-Zheng, WANG Lingling. Journal of Spatial Oncology, 2020, 10(2): 1-9.",
          "[2] Immune Landscape of Nasopharyngeal Carcinoma. Cancer Letters, 2021, 12: 10-20.",
        ].join("\n"),
      ].join("\f");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal("");
      expect(result.authors).to.deep.equal([]);
    });

    it("ignores reference entries without an explicit References heading", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正")],
      );

      const text = [
        ZH_TITLE,
        BASE_BODY,
        "[1] Spatial Organization of Basal-like Niches in Nasopharyngeal Carcinoma LI Yuan-Zheng, WANG Lingling. Journal of Spatial Oncology, 2020, 10(2): 1-9.",
        "[2] Immune Landscape of Nasopharyngeal Carcinoma. Cancer Letters, 2021, 12: 10-20.",
      ].join("\n");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal("");
      expect(result.authors).to.deep.equal([]);
    });

    it("ignores unnumbered reference entries that cite a paper by the same first author", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正")],
      );

      const text = [
        ZH_TITLE,
        BASE_BODY,
        "Spatial Organization of Basal-like Niches in Nasopharyngeal Carcinoma LI Yuan-Zheng, WANG Lingling. Journal of Spatial Oncology, 2020, 10(2): 1-9.",
        "Immune Landscape of Nasopharyngeal Carcinoma. Cancer Letters, 2021, 12: 10-20.",
      ].join("\n");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal("");
      expect(result.authors).to.deep.equal([]);
    });

    it("ignores reference fragments that begin in the middle of a citation", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正")],
      );

      const text = [
        "Organization of Basal-like Niches in Nasopharyngeal Carcinoma LI Yuan-Zheng, WANG Lingling. Journal of Spatial Oncology, 2020;10(2):1-9.",
        "Immune Landscape of Nasopharyngeal Carcinoma. Cancer Letters, 2021;12:10-20.",
      ].join("\n");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal("");
      expect(result.authors).to.deep.equal([]);
    });

    it("ignores partially read reference entries when no References heading is present", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正")],
      );

      const text = [
        "Basal-like Niches in Nasopharyngeal Carcinoma LI Yuan-Zheng, WANG Lingling. Journal of Spatial Oncology. 2020;10:1-9.",
        "Tumor Microenvironment in Metastatic Lesions. Oncology Letters. 2021;12:10-20.",
      ].join("\n");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal("");
      expect(result.authors).to.deep.equal([]);
    });

    it("extracts valid metadata even when reference-like text appears before a real English summary block", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("李元正"), author("王玲玲")],
      );

      const text = [
        ZH_TITLE,
        BASE_BODY,
        "Spatial Organization of Basal-like Niches in Nasopharyngeal Carcinoma LI Yuan-Zheng, WANG Lingling. Journal of Spatial Oncology, 2020, 10(2): 1-9.",
        "",
        BASE_EN_TITLE,
        "LI Yuan-Zheng, WANG Lingling",
        BASE_ABSTRACT,
        BASE_KEYWORDS,
      ].join("\n");

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal(BASE_EN_TITLE);
      expect(result.authors).to.include("Li Yuanzheng");
      expect(result.authors).to.include("Wang Lingling");
    });

    it("returns empty result when no first author hint is available", function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [],
      );

      const text = makeStructuredText(
        BASE_EN_TITLE,
        "LI Yuan-Zheng, WANG Lingling",
      );

      const result = extractEnglishMetadataFromText(item, text);

      expect(result.title).to.equal("");
      expect(result.authors).to.deep.equal([]);
    });
  });

  describe("resolved metadata values", function () {
    it("combines pinyin authors and mapped container title", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
          publicationTitle: "电力系统自动化",
        },
        [author("张玲玲")],
      );

      const resolved = await resolveMetadataValuesForItem(item);

      expect(resolved.authors).to.include("Zhang Lingling");
      expect(resolved.containerTitles).to.deep.equal([
        "Automation of Electric Power Systems",
      ]);
      expect(resolved.diagnostics).to.include("author:pinyin");
      expect(resolved.diagnostics).to.include("container-title:map");
    });

    it("generates pinyin author for 吕", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("吕强")],
      );

      const resolved = await resolveMetadataValuesForItem(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: true },
        containerTitle: { useMap: false },
      });

      expect(resolved.authors).to.deep.equal(["Lv Qiang"]);
      expect(resolved.diagnostics).to.deep.equal(["author:pinyin"]);
    });

    it("generates pinyin author for compound surname", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("欧阳娜娜")],
      );

      const resolved = await resolveMetadataValuesForItem(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: true },
        containerTitle: { useMap: false },
      });

      expect(resolved.authors).to.deep.equal(["Ouyang Nana"]);
    });

    it("generates pinyin author from separated family and given names", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [author("王", "玲玲")],
      );

      const resolved = await resolveMetadataValuesForItem(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: true },
        containerTitle: { useMap: false },
      });

      expect(resolved.authors).to.deep.equal(["Wang Lingling"]);
    });

    it("keeps foreign creator name case while writing family name before given name", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [
          author("McDonald", "John"),
          author("van der Waals", "Jan"),
          author("de la Cruz", "Maria"),
        ],
      );

      const resolved = await resolveMetadataValuesForItem(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: true },
        containerTitle: { useMap: false },
      });

      expect(resolved.authors).to.deep.equal([
        "McDonald John",
        "van der Waals Jan",
        "de la Cruz Maria",
      ]);
    });

    it("keeps foreign creator name case while converting comma format to family-given order", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [
          {
            creatorTypeID: 1,
            lastName: "De Souza, Maria",
            firstName: "",
          },
        ],
      );

      const resolved = await resolveMetadataValuesForItem(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: true },
        containerTitle: { useMap: false },
      });

      expect(resolved.authors).to.deep.equal(["De Souza Maria"]);
    });

    it("ignores non-author creators", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
        },
        [editor("王玲玲"), author("张三")],
      );

      const resolved = await resolveMetadataValuesForItem(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: true },
        containerTitle: { useMap: false },
      });

      expect(resolved.authors).to.deep.equal(["Zhang San"]);
    });

    it("respects disabled source preferences", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
          publicationTitle: "电力系统自动化",
        },
        [author("张三")],
      );

      const resolved = await resolveMetadataValuesForItem(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: false },
        containerTitle: { useMap: false },
      });

      expect(resolved.title).to.deep.equal([]);
      expect(resolved.authors).to.deep.equal([]);
      expect(resolved.containerTitles).to.deep.equal([]);
      expect(resolved.diagnostics).to.deep.equal([]);
    });
  });

  describe("English item draft", function () {
    it("builds a draft for future English item conversion", async function () {
      const item = makeItem(
        {
          title: ZH_TITLE,
          publicationTitle: "中国电机工程学报",
        },
        [author("张玲玲"), author("李强")],
      );

      const draft = await buildEnglishItemDraft(item, {
        title: { useFile: false },
        author: { useFile: false, usePinyin: true },
        containerTitle: { useMap: true },
      });

      expect(draft.title).to.equal(undefined);
      expect(draft.publicationTitle).to.equal("Proceedings of the CSEE");
      expect(draft.creators).to.deep.equal([
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
      ]);
      expect(draft.diagnostics).to.include("author:pinyin");
      expect(draft.diagnostics).to.include("container-title:map");
    });
  });
});
