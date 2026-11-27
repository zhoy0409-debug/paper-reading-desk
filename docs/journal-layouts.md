# Cross-journal PDF validation

The corpus contains 46 public PDFs from 38 journals. It includes 35 papers in the initial set, nine additional papers from other issues or journals, and two controls with no numbered figures. It covers English, Portuguese, French and Chinese publications, including research articles, reviews, case reports, software papers, data articles and model descriptions. Both reader versions opened the same files through the web upload control. The audit selected each indexed main figure and opened **Read explanation**. [Per-paper results](journal-layouts-0.4.15.csv) · [Corpus and publisher sources](../tests/fixtures/journal-layouts.json)

| Check | 0.4.14 | 0.4.15 |
| --- | ---: | ---: |
| Main figure numbers found | 244/244 | 244/244 |
| Printed title openings matched | 244/244 | 244/244 |
| Visible reading matched the selected source | 244/244 | 244/244 |
| Caption page matched | 231/231 | 231/231 |
| Artwork page matched | 237/237 | 237/237 |
| Crop met both overlap thresholds | 216/237 | 237/237 |
| Repeated entries | 0 | 0 |
| Unexpected main figure numbers | 0 | 0 |

**How to read the counts.** The reference is the publisher's numbering of the main figures. Title and reading checks look for a distinctive opening from the source, normally its first 24 normalized letters or digits. The reading has to be visible after the click. Page and crop checks include only cases with an independent reference. A passing crop is on the correct page, covers at least 88% of the reference ink bounds, and has at least 49% of its area within those bounds. The audit revisited the 12 page fallbacks and nine crop mismatches from the previous release using the same references and thresholds.

**Body passages and map links.** The reader identified 446 body quotations for 238 figures. Each quotation cited the target figure, appeared in full on the stated page, and led to a highlighted PDF line. Passages citing several figures carry a shared-reference label.

- The reported Neuron paper opened Figure 3 on PDF page 6 and its caption on page 7. Figure 4 in the skeletal chemokine review opened the SDF-1/CXCR4 diagram on page 7. For both papers the test followed the caption, body passage, map objective and result back to a highlighted source line. [Neuron paper](https://pubmed.ncbi.nlm.nih.gov/40233748/) · [Skeletal chemokine review](https://doi.org/10.3389/fendo.2025.1667440)
- Two side-by-side charts from DenseNet and Stochastic Depth received 160 clicks at independent PDF coordinates. Each click checked the explanation for the selected axis, group name, legend entry or symbol at fit, zoom, edited crop and zoomed crop. The maximum edge offsets were 1.89 and 1.75 CSS pixels, respectively.

**Examples**

- A PeerJ forest study prints the number and title together without punctuation. All seven figures appeared in the index. [Paper](https://doi.org/10.7717/peerj.18176)
- A French paper lists its legends on page 9 and prints Figures 1–4 on pages 12, 13, 13 and 14. Selecting a figure opens its illustrated page. [Paper](https://doi.org/10.11604/pamj.2024.49.67.43551)
- A Chinese physics paper pairs Chinese and English captions on pages 6 and 7. Each figure receives one entry. [Paper](https://doi.org/10.7498/aps.73.20241026)

A four-page raster-only derivative of the software paper was checked separately for source-page access. It is excluded from the corpus counts. Scans support opening pages and manually selecting a region.

**Reproduce or extend the audit.** The manifest pins each public PDF by SHA-256 and records the publisher's figures, title openings and independent page or artwork locations. Add new layouts or failures there with their source references. The browser audit requires Node.js and Playwright; these are developer dependencies. The Pages release also runs small, deterministic layout regressions.

```sh
python scripts/fetch-layout-corpus.py PATH_TO_PDF_CACHE
node tests/journal-corpus.cjs https://zhoy0409-debug.github.io/paper-reading-desk/read/ PATH_TO_PDF_CACHE results.json
```

Append one or more corpus IDs to run a subset. Add `--strict` to return a failing exit code for any missed reference check. The default audit records all differences and fails on browser or input errors.
