// The date range of the AI Performance report, read from the page, and how the API and the files
// write it. A range is { begin, end }, two UTC days as 'YYYY-MM-DD'.
const PRESETS = { '7 D': 7, '30 D': 30, '3 M': 90, '6 M': 180 };
const TABS = /^(7 D|30 D|3 M|6 M|Custom|Compare)$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export const isoDay = date => date.toISOString().slice(0, 10);
const utcDay = day => new Date(`${day}T00:00:00Z`);

// The last `days` days, ending today at 00:00 UTC: the bookmarklet's rule, whose numbers matched Bing's.
export function lastDays(days, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const begin = new Date(end);
  begin.setUTCDate(begin.getUTCDate() - days);
  return { begin: isoDay(begin), end: isoDay(end) };
}

// The API's DateRange: both days at midnight UTC, written like "Sun, 17 May 2026 00:00:00 GMT".
export const apiDateRange = ({ begin, end }) => ({
  BeginTimeStamp: utcDay(begin).toUTCString(),
  EndTimeStamp: utcDay(end).toUTCString(),
});

// "Feb 16 – May 17, 2026", or with both years when they differ.
export function rangeLabel({ begin, end }) {
  const from = utcDay(begin);
  const to = utcDay(end);
  const show = (date, year) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC', ...(year ? { year: 'numeric' } : {}) });
  return `${show(from, from.getUTCFullYear() !== to.getUTCFullYear())} – ${show(to, true)}`;
}

function day(year, month, date) {
  const value = new Date(Date.UTC(year, month, date));
  return value.getUTCMonth() === month && value.getUTCDate() === date ? isoDay(value) : null;
}

// A day as Bing may show it in English: "Feb 17, 2026", "February 17, 2026", "Sept. 3, 2026" or
// "2/17/2026". Null for anything else.
export function parseShownDate(text) {
  const s = text.trim();
  let m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    return month < 0 ? null : day(Number(m[3]), month, Number(m[2]));
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? day(Number(m[3]), Number(m[1]) - 1, Number(m[2])) : null;
}

const DATE = String.raw`\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, \d{4}|\b\d{1,2}\/\d{1,2}\/\d{4}`;
const PAIR = new RegExp(`(${DATE})\\s*[-–—]\\s*(${DATE})`);

// The first "day – day" in a text, if both days are real and in order.
export function shownRange(text) {
  const m = text.match(PAIR);
  if (!m) return null;
  const begin = parseShownDate(m[1]);
  const end = parseShownDate(m[2]);
  return begin && end && begin <= end ? { begin, end } : null;
}

// The range the report shows: a preset tab, or the days shown for Custom and Compare (for Compare, the
// current period: the first pair). Null when it can't tell, and the panel asks instead.
export function readRange(doc, now = new Date()) {
  const tab = [...doc.querySelectorAll('[role="tab"]')]
    .find(t => t.getAttribute('aria-selected') === 'true' && TABS.test(t.textContent.trim()));
  if (!tab) return null;
  const label = tab.textContent.trim();
  if (PRESETS[label]) return { ...lastDays(PRESETS[label], now), compare: false };
  const shown = shownRange(doc.body.innerText ?? doc.body.textContent);
  return shown ? { ...shown, compare: label === 'Compare' } : null;
}
