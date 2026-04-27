import type { ManagedField } from "./types";
import { MANAGED_FIELD_ORDER } from "./types";

export type ParsedExtra = {
  managed: Record<ManagedField, string[]>;
  present: Set<ManagedField>;
  others: string[];
  insertIndex: number | null;
};

export function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values.map((x) => x.trim()).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(value);
  }

  return out;
}

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function sameValueList(a: string[], b: string[]): boolean {
  const aa = dedupeValues(a).map(normalizeForCompare);
  const bb = dedupeValues(b).map(normalizeForCompare);

  if (aa.length !== bb.length) return false;

  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }

  return true;
}

export function splitExtra(extra: string): ParsedExtra {
  const managed: Record<ManagedField, string[]> = {
    "original-title": [],
    "original-container-title": [],
    "original-author": [],
  };

  const present = new Set<ManagedField>();
  const others: string[] = [];
  let insertIndex: number | null = null;

  const lines = String(extra || "").split(/\r?\n/);
  const re =
    /^\s*(original-title|original-container-title|original-author)\s*:\s*(.*)$/i;

  for (const line of lines) {
    const m = line.match(re);

    if (!m) {
      others.push(line);
      continue;
    }

    if (insertIndex === null) {
      insertIndex = others.length;
    }

    const field = m[1].toLowerCase() as ManagedField;
    const value = String(m[2] || "").trim();

    present.add(field);

    if (value) {
      managed[field].push(value);
    }
  }

  return {
    managed,
    present,
    others,
    insertIndex,
  };
}

function trimBlankEdges(lines: string[]): string[] {
  const out = [...lines];

  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();

  return out;
}

export function buildExtraWithManagedFields(
  oldExtra: string,
  updates: Partial<Record<ManagedField, string[]>>,
): string {
  const parsed = splitExtra(oldExtra);
  const managedLines: string[] = [];

  for (const field of MANAGED_FIELD_ORDER) {
    const values =
      updates[field] !== undefined ? updates[field]! : parsed.managed[field];

    for (const value of dedupeValues(values || [])) {
      managedLines.push(`${field}: ${value}`);
    }
  }

  if (!managedLines.length) {
    return trimBlankEdges(parsed.others).join("\n");
  }

  const insertAt =
    parsed.insertIndex === null
      ? parsed.others.length
      : Math.min(parsed.insertIndex, parsed.others.length);

  const lines = [
    ...parsed.others.slice(0, insertAt),
    ...managedLines,
    ...parsed.others.slice(insertAt),
  ];

  return trimBlankEdges(lines).join("\n");
}

export function setManagedFieldValues(
  item: Zotero.Item,
  updates: Partial<Record<ManagedField, string[]>>,
): boolean {
  const oldExtra = String(item.getField("extra") || "");
  const newExtra = buildExtraWithManagedFields(oldExtra, updates);

  if (newExtra === oldExtra) return false;

  item.setField("extra", newExtra);
  return true;
}
