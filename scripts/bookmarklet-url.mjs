// Turns bundled code into a bookmark URL, and the install page that carries it.

// Browsers percent-decode a javascript: URL before running it, so a literal % must be escaped. URL
// parsing also strips tabs and newlines, so those are escaped too.
export function toBookmarkletUrl(code) {
  return `javascript:${code.replace(/[%\t\n\r]/g, ch => encodeURIComponent(ch))}`;
}

const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function installPage(bookmarkletUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bing AI Performance Exporter</title>
<style>
  body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #172224; max-width: 640px; margin: 48px auto; padding: 0 16px; }
  a.bm { display: inline-block; padding: 10px 18px; border-radius: 20px; background: #172224; color: #fff; text-decoration: none; font-weight: 500; cursor: grab; }
  code { background: #e7eeee; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>Bing AI Performance Exporter</h1>
<p>Drag this button to your bookmarks bar (show it with <code>⌘ Shift B</code>, or <code>Ctrl Shift B</code> on Windows):</p>
<p><a class="bm" href="${escapeAttribute(bookmarkletUrl)}">Bing AI Performance Exporter</a></p>
<ol>
  <li>Open AI Performance in Bing Webmaster Tools and pick a date range.</li>
  <li>Click the bookmark. A panel shows the progress.</li>
  <li>Download the CSVs (in a ZIP) and the Excel file.</li>
</ol>
<p>Prefer a Chrome extension, which updates itself? Look for “Bing AI Performance Exporter by Natzir” on the Chrome Web Store.</p>
<p><a href="https://natzir.com/posicionamiento-buscadores/ai-performance-bing-webmaster-tools-export/">What the mapping tells you</a> · <a href="https://github.com/natzir/bing-ai-performance-exporter">Source on GitHub</a></p>
</body>
</html>
`;
}
