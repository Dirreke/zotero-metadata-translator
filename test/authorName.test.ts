import { expect } from "chai";
import { creatorToDisplayName } from "../src/utils/pinyin";

describe("creatorToDisplayName", () => {
    it("parses a full Chinese name in lastName", () => {
        const creator = {
            fieldMode: 1,
            lastName: "王玲玲",
            firstName: "",
        };

        expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
    });

    it("parses a full Chinese name in firstName", () => {
        const creator = {
            fieldMode: 0,
            lastName: "",
            firstName: "王玲玲",
        };

        expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
    });

    it("parses separated family and given names", () => {
        const creator = {
            fieldMode: 0,
            lastName: "王",
            firstName: "玲玲",
        };

        expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
    });

    it("parses a compound surname", () => {
        const creator = {
            fieldMode: 1,
            lastName: "欧阳娜娜",
            firstName: "",
        };

        expect(creatorToDisplayName(creator)).to.equal("Ouyang Nana");
    });

    it("uses lv for 吕", () => {
        const creator = {
            fieldMode: 1,
            lastName: "吕强",
            firstName: "",
        };

        expect(creatorToDisplayName(creator)).to.equal("Lv Qiang");
    });

    it("parses a common Chinese full name", () => {
        const creator = {
            fieldMode: 1,
            lastName: "晏鸣宇",
            firstName: "",
        };

        expect(creatorToDisplayName(creator)).to.equal("Yan Mingyu");
    });

    it("deduplicates repeated full names across fields", () => {
        const creator = {
            fieldMode: 0,
            lastName: "王玲玲",
            firstName: "王玲玲",
            name: "王玲玲",
        };

        expect(creatorToDisplayName(creator)).to.equal("Wang Lingling");
    });

    it("merges Chinese name parts from multiple fields", () => {
        const creator = {
            fieldMode: 0,
            lastName: "欧阳",
            firstName: "娜娜",
        };

        expect(creatorToDisplayName(creator)).to.equal("Ouyang Nana");
    });

    it("keeps non-Chinese names unchanged", () => {
        const creator = {
            fieldMode: 0,
            lastName: "Smith",
            firstName: "John",
        };

        expect(creatorToDisplayName(creator)).to.equal("Smith John");
    });

    it("returns an empty string for an empty creator", () => {
        const creator = {
            fieldMode: 0,
            lastName: "",
            firstName: "",
        };

        expect(creatorToDisplayName(creator)).to.equal("");
    });
});