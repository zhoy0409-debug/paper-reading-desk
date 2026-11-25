/* Interface copy only. PDF quotations, file names, presentation text and notes keep their original language. */
(() => {
  'use strict';
  const labels = new Map(Object.entries({
    '读一篇论文':'Read a paper','选择主文':'Open a paper','打开 PDF 论文':'Open a PDF','先选一篇论文（PDF、DOCX 或 TXT），支持拖入':'Drop a PDF, DOCX or TXT here',
    '在本机浏览器读取文件。':'Your files are read in this browser.',
    '补充材料 · 选填':'Supplements · optional','参考文献／知识资料 · 选填':'References · optional','可同时添加多份':'Select multiple files',
    '选填：补充材料、参考文献和知识资料':'Add supplements and references','没有可读文件？粘贴原文':'Paste source text',
    '粘贴正文、图注或参考文献':'Paste text, captions or references','加入这份原文':'Add text',
    '主文':'Main paper','补充材料':'Supplement','参考文献／知识资料':'Reference material',
    '选好主文后，会在这里显示读取进度。':'Reading progress will appear here.',
    '支持有文字层的 PDF、DOCX、TXT。扫描 PDF 目前不做 OCR；可粘贴正文或图注。':'Text-based PDF, DOCX and TXT. For a scan, select a page or paste the caption.',
    '查看阅读结果':'Open reading desk','改用粘贴原文':'Paste text instead','先看原始 PDF 页':'Open the original PDF',
    '本次阅读材料 · 管理文件和角色':'Manage files and roles','记录我想先弄懂的问题（选填）':'Add a reading question','我的阅读问题':'My question',
    '仅作当前阅读的便签，不会拿它推断论文的科学问题。':'A personal prompt for this reading session.',
    '私人跨论文图谱':'Personal library','私人跨论文图谱 · 返回篇内阅读':'Personal library · back to paper',
    '读图时点「保存到私人图谱」，即可从这里重开原文、笔记与读图位置。':'Save a paper while reading to reopen its figures, notes and reading position here.',
    '记录两篇论文的联系':'Link two papers','保存联系':'Save link','本文引用 →':'Cites →','← 对方引用本文':'← Cited by',
    '我确认的联系':'My connection','主题相近':'Related topic','尚无已记录的联系。':'No connections recorded.',
    '你的原文导览 · 本地生成':'Local source outline','查看原文索引':'Source index','查看脉络概览':'Paper outline','返回原图工作台':'Return to figures',
    '按页手动定位':'Find by page','读取这一页':'Open page','文献精读 · 原图工作台':'Figure reading desk',
    '正在定位论文原图':'Locating figures','从主文里找图注和原页。附件可以稍后再加。':'Matching captions to pages in your paper.',
    '论文图谱':'Evidence map','研究问题':'Research question','研究焦点 · 摘要原文':'Research focus · abstract','论文题名':'Paper title','这篇论文':'This paper',
    '作者表述':'Author’s statement','图注原文':'Original caption','原文图件':'Figures','证据路径':'Evidence path','图件':'Figure',
    '收起图件':'Show fewer','查看所选原图 ↓':'Inspect figure ↓','查看整图':'Inspect figure','打开原文':'Open PDF',
    '原文图像':'Original figure','原文整页':'Full PDF page','整图':'Full figure','这张图怎么看':'Reading the figure',
    '大图':'Expand','关闭大图':'Close','适合窗口':'Fit','重试加载':'Retry','正在读取原文图像':'Loading image',
    '正在准备原文预览':'Preparing preview','读取完成后，图像会出现在这里。':'The image will appear here.',
    '这里没有可核实的图像':'No verified image available','原图未载入':'Image unavailable',
    '原文数据 · 图注':'Source evidence · caption','整图阅读':'Figure overview','看原文图注':'Original caption',
    '作者解释 · 提及本图的正文':'Author interpretation · article text','核对比较与测量 · 整图图注':'Comparisons and measurements · full caption',
    '图中观测或测量':'Observation or measurement','比较对象或条件':'Groups or conditions','证据边界':'What the evidence supports',
    '原文引用':'References cited','延伸阅读':'Further reading','文献链接':'Open reference','本文参考条目':'Locate citation',
    '校正边界':'Adjust bounds','手动框选小图':'Draw a panel','框选共用图例／坐标轴／标尺':'Include legend, axis or scale bar','撤销边界':'Undo edit',
    '从原页框选':'Select on page','返回整图范围':'Return to figure','取消框选':'Cancel selection','讲解一句话':'Slide narration',
    '加入汇报':'Add to slides','已加入汇报':'Added to slides','导出 PPTX':'Export PPTX','私人笔记与来源':'Private notes and sources',
    '私人笔记／未核实推断 · 仅本机':'Private note or hypothesis · local only','公开原文链接（选填）':'Public source URL · optional',
    '保存到私人图谱':'Save to library','移除':'Remove','整图 · 选择小图或手动框选':'Full figure · select or draw a panel',
    '上一页':'Previous page','下一页':'Next page','用 PDF 查看器打开':'Open in PDF viewer','返回读图':'Back to figure','正在读取原页…':'Loading original page…',
    '已保存论文、读图位置和笔记，可从私人图谱重开。':'Paper, reading position and notes saved to your library.',
    '已记录原页坐标。':'Bounds saved in page coordinates.','已撤销上一次边界修改。':'Last edit undone.',
    '在左侧原图上，从区域一角拖至对角；框内保留需要的标签和标尺。':'Drag between opposite corners on the original image. Include the labels and scale you need.',
    '正在从原 PDF 裁图并生成 PPTX…':'Extracting images from the PDF and building slides…',
    '输入图内标签或描述':'Panel label or description','两篇论文的具体联系':'Why are these papers connected?',
    '边界按原页标签估计，可校正。':'Bounds are estimated from page labels and can be adjusted.',
    '图注有该标签，图像范围待框选。':'This label is in the caption. Draw its bounds on the page.',
    '找到分图标签，未自动解读其结果。':'Panel label located. Check the image and caption for the result.',
    '未确认分图边界；请在原图里核对标签。':'Check the label on the original image to verify the panel bounds.',
    '图注记录了本图展示的对象与条件。具体小图以图内标签和对应图注为准。':'For panel-specific evidence, match the label in the image to its caption.',
    '原页手动定位。请按实际图内标签框选需要的区域。':'Draw the region on the PDF page using the printed labels.',
    '先读另一篇':'Read another paper','这份原 PDF 的缓存不可用。请重新选择同一份 PDF，原有笔记和裁切位置仍按文件指纹保留。':'Reselect the same PDF to recover your notes and regions.',
    '公开论文试读':'Open this paper','裁切预览':'Crop preview','图中小图':'Figure panels','图内未定位到独立小图。':'No individual panels located.',
    '按可核对的正文与图内标签优先展示。':'Figures with traceable text and panel labels appear first.',
    '缩小原图':'Zoom out','放大原图':'Zoom in','缩放复位':'Reset zoom','在大图查看器打开':'Expand image',
    '缩小大图':'Zoom out','放大大图':'Zoom in','大图缩放复位':'Reset zoom','查看整图说明':'Full figure notes',
    '按原文顺序':'Source order','所有已识别图表图注':'All located captions','阅读范围与限制':'Indexing coverage',
    '科学问题／研究目的':'Research question','摘要':'Abstract','引言／背景':'Introduction','方法':'Methods','结果':'Results',
    '本地文献导览':'Paper outline','核心问题':'Central question','展开这条分支':'Explore this branch','原文定位':'Source location','图注定位':'Caption location',
    '阅读起点':'Starting point','证据分支':'Evidence branch','子节点':'Subtopic','回到出处':'Sources','查看原文位置':'Locate in text','展开原文摘录':'Read excerpt',
    '打开来源链接':'Open source','阅读逐字说明':'Read transcript','播放图解':'Play','暂停':'Pause','重播图解':'Replay',
    '从哪里读懂这篇论文？':'Where should I start?','从可读原文开始':'Start with the text','图表怎么读':'Read the figures','收起原文':'Close source',
    '先看核心问题；点分支查看图解、子节点和出处。':'Select a branch to explore its figures, subtopics and sources.',
    '先点一个分支。节点连到本地识别到的段落或图注，不把目录当成论点。':'Choose a branch to locate a passage or caption in the paper.',
    '点一条分支，看作者给出的证据或你要核对的边界。':'Choose a branch to examine its evidence.',
    '回到作者写明的研究问题或目的。':'Find the authors’ stated objective.','查看可定位的图注。':'Read the located caption.',
    '这里定位到原文提及的图注，点原文核对。':'Open the caption mentioned in the source text.',
    '看看作者比较了什么、观测到了什么，图注和结论分开看。':'Identify the comparison and observations in the paper.',
    '在同一段落里分开看作者报告的结果和对结果的解释。':'Separate the reported results from the authors’ interpretation.',
    '这里是作者对结果的解释，适合对照原始证据。':'Check the authors’ interpretation against the evidence.',
    '读作者怎样收束发现，再回结果核对支撑范围。':'Trace the conclusion back to the results.',
    '先弄清比较对象、读数和研究设计，再理解结果。':'Identify the groups, measurements and study design.',
    '先扫一眼论文概述，再展开实际定位到的正文。':'Read the overview, then inspect the relevant passages.',
    '找到研究背景和作者在回答的争议。':'Find the context and the question at issue.',
    '查看原文的来源条目。引用条目不等于这篇已读。':'Inspect entries in the reference list.',
    '标题还未可靠识别。可以点开已有文字，不猜测论文在证明什么。':'Section headings are unclear. Open the extracted text.',
    '从能定位到的图注开始，不把图注当成已经读过原图。':'Start with a located caption and check the original figure.',
    '上移':'Move up','下移':'Move down','下载组图 PNG':'Download PNG','下载缩小版 PNG':'Download smaller PNG','正在生成 PNG…':'Preparing PNG…',
    '讨论／局限':'Discussion','结果与讨论':'Results and discussion','结论':'Conclusion','参考文献':'References','图表图注':'Figure and table captions','其他原文':'Other text','角色':'Role',
    '内容超过本轮阅读范围；只索引部分文字。可粘贴未读章节另行查看。':'Only part of the text was indexed. Paste a missing section to read it.',
    '没有找到明确标注的研究目的段。可从摘要或引言核对，不代拟原文没有说的科学问题。':'Check the abstract or introduction for the research question.',
    '没识别到可靠的段落标题。可按原始顺序阅读，但不推断问题、方法或结论。':'Read in source order when section titles cannot be identified.',
    '按原文标题、图表编号与方括号引用定位。PDF 页序或段落边界可能不完整；原文未标识的关系不会补写。':'Navigate by source headings, figure numbers and bracketed citations. Check the PDF for exact layout.',
    '链接来自原文中的 DOI；未在后台联网核验。':'DOI links come from the source text.','返回脑图':'Return to map','待定角色':'Unassigned',
    '区域过小，请重新框选。':'Region too small. Draw a larger selection.','来源链接需为完整的 HTTP 或 HTTPS 地址。':'Enter a complete HTTP or HTTPS source URL.',
    '保存失败，请检查浏览器存储空间。':'Save failed. Check available browser storage.','导出未完成。':'Export incomplete.',
    '汇报中有已撤销或缺少边界的小图，请移除或重新框选。':'A selected panel has no bounds. Redraw or remove it.',
    '原页渲染失败，可用 PDF 查看器打开。':'Page rendering failed. Open the PDF viewer.',
    '文件读取失败，请选择本地主文。':'Could not open the paper. Choose a local file.'
  }));
  function english(value) {
    if(labels.has(value))return labels.get(value);
    const p=typeof value==='string' && value.match(/^(正文 p\.|核对原文第 )(\d+)(?: 页)?$/);
    if(p)return 'Source text · p.'+p[2];
  }
  function set(node, value, translation = english(value)) {
    node.textContent = value ?? '';
    if (!translation) return node;
    const en = node.ownerDocument.createElement('span');
    en.lang = 'en'; en.className = 'ui-en'; en.textContent = translation;
    node.append(' ', en);
    return node;
  }
  window.PaperUI = {set, english};
})();
