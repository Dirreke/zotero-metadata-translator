import { pinyin } from "pinyin-pro";

const COMPOUND_SURNAMES = [
    "欧阳", "太史", "端木", "上官", "司马", "东方", "独孤", "南宫", "万俟", "闻人",
    "夏侯", "诸葛", "尉迟", "公羊", "赫连", "澹台", "皇甫", "宗政", "濮阳", "公冶",
    "太叔", "申屠", "公孙", "慕容", "仲孙", "钟离", "长孙", "宇文", "司徒", "鲜于",
    "司空", "闾丘", "子车", "亓官", "司寇", "巫马", "公西", "颛孙", "壤驷", "公良",
    "漆雕", "乐正", "宰父", "谷梁", "拓跋", "夹谷", "轩辕", "令狐", "段干", "百里",
    "呼延", "东郭", "南门", "羊舌", "微生", "梁丘", "左丘", "东门", "西门", "南宫",
];

function normalizeSpaces(text: string): string {
    return (text || "").replace(/\s+/g, " ").trim();
}

function hasChinese(text: string): boolean {
    return /[\u3400-\u9fff]/.test(text || "");
}

function stripNameSeparators(text: string): string {
    return normalizeSpaces(text).replace(/[·•．.]/g, "");
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
        surname: "head",
        v: true, // 吕 -> lv
    }) as string[];
}

export function toPinyinWords(text: string): string {
    const raw = normalizeSpaces(text);
    if (!raw) return "";
    if (!hasChinese(raw)) return raw;
    return normalizeSpaces(toPinyinArray(raw).map(capitalizeWord).join(" "));
}

function toJoinedNamePart(text: string): string {
    const raw = stripNameSeparators(text);
    if (!raw) return "";
    if (!hasChinese(raw)) return normalizeSpaces(text);
    return capitalizeWord(toPinyinArray(raw).join("").toLowerCase());
}

function isLikelyChineseFullName(text: string): boolean {
    const raw = stripNameSeparators(text);
    return /^[\u3400-\u9fff]{2,5}$/.test(raw);
}

function splitChineseFullName(
    fullName: string,
): { family: string; given: string } | null {
    const name = stripNameSeparators(fullName);
    if (!isLikelyChineseFullName(name)) return null;

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

function uniqKeepOrder(parts: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        if (!p) continue;
        if (!seen.has(p)) {
            seen.add(p);
            out.push(p);
        }
    }
    return out;
}

function getUnifiedRawName(creator: any): string {
    const rawLast = normalizeSpaces(creator.lastName || "");
    const rawName = normalizeSpaces(creator.name || "");
    const rawFirst = normalizeSpaces(creator.firstName || "");

    const parts = uniqKeepOrder([rawLast, rawName, rawFirst]).filter(Boolean);

    if (!parts.length) return "";

    // 没有中文：保持原来的普通拼接逻辑
    if (!parts.some(hasChinese)) {
        return normalizeSpaces(parts.join(" "));
    }

    const chineseParts = parts.filter(hasChinese).map(stripNameSeparators);

    if (!chineseParts.length) {
        return normalizeSpaces(parts.join(" "));
    }

    // 只有一个中文片段，直接当完整姓名处理
    if (chineseParts.length === 1) {
        return chineseParts[0];
    }

    // 如果某个片段本身已经像完整中文姓名，且覆盖了其他片段，则优先使用它
    const fullNameCandidates = chineseParts.filter(isLikelyChineseFullName);
    if (fullNameCandidates.length) {
        const longest = [...fullNameCandidates].sort((a, b) => b.length - a.length)[0];
        const others = chineseParts.filter((x) => x !== longest);
        if (others.every((x) => longest.includes(x))) {
            return longest;
        }
    }

    // 否则统一拼接后再拆分
    return chineseParts.join("");
}

export function creatorToDisplayName(creator: any): string {
    const unifiedRawName = getUnifiedRawName(creator);
    if (!unifiedRawName) return "";

    // 中文姓名：统一按“完整姓名”逻辑拆分，不再受 lastName / firstName 写法影响
    if (hasChinese(unifiedRawName)) {
        const split = splitChineseFullName(unifiedRawName);
        if (split) {
            return normalizeSpaces(
                `${toJoinedNamePart(split.family)} ${toJoinedNamePart(split.given)}`,
            );
        }

        // 不是典型中文姓名时，退回普通拼音分词
        return toPinyinWords(unifiedRawName);
    }

    // 非中文姓名
    return unifiedRawName;
}