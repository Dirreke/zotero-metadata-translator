import { expect } from "chai";
import { creatorToDisplayName } from "../src/utils/pinyin";

describe("creatorToDisplayName", function () {
  it("parses a full Chinese name in lastName", function () {
    const creator = {
      fieldMode: 1,
      lastName: "王玲玲",
      firstName: "",
    };

    expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
  });

  it("parses a full Chinese name in firstName", function () {
    const creator = {
      fieldMode: 0,
      lastName: "",
      firstName: "王玲玲",
    };

    expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
  });

  it("parses separated family and given names", function () {
    const creator = {
      fieldMode: 0,
      lastName: "王",
      firstName: "玲玲",
    };

    expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
  });

  it("parses a compound surname", function () {
    const creator = {
      fieldMode: 1,
      lastName: "欧阳娜娜",
      firstName: "",
    };

    expect(creatorToDisplayName(creator)).to.equal("Ouyang Nana");
  });

  it("uses lv for 吕", function () {
    const creator = {
      fieldMode: 1,
      lastName: "吕强",
      firstName: "",
    };

    expect(creatorToDisplayName(creator)).to.equal("Lv Qiang");
  });

  it("parses a common Chinese full name", function () {
    const creator = {
      fieldMode: 1,
      lastName: "晏鸣宇",
      firstName: "",
    };

    expect(creatorToDisplayName(creator)).to.equal("Yan Mingyu");
  });

  it("parses 曾乐乐 with the default pinyin display form", function () {
    const creator = {
      fieldMode: 1,
      lastName: "曾乐乐",
      firstName: "",
    };

    expect(creatorToDisplayName(creator)).to.equal("Zeng Lele");
  });

  it("deduplicates repeated full names across fields", function () {
    const creator = {
      fieldMode: 0,
      lastName: "王玲玲",
      firstName: "王玲玲",
      name: "王玲玲",
    };

    expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
  });

  it("merges Chinese name parts from multiple fields", function () {
    const creator = {
      fieldMode: 0,
      lastName: "欧阳",
      firstName: "娜娜",
    };

    expect(creatorToDisplayName(creator)).to.equal("Ouyang Nana");
  });

  it("keeps common non-Chinese names in family-given order", function () {
    const creator = {
      fieldMode: 0,
      lastName: "Smith",
      firstName: "John",
    };

    expect(creatorToDisplayName(creator)).to.equal("Smith John");
  });

  it("keeps foreign creator case and particles", function () {
    const creator = {
      fieldMode: 0,
      lastName: "van der Waals",
      firstName: "Jan",
    };

    expect(creatorToDisplayName(creator)).to.equal("van der Waals Jan");
  });

  it("keeps camel-case foreign family names", function () {
    const creator = {
      fieldMode: 0,
      lastName: "McDonald",
      firstName: "John",
    };

    expect(creatorToDisplayName(creator)).to.equal("McDonald John");
  });

  it("converts comma-form foreign names to family-given order", function () {
    const creator = {
      fieldMode: 1,
      lastName: "De Souza, Maria",
      firstName: "",
    };

    expect(creatorToDisplayName(creator)).to.equal("De Souza Maria");
  });

  it("returns an empty string for an empty creator", function () {
    const creator = {
      fieldMode: 0,
      lastName: "",
      firstName: "",
    };

    expect(creatorToDisplayName(creator)).to.equal("");
  });
});
