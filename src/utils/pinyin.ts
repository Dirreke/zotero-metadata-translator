import { pinyin } from "pinyin-pro";

export type PinyinNameCandidate = {
  displayName: string;
  family: string;
  given: string;
};

const COMPOUND_SURNAMES = [
  "欧阳",
  "太史",
  "端木",
  "上官",
  "司马",
  "东方",
  "独孤",
  "南宫",
  "万俟",
  "闻人",
  "夏侯",
  "诸葛",
  "尉迟",
  "公羊",
  "赫连",
  "澹台",
  "皇甫",
  "宗政",
  "濮阳",
  "公冶",
  "太叔",
  "申屠",
  "公孙",
  "慕容",
  "仲孙",
  "钟离",
  "长孙",
  "宇文",
  "司徒",
  "鲜于",
  "司空",
  "闾丘",
  "子车",
  "亓官",
  "司寇",
  "巫马",
  "公西",
  "颛孙",
  "壤驷",
  "公良",
  "漆雕",
  "乐正",
  "宰父",
  "谷梁",
  "拓跋",
  "夹谷",
  "轩辕",
  "令狐",
  "段干",
  "百里",
  "呼延",
  "东郭",
  "南门",
  "羊舌",
  "微生",
  "梁丘",
  "左丘",
  "东门",
  "西门",
  "南宫",
];

function normalizeSpaces(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function hasChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text || "");
}

function getChineseChars(text: string): string[] {
  return text.match(/[\u3400-\u9fff]/g) || [];
}

function stripNameSeparators(text: string): string {
  return normalizeSpaces(text).replace(/[·•．.]/g, "");
}

function capitalizeWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function capitalizeJoinedPinyin(text: string): string {
  const compact = text.replace(/\s+/g, "").replace(/-/g, "").toLowerCase();
  return capitalizeWord(compact);
}

function uniqKeepOrder<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];

  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
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

function getUnifiedRawName(creator: any): string {
  const rawLast = normalizeSpaces(creator.lastName || "");
  const rawName = normalizeSpaces(creator.name || "");
  const rawFirst = normalizeSpaces(creator.firstName || "");

  const parts = uniqKeepOrder([rawLast, rawName, rawFirst]).filter(Boolean);

  if (!parts.length) return "";

  if (!parts.some(hasChinese)) {
    return normalizeSpaces(parts.join(" "));
  }

  const chineseParts = parts.filter(hasChinese).map(stripNameSeparators);

  if (!chineseParts.length) {
    return normalizeSpaces(parts.join(" "));
  }

  if (chineseParts.length === 1) {
    return chineseParts[0];
  }

  const fullNameCandidates = chineseParts.filter(isLikelyChineseFullName);

  if (fullNameCandidates.length) {
    const longest = [...fullNameCandidates].sort(
      (a, b) => b.length - a.length,
    )[0];

    const others = chineseParts.filter((x) => x !== longest);

    if (others.every((x) => longest.includes(x))) {
      return longest;
    }
  }

  return chineseParts.join("");
}

function pinyinArray(
  text: string,
  options: {
    surname?: "head" | "all" | "off";
    multiple?: boolean;
  } = {},
): unknown {
  return pinyin(text, {
    toneType: "none",
    type: "array",
    nonZh: "removed",
    surname: options.surname ?? "off",
    v: true,
    multiple: options.multiple ?? false,
  } as any);
}

function entryToVariants(entry: any): string[] {
  if (Array.isArray(entry)) {
    return uniqKeepOrder(
      entry.map((x) => capitalizeWord(String(x || ""))).filter(Boolean),
    );
  }

  const value = capitalizeWord(String(entry || ""));
  return value ? [value] : [];
}

function pinyinVariantsForSingleChineseChar(
  ch: string,
  options: {
    surname?: "head" | "all" | "off";
    multiple?: boolean;
  } = {},
): string[] {
  const result = pinyinArray(ch, {
    ...options,
    multiple: options.multiple ?? false,
  });

  if (Array.isArray(result)) {
    return uniqKeepOrder(
      result.flatMap((entry: any) => entryToVariants(entry)),
    );
  }

  return String(result || "")
    .split(/\s+/)
    .map((x) => capitalizeWord(x))
    .filter(Boolean);
}

function toPinyinCandidateTokens(
  text: string,
  options: {
    surname?: "head" | "all" | "off";
    multiple?: boolean;
  } = {},
): string[][] {
  const raw = stripNameSeparators(text);
  if (!raw) return [];

  if (!hasChinese(raw)) {
    return raw
      .split(/\s+/)
      .map((x) => [capitalizeWord(x)])
      .filter((x) => x[0]);
  }

  const chars = getChineseChars(raw);

  if (options.multiple) {
    const perChar = chars
      .map((ch, index) =>
        pinyinVariantsForSingleChineseChar(ch, {
          surname:
            index === 0 && options.surname && options.surname !== "off"
              ? options.surname
              : "off",
          multiple: true,
        }),
      )
      .filter((x) => x.length > 0);

    if (perChar.length === chars.length) {
      return perChar;
    }
  }

  const result = pinyinArray(raw, options);

  if (Array.isArray(result)) {
    if (chars.length === 1) {
      const variants = uniqKeepOrder(
        result.flatMap((entry: any) => entryToVariants(entry)),
      );

      return variants.length ? [variants] : [];
    }

    if (result.length === chars.length) {
      return result
        .map((entry: any) => entryToVariants(entry))
        .filter((x) => x.length > 0);
    }
  }

  const fallback = pinyinArray(raw, {
    ...options,
    multiple: false,
  });

  if (Array.isArray(fallback)) {
    if (fallback.length === chars.length) {
      return fallback
        .map((entry: any) => entryToVariants(entry))
        .filter((x) => x.length > 0);
    }

    if (chars.length === 1) {
      const variants = uniqKeepOrder(
        fallback.flatMap((entry: any) => entryToVariants(entry)),
      );
      return variants.length ? [variants] : [];
    }
  }

  return String(fallback || "")
    .split(/\s+/)
    .map((x) => [capitalizeWord(x)])
    .filter((x) => x[0]);
}

function joinCartesian(parts: string[][], limit = 96): string[] {
  if (!parts.length) return [];

  let out = [""];

  for (const variants of parts) {
    const next: string[] = [];

    for (const prefix of out) {
      for (const variant of variants) {
        next.push(prefix ? `${prefix} ${variant}` : variant);
        if (next.length >= limit) break;
      }

      if (next.length >= limit) break;
    }

    out = next;

    if (out.length >= limit) break;
  }

  return uniqKeepOrder(out.map(normalizeSpaces).filter(Boolean));
}

export function toPinyinWords(text: string): string {
  const raw = normalizeSpaces(text);
  if (!raw) return "";
  if (!hasChinese(raw)) return raw;

  const tokens = toPinyinCandidateTokens(raw, {
    surname: "off",
    multiple: false,
  });

  return normalizeSpaces(tokens.map((x) => x[0]).join(" "));
}

function toJoinedNamePart(text: string, isSurname: boolean): string {
  const raw = stripNameSeparators(text);
  if (!raw) return "";
  if (!hasChinese(raw)) return normalizeSpaces(text);

  const tokens = toPinyinCandidateTokens(raw, {
    surname: isSurname ? "head" : "off",
    multiple: false,
  });

  return capitalizeJoinedPinyin(tokens.map((x) => x[0]).join(""));
}

function normalizeForeignCreatorNameForExtra(creator: any): string {
  const lastName = normalizeSpaces(creator.lastName || creator.name || "");
  const firstName = normalizeSpaces(creator.firstName || "");

  if (!lastName && !firstName) return "";

  let family = lastName;
  let given = firstName;

  if (!given && family.includes(",")) {
    const parts = family.split(",", 2).map((x) => normalizeSpaces(x));
    family = parts[0] || "";
    given = parts[1] || "";
  }

  const cleanPart = (text: string) =>
    normalizeSpaces(text)
      .replace(/\d+/g, "")
      .replace(/[，。；：]/g, " ")
      .replace(/[;:()[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  family = cleanPart(family);
  given = cleanPart(given).replace(/-/g, "");

  return normalizeSpaces([family, given].filter(Boolean).join(" "));
}

export function creatorToDisplayName(creator: any): string {
  const unifiedRawName = getUnifiedRawName(creator);
  if (!unifiedRawName) return "";

  if (hasChinese(unifiedRawName)) {
    const split = splitChineseFullName(unifiedRawName);

    if (split) {
      return normalizeSpaces(
        `${toJoinedNamePart(split.family, true)} ${toJoinedNamePart(
          split.given,
          false,
        )}`,
      );
    }

    return toPinyinWords(unifiedRawName);
  }

  return normalizeForeignCreatorNameForExtra(creator);
}

function makeLvLyuVariants(name: string): string[] {
  const values = new Set<string>();
  const base = normalizeSpaces(name);
  if (!base) return [];

  values.add(base);

  const patterns: Array<[RegExp, string]> = [
    [/\bLv\b/g, "Lyu"],
    [/\bLV\b/g, "LYU"],
    [/\blv\b/g, "lyu"],
    [/\bLyu\b/g, "Lv"],
    [/\bLYU\b/g, "LV"],
    [/\blyu\b/g, "lv"],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(base)) {
      values.add(base.replace(pattern, replacement));
    }
  }

  return [...values];
}

function makeGivenForms(given: string): string[] {
  const raw = normalizeSpaces(given);
  if (!raw) return [];

  const parts = raw.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return [raw];
  }

  return uniqKeepOrder([
    parts.join("-"),
    parts.join(" "),
    parts.join(""),
    capitalizeJoinedPinyin(parts.join("")),
  ]);
}

function makeDisplayNameVariants(
  family: string,
  given: string,
  options: {
    includeReversed?: boolean;
    includeComma?: boolean;
    includeCaseVariants?: boolean;
  } = {},
): string[] {
  const normalizedFamily = normalizeSpaces(family);
  const givenForms = makeGivenForms(given);

  if (!normalizedFamily || !givenForms.length) return [];

  const includeReversed = options.includeReversed ?? true;
  const includeComma = options.includeComma ?? true;
  const includeCaseVariants = options.includeCaseVariants ?? true;

  const values: string[] = [];

  for (const givenForm of givenForms) {
    values.push(`${normalizedFamily} ${givenForm}`);

    if (includeComma) {
      values.push(`${normalizedFamily}, ${givenForm}`);
    }

    if (includeReversed) {
      values.push(`${givenForm} ${normalizedFamily}`);
    }

    if (includeCaseVariants) {
      values.push(`${normalizedFamily.toUpperCase()} ${givenForm}`);
      values.push(`${normalizedFamily.toUpperCase()}, ${givenForm}`);
      values.push(
        `${normalizedFamily.toUpperCase()} ${givenForm.toUpperCase()}`,
      );
      values.push(`${givenForm} ${normalizedFamily.toUpperCase()}`);
    }
  }

  return uniqKeepOrder(
    values.flatMap(makeLvLyuVariants).map(normalizeSpaces).filter(Boolean),
  );
}

function dedupeNameCandidates(
  candidates: PinyinNameCandidate[],
): PinyinNameCandidate[] {
  const seen = new Set<string>();
  const out: PinyinNameCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.displayName.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(candidate);
  }

  return out;
}

function getFamilyCandidates(family: string, maxCandidates: number): string[] {
  const raw = stripNameSeparators(family);
  if (!raw) return [];

  if (!hasChinese(raw)) {
    return makeLvLyuVariants(normalizeSpaces(raw));
  }

  const standard = joinCartesian(
    toPinyinCandidateTokens(raw, {
      surname: "head",
      multiple: false,
    }),
    maxCandidates,
  );

  const all = joinCartesian(
    toPinyinCandidateTokens(raw, {
      surname: "all",
      multiple: true,
    }),
    maxCandidates,
  );

  return uniqKeepOrder([...standard, ...all])
    .map((x) => capitalizeJoinedPinyin(x))
    .flatMap(makeLvLyuVariants);
}

export function creatorToPinyinNameCandidates(
  creator: any,
  options: {
    includeCaseVariants?: boolean;
    includeReversed?: boolean;
    includeComma?: boolean;
    maxCandidates?: number;
  } = {},
): PinyinNameCandidate[] {
  const maxCandidates = options.maxCandidates ?? 160;
  const includeCaseVariants = options.includeCaseVariants ?? true;
  const includeReversed = options.includeReversed ?? true;
  const includeComma = options.includeComma ?? true;

  const unifiedRawName = getUnifiedRawName(creator);
  if (!unifiedRawName) return [];

  if (!hasChinese(unifiedRawName)) {
    const normalized = normalizeEnglishAuthorForExtra(unifiedRawName);
    const parts = normalized.split(/\s+/).filter(Boolean);

    if (parts.length < 2) {
      return [
        {
          displayName: normalized,
          family: normalized,
          given: "",
        },
      ];
    }

    const family = parts[0];
    const given = parts.slice(1).join(" ");

    return makeDisplayNameVariants(family, given, {
      includeCaseVariants,
      includeReversed,
      includeComma,
    })
      .slice(0, maxCandidates)
      .map((displayName) => ({
        displayName,
        family,
        given,
      }));
  }

  const split = splitChineseFullName(unifiedRawName);

  if (!split) {
    const base = toPinyinWords(unifiedRawName);
    const parts = base.split(/\s+/).filter(Boolean);

    if (parts.length < 2) {
      return [
        {
          displayName: base,
          family: parts[0] || base,
          given: parts.slice(1).join(" "),
        },
      ];
    }

    const family = parts[0];
    const given = parts.slice(1).join(" ");

    return makeDisplayNameVariants(family, given, {
      includeCaseVariants,
      includeReversed,
      includeComma,
    })
      .slice(0, maxCandidates)
      .map((displayName) => ({
        displayName,
        family,
        given,
      }));
  }

  const familyCandidates = getFamilyCandidates(split.family, maxCandidates);

  const givenSyllableCombinations = joinCartesian(
    toPinyinCandidateTokens(split.given, {
      surname: "off",
      multiple: true,
    }),
    maxCandidates,
  );

  const givenCandidates = uniqKeepOrder([
    ...givenSyllableCombinations.map((x) => x.replace(/\s+/g, "-")),
    ...givenSyllableCombinations,
    ...givenSyllableCombinations.map((x) => x.replace(/\s+/g, "")),
    ...givenSyllableCombinations.map((x) => capitalizeJoinedPinyin(x)),
    toJoinedNamePart(split.given, false),
  ]);

  const candidates: PinyinNameCandidate[] = [];

  for (const family of familyCandidates) {
    for (const given of givenCandidates) {
      for (const displayName of makeDisplayNameVariants(family, given, {
        includeCaseVariants,
        includeReversed,
        includeComma,
      })) {
        candidates.push({
          displayName,
          family,
          given,
        });

        if (candidates.length >= maxCandidates) {
          return dedupeNameCandidates(candidates);
        }
      }
    }
  }

  return dedupeNameCandidates(candidates).slice(0, maxCandidates);
}

export function getAuthorCreators(item: Zotero.Item): any[] {
  return ((item.getCreators() || []) as any[]).filter((creator: any) => {
    try {
      return Zotero.CreatorTypes.getName(creator.creatorTypeID) === "author";
    } catch {
      return false;
    }
  });
}

export function getFirstAuthorPinyinCandidates(
  item: Zotero.Item,
): PinyinNameCandidate[] {
  const firstAuthor = getAuthorCreators(item)[0];
  if (!firstAuthor) return [];

  return creatorToPinyinNameCandidates(firstAuthor, {
    includeCaseVariants: true,
    includeReversed: true,
    includeComma: true,
    maxCandidates: 160,
  });
}

export function getAllAuthorPinyinCandidates(
  item: Zotero.Item,
): PinyinNameCandidate[] {
  const candidates: PinyinNameCandidate[] = [];

  for (const creator of getAuthorCreators(item)) {
    candidates.push(
      ...creatorToPinyinNameCandidates(creator, {
        includeCaseVariants: true,
        includeReversed: true,
        includeComma: true,
        maxCandidates: 96,
      }),
    );
  }

  return dedupeNameCandidates(candidates);
}

export function normalizeEnglishAuthorForExtra(name: string): string {
  let s = normalizeSpaces(name)
    .replace(/\d+/g, "")
    .replace(/[，。；：]/g, " ")
    .replace(/[;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";

  if (s.includes(",")) {
    const [family, given] = s.split(",", 2).map((x) => normalizeSpaces(x));
    s = `${family} ${given}`;
  }

  const parts = s
    .split(/\s+/)
    .map((part) => part.replace(/-/g, ""))
    .filter(Boolean);

  return parts.map(capitalizeWord).join(" ");
}
