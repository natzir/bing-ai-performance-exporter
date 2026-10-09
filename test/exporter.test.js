import { describe, it, expect, afterEach } from 'vitest';
import { createExporter } from '../src/exporter.js';
import { stateKey } from '../src/run.js';
import { memoryStore } from '../src/store.js';
import { SITE, fakeBing, reply } from './helpers/bing.js';
import { fakeClock } from './helpers/clock.js';

const REPORT_URL = `https://www.bing.com/webmasters/aiperformance?siteUrl=${encodeURIComponent(SITE)}`;
const DONE = '3 queries · 2 pages mapped. Download below.';
const FILES = ['Download CSV (ZIP)', 'Download Excel'];

afterEach(() => {
  document.body.innerHTML = '';
});

function setup({ bing = fakeBing(), tab = '30 D', href = REPORT_URL, store = memoryStore(), clock = fakeClock(), files } = {}) {
  document.body.innerHTML = tab
    ? `<div role="tablist"><div role="tab" aria-selected="false">7 D</div><div role="tab" aria-selected="true">${tab}</div></div>`
    : '<main></main>';
  const blobs = [];
  const win = {
    location: { href },
    navigator: { language: 'en-US' },
    URL: {
      createObjectURL: blob => {
        blobs.push(blob);
        return `blob:${blobs.length}`;
      },
      revokeObjectURL: () => {},
    },
  };
  const exporter = createExporter({ doc: document, win, store, fetch: bing.fetch, clock, logo: '', again: 'click the icon again', ...(files && { files }) });
  return { exporter, bing, store, blobs, clock };
}

const root = () => document.querySelector('[data-bing-aip]')?.shadowRoot;
const status = () => root()?.querySelector('.status .text').textContent;
const title = () => root()?.querySelector('.title').textContent;
const labels = () => [...root().querySelectorAll('.actions .label')].map(n => n.textContent);
const action = label => [...root().querySelectorAll('.actions > *')].find(n => n.querySelector('.label').textContent === label);

describe('exporter', () => {
  it('points to AI Performance anywhere else', () => {
    const { exporter } = setup({ href: `https://www.bing.com/webmasters/home?siteUrl=${encodeURIComponent(SITE)}` });
    exporter.toggle();
    expect(status()).toBe('Open the AI Performance report to export its mapping.');
    expect(action('Open AI Performance').getAttribute('href')).toBe(REPORT_URL);
  });

  it('exports the report and offers the files', async () => {
    const { exporter, blobs } = setup();
    exporter.toggle();
    await exporter.settled();
    expect(title()).toBe('example.com · Apr 17 – May 16, 2026');
    expect(status()).toBe(DONE);
    expect(labels()).toEqual(FILES);
    expect(action('Download CSV (ZIP)').getAttribute('download')).toBe('bing-aip_example-com_2026-04-17_2026-05-16.zip');
    expect(action('Download Excel').getAttribute('download')).toBe('bing-aip_example-com_2026-04-17_2026-05-16.xlsx');
    expect(blobs.map(b => b.type)).toEqual([
      'application/zip',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
  });

  it('closes on the next click once the export is over', async () => {
    const { exporter } = setup();
    exporter.toggle();
    await exporter.settled();
    exporter.toggle();
    expect(root()).toBeUndefined();
  });

  it('asks for the range when it can\'t read it', async () => {
    const { exporter } = setup({ tab: null });
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe('Which dates should it export?');
    root().querySelector('.choices button').click();
    await exporter.settled();
    expect(title()).toBe('example.com · May 10 – May 16, 2026');
    expect(status()).toBe(DONE);
  });

  it('waits for Bing to draw its range tabs before asking', async () => {
    let sleeps = 0;
    const tabs = '<div role="tablist"><div role="tab" aria-selected="false">7 D</div><div role="tab" aria-selected="true">30 D</div></div>';
    const clock = fakeClock(undefined, () => {
      sleeps += 1;
      if (sleeps === 3) document.body.insertAdjacentHTML('afterbegin', tabs);
    });
    const { exporter } = setup({ tab: null, clock });
    exporter.toggle();
    expect(status()).toBe('Waiting for the report to load…');
    await exporter.settled();
    expect(title()).toBe('example.com · Apr 17 – May 16, 2026');
    expect(status()).toBe(DONE);
  });

  it('says the session expired when there is no token', async () => {
    const { exporter } = setup({ bing: fakeBing({ tokenStatus: 401 }) });
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe('Your Bing session has expired. Reload the page and click the icon again.');
  });

  it('tells how long Bing makes it wait', async () => {
    const seen = [];
    let once = true;
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query !== 'how to clean widgets' || !once) return undefined;
        once = false;
        return reply(429);
      },
    });
    const { exporter } = setup({ bing, clock: fakeClock(undefined, () => seen.push(status())) });
    exporter.toggle();
    await exporter.settled();
    expect(seen).toContain('Bing is pausing requests. Resuming in 5:00. You can leave this tab in the background.');
    expect(status()).toBe(DONE);
  });

  it('asks before stopping, and reopening goes on where it stopped', async () => {
    let exporter;
    let question = null;
    let closed = false;
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query !== 'how to clean widgets' || question !== null) return undefined;
        exporter.toggle();
        question = root()?.querySelector('.question .ask')?.textContent ?? '';
        root()?.querySelector('.question button')?.click();
        closed = root() === undefined;
        return undefined;
      },
    });
    ({ exporter } = setup({ bing }));
    exporter.toggle();
    await exporter.settled();
    expect(question).toBe('Stop the export? Your progress is kept.');
    expect(closed).toBe(true);
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe(DONE);
    expect(bing.mappingCalls()).toEqual(['blue widgets price', 'how to clean widgets', 'widget history']);
  });

  it('asks the stop question without the promise of kept progress when it can\'t be saved', async () => {
    const store = { ...memoryStore(), async set() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } };
    let exporter;
    let question = null;
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query !== 'how to clean widgets' || question !== null) return undefined;
        exporter.toggle();
        question = root().querySelector('.question .ask').textContent;
        root().querySelectorAll('.question button')[1].click();
        return undefined;
      },
    });
    ({ exporter } = setup({ bing, store }));
    exporter.toggle();
    await exporter.settled();
    expect(question).toBe("Stop the export? Progress can't be saved in this browser.");
    expect(status()).toBe(DONE);
  });

  it('leaves no question on screen when the run finishes with one open', async () => {
    let exporter;
    let opened = false;
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query !== 'how to clean widgets' || opened) return undefined;
        opened = true;
        exporter.toggle();
        return undefined;
      },
    });
    ({ exporter } = setup({ bing }));
    exporter.toggle();
    await exporter.settled();
    expect(opened).toBe(true);
    expect(status()).toBe(DONE);
    expect(root().querySelector('.question').children).toHaveLength(0);
    expect(root().querySelector('.question').hidden).toBe(true);
  });

  it('forgets the saved progress once the files are built, and keeps it when some queries failed', async () => {
    const key = stateKey(SITE, { begin: '2026-04-17', end: '2026-05-16' });
    const done = setup();
    done.exporter.toggle();
    await done.exporter.settled();
    expect(await done.store.get(key)).toBeNull();
    const bing = fakeBing({ intercept: c => (c.body?.Query === 'how to clean widgets' ? reply(429) : undefined) });
    const failed = setup({ bing });
    failed.exporter.toggle();
    await failed.exporter.settled();
    expect(await failed.store.get(key)).not.toBeNull();
  });

  it('says what went wrong when building the files fails, and keeps the saved progress', async () => {
    const key = stateKey(SITE, { begin: '2026-04-17', end: '2026-05-16' });
    const { exporter, store } = setup({
      files: () => {
        throw new Error('boom');
      },
    });
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe('Something went wrong: boom. Your progress is kept.');
    expect(root().querySelector('.status').className).toBe('status error');
    expect(await store.get(key)).not.toBeNull();
  });

  it('says what went wrong before a run exists, without a word about progress', async () => {
    const { exporter } = setup({ store: { ...memoryStore(), get() { throw new Error('disk gone'); } } });
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe('Something went wrong: disk gone.');
  });

  it('says where it resumes from', async () => {
    const store = memoryStore();
    const clock = fakeClock();
    await store.set(stateKey(SITE, { begin: '2026-04-17', end: '2026-05-16' }), {
      version: 1,
      site: SITE,
      range: { begin: '2026-04-17', end: '2026-05-16' },
      savedAt: clock.now(),
      queries: [
        { query: 'blue widgets price', citations: 40, intent: ['Commercial'], topic: ['Widgets'], rate: 0.7 },
        { query: 'how to clean widgets', citations: 12, intent: ['Informational'], topic: ['Care', 'Widgets'], rate: 0.125 },
        { query: 'widget history', citations: 3, intent: [], topic: [], rate: null },
      ],
      pages: [{ url: 'https://example.com/widgets/', citations: 45 }, { url: 'https://example.com/care/', citations: 15 }],
      mapping: [['blue widgets price', [['https://example.com/widgets/', 30]]]],
      failed: [],
    });
    const { exporter, bing } = setup({ store, clock });
    const texts = [];
    exporter.toggle();
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 3) texts.push(node.textContent);
    }).observe(root().querySelector('.status .text'), { childList: true });
    await exporter.settled();
    expect(texts).toContain('Resuming from 1/3…');
    expect(status()).toBe(DONE);
    expect(bing.mappingCalls()).toEqual(['how to clean widgets', 'widget history']);
  });

  it('offers to retry the queries that failed', async () => {
    let blocked = true;
    const bing = fakeBing({ intercept: c => (blocked && c.body?.Query === 'how to clean widgets' ? reply(429) : undefined) });
    const { exporter } = setup({ bing });
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe('3 queries · 2 pages mapped · 1 failed. Download below.');
    expect(labels()).toEqual(['Retry failed', ...FILES]);
    blocked = false;
    action('Retry failed').click();
    await exporter.settled();
    expect(status()).toBe(DONE);
    expect(labels()).toEqual(FILES);
  });

  it('says when progress can\'t be saved', async () => {
    const store = { ...memoryStore(), async set() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } };
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query === 'how to clean widgets') action('Stop and download what I have')?.click();
        return undefined;
      },
    });
    const { exporter } = setup({ bing, store });
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe("Stopped at 2/3. Progress can't be saved in this browser.");
    expect(labels()).toEqual(['Resume', ...FILES]);
  });

  it('says when Bing has no data for the range', async () => {
    const { exporter } = setup({ bing: fakeBing({ queries: [], pages: [] }) });
    exporter.toggle();
    await exporter.settled();
    expect(status()).toBe('Bing has no AI Performance data for this site and range.');
    expect(labels()).toEqual([]);
  });
});
