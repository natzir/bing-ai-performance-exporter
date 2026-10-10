# Chrome Web Store listing

**Name:** Bing AI Performance Exporter by Natzir

**Summary** (132 characters max). The dashboard takes it from the package (the manifest's `description`), so it must stay exactly this:

> In one click, every AI query that cited each of your pages, from Bing Webmaster Tools' AI Performance, in CSV and Excel.

**Description:**

In one click, get every AI query that cited each of your pages. Bing Webmaster Tools' AI Performance report shows which grounding queries lead AI answers to cite your site, but its export leaves out which query cited which page: this extension exports that mapping in full.

Open AI Performance, pick a date range and click the icon. You get:
• mapping.csv: one row per query and page it cited, with the query's intent, topic and citation share.
• queries-summary.csv: one row per query, with its total and mapped citations and how many pages Bing maps it to.
• pages-summary.csv: one row per page, with total, mapped and unmapped citations, so you see how much of each page Bing's sample leaves out.
• The same three tables in one Excel file.

It handles big sites: it paces itself, waits when Bing throttles and goes on by itself, and keeps its progress, so you can stop, close the tab or reload and carry on later. Queries that fail can be retried on their own. The CSVs follow your browser's language (semicolons and decimal commas where Excel expects them).

Private by design: it runs in the Bing Webmaster Tools page with your session and talks only to Bing. No analytics, nothing sent anywhere.

Made by Natzir Turrado (natzir.com). Source: github.com/natzir/bing-ai-performance-exporter

**Category:** Developer Tools · **Language:** English

## Privacy practices

**Single purpose:** Export the grounding query ↔ page mapping of Bing Webmaster Tools' AI Performance report.

**Permission justification:**

- activeTab: When the icon is clicked, reads that tab's address to tell whether it is Bing Webmaster Tools (otherwise it opens AI Performance in a new tab). No access to other tabs.
- scripting: Together with activeTab, puts the exporter into a Bing Webmaster Tools tab that was open before the install, so the panel opens there without reloading the page. Only on the clicked tab.
- storage: Keeps an export's progress, so a stop, a reload or a closed tab loses nothing.
- unlimitedStorage: The progress of a big site (thousands of queries, each with its cited pages) can exceed the default 10 MB.
- Host permission (content script on https://www.bing.com/webmasters/*): Shows the exporter's panel on Bing Webmaster Tools and calls the AI Performance report's own API from that page, with the user's session.

**Remote code:** No.

**Data usage:** Collects no user data; tick none of the data types. Certify that data is not sold, not used for purposes unrelated to the single purpose, and not used for creditworthiness.

**Privacy policy URL:** https://github.com/natzir/bing-ai-performance-exporter/blob/main/PRIVACY.md

**Official URL:** natzir.com · **Homepage:** https://github.com/natzir/bing-ai-performance-exporter · **Support:** https://github.com/natzir/bing-ai-performance-exporter/issues
