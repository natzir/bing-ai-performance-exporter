import { describe, it, expect, afterEach } from 'vitest';
import { apiDateRange, parseShownDate, presetRange, rangeLabel, readRange, shownRange } from '../src/range.js';

// Today in the browser: 9 October 2026, mid-afternoon local time (the day Bing's own requests were read).
const NOW = new Date(2026, 9, 9, 15, 0);

// The report's range tabs, one of them selected, and whatever else the page shows after them.
const page = (selected, extra = '') => {
  const tabs = ['7 D', '30 D', '3 M', '6 M', 'Custom', 'Compare']
    .map(t => `<div role="tab" aria-selected="${t === selected}">${t}</div>`).join('\n');
  document.body.innerHTML = `<div role="tablist">\n${tabs}\n</div>\n${extra}`;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('presetRange', () => {
  it("ends yesterday and goes back as Bing's own report does: days for 7 D and 30 D, calendar months for 3 M and 6 M", () => {
    // What Bing's AI Performance page sent on 9 October 2026 for each tab.
    expect(presetRange('7 D', NOW)).toEqual({ begin: '2026-10-02', end: '2026-10-08' });
    expect(presetRange('30 D', NOW)).toEqual({ begin: '2026-09-09', end: '2026-10-08' });
    expect(presetRange('3 M', NOW)).toEqual({ begin: '2026-07-09', end: '2026-10-08' });
    expect(presetRange('6 M', NOW)).toEqual({ begin: '2026-04-09', end: '2026-10-08' });
  });

  it('keeps months whole at the end of a month and across a year', () => {
    expect(presetRange('3 M', new Date(2026, 4, 31, 15, 0))).toEqual({ begin: '2026-02-28', end: '2026-05-30' });
    expect(presetRange('6 M', new Date(2026, 1, 10, 15, 0))).toEqual({ begin: '2025-08-10', end: '2026-02-09' });
    expect(presetRange('7 D', new Date(2026, 0, 3, 15, 0))).toEqual({ begin: '2025-12-27', end: '2026-01-02' });
  });
});

describe('apiDateRange', () => {
  it('writes both days at midnight UTC, as the API takes them', () => {
    expect(apiDateRange({ begin: '2026-02-16', end: '2026-05-17' })).toEqual({
      BeginTimeStamp: 'Mon, 16 Feb 2026 00:00:00 GMT',
      EndTimeStamp: 'Sun, 17 May 2026 00:00:00 GMT',
    });
  });
});

describe('rangeLabel', () => {
  it('names the range, with the year once, or twice when it changes', () => {
    expect(rangeLabel({ begin: '2026-02-16', end: '2026-05-17' })).toBe('Feb 16 – May 17, 2026');
    expect(rangeLabel({ begin: '2025-11-18', end: '2026-05-17' })).toBe('Nov 18, 2025 – May 17, 2026');
  });
});

describe('parseShownDate', () => {
  it('reads the English ways Bing may write a day', () => {
    expect(parseShownDate('Feb 17, 2026')).toBe('2026-02-17');
    expect(parseShownDate('February 17, 2026')).toBe('2026-02-17');
    expect(parseShownDate('Sept. 3, 2026')).toBe('2026-09-03');
  });

  it('reads the day-first dates of the Custom fields', () => {
    expect(parseShownDate('09 Jul 2026')).toBe('2026-07-09');
    expect(parseShownDate('09 Sept 2026')).toBe('2026-09-09');
    expect(parseShownDate('8 October 2026')).toBe('2026-10-08');
    expect(parseShownDate('31 Sept 2026')).toBeNull();
  });

  it('refuses days that do not exist and words that are not months', () => {
    expect(parseShownDate('Feb 30, 2026')).toBeNull();
    expect(parseShownDate('2/17/2026')).toBeNull();
    expect(parseShownDate('17/2/2026')).toBeNull();
    expect(parseShownDate('Foo 1, 2026')).toBeNull();
  });
});

describe('shownRange', () => {
  it('finds the first "day – day" in a text', () => {
    expect(shownRange('Data for Feb 1, 2026 - Mar 3, 2026')).toEqual({ begin: '2026-02-01', end: '2026-03-03' });
    expect(shownRange('2/1/2026 – 3/3/2026')).toBeNull();
  });

  it('gives nothing for a single day or a backwards pair', () => {
    expect(shownRange('Last updated Feb 1, 2026')).toBeNull();
    expect(shownRange('Mar 3, 2026 – Feb 1, 2026')).toBeNull();
  });
});

describe('readRange', () => {
  it('turns each preset tab into the days Bing uses', () => {
    page('7 D');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-10-02', end: '2026-10-08' });
    page('30 D');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-09-09', end: '2026-10-08' });
    page('3 M');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-07-09', end: '2026-10-08' });
    page('6 M');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-04-09', end: '2026-10-08' });
  });

  it('reads Custom from its Start date and End date fields', () => {
    // As Bing renders them: read-only text fields labelled for assistive tech.
    const field = (label, text) => `<div aria-label="${label}"><div class="ms-TextField-field">${text}</div></div>`;
    page('Custom', `${field('Start date', '09 Jul 2026')}\n${field('End date', '08 Oct 2026')}\n${field('Start date', '09 Sept 2026')}\n${field('End date', '08 Oct 2026')}`);
    expect(readRange(document, NOW)).toEqual({ begin: '2026-07-09', end: '2026-10-08' });
  });

  it('falls back to a "day – day" in the page for Custom', () => {
    page('Custom', '<span>Feb 1, 2026 - Mar 3, 2026</span>');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-02-01', end: '2026-03-03' });
  });

  it("asks for Compare, whose current period the page doesn't show once applied", () => {
    page('Compare', '<span>Apr 1, 2026 – Apr 30, 2026</span>');
    expect(readRange(document, NOW)).toBeNull();
  });

  it('gives nothing when it cannot tell, so the panel asks', () => {
    page('Custom');
    expect(readRange(document, NOW)).toBeNull();
    document.body.innerHTML = '<p>No tabs here</p>';
    expect(readRange(document, NOW)).toBeNull();
  });
});
