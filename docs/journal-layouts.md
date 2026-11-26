# Cross-journal PDF validation

The corpus contains 46 public PDFs from 38 journals. It includes 35 papers in the initial set, nine additional papers from other issues or journals, and two controls with no numbered figures. It covers English, Portuguese, French and Chinese publications, including research articles, reviews, case reports, software papers, data articles and model descriptions. Both reader versions opened the same files through the web upload control. The audit selected each indexed main figure and opened **Read explanation**. [Per-paper results](journal-layouts-0.4.14.csv) · [Corpus and publisher sources](../tests/fixtures/journal-layouts.json)

| Check | 0.4.13 | 0.4.14 |
| --- | ---: | ---: |
| Main figure numbers found | 227/244 | 244/244 |
| Printed title openings matched | 213/244 | 244/244 |
| Visible reading matched the selected source | 209/244 | 244/244 |
| Caption page matched | 208/231 | 231/231 |
| Artwork page matched | 215/237 | 237/237 |
| Crop met both overlap thresholds | 161/237 | 216/237 |
| Repeated entries | 31 | 0 |
| Unexpected main figure numbers | 2 | 0 |

**How to read the counts.** The reference is the publisher's numbering of the main figures. Title and reading checks look for a distinctive opening from the source, normally its first 24 normalized letters or digits. The reading has to be visible after the click. Page and crop checks include only cases with an independent reference. A passing crop is on the correct page, covers at least 88% of the reference ink bounds, and has at least 49% of its area within those bounds. Among figures with an image reference, 12 opened in page view and 9 automatic crops cut off detail or included substantial surrounding material. Their figure numbers appear in the per-paper table.

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
