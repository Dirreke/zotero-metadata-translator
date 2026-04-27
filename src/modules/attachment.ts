export type AttachmentTextKind = "pdf" | "snapshot";

export type AttachmentTextSource = {
  itemID: number;
  attachmentID: number;
  kind: AttachmentTextKind;
  title: string;
  filename: string;
  contentType: string;
  text: string;
  textLength: number;
  error?: string;
};

function getAttachmentFilename(att: Zotero.Item): string {
  try {
    return att.attachmentFilename || "";
  } catch {
    return "";
  }
}

function getAttachmentContentType(att: Zotero.Item): string {
  try {
    return att.attachmentContentType || "";
  } catch {
    return "";
  }
}

function isPDFAttachment(att: Zotero.Item): boolean {
  const contentType = getAttachmentContentType(att).toLowerCase();
  const filename = getAttachmentFilename(att).toLowerCase();

  return contentType === "application/pdf" || filename.endsWith(".pdf");
}

function isSnapshotAttachment(att: Zotero.Item): boolean {
  const contentType = getAttachmentContentType(att).toLowerCase();
  const filename = getAttachmentFilename(att).toLowerCase();

  return (
    contentType === "text/html" ||
    contentType === "application/xhtml+xml" ||
    filename.endsWith(".html") ||
    filename.endsWith(".htm") ||
    filename.endsWith(".xhtml")
  );
}

function detectAttachmentKind(att: Zotero.Item): AttachmentTextKind | null {
  if (isPDFAttachment(att)) return "pdf";
  if (isSnapshotAttachment(att)) return "snapshot";
  return null;
}

export async function getAttachmentTextSources(
  item: Zotero.Item,
): Promise<AttachmentTextSource[]> {
  const sources: AttachmentTextSource[] = [];

  if (!item || !item.isRegularItem()) {
    return sources;
  }

  for (const attachmentID of item.getAttachments()) {
    const att = Zotero.Items.get(attachmentID);
    if (!att || !att.isAttachment()) continue;

    const kind = detectAttachmentKind(att);
    if (!kind) continue;

    const filename = getAttachmentFilename(att);
    const contentType = getAttachmentContentType(att);
    const title = String(att.getField("title") || "");

    let text = "";
    let error = "";

    try {
      text = String((await att.attachmentText) || "");
    } catch (e: any) {
      error = String(e?.message || e);
    }

    sources.push({
      itemID: item.id,
      attachmentID: att.id,
      kind,
      title,
      filename,
      contentType,
      text,
      textLength: text.length,
      error: error || undefined,
    });
  }

  sources.sort((a, b) => {
    if (a.kind === b.kind) return 0;
    if (a.kind === "pdf") return -1;
    return 1;
  });

  return sources;
}
