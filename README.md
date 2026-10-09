# Bing AI Performance Exporter

Bing Webmaster Tools' AI Performance report shows which grounding queries lead AI answers to cite your pages, but its export leaves out which query cited which page. This Chrome extension, and a bookmarklet built from the same code, exports that mapping in full, with each query's intent, topic and citation share.

## What you get

A ZIP with three CSVs, and the same three tables in one Excel file:

| File | One row per | Columns |
| --- | --- | --- |
| `mapping.csv` | query and page it cited | `query, intent, topic, citation_share, page, citations` |
| `queries-summary.csv` | query | `query, intent, topic, citation_share, total_citations, mapped_citations, num_pages_mapped` |
| `pages-summary.csv` | page | `page, total_citations, mapped_citations, unmapped_citations, num_queries_mapped` |

Files are named after the site and the range, like `bing-aip_example-com_2026-04-17_2026-05-17_mapping.csv`. The CSVs follow your browser's language: where decimals are written with a comma, columns are separated by semicolons, as Excel expects there.

Bing's mapping is a sample: `unmapped_citations` shows how much of each page's citations it leaves out. More in [the post](https://natzir.com/posicionamiento-buscadores/ai-performance-bing-webmaster-tools-export/).

## Install

- **Extension:** “Bing AI Performance Exporter by Natzir” on the Chrome Web Store. It updates itself.
- **Bookmarklet:** drag it from [natzir.github.io/bing-ai-performance-exporter](https://natzir.github.io/bing-ai-performance-exporter/).

## Use

1. Open AI Performance in Bing Webmaster Tools and pick a date range: 7 D, 30 D, 3 M, 6 M or Custom (with Compare, it exports the current period).
2. Click the icon, or the bookmark. A panel shows the progress: seconds for a small site, up to two hours for one with thousands of queries.
3. Download the ZIP of CSVs and the Excel file.

**When Bing throttles.** Bing limits how fast an account can ask. The exporter paces itself and pauses 45 seconds every 150 queries; when Bing says to slow down it waits (5 minutes, or as long as Bing asks), checks whether Bing is back and goes on. After an hour of throttling it stops with a Resume button.

**Stopping and resuming.** Progress is kept for 24 hours per site and range. Stop, close the tab or reload: open the same report, click again, and it carries on where it stopped. Queries that failed can be retried on their own.

## Privacy

It runs inside the Bing Webmaster Tools page with your session and calls Bing's own API, as the report does. Nothing is sent anywhere else: no analytics, no servers of ours. See [PRIVACY.md](PRIVACY.md).

## Develop

```bash
npm install
npm test          # Vitest
npm run icons     # redraw extension/icons/
npm run build     # dist/extension/, dist/bookmarklet.txt and docs/index.html
npm run pack      # dist/bing-ai-performance-exporter-<version>.zip for the Chrome Web Store
```

Load `dist/extension/` with *Load unpacked* in `chrome://extensions` to try it.

## License

MIT
