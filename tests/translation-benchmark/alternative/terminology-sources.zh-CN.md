# 模型与科学术语来源核对

核对日期为 2026 年 11 月 28 日。代码核对以 Reading Desk 0.4.18 为基线。

| 来源 | 核对到的许可或条件 | 适合的用途 |
|---|---|---|
| Mozilla / BrowserMT | Mozilla 在翻译训练项目说明中明确将发布的模型文件列为 MPL 2.0。Reading Desk 的 SOURCES.txt 标示 Bergamot 0.4.9、Firefox Remote Settings 英中模型 2.1。models.json 列出模型、源词表、目标词表和 shortlist 的 SHA-256。 | 随分发保留许可、来源和改动说明。词表服务于分词，不能据此声称有专业双语词库。[Mozilla 对权重的说明](https://github.com/mozilla/translations#readme) · [浏览器运行时](https://github.com/browsermt/bergamot-translator) |
| Helsinki-NLP OPUS-MT | 原始英中模型卡标注 Apache 2.0。Xenova 的量化转换卡指向该原模型，未单列许可。Transformers.js v2.17.2 为 Apache 2.0，ONNX Runtime Web 为 MIT。 | 本次仅在验收目录运行量化版。若成为正式分发件，应随包保留上游许可、归属与变换记录，核查第三方运行时 notices，或从原权重自行转换。[原始模型卡](https://huggingface.co/Helsinki-NLP/opus-mt-en-zh/blob/408d9bc410a388e1d9aef112a2daba955b945255/README.md) · [转换模型卡](https://huggingface.co/Xenova/opus-mt-en-zh/blob/046f55aec303cdee3e0318604406d4df20f1e8ea/README.md) · [Transformers.js](https://github.com/huggingface/transformers.js/blob/2.17.2/LICENSE) · [ONNX Runtime](https://github.com/microsoft/onnxruntime/blob/main/LICENSE) |
| Reading Desk 内置专业词表 | 基线的 discipline-glossary.js 使用代码内的英语与中文词对及学科匹配规则，scientific-translation.js 另有术语和事实保护规则。THIRD-PARTY.md 没有列出已导入的 MeSH、ChEBI 或中文医学术语数据库，也未提供每个词条的独立来源。 | 对新增条目分别记录学科、出处、许可及歧义条件，例如区分医药与交通语境的 vehicle。将来若新增数据库，应逐一记录其授权。[0.4.18 专业词表](https://github.com/zhoy0409-debug/paper-reading-desk/blob/05af935/dist/discipline-glossary.js) |
| ChEBI | EMBL-EBI 将 ChEBI 数据内容以 CC BY 4.0 提供，同时适用 EMBL-EBI 的使用条款。须标注出处、链接许可并说明改动。 | 用稳定 ChEBI ID 核对化学实体及已有同义词。库中的名称语言需逐项确认，不能把英语名自动视为审核过的中文译名。[ChEBI 关于与许可](https://www.ebi.ac.uk/chebi/about/) |
| NLM MeSH | 美国国家医学图书馆要求标注来源、避免暗示背书，保持数据为最新版或清楚注明所用版本。条款明确不涵盖第三方翻译所得的多语种 MeSH 数据。 | 英文主题词与标识符可供医学概念消歧；打包发行中文 MeSH 须单独核对对应翻译机构与条款。[NLM 的 MeSH 使用条件](https://www.nlm.nih.gov/databases/download/terms_and_conditions_mesh.html) |
| Wikidata | 主、属性、词位等指定命名空间的结构化数据采用 CC0；普通说明页面的文字受其他适用许可约束。 | 用实体 ID 配对英中标签，并限学科审核同名词。标签是候选译名，不能代替上下文判断。[Wikidata 许可说明](https://www.wikidata.org/wiki/Wikidata:Licensing) |
| BIPM SI Brochure | 国际计量局标注该手册采用 CC BY 4.0。 | 核对量、单位符号、词头与大小写；在改编并分发手册文字、表格时注明原版本和改动。[BIPM 国际单位制手册](https://www.bipm.org/en/publications/si-brochure) |
| UNTERM | 联合国公开提供多语言查询。联合国网站的一般使用条件对再分发设有限制；本次未查到覆盖整库再分发的开放许可。 | 可提供权威术语查询入口；未获得具体授权前不打包数据库。[UNTERM 说明](https://unterm.un.org/unterm2/zh/about) · [联合国使用条款](https://www.un.org/zh/about-us/terms-of-use/) |

这次比较所用公开论文的正文摘录全部来自明确标注 CC BY 4.0 的九篇原文。样本包逐项保存了标题、作者、DOI、许可和本地 XML 的散列。参考核对点、译文与评分为本次验收生成，和出版方的原文分字段保存。
