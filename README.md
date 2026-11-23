# 文献精读

[English](README.en.md)

读论文遇到一张六格图，放大以后，还是不知道先看哪一格。点进下面这段 **43 秒实录**，跟着一张图，从看清小图走到做出一页有出处的汇报。

[![一张论文图，到底该怎么看？播放 43 秒实录](dist/media/tour/cover-zh.webp)](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=zh)

## 选一个你遇到过的问题

| 读到这里的疑问 | 演示里的实际操作 |
| --- | --- |
| 一张图挤了六格，该从哪格看起？ | [点开 A，再切到 F](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=zh#focus)，对照同一批细胞的两种画法。 |
| 又碰到 PCA，要离开论文查词吗？ | [划选 PCA](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=zh#context)，就地看到作者给出的全称和第 7 页出处。 |
| 这句解释，作者到底写在哪里？ | [从图注跳回 PDF](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=zh#evidence)，直接看到第 10 页高亮的原句。 |
| 只想问细胞取样跨了多久，还要重讲一遍背景吗？ | [在图旁追问](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=zh#ask)，原文导读答出「0 天到 4 个月」，并列出图注页码。 |
| 做汇报时，这张截图到底出自哪一页？ | [打开导出的 PowerPoint](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=zh#slide)，核对小图 F、讲解和第 10 页出处。 |

![三处实际界面细节。划词显示 PCA 全称，图注回答取样范围，导出的幻灯片保留小图和出处。](dist/media/tour/details-zh.webp)

## 开始阅读

1. 下载并解压 [最新版本](https://github.com/zhoy0409-debug/paper-reading-desk/releases/latest) 的源码 ZIP。
2. 安装 Python 3.8 或更新版本。Windows 双击 `start.cmd`。macOS 或 Linux 在解压目录运行 `python3 preview.py`。
3. 浏览器会打开 [文献精读](http://127.0.0.1:4187/)。点「公开论文试读」体验示例，或选入自己的主文 PDF。右上角可切换中文和英文。

## 联网检索与模型问答

阅读 PDF、查看摘录和使用随附的中英翻译模型均可在本机完成。公开文献检索使用 PubMed 与 Crossref，无需模型账号。选择在线模型后，界面会显示随问题发送的选段和出处。

| 回答方式 | 配置 |
| --- | --- |
| 原文导读与公开检索 | 直接使用 |
| DeepSeek | 设置环境变量 `DEEPSEEK_API_KEY` |
| 通义千问 | 设置 `DASHSCOPE_API_KEY`，使用北京地域接口 |
| Ollama | 启动本机 Ollama，安装模型，按需设置 `READING_OLLAMA_MODEL` |
| ChatGPT / Codex | 安装并登录本机 Codex CLI |

在设置环境变量后重新启动服务。Web 界面与 Python 服务在同一本机地址运行。运行 `python3 preview.py --no-browser --port 4190` 可指定其他端口。

示例论文及组件的作者、来源和许可见[第三方资料说明](THIRD-PARTY.md)。
