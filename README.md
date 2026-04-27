# Metadata Translator

[![Zotero target version](https://img.shields.io/badge/Zotero-7/8/9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[简体中文](./doc/README-zhCN.md) | [English](./README.md)

Metadata Translator is a Zotero plugin for Chinese journal articles.

It helps Zotero users create English Zotero items from Chinese source items and generate English `original-*` metadata for CSL citation styles.

## Main Features

### Create English Zotero Items

Metadata Translator can create a corresponding English Zotero item from a Chinese source item.

Generated English items are linked with their source Chinese items, so they can be managed, cleaned, or deleted later through the plugin.

### Generate English `original-*` Metadata

Metadata Translator can write English citation metadata into the Zotero `Extra` field.

Supported fields:

- `original-title`
- `original-author`
- `original-container-title`

Example:

```text
original-title: Research on Energy Production and Transportation Mode for Independent Islands Considering Optimal Global Benefit and Its Fair Distribution
original-author: Feng Zhongnan
original-author: Wen Ting
original-container-title: Proceedings of the CSEE
```

These fields are useful for CSL styles that require English citation output for Chinese journal articles.

## Metadata Sources

### Article Title

The plugin extracts English article titles from indexed PDF or web Snapshot attachments and writes them to `original-title`.

Article titles are not generated from pinyin.

### Authors

The plugin can extract English author names from indexed PDF / Snapshot attachments and complete missing author names from Zotero creator fields using pinyin.

Author names are written in family-name-first format:

```text
Zhang Lingling
```

For foreign authors already stored in Zotero with English names, the plugin keeps the original English name casing.

### Journal Title

The plugin maps Chinese journal titles to English journal titles and writes the result to `original-container-title`.

Custom mappings configured in Preferences have priority over the built-in mapping table.

Example custom mapping JSON:

```json
{
  "中国电机工程学报": "Proceedings of the CSEE",
  "电力系统自动化": "Automation of Electric Power Systems",
  "电网技术": "Power System Technology"
}
```

Journal titles are not generated from pinyin.

## Usage

In Zotero, select one or more Chinese journal items, right-click, and open **Metadata Translator**.

Available commands include:

- Write `original-title`
- Write `original-author`
- Write `original-container-title`
- Delete generated English item
- Clean broken English item links
- Write all `original-*` metadata
- Translate to English item

## Preferences

You can configure whether to:

- automatically process newly added Chinese journal items;
- automatically create English items for newly added Chinese journal items;
- extract English titles from PDF / Snapshot attachments;
- extract English authors from PDF / Snapshot attachments;
- complete authors from Zotero creator names using pinyin;
- generate English journal titles from journal mappings;
- configure a custom journal title mapping table;
- set the default placement of generated English items.

Automatic English item creation is disabled by default.

## Notes

- PDF / Snapshot extraction requires Zotero to have indexed attachment text.
- You should always check the generated data.
- Article titles are not generated from pinyin.
- Journal titles are not generated from pinyin.
- Generated English items are separate Zotero items.
- Attachments are not copied to generated English items.
