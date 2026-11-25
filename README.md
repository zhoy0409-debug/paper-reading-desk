# Reading Desk

[Open the reader](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en) · [Download for Windows](https://github.com/zhoy0409-debug/paper-reading-desk/releases/latest/download/Reading-Desk-Windows-x64.zip) · [简体中文](README.zh-CN.md)

Journal club tomorrow? The axis labels look fuzzy on your slide. You looked up UMAP and lost track of which dots you were comparing. You know what each figure shows, but explaining why one follows another is harder. The walkthrough below uses one published paper to show how to take a panel, read it closely and place it in the paper’s argument.

[![Play the 60-second walkthrough from clicking an axis to exporting the complete slide deck.](dist/media/tour/cover-en.webp)](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en)

[Watch by chapter](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en) · [Watch the narrated introduction](https://zhoy0409-debug.github.io/paper-reading-desk/film/en.html)

<a name="start-reading"></a>

Open a panel close-up and choose **Add to slides**. Its thumbnail appears in the **Slide basket** at the bottom of the reader.

Start with the public sample, or drop in your own PDF. Your browser reads the file on your device. [Open Reading Desk](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en)

## How does a figure fit into the argument and into my talk?

On desktop, the paper outline, original figure and explanation share one screen. Open a panel for a close-up. A locator shows where it sits in the whole figure. Select an axis, legend or scale bar to read its explanation.

![A public paper’s mind map alongside its original figure](docs/guide/studio-map-en.webp)

**Map** organizes the background, research question and figure evidence from the text and captions. Select a page number to check a quotation. With a connected model, the Windows edition can generate an outline directly. The web edition accepts outlines from other AI chats and checks their quotations against the PDF.

Choose **Edit deck** in the basket to work with the same panels, order and notes in a full presentation. Insert your own pictures or text slides, edit the slide body and speaker notes separately, rehearse and choose **Export slide deck**.

![Slide editor showing the sequence, slide body and separate speaker notes](docs/guide/studio-deck-en.webp)

## How do I get a sharp panel onto my slide?

Drag a card by its handle to change the presentation order. Type a speaking note beside its thumbnail, then choose **Export selected figures**. The deck follows the basket order, with editable notes below each image and links to the source page. Reopening the same PDF in the same browser restores your selections and notes.

![Slide basket with two original panel thumbnails and editable speaking notes](docs/guide/basket-en.png)

To save a single image, choose **Save panel PNG** under **Crop & present**.

[![Recorded workflow. Save panel F as a PNG, add it to the slide queue and export a slide with a note and page reference.](docs/guide/export-en.gif)](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en#export)

[Watch with playback controls](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en#export) · [Inspect the exported PNG (1243 × 1500)](dist/media/tour/sample-panel.png) · [Download the editable sample slide](https://raw.githubusercontent.com/zhoy0409-debug/paper-reading-desk/refs/heads/main/docs/guide/figure-6f-en.pptx)

<details>
<summary>Adjust a crop, relabel panels or show two panels together</summary>

- **Correct a boundary.** Adjust the detected crop, undo your edit or draw a new area on the PDF page. If a caption sits on a different page from its figure, the reader shows both page numbers.
- **Bring the legend along.** Keep a shared legend, vertical axis or group heading with your panels so the audience can interpret them.
- **Build a slide queue as you read.** Remove a panel with ×. To reorder with the keyboard, focus its drag handle and press the left or right arrow key. Adjacent panels from the same figure with matching shared annotations appear side by side, up to two per slide. Keep the printed labels or assign new ones for the talk while retaining the original figure reference.
- **Keep speaking notes and private notes separate.** Slide titles and speaking notes are editable in PowerPoint. Each panel is an image. You can attach a public source link. The sample slide links to page 10 of the paper.

</details>

## Can I explain each figure before reading its caption?

Pick a figure in the paper outline and turn on **Look first**. The caption, figure title and notes are covered. Write one line, choose **Reveal caption**, and mark whether you got it. If a figure has to be shown as a full page, its printed caption stays visible and the reader says so.

Open **Slides** to arrange and rehearse the deck. Rehearsal has a timer and notes you can reveal on demand.

When you add a panel to the slide basket, your line becomes its speaking note. It stays in step until you edit the note by hand. Notes you typed are never overwritten. Press `?` in the reader for keyboard shortcuts.

## How do I pronounce a term before journal club?

Select an English term or passage and choose **Listen**. From any figure, **English practice** opens its available English explanation for normal or slow playback. To prepare for questions, choose **Explore background & rehearse** to draft an English question with the selected term and figure evidence.

[![English practice card with the author recording and a journal-club speaking example.](docs/guide/practice-en.png)](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en&practice=abaucin)

[Hear Jon Stokes say *abaucin*, then rehearse a sentence for your talk](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en&practice=abaucin). The author clip starts around 40:05 in the ACS interview and supports slow replay. Other English words and sentences use device speech, with a dictionary lookup for short terms.

## What am I looking at, and where did the authors say that?

Open a close-up from the figure, a panel letter or the crop thumbnail. Figure elements remain clickable while Crop & present is open. Drawing a boundary brings up the original image. Finish or cancel to resume the close-up.

Panel 6F is labelled UMAP. Open the panel to learn what each point represents and which groups to compare. Then select the sampling description in the caption and ask, “How long did sampling last?” The source guide finds the interval from day 0 to month 4 and takes you back to the authors’ sentence.

[![Recorded workflow. Ask a sampling question from the caption, read the answer beside the figure and open the source passage.](docs/guide/question-en.gif)](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en#ask)

[Watch the UMAP walkthrough](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en#methods) · [Watch the question and source lookup](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en#ask)

[![Four real clicks on panel 8A: the x-axis, y-axis, Fashion MNIST legend and MNIST peak.](docs/guide/elements-en.gif)](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en&sample=figure-8a)

[Try panel 8A yourself: x-axis, legend and curve maximum](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en&sample=figure-8a)

<details>
<summary>What happens when I select an axis, group or printed label?</summary>

[View the still image](docs/guide/focus-en.png)

- **Explore one element at a time.** In sample panel 8A, select the x-axis to read what ρ changes, a legend entry to identify its dataset, or a peak to find the setting that most closely matches UMAP for that dataset. Click the background or press `Esc` to dismiss it, or return to the whole figure.
- **Read different kinds of evidence.** Guides cover axis units, colors, line styles and the relationship between observations and fitted curves. A curated pathology example shows where to look on a section and how to compare the image with an injury score.
- **Understand the design.** When the paper gives the details, see who or what was studied, which groups were compared and when treatment occurred relative to the event. For covered animal models, open a strain record or studies using the same model.
- **Ask why a choice mattered.** Start from a comparator or outcome and look for a rationale in the methods, a paper the authors cited or another study. Each source can be inspected separately.
- **Choose translation or a follow-up.** Select text for a translation or send a question along with the figure reference. For an acronym, the reader looks for its expansion in this paper. Help is available on hover, keyboard focus or tap.

</details>

<details>
<summary>How much context should I use for a question?</summary>

Start at the selected passage and choose the scope that fits your question.

```mermaid
flowchart TD
    Q["A question beside the figure"] --> A["What does this phrase mean?"]
    Q --> B["How were the groups defined?"]
    Q --> C["How do other studies justify this choice?"]
    A --> D["Use the selected passage"]
    B --> E["Check this paper’s captions and text"]
    C --> F["Search references and public literature"]
```

Review or edit the selection, supporting passages and follow-up history before sending them to a model. Public search terms are editable. Results matched to the paper’s bibliography are marked as cited.

</details>

## How do these figures fit the paper’s argument?

Open the map at the research question or the authors’ statement of focus. Follow a branch to its figure, expand the available panels and return to the PDF to check the evidence. Switch to Chinese for translated paper titles, figure branches and panel descriptions, or back to English to check the wording.

[![The live English evidence map in version 0.3.0. The study focus links to four figures in paper order, each labelled with its PDF page.](docs/guide/map-en.png)](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en)

[Watch the map walkthrough](https://zhoy0409-debug.github.io/paper-reading-desk/?lang=en#story) · [Explore the sample in English](https://zhoy0409-debug.github.io/paper-reading-desk/read/?lang=en)

<details>
<summary>Open another paper, add a supplement or pick up where you left off</summary>

- **Import your paper.** Open PDF, DOCX or TXT, or paste text or a caption. Assign supplements and references separately. Use a PDF for figure crops. Scanned pages can be opened and selected manually.
- **Choose a reading view.** Use the map for the whole paper, panel focus for one result, or the source index to navigate sections, figures and citations. Imported papers use their identifiable layouts, captions and passages. Curated editions also include dedicated method and design explanations.
- **Verify a claim.** The reader labels panel-specific and shared captions separately. A source link opens the PDF page and highlights the matching line when it can be located.
- **Resume reading.** Reopen saved papers, notes and crop positions in the same browser. The private cross-paper map distinguishes matched citations, title-based topic links and connections you record yourself.
- **Reuse literature you looked up.** Public bibliographic records are saved in your browser. The 30-day interval for model-background literature controls when to check for updates. Saved records remain available afterwards.

</details>

<a name="ask-questions"></a>

## Choose an edition

| Capability | Web reader | Portable Windows x64 |
| --- | --- | --- |
| Start reading | Open the site. No installation or account required | Extract the ZIP and double-click `start.cmd`. Python is included |
| English or Chinese maps, panel focus, PNG and PPTX export, source guide | Included | Included |
| Public literature search | Crossref | PubMed and Crossref |
| Continue in your usual AI chat | Copy the question and excerpts to ChatGPT, DeepSeek, Claude or Gemini | Same options |
| Answers inside the reader | Built-in source guide | Also supports DeepSeek, Qwen (Beijing), an installed Ollama model or a signed-in Codex CLI |
| Get updates | Reopen or refresh the site | From v0.3.0, open **Updates**, download the release and choose **Restart to apply** |

In the Windows question panel, open **Answer and search settings → Connect a model** to enter a provider API key. Keys entered there stay in the service’s memory for the session and can be removed at any time. Provider billing applies. Users of v0.2.2 or earlier need to download the new edition once. [Download for Windows](https://github.com/zhoy0409-debug/paper-reading-desk/releases/latest/download/Reading-Desk-Windows-x64.zip) · [Release notes](https://github.com/zhoy0409-debug/paper-reading-desk/releases)

On macOS or Linux, the local service can also be run from source with Python 3.8+ and `python3 preview.py`.

The walkthrough uses the open paper on neighbor embeddings by Böhm, Berens and Kobak. Figures are cropped and annotated in the reader. [Read the paper](https://www.jmlr.org/papers/v23/21-0055.html) · [Figure credits, licenses and bundled components](THIRD-PARTY.md)
