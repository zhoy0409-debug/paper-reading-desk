# Reading Desk

[中文](README.md)

Read a scientific paper one figure at a time. Open a panel, inspect its labels, and compare it with the authors’ caption and discussion. A published paper is included for a first visit.

## Quick start

1. Download the source ZIP from the [v0.1.0 release](https://github.com/zhoy0409-debug/paper-reading-desk/releases/tag/v0.1.0) and extract it.
2. Install Python 3.8 or later. On Windows, run `start.cmd`. On macOS or Linux, run `python3 preview.py` in the extracted directory.
3. Open [Reading Desk](http://127.0.0.1:4187/), choose **English**, then open the sample paper or select your own PDF.

Choose a figure in the map and open a panel. **Read source passages** shows the caption and related paragraphs alongside the figure. **Locate in PDF** opens the page in context. **Back to passage** returns to the same excerpt. Select an acronym to see an expansion found in that paper or to ask a follow-up question. You can save your reading position and export selected panels to PowerPoint.

PDF processing and on-device translation run locally. Public literature search uses PubMed and Crossref. Optional model providers receive the text shown in the question panel. To enable DeepSeek or Qwen, set `DEEPSEEK_API_KEY` or `DASHSCOPE_API_KEY` (Beijing endpoint), then restart. A local Ollama model or a signed-in Codex CLI can also be used. The source guide works without a model account.

See [third-party credits](THIRD-PARTY.md) for the sample paper and bundled components.
