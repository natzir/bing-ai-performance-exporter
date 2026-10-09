import { describe, it, expect, afterEach } from 'vitest';
import { apiDateRange, lastDays, parseShownDate, rangeLabel, readRange, shownRange } from '../src/range.js';

const NOW = new Date('2026-05-17T15:00:00Z');

// The report's range tabs, one of them selected, and whatever else the page shows after them.
const page = (selected, extra = '') => {
  const tabs = ['7 D', '30 D', '3 M', '6 M', 'Custom', 'Compare']
    .map(t => `<div role="tab" aria-selected="${t === selected}">${t}</div>`).join('\n');
  document.body.innerHTML = `<div role="tablist">\n${tabs}\n</div>\n${extra}`;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('lastDays', () => {
  it('ends today at 00:00 UTC and goes back the given days', () => {
    expect(lastDays(7, NOW)).toEqual({ begin: '2026-05-10', end: '2026-05-17' });
    expect(lastDays(30, NOW)).toEqual({ begin: '2026-04-17', end: '2026-05-17' });
    expect(lastDays(90, NOW)).toEqual({ begin: '2026-02-16', end: '2026-05-17' });
    expect(lastDays(180, NOW)).toEqual({ begin: '2025-11-18', end: '2026-05-17' });
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
    expect(parseShownDate('2/17/2026')).toBe('2026-02-17');
  });

  it('refuses days that do not exist and words that are not months', () => {
    expect(parseShownDate('Feb 30, 2026')).toBeNull();
    expect(parseShownDate('17/2/2026')).toBeNull();
    expect(parseShownDate('Foo 1, 2026')).toBeNull();
  });
});

describe('shownRange', () => {
  it('finds the first "day – day" in a text', () => {
    expect(shownRange('Data for Feb 1, 2026 - Mar 3, 2026')).toEqual({ begin: '2026-02-01', end: '2026-03-03' });
    expect(shownRange('2/1/2026 – 3/3/2026')).toEqual({ begin: '2026-02-01', end: '2026-03-03' });
  });

  it('gives nothing for a single day or a backwards pair', () => {
    expect(shownRange('Last updated Feb 1, 2026')).toBeNull();
    expect(shownRange('Mar 3, 2026 – Feb 1, 2026')).toBeNull();
  });
});

describe('readRange', () => {
  it('turns each preset tab into its days', () => {
    page('7 D');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-05-10', end: '2026-05-17', compare: false });
    page('30 D');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-04-17', end: '2026-05-17', compare: false });
    page('3 M');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-02-16', end: '2026-05-17', compare: false });
    page('6 M');
    expect(readRange(document, NOW)).toEqual({ begin: '2025-11-18', end: '2026-05-17', compare: false });
  });

  it('reads the dates shown for Custom', () => {
    page('Custom', '<span>Feb 1, 2026 - Mar 3, 2026</span>');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-02-01', end: '2026-03-03', compare: false });
  });

  it('takes the current period of Compare, the first pair shown', () => {
    page('Compare', '<span>Apr 1, 2026 – Apr 30, 2026</span>\n<span>Mar 1, 2026 – Mar 31, 2026</span>');
    expect(readRange(document, NOW)).toEqual({ begin: '2026-04-01', end: '2026-04-30', compare: true });
  });

  it('gives nothing when it cannot tell, so the panel asks', () => {
    page('Custom');
    expect(readRange(document, NOW)).toBeNull();
    document.body.innerHTML = '<p>No tabs here</p>';
    expect(readRange(document, NOW)).toBeNull();
  });
});
