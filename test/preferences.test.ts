import { expect } from "chai";
import {
  DEFAULT_PREFS,
  normalizeJournalMapObject,
  validateJournalMapJSON,
} from "../src/modules/preferences";

describe("preferences", function () {
  it("keeps automatic English item creation disabled by default", function () {
    expect(DEFAULT_PREFS.autoCreateEnglishItem).to.equal(false);
  });

  it("keeps automatic original-* processing disabled by default", function () {
    expect(DEFAULT_PREFS.autoProcessNew).to.equal(false);
  });

  it("uses same-level English item placement by default", function () {
    expect(DEFAULT_PREFS.englishItemPlacement).to.equal("same-level");
    expect(DEFAULT_PREFS.englishItemCollectionKey).to.equal("");
  });

  it("normalizes journal mapping keys and values", function () {
    const normalized = normalizeJournalMapObject({
      " 电力系统自动化 ": " Automation of Electric Power Systems ",
      "Power System Technology": "Power System Technology",
      "": "ignored",
      emptyValue: "",
    });

    expect(normalized).to.deep.equal({
      电力系统自动化: "Automation of Electric Power Systems",
      "power system technology": "Power System Technology",
    });
  });

  it("validates and formats journal mapping JSON", function () {
    const result = validateJournalMapJSON(
      JSON.stringify({
        " 电力系统自动化 ": " Automation of Electric Power Systems ",
      }),
    );

    expect(result.valid).to.equal(true);
    expect(result.normalizedJSON).to.equal(
      JSON.stringify(
        {
          电力系统自动化: "Automation of Electric Power Systems",
        },
        null,
        2,
      ),
    );
  });

  it("rejects non-object journal mapping JSON", function () {
    const result = validateJournalMapJSON("[]");

    expect(result.valid).to.equal(false);
    expect(result.normalizedJSON).to.equal("");
  });

  it("allows an empty journal mapping", function () {
    const result = validateJournalMapJSON("");

    expect(result.valid).to.equal(true);
    expect(result.normalizedJSON).to.equal("");
  });
});
