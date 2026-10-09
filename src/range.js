// The date range of the AI Performance report, read from the page, and how the API and the files
// write it. A range is { begin, end }, two UTC days as 'YYYY-MM-DD'.
// The report's tabs, as Bing's own page sends them: every range ends yesterday; 7 D and 30 D go back
// that many days, 3 M and 6 M that many calendar months from today (read from its requests on 9 Oct 2026:
// 7 D = Oct 2–8, 30 D = Sep 9–Oct 8, 3 M = Jul 9–Oct 8, 6 M = Apr 9–Oct 8).
const PRESETS = { '7 D': { days: 7 }, '30 D': { days: 30 }, '3 M': { months: 3 }, '6 M': { months: 6 } };
const TABS = /^(7 D|30 D|3 M|6 M|Custom|Compare)$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export const isoDay = date => date.toISOString().slice(0, 10);
const utcDay = day => new Date(`${day}T00:00:00Z`);

// A preset tab's range, from the browser's today (Bing's page works out its dates in the browser too).
// Months keep the day of the month, or the month's last day when it is shorter (May 31 − 3 months = Feb 28).
export function presetRange(preset, now = new Date()) {
  const { days, months } = PRESETS[preset];
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  const end = new Date(Date.UTC(year, month, date - 1));
  let begin;
  if (days) {
    begin = new Date(Date.UTC(year, month, date - days));
  } else {
    const first = new Date(Date.UTC(year, month - months, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    begin = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date, last)));
  }
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

const monthOf = word => MONTHS.indexOf(word.slice(0, 3).toLowerCase());

// A day as Bing may show it in English: "Feb 17, 2026", "February 17, 2026", "Sept. 3, 2026", or day
// first as in its Custom fields, "09 Jul 2026", "09 Sept 2026". Numeric dates are not read: 2/3/2026 is
// the 3rd of February or the 2nd of March depending on the locale. Null for anything else.
export function parseShownDate(text) {
  const s = text.trim();
  let m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}), (\d{4})$/);
  if (m) {
    const month = monthOf(m[1]);
    return month < 0 ? null : day(Number(m[3]), month, Number(m[2]));
  }
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4})$/);
  if (m) {
    const month = monthOf(m[2]);
    return month < 0 ? null : day(Number(m[3]), month, Number(m[1]));
  }
  return null;
}

const DATE = String.raw`\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, \d{4}`;
const PAIR = new RegExp(`(${DATE})\\s*[-–—]\\s*(${DATE})`);

// The first "day – day" in a text, if both days are real and in order.
export function shownRange(text) {
  const m = text.match(PAIR);
  if (!m) return null;
  const begin = parseShownDate(m[1]);
  const end = parseShownDate(m[2]);
  return begin && end && begin <= end ? { begin, end } : null;
}

// Whether the report has drawn its range tabs yet (Bing draws them after its own requests, so a panel
// opened on a page that is still loading waits for them).
export const rangeTabsShown = doc => [...doc.querySelectorAll('[role="tab"]')].some(t => TABS.test(t.textContent.trim()));

// Custom's two fields, as Bing renders them: read-only text labelled "Start date" and "End date" (the
// first pair on the page belongs to Custom; the Compare dialog adds its own pairs after it).
function customFields(doc) {
  const text = label => doc.querySelector(`[aria-label="${label}"]`)?.textContent ?? '';
  const begin = parseShownDate(text('Start date'));
  const end = parseShownDate(text('End date'));
  return begin && end && begin <= end ? { begin, end } : null;
}

// The range the report shows: a preset tab, or Custom's dates. Compare is not read: once applied, the
// page no longer shows the periods it asked for, only the days that have data. Null when it can't tell,
// and the panel asks instead.
export function readRange(doc, now = new Date()) {
  const tab = [...doc.querySelectorAll('[role="tab"]')]
    .find(t => t.getAttribute('aria-selected') === 'true' && TABS.test(t.textContent.trim()));
  if (!tab) return null;
  const label = tab.textContent.trim();
  if (PRESETS[label]) return presetRange(label, now);
  if (label !== 'Custom') return null;
  return customFields(doc) ?? shownRange(doc.body.innerText ?? doc.body.textContent);
}
