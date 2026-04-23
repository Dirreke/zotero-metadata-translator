import JOURNAL_TITLE_MAP from "../journalTitleMap.json";

const USER_MAP_FILENAME = "metadata-translator-journal-map.json";

function hasChinese(text: string): boolean {
    return /[\u3400-\u9fff]/.test(text || "");
}

function normalizeKey(text: string): string {
    const raw = (text || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    return hasChinese(raw) ? raw : raw.toLowerCase();
}

function getUserMapPath(): string {
    return PathUtils.join(Zotero.DataDirectory.dir, USER_MAP_FILENAME);
}

async function ensureUserMapFile(): Promise<string> {
    const path = getUserMapPath();
    const exists = await IOUtils.exists(path);

    if (!exists) {
        const template = {
            "中国电力系统及其自动化学报": "Proceedings of the CSU-EPSA"
        };
        await IOUtils.writeUTF8(path, JSON.stringify(template, null, 2));
    }

    return path;
}

export async function loadUserJournalMap(): Promise<Record<string, string>> {
    const path = await ensureUserMapFile();

    try {
        const text = await IOUtils.readUTF8(path);
        const obj = JSON.parse(text || "{}");
        const out: Record<string, string> = {};

        for (const [k, v] of Object.entries(obj)) {
            out[normalizeKey(k)] = String(v).trim();
        }

        return out;
    } catch (e) {
        Zotero.debug(`[MetadataTranslator] load user journal map failed: ${e}`);
        return {};
    }
}

export async function getUserJournalMapPath(): Promise<string> {
    return await ensureUserMapFile();
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
    const title = (containerTitle || "").trim();
    if (!title) return "";

    const key = normalizeKey(title);
    const userMap = await loadUserJournalMap();

    if (userMap[key]) return userMap[key];

    const builtin = (JOURNAL_TITLE_MAP as Record<string, string>)[key];
    if (builtin) return builtin;

    return "";
}