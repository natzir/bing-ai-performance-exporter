# Bing AI Performance Exporter by Natzir · Privacy policy

Last updated: 9 October 2026

## What it reads

When you click its icon on Bing Webmaster Tools' AI Performance report, it asks Bing's own API, from that page and with your Bing session, for the report's grounding queries, its cited pages and the pages each query cited. It reads nothing on other sites, and nothing until you click.

## What it keeps

While an export runs, its progress (the lists and the mapping fetched so far) is kept in `chrome.storage.local`, in this browser only, so a stop or a reload loses nothing. It is deleted when an export finishes with every query fetched, and anything older than 24 hours is deleted. The files are saved to your computer only when you click a download.

## What it sends

Nothing. No analytics, no tracking, and no servers other than Bing's, which the report itself uses.

## Permissions

- **activeTab**: when you click the icon, to read that tab's address and act on that tab only. It gives no access to any other tab.
- **scripting**: with activeTab, to put the exporter into a Bing Webmaster Tools tab that was open before the install, so the panel opens there without reloading the page.
- **storage**: to keep an export's progress.
- **unlimitedStorage**: a big site's progress can exceed the 10 MB Chrome gives by default.
- **Access to www.bing.com/webmasters**: to show the panel on Bing Webmaster Tools and ask Bing's API from that page.

## Contact

Natzir Turrado · https://natzir.com
