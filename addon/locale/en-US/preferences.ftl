pref-title = Metadata Translator

pref-settings-intro = Write CSL original-* metadata for Chinese references and optionally generate corresponding English Zotero items from attachment-derived English metadata.

pref-auto-title = Automation

pref-auto-process =
    .label = Automatically process original-* metadata for newly added Chinese journal papers

pref-auto-process-desc = When enabled, newly added regular Chinese items will be processed automatically for enabled original-* metadata fields. Existing fields are skipped silently.

pref-auto-create-english-item =
    .label = Automatically create corresponding English items

pref-auto-create-english-item-desc = When enabled, newly added regular Chinese items will be used to create separate English Zotero items when an English title can be detected. This option is disabled by default.

pref-english-placement-title = Default placement for English items

pref-english-placement-same = Same collections as the source item

pref-english-placement-custom = Custom collection

pref-english-collection-refresh = Refresh

pref-english-collection-empty = No collection in the current library

pref-english-collection-empty-note = No collection is available in the current Zotero library. Generated English items will fall back to the source item’s collections.

pref-english-collection-missing = Saved collection not found: { $key }

pref-english-collection-missing-note = The saved collection key was not found in the current library. If it cannot be found in the source item’s library during creation, the generated item will fall back to the source item’s collections.

pref-english-placement-note = The custom collection is stored as a Zotero collection key. The dropdown lists collections in the current Zotero library. If the collection cannot be found in the source item’s library during creation, the generated item falls back to the source item’s collections.

pref-title-field-title = original-title

pref-title-field-badge = Title

pref-title-field-desc = Extract the English article title from indexed PDF or web snapshot text.

pref-source-file-title =
    .label = Extract English title from PDF / Snapshot

pref-title-note = Title is not generated from pinyin. If no English title is detected from attachments, this field is left unchanged.

pref-author-field-title = original-author

pref-author-field-badge = Authors

pref-author-field-desc = Extract English authors from attachments, or generate standardized pinyin author names from Zotero creators.

pref-source-file-author =
    .label = Extract English authors from PDF / Snapshot

pref-source-pinyin-author =
    .label = Generate pinyin authors from Zotero creators

pref-author-note = If both are enabled, attachment-extracted authors are preferred and pinyin authors are used as completion. The written format is Zhang Lingling.

pref-container-field-title = original-container-title

pref-container-field-badge = Journal

pref-container-field-desc = Resolve the standard English journal title from the preference mapping table and built-in mapping table.

pref-source-map-container =
    .label = Generate English journal title from journal mapping

pref-container-note = Journal title is not generated from pinyin. If the journal mapping does not match, this field is left unchanged.

pref-container-map-json-label = Custom journal mapping JSON

pref-container-map-save = Save mapping

pref-container-map-example = Insert example

pref-container-map-clear = Clear

pref-container-map-json-note = JSON format: {"{"}"Chinese Journal Title": "English Journal Title"{"}"}. Mappings in preferences have higher priority than the built-in mapping table.

pref-container-map-status-saved = Journal mapping saved.

pref-container-map-status-cleared = Journal mapping cleared.

pref-container-map-status-example = Example inserted. Click “Save mapping” to apply it.

pref-container-map-status-invalid = Invalid JSON:

pref-about-title = About

pref-about-desc = This plugin helps Chinese references carry original-title, original-author, and original-container-title metadata for English citation output, and provides helper actions for generating corresponding English Zotero items.

pref-help = { $name } Build { $version } { $time }