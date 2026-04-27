import { expect } from "chai";
import {
  buildExtraWithManagedFields,
  sameValueList,
  splitExtra,
} from "../src/modules/extraFields";

describe("extraFields", function () {
  it("parses canonical managed fields case-insensitively", function () {
    const parsed = splitExtra(
      [
        "Original-Title: English Title",
        "original-author: Zhang San",
        "publicationTag: core",
      ].join("\n"),
    );

    expect(parsed.present.has("original-title")).to.equal(true);
    expect(parsed.present.has("original-author")).to.equal(true);
    expect(parsed.managed["original-title"]).to.deep.equal(["English Title"]);
    expect(parsed.managed["original-author"]).to.deep.equal(["Zhang San"]);
    expect(parsed.others).to.deep.equal(["publicationTag: core"]);
  });

  it("keeps non-managed lines and normalizes managed field order", function () {
    const oldExtra = [
      "publicationTag: core",
      "",
      "original-author: Old Author",
      "note: keep me",
    ].join("\n");

    const newExtra = buildExtraWithManagedFields(oldExtra, {
      "original-title": ["A New English Title"],
      "original-author": ["Zhang San"],
    });

    expect(newExtra).to.equal(
      [
        "publicationTag: core",
        "",
        "original-title: A New English Title",
        "original-author: Zhang San",
        "note: keep me",
      ].join("\n"),
    );
  });

  it("appends managed fields when Extra has no existing managed field", function () {
    const newExtra = buildExtraWithManagedFields("publicationTag: core", {
      "original-title": ["A New English Title"],
      "original-container-title": ["Power System Technology"],
    });

    expect(newExtra).to.equal(
      [
        "publicationTag: core",
        "original-title: A New English Title",
        "original-container-title: Power System Technology",
      ].join("\n"),
    );
  });

  it("deduplicates managed field values", function () {
    const newExtra = buildExtraWithManagedFields("", {
      "original-author": ["Zhang San", "zhang san", "Li Si"],
    });

    expect(newExtra).to.equal(
      ["original-author: Zhang San", "original-author: Li Si"].join("\n"),
    );
  });

  it("removes a managed field when update value is empty", function () {
    const oldExtra = [
      "original-title: Old Title",
      "original-author: Zhang San",
      "note: keep me",
    ].join("\n");

    const newExtra = buildExtraWithManagedFields(oldExtra, {
      "original-title": [],
    });

    expect(newExtra).to.equal(
      ["original-author: Zhang San", "note: keep me"].join("\n"),
    );
  });

  it("compares value lists after trimming, deduplication, and case folding", function () {
    expect(
      sameValueList([" Zhang San ", "Li Si"], ["zhang san", "Li Si"]),
    ).to.equal(true);

    expect(sameValueList(["Zhang San"], ["Zhang San", "Li Si"])).to.equal(
      false,
    );
  });
});
