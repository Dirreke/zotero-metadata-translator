# Metadata Translator

中文期刊论文英文元数据生成插件（Zotero）

[![zotero target version](https://img.shields.io/badge/Zotero-7/8/9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[简体中文](./README-zhCN.md) | [English](../README.md)

Metadata Translator 是一个 Zotero 插件，用于为中文期刊论文生成英文元数据，并写入条目的 `Extra` 字段。

目前支持生成以下字段：

- `original-author`
- `original-container-title`

## 用途

适合需要为中文期刊论文补充英文作者信息和英文期刊名的 Zotero 用户。

## 使用方法

在 Zotero 中选中一个或多个中文条目，右键进入 **Metadata Translator**，可选择：

- 写入 `original-author`
- 写入 `original-container-title`
- 同时写入作者与期刊英文元数据
- 显示期刊映射文件路径

## 自动处理

插件支持在偏好设置中启用“新增中文期刊论文时自动处理”。

启用后，新加入的中文期刊论文会自动写入英文元数据。

## 说明

作者英文信息会根据中文姓名生成拼音形式。  
期刊英文名优先使用内置字典和用户自定义映射文件。  
如果某个期刊未在映射中定义，则不会自动生成 `original-container-title`。

## 示例

```text
original-author: Yan Mingyu
original-author: Wang Lingling
original-container-title: Proceedings of the CSEE