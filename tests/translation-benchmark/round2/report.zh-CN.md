# 科研划词翻译第二轮验收

**发布结论为暂缓。** 对六篇新论文的 36 个选段逐句评阅后，本轮候选默认能读懂 19/42 句（45.2%），有 12/36 段出现了界面没有提示的严重语义错误。相比上一候选版，正确译句被隐藏的次数减少，严重错译未提示的次数增加。读者正式入口和 Windows 正式包继续使用 v0.4.18。[逐段结果与理由](failures.jsonl) · [计算结果](summary.json)

## 读者实际会看到什么

| 从 PDF 上传开始的操作 | 实测结果 |
| --- | --- |
| 在 PLOS ONE 论文的第 8 页划选一整句图注 | 得到“尽管分析的颗粒数量显著增加，但比例非常相似。”对照原文仍定位第 8 页。 |
| 在 PLOS Climate 第 1 页划选摘要，再划选第 3 页图注 | 两次均给出中文及源页。摘要把遥感地表温度用作气温的“代理指标”错写成“代名词”，界面显示机械核对通过。 |
| 在 PLOS Medicine 第 1 页划选横跨两行的摘要，再选第 9 页图注 | 原先送入模型的词是 `mod-erate`。阅读器现在能根据这篇论文中出现的完整拼写送入 `moderate`，原文对照保留换行。摘要仍把新发心血管疾病译成“事件CVD”。第 9 页图注的 CVD、HR 和 PA 均有对应。 |
| 在 Windows 便携包上传 Abaucin 原文 | 在第 5 页划选跨行的化学结构句，得到三个结构单元、三个对应化合物名称和图 3b。注册表、shortlist、模型权重和词表摘要通过实测。 |
| 断开一份词表的下载，恢复后只重试当前选段 | 在同一原页得到“水”。运行中超时后也能重建 Worker 并复用已经校验的文件。 |
| 译文把 A、B 两组的 7 mg 和 11 mg 对调 | 在控制试验中注入这条交换错误。读者可以在译句旁看到两边具体的数值，点击后焦点落在该句的原文与待核对译文。 |

三份出版商 PDF 共六次真实划选，摘要与图注各三次。修复后，送入翻译会话的六个选段逐字匹配出版商 XML，界面显示五次已翻译、一次需核对。实际语言质量另行评判。记录含原始 PDF 的 SHA-256、页码、选区和界面文字。[修复前](runs/pdf-before.json) · [修复后](runs/pdf-after.json) · [仍有错译的原始界面](pdf-f25.png) · [组别错配提示](12-swapped-group-evidence.png) · [便携版模型与恢复日志](runs/portable-edge.txt)

## 六篇新论文的盲评

比较的是 v0.4.18、上一候选 `ec38132`、本轮候选。开发阶段使用旧样本和成对的正确、错误译法。按固定程序从六篇未使用过的论文各抽六段，分别覆盖摘要、图注、测量、比较、其他正文和双句段落。六篇来自 PLOS ONE、PLOS Biology、PLOS Computational Biology、PLOS Climate、PLOS Medicine 及 eLife。论文作者、DOI、发表期刊、定位、许可及输入摘要均已保存。[来源和许可](sources.json) · [冻结输入](fresh.jsonl) · [取样与评分方案](protocol.md)

| 同一批 36 段，共 42 句 | 正式版 v0.4.18 | 上一候选 | 本轮候选 |
| --- | ---: | ---: | ---: |
| 默认可读且保留关键科学含义的句子 | 20/42 | 14/42 | 19/42 |
| 可读但被折叠的句子 | 0 | 6 | 2 |
| 默认整段每句都可用 | 15/36 | 9/36 | 14/36 |
| 默认显示严重错误的选段 | 16/36 | 10/36 | 14/36 |
| 默认显示严重错误且该句没有提示的选段 | 16/36 | 8/36 | 12/36 |
| 没有生成目标语言内容的句子 | 0 | 0 | 0 |
| 单段 P50 / P95（毫秒） | 64 / 487 | 91.5 / 531 | 73 / 444 |

三个版本各从干净的 Chrome 会话顺序运行。计时包含每组首个选段的冷启动，环境是同一台 Windows 电脑的本机 HTTP 服务。它能比较这批新内容的端到端响应，不能估算不同地区访问公共站点时的下载延迟。[三版实际输出](runs/) · [上一轮公共站点冷启动测量](../runs/pages-baseline-performance.json)

对同源同译文只判定一次。评阅时隐藏版本、警示与折叠状态，39 组去重后的原文和译文均先给出逐句判断，再对照界面。评分由本次执行工作的模型完成，未取得第二位学科专家的独立复核。翻译代码与盲评办法先冻结在 `04e9fc6`，再采集并评阅译文。其后在真实 PDF 发现了排版断词，在 `75da7c7` 追加了基于原文拼写的断词核对，并重跑全部 36 段。原冻结测试与重跑的译文、每句状态、诊断和尝试次数逐项相同。三份用于定位与复测断词的 PDF 单独列作回归。[匿名译文](anonymous.jsonl) · [判定理由](semantic.tsv) · [逐句显示状态](observations.jsonl) · [最终重跑](runs/final-input-fresh.json)

## 为什么目前不能发布

- **关键结果可能整项消失。** F09 保留了置信区间和耗氧描述，却漏掉了题句的核心发现“湖中微粒更少”。数值全部在场也不能识别这个遗漏。[原文、译文与判定](semantic.tsv)
- **研究关系与分组可能被改写。** F28 的负相关被加强为严格的反比。F27 的四分位分组被写成季度，六组 HR 及置信区间仍全部出现。F19 和 F25 的问题在真实上传时也重现。[失败记录](failures.jsonl)
- **旧样本上的改善大于新论文上的改善。** 既有 105 个选段、145 句中，默认可用句从 54 提升至 79，正式版是 73。共有 24 个旧选段仍包含未提示的严重错误，上一候选为 19。本轮仅对措辞发生变化的八句重新逐句评分。旧样本用于开发和回归，因此另列。[旧样本复算](regression-summary.json) · [重新评判的八句](regression-changed.tsv)
- **控制试验成功可以证明具体修复。** 新设 18 对等义和错义译法，上一候选错拦 12/18、错放 3/18，本轮均为 0/18。既有 24 对仍全部区分正确。H061 保留聚合物英文全名及 PET，H099 保留变化倍数设为 1 和每个样本至少 t 条读段的阈值。H042 的吸光度和下标都恢复，实验“提取物”仍被错译为“摘录”。[新控制](contrast-pairs.json) · [实测前后](runs/) · [化学名](10-chemical-identity.png) · [符号阈值](11-symbolic-threshold.png)

## 修改与发布检查

| 文件或范围 | 技术理由 |
| --- | --- |
| `dist/translation-anchors.js`、`dist/translation-facts.js` | 保护复合化学名称、符号阈值的变量、计数单位、每个样本或窗口等限定。分组、科学记数和统计量的核对保留可定位的源值与译值。 |
| `dist/scientific-translation.js`、`dist/discipline-glossary.js` | 在实际翻译与回退中使用同一组科学事实。保留无法可靠翻译的完整名称与下标，区分吸光度和吸收。 |
| `dist/literature-reader.js`、`dist/translation-session.js` | 选择跨越印刷断词时，按当前 PDF 延迟建立词形索引。只把规范化的副本传给本机引擎，同纸同时出现两种写法时优先保留连字符。缓存同时区分原文和规范化输入。 |
| `dist/selection-translation.js`、`dist/folio.css`、`dist/paper-language.js`、`dist/index.html` | 就地显示每句具体差异，提供局部重试、键盘焦点和当前纸本上下文，更新浏览器资源引用。 |
| `tests/scientific-translation.mjs`、`tests/translation-evidence.mjs`、`tests/translation-workflow-browser.cjs`、本目录及 Pages 工作流 | 按原文核对断词和药名，实测局部失败、恢复和用户授权，复算盲评，把语义成绩加入部署前判断。 |

Windows 便携候选用自带的 Python 和本机端口启动。便携包与静态站的 344 份同名阅读器资源逐字节相同。真实 Windows Edge、Chrome 和 WebKit 的上传、划词与局部恢复均跑通。另实测 Neuron 论文与综述的脑图、图件点击解读、Obsidian 以及原文小图导出。解包后的 PPTX 有两页、三张内嵌图片，顺序 E、B、C，三条讲解可编辑。此轮没有实测真机 iPad Safari、大陆多运营商线路或付费 API 推理。[包一致性](runs/package-parity.json) · [原论文回归](runs/reader-regression.json)

候选分支的 Pages 工作流先运行真实 WASM 和浏览器测试，再用冻结论文、真实输出和语义评分复算发布条件。本轮部署预演因低于 98% 有效覆盖且存在未提示的严重错误退出。正式版没有升级；恢复正式产品只需继续使用 v0.4.18。若需撤回草稿修复，原稳定提交为 `05af935`，候选改动在独立分支。[工作流](../../../.github/workflows/pages.yml) · [发布判断](audit.py)

把整体质量进一步提高，优先验证能在无 Key 条件下处理科学句法的引擎，并用另一批新论文比较主语、主要结论和比较对象的保留率。上一轮测过的 OPUS-MT 在该用途上的准确性和速度均未达到替换条件。[模型对照实测](../alternative/alternative-models.zh-CN.md)

复算本轮记录可在仓库根目录运行以下命令。最后一条用于发布前判定，本轮预期返回非零退出状态。

```sh
python tests/translation-benchmark/round2/score-regression.py
python tests/translation-benchmark/round2/audit.py verify tests/translation-benchmark/round2 /tmp/reading-desk-replay
python tests/translation-benchmark/round2/audit.py release tests/translation-benchmark/round2 /tmp/reading-desk-publication
```
