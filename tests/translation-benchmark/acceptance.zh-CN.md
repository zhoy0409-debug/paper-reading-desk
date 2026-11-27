# Paper Reading Desk 科研翻译验收

**本轮暂缓发布。** 候选版能保留一段中已经译好的句子，能够恢复模型下载和 Worker 故障，也减少了读者默认看到的严重错译。但在七篇独立论文中，读者能直接读懂主要事实的句子由 73/145 降到 54/145。还有 19 个选段带着严重语义错误通过了全部逐句检查。线上 GitHub Pages 和正式 Windows 包继续使用 v0.4.18。候选包与候选网页只用于验收。

2026 年 11 月 28 日重新测量 v0.4.18，基线提交为 `05af935`。同机使用 Windows 便携版、实际 Pages 网站及从同一份候选源码生成的静态网页和 Windows 测试包。独立评审在看不到版本名的情况下逐段、逐句评分。评审由模型完成，没有第二位学科专家双评。[基线实测](runs/baseline-performance.json) · [Pages 实测](runs/pages-baseline-performance.json) · [候选包实测](runs/candidate-portable-performance.json) · [冻结文件摘要](runs/engine-freeze-final.json)

## 1. 故障与根因

| 证据 | 发现 | 对读者的影响 |
| --- | --- | --- |
| 原版实际执行 | 五句选段中注入一次局部失败，旧调用抛出整段错误。候选版保留四句译文，并在第三句的位置提示重试，重试只发送失败的句子 | 读者可以继续阅读已完成部分。[操作截图](screens-zh/05-partial-paragraph.png) |
| 原版实际执行 | 对“A 组上升 10%，B 组下降 20%”，基线返回“A组增长10%,B组增长20%。”并放行。候选版返回“A组增长10%，而B组减少20%。” | 数字都在译文里，方向仍可能改变。[旧输出](runs/baseline-performance.json) · [新输出](runs/candidate-portable-performance.json) |
| 源码与实际执行 | 原版把一次划词作为一个成功或失败的请求，部分科学检查核对字面数字与标识符，未充分约束它们对应的对象、方向及单位。化合物身份和隐含阈值至今仍可能误判 | 双语原文对照和逐句判定都需要保留。[逐条失败记录](holdout-corpus/final-blinded-score/failed-cases.csv) |
| 源码与断网复现 | 原版在新页面上下文重新读取注册表。即使先前使用成功，测试中断网后也无法重新开始翻译。候选版复核已持久保存的资源摘要，可在已打开的阅读器中重新使用 | 初次使用仍需要取得模型。浏览器可能按其存储策略清理已有缓存。[旧缓存实测](runs/baseline-cache.json) · [新缓存实测](runs/candidate-cache.json) |
| 源码与调度测试 | 原版前台和后台更容易争用同一个初始化等待过程，重复选区仍会再次推理。缩短后台批次并复用已核对结果后，重复选段明显加快。陌生科研段落出现额外核查开销 | 首次响应、陌生文本和重复阅读的耗时应分别报告。[延迟明细](runs/candidate-portable-performance.json) |

本轮重新检查了模型注册表、模型路径、shortlist 与旧 lex 字段、四个模型文件的摘要和 Worker 启动。干净环境中四个文件均成功取得并校验，字词和整句均产生真实中文。已有 v0.4.18 的模型字段修复继续有效。本轮故障的主要来源是选段容错、事实错配与模型本身的翻译质量。[实机日志](runs/windows-engine.txt)

## 2. 修改范围与回滚

| 修改文件 | 修改理由与行为变化 |
| --- | --- |
| `dist/translation-session.js` | 保存每个翻译单元的原文、规范文本、引擎、状态、检查、错误和尝试次数。逐句显示，按编号重试，切换时取消旧任务。重叠相同任务共享推理。对显式转折尝试有限恢复，对代词开头的句子尝试携带相邻的所选原文。 |
| `dist/translation-facts.js`、`dist/scientific-translation.js` | 统一比较用文字、统计标记、科学记数和单位写法，按组检查数值和方向，保留原有检查和原文回退。区分空结果、严重事实冲突、术语疑点、分段恢复。保留拒绝的候选和原始异常供核对。 |
| `dist/translation-alignment.js` | 提供读者主动开启的本机回译对照。四轮交叉实验中，增加的四条警示有三条对应严重错误，也带来一次误报、首次约 52.03 MiB 额外下载。默认快速翻译不触发回译。[交叉实验](dev-corpus/alignment-review.zh-CN.md) |
| `dist/discipline-glossary.js` | 扩充研究领域，沿用手动选科和个人词库。结合选段上下文处理 SEM、vehicle、expression、resistance 等多义词，缓存区分个人词表内容。来源和可再分发条件单列审查。[术语来源与许可](alternative/terminology-sources.zh-CN.md) |
| `dist/paper-language.js` | 优先处理主动划词，共用引擎，限制后台批次。脑图单节点重试复用已完成句子。最后一次推理结束后启动闲置释放计时。提供模型读取进度和定向清理入口。 |
| `dist/vendor/bergamot/translator.js`、`dist/translation-runtime-cache.js` | 模型缓存按 SHA-256 寻址，读取时再验摘要。运行时缓存限于同源的三个已知资产。损坏项单独删除并获取，无法使用持久存储时可在当前进程取用。保留原模型和 Worker 实现。 |
| `dist/selection-translation.js`、`dist/folio.css`、`dist/index.html` | 弹窗保留原文页码、完成进度、逐句重试、复制、朗读、取消、可展开的术语和诊断。精译先预览选段和术语。更新资源引用。 |
| `dist/browser-models.js`、`dist/reader-access.js`、`dist/reading-models.json` | 共用已有个人 Key 管理与服务适配，明确精译目标语言、逐句编号、服务商和待发送字句。默认不附加上下文，只有用户同意发送才发出请求。 |
| `preview.py`、`reading_questions.py` | 便携版复用原有提供方，加上精译请求的同意、字段、长度及编号检查。支持已配置的 DeepSeek、Qwen 或本机 Ollama。 |
| `tests/selection-engine-browser.cjs`、`tests/translation-{workflow,cache,lifecycle}-browser.cjs` | 真实 PDF 选区及 WASM 检查，覆盖单句断网、连续切换、坏缓存、Worker 异常退出与恢复、精译预览及授权。故障是有意注入的，成功路径经过实际引擎。 |
| `tests/translation-session.mjs`、`tests/provider-test.py` | 可重复地测试取消后的迟到响应、在途共享、缓存隔离、段落恢复，以及三个服务的授权和请求边界。 |
| `tests/personal-api-browser.cjs`、`tests/personal-api-fixture.cjs` | 在测试浏览器内把两条已知付费服务地址改指第二个本机 HTTPS 端口。保留真实跨域请求、CORS、弹窗授权以及模型缓存 Service Worker，核对个人提问和脑图接入。 |
| `.github/workflows/pages.yml`、`tests/translation-benchmark/` | 在独立 PR 跑真实引擎和语料复算。PR 不能部署 Pages。提交原文许可、双语参考、运行结果、失败清单、评审及截图。仓库首页、版本号及正式下载保持在已发布版本。 |

可能的回归集中在自动校验的误拦、慢机额外推理，以及浏览器存储被逐出。实验分支可以整体放弃，或按提交回退。测试包用过的设备可以重新启动正式 v0.4.18 包。本次没有迁移论文或笔记的数据格式。模型清理只移除翻译缓存。测试验证了同一站点的阅读笔记和无关缓存条目存留。[缓存恢复日志](runs/cache-recovery.txt) · [浏览器存储机制](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## 3. 独立语料与质量指标

233 个真实选段，来自 15 篇公开许可论文。开发集与验收集按论文隔离，包含摘要、引言、方法、结果、讨论、图注、表注及补充材料。每段保留出处、原文定位、学科、难度、事实与术语锚点、可接受的参考译文和错误类型。参考允许等义表达。开发集 128 段来自 8 篇论文。独立集每篇取 15 段，共 105 段，含 39 段多句选段与 14 个实际 PDF 断行样例。盲评前冻结验收文本与检查点，预选每篇 5 段，再按同一标准审完其余 70 段。[开发集与出处](dev-corpus/sources.json) · [验收集与出处](holdout-corpus/sources.json) · [冻结摘要](holdout-corpus/freeze.json) · [评分口径](holdout-corpus/scoring-protocol.md)

| 独立指标 | 正式 v0.4.18 | 候选版 |
| --- | ---: | ---: |
| 默认展示完整可读的选段 | 89/105（84.8%） | 57/105（54.3%） |
| 默认整段有效，主要事实和限定均可用于科研阅读 | 37/105（35.2%） | 27/105（25.7%） |
| 默认有效原文句 | 73/145（50.3%） | 54/145（37.2%） |
| 主动展开全部候选后的有效句 | 73/145 | 79/145（54.5%） |
| 默认正确表达的预先标注事实 | 204/260（78.5%） | 128/260（49.2%） |
| 默认正确表达的术语 | 128/177（72.3%） | 90/177（50.8%） |
| 默认展示严重语义错误的选段 | 37/105（35.2%） | 23/105（21.9%） |
| 正确候选受到拒绝或核对标记 | 0/37 | 13/39（33.3%） |
| 错误候选被校验接受 | 65/65（100%） | 32/66（48.5%） |
| 普通难度的完整可读选段 | 10/11 | 10/11 |

基线有三段没有候选，无法进入误拒、漏判的分母。候选版的 47 个折叠句中，25 句能正确传达要点、6 句仍难用、16 句有严重错误。打开折叠内容同时增加了有用信息和错误信息。候选版有 19 个整段所有句子状态均为 translated、issues 均为空，独立审读仍发现严重错误。基线有 37 个含严重错译的选段被放行且返回文字无警示标记，旧日志没有逐句界面状态。普通文本的 99%、科研有效覆盖的 98%、样本内零未标记严重错误三项目标均未达到。[105 段核验](holdout-corpus/final-blinded-score/blind-review.md) · [145 句核验](holdout-corpus/final-blinded-score/sentence-review.md) · [完整失败清单](holdout-corpus/final-blinded-score/failed-cases.csv)

三个例子说明拦截与漏判的实际后果。H024 的正确相关关系被折叠。H061 在两个版本中都保留 PET 缩写，却把化合物全称误译成另一化学结构。H099 丢失了决定读段是否计入分析的阈值。还有一段 H042，旧版无译文，候选版带提示展示了误译的吸光度与阴性对照。这是本轮新增可见的严重错译。[逐条原文、译文和判定](holdout-corpus/final-blinded-score/audited-cases.jsonl)

开发集按所有能取得的候选评分，不能与默认可见区域的独立指标混用。原版到候选版的有效句从 100/163 升至 112/163，事实从 211/259 升至 237/259，术语从 134/207 升至 153/207。能取得中文的选段从 115 增至 128，同时出现严重偏差的原始候选从 41 增至 48。另用 24 对受控的正确/错误译文检查守卫逻辑，误拒由 5/24 降至 0/24，漏判由 9/24 降至 0/24。受控对照只覆盖列出的错误类型。[开发集基线](dev-corpus/baseline-metrics.json) · [开发集候选](dev-corpus/candidate-recovery-metrics.json) · [受控对照](control-pairs.json)

## 4. 性能和恢复

同一台 Windows x64 电脑。延迟为发起翻译至得到可展示结果的时间，取实际浏览器计时。首次同时包含下载、初始化和首次推理。内存为浏览器进程树的工作集峰值，不是模型独占内存。每次冷启动和长短段探针只取该次实测值。新论文延迟随选段复杂度变化。[便携版基线](runs/baseline-performance.json) · [便携候选](runs/candidate-portable-performance.json) · [Windows 内存实测](runs/candidate-portable-performance.json.rss.json)

| 同机条件 | v0.4.18 | 候选版 |
| --- | ---: | ---: |
| 空缓存到第一句英文译出中文 | 1,105 ms | 1,258 ms |
| 同一会话首次启动中译英 | 856 ms | 684 ms |
| 10 次相同选段重复阅读，P50 / P95 | 32 / 45 ms | 均低于 1 ms 计时分辨率 |
| 105 个真实独立选段，P50 / P95，计入首段 | 94 / 302 ms | 120 / 487 ms |
| 上列排除首段后，104 个不同选段，P50 / P95 | 93 / 297 ms | 118 / 397 ms |
| 脑图后台翻译期间发起一次主动划词 | 24 ms | 27 ms |
| 限速 4 MiB/s、附加延迟 80 ms 的首次翻译 | 14,980 ms | 14,337 ms |
| 峰值浏览器进程树工作集 | 2,748,727,296 字节 | 2,682,839,040 字节 |
| 双向健康会话的 Worker 启动数 | 1 | 1 |
| 空缓存英译中模型文件下载 | 4 个文件，各 1 次 | 4 个文件，各 1 次 |

100、500、2,000、6,000 字符探针使用重复句并在指定长度截断。旧版依次为失败（86 ms）、整段返回（326 ms）、整段返回（1,126 ms）、失败（3,149 ms）。候选版为部分可读（31 ms）、整段返回（26 ms）、整段返回（15 ms）、部分可读（10 ms）。重复内容受缓存帮助，陌生长文应参考独立语料的延迟。在本次网络上，正式 Pages 空缓存英译中首次用了 110.2 秒，中译英首次用了 119.8 秒。此次没有国内多运营商测速。[正式 Pages 原始记录](runs/pages-baseline-performance.json) · [独立选段延迟](runs/candidate-recovery-heldout.json)

| 可重复的故障和操作 | 观测结果 |
| --- | --- |
| 注册表请求中断、缺少模型字段、无效 WASM、词表返回 HTTP 503、下载摘要不符 | 每种都在新会话单独触发。恢复资源后，在原页点击一次重试，同一选区得出中文。另行验证五种故障连续发生时的恢复。[独立试验](runs/isolated-asset-recovery.txt) · [连续注入](runs/windows-engine.txt) |
| 翻译超时、运行中的 Worker 异常 | 同一选段可重试并重建引擎。连续阅读实测 331 秒、363 次选段，崩溃后复用了新 Worker。另用加速计时器验证闲置释放和下次重建。[运行统计](runs/soak.json) |
| 空模型缓存时断网、持久词表受损 | 联网后可恢复。只损坏源词表时，仅重新获取该文件。已有完整缓存时，在新页面上下文打开阅读器后切断网络，仍能译新句。模型缓存清理后，测试笔记和另一缓存保留。[缓存试验](runs/cache-recovery.txt) |
| 五句中断一句，连续更换选区、论文、术语词库 | 原文仍在，已译的四句仍显示，恢复故障后点击一次“仅重试此句”，只对该句请求引擎。切换原文关闭旧弹窗，相同选段的在途读取相互独立。[重试前](screens-zh/05-partial-paragraph.png) · [重试后](screens-zh/06-single-sentence-retry.png) |
| 外部服务无效 Key、限流 | 在真实浏览器拦截 HTTPS 模型请求，依次返回 401、429、正常响应。前两次保留本地译文，只有点击同意才发出预览里的内容。便携端三个适配器另有请求体和同意检查。未使用付费 Key，也未在本机运行真实 Ollama 推理。[浏览器测试](../translation-workflow-browser.cjs) · [便携适配器测试](../provider-test.py) |

按独立用例计，五种启动/下载故障的单次恢复为 5/5。另测的超时、Worker 崩溃、持久词表损坏、首次缺缓存断网、单句中断五条路径均恢复，合计 10/10。该比例描述所注入的十类情形。真实用户每段的额外点击次数未做用户研究，实测五句中断场景的操作成本为一次点击、一次单句请求、零次页面刷新。[逐场景执行脚本](../translation-lifecycle-browser.cjs) · [缓存脚本](../translation-cache-browser.cjs) · [选段脚本](../translation-workflow-browser.cjs)

## 5. 实际阅读、平台与替代模型

中文截图均来自运行候选便携包的真实浏览器，使用可再分发的测试 PDF。其中一个句子的网络失败经过注入以便每次重现。读者可顺序查看 [模型下载进度](screens-zh/02-model-progress.png)、[网络恢复](screens-zh/03-recovered-translation.png)、[上下文术语](screens-zh/04-contextual-terminology.png)、[单句失败](screens-zh/05-partial-paragraph.png)、[局部重试](screens-zh/06-single-sentence-retry.png)、[整段与原文](screens-zh/07-whole-paragraph-source.png)、[精译发送前预览](screens-zh/08-precision-preview.png) 和 [单词划译](screens-zh/09-word.png)。

本轮验证了 Windows 便携候选、同路径结构的静态候选站、桌面 Chrome、Edge 和 Windows 上的 WebKit 自动化。正式 Pages 单独验证的是 v0.4.18。对照了论文上传、脑图研究问题与目的、图件元素解释、PDF 跳页、Obsidian 导出。使用原版 Abaucin PDF 上传、划选含三种化学结构及 Fig. 3b 的整句，又将小图按 E、B、C 排序导出并解包核实，2 页 PPTX 包含 3 张图片、按顺序的图号、原页码和可编辑讲解。另用邻域嵌入论文、Neuron 研究与骨骼趋化因子综述复测脑图。真实 iPad、Safari 和大陆多条公共网络尚未覆盖。[原文化学句](runs/original-chemical-selection.txt) · [回归记录](runs/reader-regression.json)

九篇额外论文的 17 个样例上，真实浏览器 Bergamot 原始译文有 5 条严重错译，OPUS-MT INT8 单束有 14 条、四束有 13 条。单束模型实际总下载从 57.25 MB 增至 130.41 MB，中位热句延迟从 75 ms 增至 1,157 ms。本次保留现有引擎。机器辅助回译仅作可选提示，也不能判定语义正确。[模型对照、许可与运行条件](alternative/alternative-models.zh-CN.md) · [原始对照结果](alternative/comparison.json)

## 6. 重跑与核对

第一次 Linux WebKit 检查在个人提问用例失败。本机 HTTPS 复现时，缓存 Service Worker 已控制页面，Playwright 的请求拦截计数为零，界面收到了密钥无效的回答。改用第二个本机 HTTPS 服务实收测试请求后，能够检查谁收到请求、授权头是否对应以及 401、429 后的恢复。测试始终使用伪造的测试 Key。产品的提问实现和盲评所用翻译引擎均未因这项修正改动。[WebKit 用例](../personal-api-browser.cjs) · [Playwright 对 Service Worker 和请求拦截的说明](https://playwright.dev/docs/network#missing-network-events-and-service-workers)

在仓库根目录运行下列命令。第一条使用 Python 标准库校验冻结语料、双语运行结果和评审文件，逐项复算两份报告。浏览器实测需要 Playwright Core、已安装的浏览器和按 `scripts/web_assets.py` 生成的静态目录。Windows 可设置 `READER_BROWSER=msedge` 或 `chrome` 运行相应浏览器测试。具体 CI 命令已写入项目工作流。[发布检查工作流](../../.github/workflows/pages.yml)

```sh
python tests/translation-benchmark/verify-acceptance.py
node tests/translation-session.mjs
python tests/provider-test.py
node tests/selection-engine-browser.cjs http://127.0.0.1:8174/read/ --isolated-faults
node tests/translation-workflow-browser.cjs http://127.0.0.1:8174/read/
node tests/translation-benchmark/benchmark.cjs http://127.0.0.1:8174/read/ new-run.json tests/translation-benchmark/holdout-corpus/holdout.jsonl
```

重新测量其他版本时，用 `blind-pair.cjs BASE.json NEW.json OUTPUT.jsonl KEY.json` 随机分配匿名列。评审完成前将 KEY 与评审隔离。用 `score_holdout.py` 生成盲表，给变更的译文重新打分。附带的已定案记录只适用于本次实际输出。[原始匿名对](runs/anonymous-pairs-final.jsonl) · [评审后揭盲](runs/comparison-key.json)

## 7. 下一轮验收重点

首先处理两个相反的误差。化学名、数字阈值及不等式改变科学对象或结论时，读者需要在译句旁看见具体差异。单位等价、中文量词和语序变化等证据较弱的疑点，应尝试保留可读句并就地指出疑点，测量误拦是否下降。接下来用从未参与本轮分析的新论文检验默认有效覆盖、事实和漏判，并优先请学科人员双评有分歧的化学与统计样例。现有 105 段保留为回归集，后续以新独立集决定是否发布。
