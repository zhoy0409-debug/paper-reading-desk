# 划词翻译验收记录 · Reading Desk 0.4.18

## 复现和归因

使用空浏览器配置打开 0.4.17 的发布目录。英文单词 *water* 和普通完整句可以翻译。上传的 Abaucin 论文第 5 页有一段跨三行的正文引用图 3b，划选同一句时，科学校验拒绝了译文。

| 对照条件 | 实际观察 |
| --- | --- |
| 0.4.17 原版 | 注册表和四个英译中文件均返回 HTTP 200。注册表使用 `shortlist`，传给 Worker 的对应值却是 `undefined`，生成了零字节的缓冲区。原始模型输出还把 piperidine 译成了「吡啶」，拆散了图号，改变了 Abaucin 的写法。 |
| 单独修复 shortlist 映射 | Worker 收到 6,506,248 字节的 shortlist。模型仍输出「吡啶」，同一选段仍未通过科学校验。 |
| 单独检查取文和术语恢复 | 跨行划选原文索引时，浏览器的原生选区还包含相邻的文件名、页码等界面文字。术语恢复把 `Abaucin` 改成了小写，和保留标识符的校验冲突。内部图号及结构描述中的化学名称也可能在翻译时被拆开。 |
| 0.4.18 | 从原 PDF 的上传入口进入，划选第 5 页的跨行原句。弹框的原文只含选中的论文文字，译文保留了三个结构单元、三个化学名称和图 3b。 |

旧版弹框还会将下载中断、校验错误、Worker 出错和译文不合格都显示为同一句提示。这些故障需要不同的处理。

## 模型加载

发布目录下的注册表为 `read/vendor/bergamot/models.json`。表中四个文件与它位于同一目录。测试收集了 HTTP 响应，并在 Worker 接收缓冲区时独立计算了每份数据的 SHA-256。

| 文件 | 字节数 | Worker 入参的 SHA-256，与注册表一致 |
| --- | ---: | --- |
| model.enzh.intgemm.alphas.bin | 43,849,787 | `f102e513798f5c5e61621e58b08d1c8aa535189a47befdef5613d5b058983fed` |
| lex.50.50.enzh.s2t.bin | 6,506,248 | `4a5e5827788060f1d718a8132b69440929387514a045796e9b77f935db68c055` |
| srcvocab.enzh.spm | 806,952 | `bd9b65504acc6d9726dd281f7defc2adb7c2c22d0688fe2f84697de25197c8c5` |
| trgvocab.enzh.spm | 772,004 | `aded6993c36e440284d11cec3f6b8aef9c0e43188a772d80be342a713adf223d` |

正常会话只初始化一个 WASM Worker，加载一次英译中模型。以下为在阅读器中上传 PDF、划选文字并点击翻译后的结果。

| 选段 | 弹框结果 |
| --- | --- |
| water | 水 |
| The blue light passed through the glass. | 蓝光穿过玻璃。 |
| The measured concentration was 0.25 mg/mL (Fig. 2c). | 测量浓度为0.25 mg/mL（图2c）。 |
| Abaucin comprises three structural moieties: benzoxazine, piperidine, and trifluoromethyl-phenyl group (Fig. 3b). | Abaucin 包括三个结构单元，分别为 benzoxazine、piperidine 和 trifluoromethyl-phenyl 基团（图 3b）。 |

最后一句同时在测试 PDF 和原论文中验证。此例保留可逐字对应的化学名称。科学校验还单独测试了错误的浓度单位、数值、分图、名称、空译文，以及翻译引擎照抄原句的情况。

## 失败后只重试当前选段

在 Chromium 中依次模拟注册表断开、缺少 shortlist、WASM 无法启动、源词表返回 HTTP 503、源词表内容损坏。每次原选段和页面都保持打开。恢复后，点同一选段的重试按钮得到「水」。

- 源词表共请求三次，分别遇到 503、错误摘要、正确数据。主模型、shortlist 和目标词表各请求一次。重试期间页面导航次数为零。
- 另一次测试挂起正在进行的推理并缩短测试时钟。页面显示翻译超时，点重试后创建新 Worker，复用此前核验过的模型文件。
- 在上一段尚未完成时改选另一段，只有新选段的结果可以更新当前弹框。开发者控制台保留错误阶段、原始异常及其调用栈。

## 修改文件与理由

| 文件 | 原因 |
| --- | --- |
| `dist/vendor/bergamot/translator.js` | 按注册表定位文件，兼容 shortlist 和 lex。校验下载字节、复用已核验资源，区分下载、校验和推理超时，释放失败的 Worker。 |
| `dist/vendor/bergamot/worker/translator-worker.js` | 在进入 WASM 前拒绝缺失或空的模型、词表、shortlist，将 Worker 内错误和调用栈送回主线程。 |
| `dist/paper-language.js` | 共用引擎，允许失败的模块或引擎初始化重新开始，交互式划选优先处理。 |
| `dist/scientific-translation.js` | 处理 PDF 断行与连字，保护大小写、化合物、浓度和图号。再次核对译文，区分空输出、事实不符及术语不符。 |
| `dist/selection-translation.js`、`dist/reading-studio.js` | 保留选段和错误原因，避免过期结果覆盖新选段。原文索引跨行取文跳过界面标签，从工具抽屉打开索引后可直接划选。 |
| `tests/scientific-translation.mjs`、`tests/translation-transfer.mjs` | 检查错误分类、科学事实保护、两种注册表命名及损坏资源的重试。 |
| `tests/selection-engine-browser.cjs`、`tests/fixtures/translation-selection.pdf`、`.gitignore` | 用小型 PDF 运行真实上传、划选、下载、WASM 推理和故障恢复测试。仓库仅收录测试页。 |
| `.github/workflows/pages.yml`、`dist/index.html`、`VERSION` | 将 Chromium 和 WebKit 的真实翻译测试放在 Pages 部署前，令读者加载本次修订的资源。 |
| `README.md`、`README.en.md`、`README.zh-CN.md`、本记录 | 说明选段重试的入口，提供复现步骤及核对结果。 |

## 重跑测试

在仓库根目录用 `python scripts/web_assets.py _site/read` 生成发布目录，用 `python -m http.server 8174 --bind 127.0.0.1 --directory _site` 提供该目录。安装发布流程指定的 Playwright 和浏览器后，在另一个终端运行下面的命令。

```sh
node tests/scientific-translation.mjs
node tests/translation-transfer.mjs
node tests/selection-engine-browser.cjs http://127.0.0.1:8174/read/
READER_BROWSER=webkit node tests/selection-engine-browser.cjs http://127.0.0.1:8174/read/ --healthy
```

设置环境变量 `READER_ORIGINAL_PDF` 指向原论文的本地 PDF，即可在测试页之后追加原论文的跨行划选。发布流程使用仓库里的小型 PDF，可从空缓存独立复现。
