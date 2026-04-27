pref-title = Metadata Translator

pref-settings-intro = 为中文文献写入 CSL original-* 字段，并可基于附件英文信息自动生成对应英文条目。

pref-auto-title = 自动处理

pref-auto-process =
    .label = 新增中文期刊论文时自动处理 original-* 元数据

pref-auto-process-desc = 启用后，新增普通中文条目时自动写入已启用的 original-* 元数据。若对应字段已存在，则默认跳过且不弹出覆盖提示。

pref-auto-create-english-item =
    .label = 自动创建对应英文条目

pref-auto-create-english-item-desc = 启用后，新增普通中文条目时，如果能够识别英文题名，则自动创建一个独立的英文 Zotero 条目。该选项默认关闭。

pref-english-placement-title = 英文条目默认放置位置

pref-english-placement-same = 与源条目同级

pref-english-placement-custom = 自定义分类

pref-english-collection-refresh = 刷新

pref-english-collection-empty = 当前库中没有分类

pref-english-collection-empty-note = 当前 Zotero 库中没有可选择的分类；创建英文条目时将退回为与源条目同级。

pref-english-collection-missing = 找不到已保存分类：{ $key }

pref-english-collection-missing-note = 已保存的分类 key 在当前库中未找到；如果创建英文条目时也找不到该分类，将退回为与源条目同级。

pref-english-placement-note = 自定义分类保存的是 Zotero collection key。下拉框显示当前 Zotero 库中的分类；若创建时无法在源条目所在库中找到该分类，将退回为与源条目同级。

pref-title-field-title = original-title

pref-title-field-badge = 标题

pref-title-field-desc = 从 PDF 或网页 Snapshot 的索引文本中提取英文题名。

pref-source-file-title =
    .label = 从 PDF / Snapshot 提取英文题名

pref-title-note = 不使用拼音生成标题；若附件中未识别到英文题名，则该字段保持不变。

pref-author-field-title = original-author

pref-author-field-badge = 作者

pref-author-field-desc = 从附件中识别英文作者，也可以从 Zotero 中文作者字段生成标准拼音作者名。

pref-source-file-author =
    .label = 从 PDF / Snapshot 提取英文作者

pref-source-pinyin-author =
    .label = 从 Zotero 作者字段生成拼音作者

pref-author-note = 两者都启用时，优先使用附件提取结果，并用拼音作者补全。写入格式统一为 Zhang Lingling。

pref-container-field-title = original-container-title

pref-container-field-badge = 期刊

pref-container-field-desc = 根据当前期刊名，在偏好设置映射表和内置映射表中查找标准英文期刊名。

pref-source-map-container =
    .label = 从期刊映射表生成英文期刊名

pref-container-note = 不使用拼音生成期刊名；若映射表未命中，则该字段保持不变。

pref-container-map-json-label = 自定义期刊映射表 JSON

pref-container-map-save = 保存映射表

pref-container-map-example = 填入示例

pref-container-map-clear = 清空

pref-container-map-json-note = JSON 格式为 {"{"}"中文期刊名": "English Journal Title"{"}"}。偏好设置中的映射优先级高于内置映射表。

pref-container-map-status-saved = 已保存期刊映射表。

pref-container-map-status-cleared = 已清空期刊映射表。

pref-container-map-status-example = 已填入示例，点击“保存映射表”后生效。

pref-container-map-status-invalid = JSON 格式错误：

pref-about-title = 关于

pref-about-desc = 该插件用于为中文文献补全英文引用所需的 original-title、original-author 与 original-container-title，并提供生成对应英文条目的辅助功能。

pref-help = { $name } Build { $version } { $time }