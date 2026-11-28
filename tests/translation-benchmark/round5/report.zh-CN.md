# 科研翻译第五轮验收

**本候选暂缓发布。** 在 8 篇此前未用于开发或评分的论文中，58 个翻译单元有 39 个在默认视图里可读且保留了科学含义，48 个选段中有 4 个出现严重错误且未给出提示。发布要求为默认可用率至少 98%，同时没有已知漏报的严重错误。[评分数据](summary.json) · [失败样本及评阅理由](failures.jsonl)

| 同一批 48 个选段 | 公开版 0.4.18 | 第四轮候选 | 第五轮候选 |
| --- | ---: | ---: | ---: |
| 默认可见且可用 | 19/58 | 40/58 | 39/58 |
| 展开核对区域后可用 | 19/58 | 47/58 | 46/58 |
| 正确译句被默认折叠 | 0 | 7 | 7 |
| 未生成译文的单元 | 3 | 0 | 0 |
| 整段默认可用 | 15/48 | 31/48 | 30/48 |
| 严重错译未提示的选段 | 14/48 | 3/48 | 4/48 |
| 选段用时中位数 | 0.15 秒 | 10.91 秒 | 9.88 秒 |
| 选段用时第 95 百分位 | 0.56 秒 | 25.01 秒 | 25.08 秒 |

计时从发送选段开始，到界面收到最后一个翻译单元结束。本轮 8 篇均来自 PLOS ONE，涉及珊瑚白化、眼动、拉曼光谱、水凝胶和光伏等不同领域。真实 PDF 划选测试与分层语料测试分别记录。后者在浏览器中向阅读器传入从期刊 JATS 提取的选段及文章上下文。匿名双语评阅使用模型辅助，尚无独立学科专家复评。[取样及评阅方法](protocol.md) · [逐句意见](semantic.tsv)

## 核实的修复

Chrome 中从 PDF 实际划选化合物结构描述时，先前的本机精译把 Abaucin 写成“阿巴钦”。快速翻译已有的名称保护没有进入本机精译的整句路径。现在两条路径共用名称范围与校验，原文中的每个受保护名称均须得到保留。确有缺失时，以同一整句重试。数值与图号仍需通过校验。[修改前的真实选区](runs/chrome-selection-before.json) · [修改后的同一选区](runs/chrome-selection-after.json)

Edge 便携版和 WebKit 的实际划词结果相同。结构句得到“Abaucin由三个结构单元组成：benzoxazine、piperidine和trifluoromethyl-phenyl基团（图3b）。” 另一选段保留了 0.25 毫克/毫升和图 2c。这里按原文保留化合物名称，便于读者对照。[便携版截图](chemistry-edge.png) · [WebKit 输出](runs/webkit.json)

同一份 Windows 便携包中，首次使用显示 1.35 GB 和下载确认。模拟传输在 16 MiB 处中断后，重试从该偏移继续。破坏一个缓存块后只重新获取该 8 MiB。缓存全部清除后，未经再次确认的下载次数为零。测试观测到的论文内容对外 POST 为零。WebKit 已完成首次推理、重新打开和科学整句划选。实机 iPad Safari 尚未验证。[确认界面](consent-edge.png) · [便携版请求记录](runs/portable-edge.json)

用第四轮的旧论文复测，56 个单元中默认可用的从 36 个提高到 44 个，漏报严重错译从 3 段减为 0 段。其中部分修复表现为识别高风险译文并提示读者核对。[旧样本回归](regression-summary.json) · [回归逐句结果](runs/fourth-round-regression.json)

## 陌生论文中的失败

| 选段 | 原文指什么 | 候选译文的问题 |
| --- | --- | --- |
| L12 | 空间网格单元 | 将 cells 译成生物学意义的“细胞” |
| L22 | 同一句中的眼动结果和章节交叉引用 | 在括号内章节号处分句，眼动结果丢失 |
| L35 | 文章定义的 degree of substitution，即取代度 | 将 DS 误作“脱粘” |
| L42 | 用动态功能连接指标对年龄进行回归 | 把年龄写成自变量，颠倒了变量角色 |

L10 还漏掉了两个概率阈值，该句触发了警示。此次结果支持保留这些发布条件，继续验证对上下文和统计语义处理更好的模型。[原句与来源](fresh.jsonl) · [候选原始译文](runs/revised-fresh.json)

## 工程改动及理由

| 文件 | 实际作用 |
| --- | --- |
| `dist/translation-anchors.js`、`dist/scientific-translation.js`、`dist/translation-session.js` | 两条翻译路径共用化学名称识别和完整性保护，有限重试时核对标记的缺失、重复及新增。限制相邻句进入生成上下文，减少串句。 |
| `dist/translation-facts.js`、`dist/translation-claims.js` | 比较完整术语与等价单位，识别部分数量、时序和因果强度变化。 |
| `dist/discipline-glossary.js` | 在实体成像上下文识别体模，保留 phantom pain、phantom power 等其他意义。 |
| `dist/selection-translation.js`、`dist/paper-language.js`、`dist/index.html` | 向读者呈现分层核对结果，同步更新相互导入的资源版本。 |
| `tests/translation-evidence.mjs`、`tests/translation-local-model-browser.cjs` | 用语义反例检测错误方向，并从真实 PDF 划选含浓度、化合物和图号的整句。 |
| `.github/workflows/pages.yml`、`round4/audit.py`、`round5/` | 可重放历史数据，在发布前检查当前候选的实际评阅结果。 |

候选没有改动已发布的 Bergamot 权重和注册表。第五轮候选可整体回退至第四轮候选提交 `0a899894`。公开链接和正式安装包仍提供 0.4.18。
