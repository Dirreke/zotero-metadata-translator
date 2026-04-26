# Zotero Plugin Template

[![zotero target version](https://img.shields.io/badge/Zotero-7/8/9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[简体中文](./doc/README-zhCN.md) | [English](./README.md)

Metadata Translator is a Zotero plugin for generating English metadata for Chinese journal papers and writing it into the `Extra` field.

The plugin currently supports:

- `original-author`
- `original-container-title`

## Purpose

It is intended for Zotero users who want to add English author names and English journal titles to Chinese journal papers.

## Usage

In Zotero, select one or more Chinese items, right-click, and open **Metadata Translator**. The plugin provides the following commands:

- Write `original-author`
- Write `original-container-title`
- Write both author and journal metadata
- Show journal mapping file path

## Automatic Processing

The plugin can automatically process newly added Chinese journal papers if enabled in preferences.

## Notes

Author names are converted into pinyin-based English form.  
Journal titles are generated from the built-in dictionary and the user-defined mapping file.  
If a journal is not defined in the mapping, `original-container-title` will not be generated.

## Example

```text
original-author: Yan Mingyu
original-author: Wang Lingling
original-container-title: Proceedings of the CSEE
