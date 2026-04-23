import { pinyin } from "pinyin-pro";

const COMPOUND_SURNAMES = [
    "欧阳", "太史", "端木", "上官", "司马", "东方", "独孤", "南宫", "万俟", "闻人",
    "夏侯", "诸葛", "尉迟", "公羊", "赫连", "澹台", "皇甫", "宗政", "濮阳", "公冶",
    "太叔", "申屠", "公孙", "慕容", "仲孙", "钟离", "长孙", "宇文", "司徒", "鲜于",
    "司空", "闾丘", "子车", "亓官", "司寇", "巫马", "公西", "颛孙", "壤驷", "公良",
    "漆雕", "乐正", "宰父", "谷梁", "拓跋", "夹谷", "轩辕", "令狐", "段干", "百里",
    "呼延", "东郭", "南门", "羊舌", "微生", "梁丘", "左丘", "东门", "西门", "南宫",
];

function hasChinese(text: string): boolean {
    return /[\u3400-\u9fff]/.test(text);
}

function isPureChineseName(text: string): boolean {
    return /^[\u3400-\u9fff]{2,4}$/.test(text.trim());
}

function normalizeSpaces(text: string): string {
    return (text || "").replace(/\s+/g, " ").trim();
}

function capitalizeWord(word: string): string {
    if (!word) return "";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function toPinyinArray(text: string): string[] {
    return pinyin(text, {
        toneType: "none",
        type: "array",
        nonZh: "consecutive",
        v: false,
    }) as string[];
}

export function toPinyinWords(text: string): string {
    const raw = normalizeSpaces(text);
    if (!raw) return "";
    if (!hasChinese(raw)) return raw;
    return normalizeSpaces(toPinyinArray(raw).map(capitalizeWord).join(" "));
}

function toJoinedNamePart(text: string): string {
    const raw = normalizeSpaces(text);
    if (!raw) return "";
    if (!hasChinese(raw)) return raw;
    return capitalizeWord(toPinyinArray(raw).join("").toLowerCase());
}

function splitChineseFullName(fullName: string): { family: string; given: string } | null {
    const name = normalizeSpaces(fullName);
    if (!isPureChineseName(name)) return null;

    for (const surname of COMPOUND_SURNAMES) {
        if (name.startsWith(surname) && name.length > surname.length) {
            return {
                family: surname,
                given: name.slice(surname.length),
            };
        }
    }

    return {
        family: name.slice(0, 1),
        given: name.slice(1),
    };
}

export function creatorToDisplayName(creator: any): string {
    // 单字段作者（fieldMode=1）
    if (creator.fieldMode === 1) {
        const rawName = normalizeSpaces(creator.lastName || creator.name || "");
        if (!rawName) return "";

        const split = splitChineseFullName(rawName);
        if (split) {
            return normalizeSpaces(
                `${toJoinedNamePart(split.family)} ${toJoinedNamePart(split.given)}`,
            );
        }

        return toPinyinWords(rawName);
    }

    // 双字段作者
    const familyRaw = normalizeSpaces(creator.lastName || "");
    const givenRaw = normalizeSpaces(creator.firstName || "");

    const family = hasChinese(familyRaw) ? toJoinedNamePart(familyRaw) : familyRaw;
    const given = hasChinese(givenRaw) ? toJoinedNamePart(givenRaw) : givenRaw;

    return normalizeSpaces([family, given].filter(Boolean).join(" "));
}