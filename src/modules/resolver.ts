import JOURNAL_TITLE_MAP from "../journalTitleMap.json";
import {
  creatorToDisplayName,
  getAllAuthorPinyinCandidates,
  getAuthorCreators,
  getFirstAuthorPinyinCandidates,
  normalizeEnglishAuthorForExtra,
  type PinyinNameCandidate,
} from "../utils/pinyin";
import {
  getAttachmentTextSources,
  type AttachmentTextSource,
} from "./attachment";
import {
  getMetadataSourcePreferences,
  loadPreferenceJournalMap,
  normalizeJournalMapKey,
} from "./preferences";
import type {
  EnglishItemDraft,
  MetadataSourcePreferences,
  ResolvedMetadataValues,
} from "./types";
import { dedupeValues } from "./extraFields";

type CandidateBlockName = "first" | "last" | "penultimate" | "tail";

type CandidateBlock = {
  name: CandidateBlockName;
  pageIndex: number | null;
  text: string;
};

type AuthorHint = {
  displayName: string;
  compactKey: string;
};

type AuthorMatch = {
  index: number;
  endIndex: number;
  value: string;
  displayName: string;
};

type FirstAuthorBoundary = {
  index: number;
  endIndex: number;
  matchedFirstAuthor: string;
  matchedLength: number;
};

export type EnglishMetadataCandidate = {
  title: string;
  authors: string[];
  score: number;
  blockName: CandidateBlockName;
  pageIndex: number | null;
  lineIndex: number;
  raw: string;
  matchedFirstAuthor: string;
};

export type ExtractedEnglishMetadata = {
  title: string;
  authors: string[];
  source: {
    attachmentID?: number;
    attachmentKind?: "pdf" | "snapshot";
    attachmentFilename?: string;
    blockName?: CandidateBlockName;
    pageIndex?: number | null;
    lineIndex?: number;
    raw?: string;
    matchedFirstAuthor?: string;
  };
  candidates: EnglishMetadataCandidate[];
};

function cleanLine(s: string): string {
  return String(s ?? "")
    .replace(/\u00ad/g, "")
    .replace(/[‐-‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(s: string): string {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function getLines(text: string): string[] {
  return normalizeText(text).split(/\n+/).map(cleanLine).filter(Boolean);
}

function countEnglishWords(s: string): number {
  return (String(s).match(/[A-Za-z][A-Za-z-]*/g) || []).length;
}

function countChineseChars(s: string): number {
  return (String(s).match(/[\u3400-\u9fff]/g) || []).length;
}

function englishLetterRatio(s: string): number {
  const str = String(s || "");
  const letters = (str.match(/[A-Za-z]/g) || []).length;
  const nonSpace = str.replace(/\s/g, "").length;
  return nonSpace ? letters / nonSpace : 0;
}

function cleanTitleCandidate(title: string): string {
  let s = cleanLine(title);
  let previous = "";

  while (s && s !== previous) {
    previous = s;
    s = s
      .replace(
        /\s*(?:\[[\d,\s\-–]+\]|\[[*†‡§#]+\]|[*†‡§#]+|[¹²³⁴⁵⁶⁷⁸⁹⁰]+)\s*$/g,
        "",
      )
      .trim();
  }

  return cleanLine(s);
}

function compactAuthorKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function buildCompactIndexMap(s: string): {
  compact: string;
  indexMap: number[];
} {
  const compactChars: string[] = [];
  const indexMap: number[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/[A-Za-z]/.test(ch)) {
      compactChars.push(ch.toLowerCase());
      indexMap.push(i);
    }
  }

  return {
    compact: compactChars.join(""),
    indexMap,
  };
}

function splitCandidateBlocks(text: string): CandidateBlock[] {
  const normalized = normalizeText(text);

  const pages = normalized
    .split(/\f+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (pages.length >= 3) {
    return [
      { name: "first", pageIndex: 0, text: pages[0] },
      {
        name: "last",
        pageIndex: pages.length - 1,
        text: pages[pages.length - 1],
      },
      {
        name: "penultimate",
        pageIndex: pages.length - 2,
        text: pages[pages.length - 2],
      },
    ];
  }

  if (pages.length === 2) {
    return [
      { name: "first", pageIndex: 0, text: pages[0] },
      { name: "last", pageIndex: 1, text: pages[1] },
    ];
  }

  const headText = normalized.slice(0, 9000);
  const tailText = normalized.slice(Math.max(0, normalized.length - 12000));

  if (tailText === headText || normalized.length <= 12000) {
    return [{ name: "first", pageIndex: 0, text: headText }];
  }

  return [
    { name: "first", pageIndex: 0, text: headText },
    { name: "tail", pageIndex: null, text: tailText },
  ];
}

function makeHintsFromCandidates(
  candidates: PinyinNameCandidate[],
): AuthorHint[] {
  const map = new Map<string, AuthorHint>();

  for (const candidate of candidates) {
    const compactKey = compactAuthorKey(candidate.displayName);

    if (compactKey.length < 5) continue;

    if (!map.has(compactKey)) {
      map.set(compactKey, {
        displayName: candidate.displayName,
        compactKey,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => b.compactKey.length - a.compactKey.length,
  );
}

function makeFirstAuthorHints(item: Zotero.Item): AuthorHint[] {
  return makeHintsFromCandidates(getFirstAuthorPinyinCandidates(item));
}

function makeAllAuthorHints(item: Zotero.Item): AuthorHint[] {
  return makeHintsFromCandidates(getAllAuthorPinyinCandidates(item));
}

function findAuthorMatches(text: string, hints: AuthorHint[]): AuthorMatch[] {
  const s = cleanLine(text);
  const { compact, indexMap } = buildCompactIndexMap(s);
  const matches: AuthorMatch[] = [];

  for (const hint of hints) {
    let from = 0;

    while (from < compact.length) {
      const pos = compact.indexOf(hint.compactKey, from);
      if (pos < 0) break;

      const startIndex = indexMap[pos];
      const endIndex = indexMap[pos + hint.compactKey.length - 1] + 1;
      const raw = s.slice(startIndex, endIndex);
      const value =
        normalizeEnglishAuthorForExtra(raw) ||
        normalizeEnglishAuthorForExtra(hint.displayName);

      if (value) {
        matches.push({
          index: startIndex,
          endIndex,
          value,
          displayName: hint.displayName,
        });
      }

      from = pos + hint.compactKey.length;
    }
  }

  matches.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return b.endIndex - a.endIndex;
  });

  const out: AuthorMatch[] = [];
  const occupied: Array<[number, number]> = [];
  const seenAtPosition = new Set<string>();

  for (const match of matches) {
    const key = `${match.index}:${match.endIndex}:${match.value.toLowerCase()}`;
    if (seenAtPosition.has(key)) continue;

    const overlaps = occupied.some(
      ([start, end]) => match.index < end && match.endIndex > start,
    );

    if (overlaps) continue;

    seenAtPosition.add(key);
    occupied.push([match.index, match.endIndex]);
    out.push(match);
  }

  return out.sort((a, b) => a.index - b.index);
}

function findFirstAuthorBoundaries(
  line: string,
  firstAuthorHints: AuthorHint[],
): FirstAuthorBoundary[] {
  return findAuthorMatches(line, firstAuthorHints).map((match) => ({
    index: match.index,
    endIndex: match.endIndex,
    matchedFirstAuthor: match.value,
    matchedLength: match.value.length,
  }));
}

function looksLikeSimpleEnglishTitle(text: string): boolean {
  const s = cleanTitleCandidate(text);

  if (!s) return false;
  if (s.length < 8) return false;
  if (s.length > 280) return false;
  if (countChineseChars(s) > 0) return false;
  if (countEnglishWords(s) < 2) return false;
  if (englishLetterRatio(s) < 0.45) return false;

  return true;
}

function looksLikeEnglishTitleLine(line: string): boolean {
  const s = cleanTitleCandidate(line);

  if (!s) return false;
  if (s.length < 4) return false;
  if (s.length > 180) return false;
  if (countChineseChars(s) > 0) return false;
  if (englishLetterRatio(s) < 0.45) return false;

  if (/^\(/.test(s)) return false;
  if (/^(ABSTRACT|KEY WORDS|Keywords?|Funds?|Project supported)\b/i.test(s)) {
    return false;
  }

  return countEnglishWords(s) >= 1;
}

function collectTitleBeforeAuthorLine(
  lines: string[],
  authorLineIndex: number,
): string {
  const titleLines: string[] = [];

  for (let i = authorLineIndex - 1; i >= 0 && titleLines.length < 4; i--) {
    const line = lines[i];

    if (!looksLikeEnglishTitleLine(line)) {
      if (titleLines.length) break;
      continue;
    }

    titleLines.unshift(line);
  }

  return cleanTitleCandidate(titleLines.join(" "));
}

function looksLikeReferenceWindow(raw: string): boolean {
  const s = cleanLine(raw);
  const lower = s.toLowerCase();

  if (!s) return false;

  if (/^参考文献\b/.test(s)) return true;
  if (/^references?\b/i.test(s)) return true;

  // Numbered reference entries.
  if (/^\[\d+]/.test(s)) return true;
  if (/^\d+\s*[.)]\s+[A-Z]/.test(s)) return true;

  // Common reference-entry markers.
  if (/\[[JMCDR]\]/.test(s)) return true;
  if (/\bdoi\s*[:：]/i.test(s)) return true;
  if (/\bet\s+al\.?/i.test(s)) return true;
  if (/\bin\s+chinese\b/i.test(s)) return true;

  // CN-style and general reference formats:
  // 2020, 10(2): 1-9
  // 2020, 10: 1-9
  // 2020;10(2):1-9
  // 2020;10:1-9
  if (/\b\d{4}\s*,\s*\d+\s*\(\d+\)\s*:\s*\d+[-–]\d+/.test(s)) {
    return true;
  }

  if (/\b\d{4}\s*,\s*\d+\s*:\s*\d+[-–]\d+/.test(s)) {
    return true;
  }

  if (/\b\d{4}\s*;\s*\d+\s*\(\d+\)\s*:\s*\d+[-–]\d+/.test(s)) {
    return true;
  }

  if (/\b\d{4}\s*;\s*\d+\s*:\s*\d+[-–]\d+/.test(s)) {
    return true;
  }

  // Page-range style.
  if (/\bpp\.?\s*\d+[-–]\d+/i.test(s)) return true;

  // Reference snippets can be truncated and may not start with [1] or References.
  // If a window contains journal-like words, a year, and a page range, treat it as reference-like.
  if (
    /\b(journal|transactions|proceedings|press|science|engineering|energy|electric|automation|oncology|medicine|cancer|letters)\b/i.test(
      lower,
    ) &&
    /\b\d{4}\b/.test(s) &&
    /\b\d+[-–]\d+\b/.test(s)
  ) {
    return true;
  }

  // Truncated citation fragments may contain only year + volume/issue + pages,
  // without journal keywords.
  if (/\b\d{4}\b/.test(s) && /\b\d+\s*\(\d+\)\s*:\s*\d+[-–]\d+\b/.test(s)) {
    return true;
  }

  return false;
}

function extractAuthorsByObservedText(
  segment: string,
  allAuthorHints: AuthorHint[],
  fallbackFirstAuthor: string,
): string[] {
  const matches = findAuthorMatches(segment, allAuthorHints);
  const authors = matches.map((m) => m.value);

  if (!authors.length && fallbackFirstAuthor) {
    return [fallbackFirstAuthor];
  }

  return dedupeValues(authors);
}

function scoreCandidate(
  title: string,
  authors: string[],
  blockName: CandidateBlockName,
  lineIndex: number,
): number {
  const words = countEnglishWords(title);
  let score = 0;

  if (words >= 4) score += 8;
  if (words >= 8) score += 4;
  if (authors.length >= 1) score += 8;
  if (authors.length >= 2) score += 4;

  if (blockName === "first") score += 30;
  if (blockName === "last") score += 20;
  if (blockName === "penultimate") score += 10;
  if (blockName === "tail") score += 5;
  if (lineIndex <= 80) score += 2;

  return score;
}

function collectLineStructuredCandidatesFromBlock(
  block: CandidateBlock,
  firstAuthorHints: AuthorHint[],
  allAuthorHints: AuthorHint[],
): EnglishMetadataCandidate[] {
  const lines = getLines(block.text);
  const candidates: EnglishMetadataCandidate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const authorLine = lines[i];

    if (looksLikeReferenceWindow(authorLine)) {
      continue;
    }

    const boundaries = findFirstAuthorBoundaries(authorLine, firstAuthorHints);
    if (!boundaries.length) continue;

    const title = collectTitleBeforeAuthorLine(lines, i);
    if (!looksLikeSimpleEnglishTitle(title)) continue;

    const authorSegment = cleanLine([authorLine, lines[i + 1] || ""].join(" "));

    if (looksLikeReferenceWindow(authorSegment)) {
      continue;
    }

    for (const boundary of boundaries) {
      const authors = extractAuthorsByObservedText(
        authorSegment.slice(boundary.index),
        allAuthorHints,
        boundary.matchedFirstAuthor,
      );

      const raw = cleanLine(`${title} ${authorSegment}`);

      if (looksLikeReferenceWindow(raw)) {
        continue;
      }

      candidates.push({
        title,
        authors,
        score: scoreCandidate(title, authors, block.name, i) + 8,
        blockName: block.name,
        pageIndex: block.pageIndex,
        lineIndex: i,
        raw,
        matchedFirstAuthor: boundary.matchedFirstAuthor,
      });

      break;
    }
  }

  return candidates;
}

function collectWindowCandidatesFromBlock(
  block: CandidateBlock,
  firstAuthorHints: AuthorHint[],
  allAuthorHints: AuthorHint[],
): EnglishMetadataCandidate[] {
  const lines = getLines(block.text);
  const candidates: EnglishMetadataCandidate[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (const beforeCount of [0, 1, 2, 3]) {
      const start = Math.max(0, i - beforeCount);

      for (const afterCount of [0, 1, 2]) {
        const end = Math.min(lines.length, i + afterCount + 1);
        const raw = cleanLine(lines.slice(start, end).join(" "));

        if (!raw) continue;
        if (looksLikeReferenceWindow(raw)) continue;

        const boundaries = findFirstAuthorBoundaries(raw, firstAuthorHints);
        if (!boundaries.length) continue;

        for (const boundary of boundaries) {
          const title = cleanTitleCandidate(raw.slice(0, boundary.index));

          if (!looksLikeSimpleEnglishTitle(title)) continue;

          const authorSegment = raw.slice(boundary.index);

          if (looksLikeReferenceWindow(authorSegment)) {
            continue;
          }

          const authors = extractAuthorsByObservedText(
            authorSegment,
            allAuthorHints,
            boundary.matchedFirstAuthor,
          );

          candidates.push({
            title,
            authors,
            score: scoreCandidate(title, authors, block.name, i),
            blockName: block.name,
            pageIndex: block.pageIndex,
            lineIndex: i,
            raw,
            matchedFirstAuthor: boundary.matchedFirstAuthor,
          });

          break;
        }
      }
    }
  }

  return candidates;
}

function collectCandidatesFromBlock(
  block: CandidateBlock,
  firstAuthorHints: AuthorHint[],
  allAuthorHints: AuthorHint[],
): EnglishMetadataCandidate[] {
  return [
    ...collectLineStructuredCandidatesFromBlock(
      block,
      firstAuthorHints,
      allAuthorHints,
    ),
    ...collectWindowCandidatesFromBlock(
      block,
      firstAuthorHints,
      allAuthorHints,
    ),
  ];
}

function dedupeCandidates(
  candidates: EnglishMetadataCandidate[],
): EnglishMetadataCandidate[] {
  const map = new Map<string, EnglishMetadataCandidate>();

  for (const candidate of candidates) {
    const key = candidate.title
      .toLowerCase()
      .replace(/[^\w]+/g, " ")
      .trim();

    if (!map.has(key) || candidate.score > map.get(key)!.score) {
      map.set(key, candidate);
    }
  }

  return [...map.values()].sort((a, b) => b.score - a.score);
}

export function extractEnglishMetadataFromText(
  item: Zotero.Item,
  text: string,
): ExtractedEnglishMetadata {
  const firstAuthorHints = makeFirstAuthorHints(item);
  const allAuthorHints = makeAllAuthorHints(item);

  if (!text || !firstAuthorHints.length) {
    return {
      title: "",
      authors: [],
      source: {},
      candidates: [],
    };
  }

  const blocks = splitCandidateBlocks(text);
  const allCandidates: EnglishMetadataCandidate[] = [];

  for (const block of blocks) {
    const blockCandidates = dedupeCandidates(
      collectCandidatesFromBlock(block, firstAuthorHints, allAuthorHints),
    );

    if (blockCandidates.length) {
      const best = blockCandidates[0];

      return {
        title: best.title,
        authors: best.authors,
        source: {
          blockName: best.blockName,
          pageIndex: best.pageIndex,
          lineIndex: best.lineIndex,
          raw: best.raw,
          matchedFirstAuthor: best.matchedFirstAuthor,
        },
        candidates: dedupeCandidates([...blockCandidates, ...allCandidates]),
      };
    }

    allCandidates.push(...blockCandidates);
  }

  return {
    title: "",
    authors: [],
    source: {},
    candidates: dedupeCandidates(allCandidates),
  };
}

export function extractEnglishMetadataFromAttachmentTextSource(
  item: Zotero.Item,
  source: AttachmentTextSource,
): ExtractedEnglishMetadata {
  const result = extractEnglishMetadataFromText(item, source.text);

  return {
    ...result,
    source: {
      ...result.source,
      attachmentID: source.attachmentID,
      attachmentKind: source.kind,
      attachmentFilename: source.filename,
    },
  };
}

export async function extractEnglishMetadataFromItemAttachments(
  item: Zotero.Item,
): Promise<ExtractedEnglishMetadata> {
  const sources = await getAttachmentTextSources(item);
  const allCandidates: EnglishMetadataCandidate[] = [];

  for (const source of sources) {
    if (!source.text?.trim()) continue;

    const result = extractEnglishMetadataFromAttachmentTextSource(item, source);

    if (result.title) return result;

    allCandidates.push(...result.candidates);
  }

  return {
    title: "",
    authors: [],
    source: {},
    candidates: dedupeCandidates(allCandidates),
  };
}

export function getContainerTitle(item: Zotero.Item): string {
  const candidates = [
    "publicationTitle",
    "proceedingsTitle",
    "bookTitle",
    "seriesTitle",
    "websiteTitle",
  ];

  for (const field of candidates) {
    const value = String(item.getField(field) || "").trim();
    if (value) return value;
  }

  return "";
}

export async function resolveOriginalContainerTitle(
  containerTitle: string,
): Promise<string> {
  const title = String(containerTitle || "").trim();
  if (!title) return "";

  const key = normalizeJournalMapKey(title);

  const preferenceMap = loadPreferenceJournalMap();
  if (preferenceMap[key]) return preferenceMap[key];

  const builtin = (JOURNAL_TITLE_MAP as Record<string, string>)[key];
  if (builtin) return builtin;

  return "";
}

function getAuthorValuesByPinyin(item: Zotero.Item): string[] {
  return getAuthorCreators(item)
    .map((creator) => creatorToDisplayName(creator))
    .filter(Boolean);
}

export async function resolveMetadataValuesForItem(
  item: Zotero.Item,
  prefs: MetadataSourcePreferences = getMetadataSourcePreferences(),
): Promise<ResolvedMetadataValues> {
  const diagnostics: string[] = [];

  const titles: string[] = [];
  const authors: string[] = [];
  const containerTitles: string[] = [];

  let fileMetadata: Awaited<
    ReturnType<typeof extractEnglishMetadataFromItemAttachments>
  > | null = null;

  if (prefs.title.useFile || prefs.author.useFile) {
    fileMetadata = await extractEnglishMetadataFromItemAttachments(item);
  }

  if (prefs.title.useFile && fileMetadata?.title) {
    titles.push(fileMetadata.title);
    diagnostics.push("title:file");
  }

  if (prefs.author.useFile && fileMetadata?.authors?.length) {
    authors.push(...fileMetadata.authors);
    diagnostics.push("author:file");
  }

  if (prefs.author.usePinyin) {
    const values = getAuthorValuesByPinyin(item);
    authors.push(...values);
    if (values.length) diagnostics.push("author:pinyin");
  }

  if (prefs.containerTitle.useMap) {
    const containerTitle = getContainerTitle(item);
    if (containerTitle) {
      const resolved = await resolveOriginalContainerTitle(containerTitle);
      if (resolved) {
        containerTitles.push(resolved);
        diagnostics.push("container-title:map");
      }
    }
  }

  return {
    title: dedupeValues(titles).slice(0, 1),
    authors: dedupeValues(authors),
    containerTitles: dedupeValues(containerTitles).slice(0, 1),
    diagnostics,
  };
}

export async function buildEnglishItemDraft(
  item: Zotero.Item,
  prefs: MetadataSourcePreferences = getMetadataSourcePreferences(),
): Promise<EnglishItemDraft> {
  const resolved = await resolveMetadataValuesForItem(item, prefs);

  const creators = resolved.authors.map((name) => {
    const parts = name.split(/\s+/).filter(Boolean);

    return {
      creatorType: "author" as const,
      lastName: parts[0] || "",
      firstName: parts.slice(1).join(" "),
    };
  });

  return {
    title: resolved.title[0],
    creators,
    publicationTitle: resolved.containerTitles[0],
    diagnostics: resolved.diagnostics,
  };
}
