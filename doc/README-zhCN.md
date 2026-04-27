# Metadata Translator

中文期刊论文英文引用元数据生成插件（Zotero）

[![Zotero target version](https://img.shields.io/badge/Zotero-7/8/9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[简体中文](./README-zhCN.md) | [English](../README.md)

Metadata Translator 是一个面向中文期刊论文的 Zotero 插件。

插件主要用于根据中文源条目创建对应英文 Zotero 条目，并为 CSL 引用样式生成英文 `original-*` 元数据。

## 主要功能

### 创建英文 Zotero 条目

Metadata Translator 可以基于中文源条目创建对应的英文 Zotero 条目。

生成的英文条目会与中文源条目建立关联，便于后续通过插件进行管理、清理或删除。

### 生成英文 `original-*` 元数据

Metadata Translator 可以将英文引用元数据写入 Zotero 条目的 `Extra` 字段。

当前支持字段：

- `original-title`
- `original-author`
- `original-container-title`

示例：

```text
original-title: Research on Energy Production and Transportation Mode for Independent Islands Considering Optimal Global Benefit and Its Fair Distribution
original-author: Feng Zhongnan
original-author: Wen Ting
original-container-title: Proceedings of the CSEE
```

这些字段主要用于需要以英文格式引用中文期刊论文的 CSL 样式。

## 元数据来源

### 题名

插件可以从已索引 PDF 或网页 Snapshot 附件中提取英文题名，并写入 `original-title`。

题名不会通过拼音生成。

### 作者

插件可以从已索引 PDF / Snapshot 附件中提取英文作者名，也可以利用 Zotero 作者字段通过拼音补全作者。

作者写入格式为姓在前、名在后：

```text
Zhang Lingling
```

对于 Zotero 中已经以英文保存的外国作者，插件会保留其英文名原有大小写。

### 期刊名

插件可以将中文期刊名映射为英文期刊名，并写入 `original-container-title`。

偏好设置中的自定义映射优先级高于内置映射表。

自定义期刊映射 JSON 示例：

```json
{
  "中国电机工程学报": "Proceedings of the CSEE",
  "电力系统自动化": "Automation of Electric Power Systems",
  "电网技术": "Power System Technology"
}
```

期刊名不会通过拼音生成。

## 使用方法

在 Zotero 中选中一个或多个中文期刊条目，右键进入 **Metadata Translator** 菜单。

可用操作包括：

- 写入 `original-title`
- 写入 `original-author`
- 写入 `original-container-title`
- 删除生成的英文条目
- 清理失效英文条目链接
- 写入全部 `original-*` 元数据
- 翻译为英文条目

## 偏好设置

可以配置：

- 是否自动处理新增中文期刊条目；
- 是否自动为新增中文期刊条目创建英文条目；
- 是否从 PDF / Snapshot 附件中提取英文题名；
- 是否从 PDF / Snapshot 附件中提取英文作者；
- 是否使用 Zotero 作者字段通过拼音补全作者；
- 是否通过期刊映射表生成英文期刊名；
- 是否配置自定义期刊映射表；
- 生成英文条目的默认放置位置。

自动创建英文条目默认关闭。

## 注意事项

- PDF / Snapshot 提取依赖 Zotero 对附件文本的索引结果。
- 你总是需要核对生成的数据。
- 题名不会通过拼音生成。
- 期刊名不会通过拼音生成。
- 生成英文条目是独立 Zotero 条目。
- 插件不会复制附件到生成的英文条目。
