import { describe, it, expect } from 'vitest';
import { client } from '../src/api.js';
import { TTL, createRun, loadState, pacing, stateKey } from '../src/run.js';
import { memoryStore } from '../src/store.js';
import { SITE, fakeBing, reply } from './helpers/bing.js';
import { fakeClock } from './helpers/clock.js';

const RANGE = { begin: '2026-04-17', end: '2026-05-17' };
const KEY = stateKey(SITE, RANGE);

async function setup({ bing = fakeBing(), store = memoryStore(), clock = fakeClock(), pace } = {}) {
  const snapshots = [];
  const state = await loadState(store, SITE, RANGE, clock.now());
  const run = createRun({ post: client(bing.fetch, 'tok'), site: SITE, range: RANGE, store, state, clock, pace, onChange: s => snapshots.push(s) });
  return { bing, store, clock, run, snapshots };
}

const many = n =>
  Array.from({ length: n }, (_, i) => ({ GroundingQuery: `query ${i}`, Citations: 1, Intent: [], TopicClusters: [], CitationRate: 0.5 }));

describe('a run', () => {
  it('maps every query to the pages it cited, then forgets the saved progress', async () => {
    const { run, store } = await setup();
    expect(await run.start()).toMatchObject({ status: 'done', done: 3, total: 3, pages: 2, failed: 0 });
    expect(Object.fromEntries(run.result().mapping)).toEqual({
      'blue widgets price': [['https://example.com/widgets/', 30]],
      'how to clean widgets': [['https://example.com/care/', 8], ['https://example.com/widgets/', 2]],
      'widget history': [],
    });
    expect(run.result().queries[1]).toEqual({ query: 'how to clean widgets', citations: 12, intent: ['Informational'], topic: ['Care', 'Widgets'], rate: 0.125 });
    expect(run.result().pages).toEqual([{ url: 'https://example.com/widgets/', citations: 45 }, { url: 'https://example.com/care/', citations: 15 }]);
    expect(await store.get(KEY)).toBeNull();
  });

  it('paces itself by the size of the site', () => {
    expect(pacing(100)).toEqual({ concurrency: 2, gap: 200 });
    expect(pacing(101)).toEqual({ concurrency: 2, gap: 300 });
    expect(pacing(500)).toEqual({ concurrency: 2, gap: 300 });
    expect(pacing(501)).toEqual({ concurrency: 1, gap: 500 });
  });

  it('pauses 45 s after every 150 queries, but not after the last one', async () => {
    const pauses = snapshots => snapshots.filter((s, i) => s.status === 'cooling' && snapshots[i - 1]?.status !== 'cooling').length;
    const pace = { concurrency: 1, gap: 0 };
    const big = await setup({ bing: fakeBing({ queries: many(310), mapping: {} }), pace });
    expect((await big.run.start()).done).toBe(310);
    expect(pauses(big.snapshots)).toBe(2);
    expect(big.clock.elapsed).toBeGreaterThanOrEqual(90000);
    const exact = await setup({ bing: fakeBing({ queries: many(150), mapping: {} }), pace });
    await exact.run.start();
    expect(pauses(exact.snapshots)).toBe(0);
  });

  it('waits as long as Bing asks, probes, and goes on', async () => {
    let once = true;
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query !== 'how to clean widgets' || !once) return undefined;
        once = false;
        return reply(429, '', { 'retry-after': '600' });
      },
    });
    const { run, clock, snapshots } = await setup({ bing });
    expect(await run.start()).toMatchObject({ status: 'done', done: 3, failed: 0 });
    expect(clock.elapsed).toBeGreaterThanOrEqual(600000);
    expect(bing.probes()).toBe(1);
    expect(snapshots.some(s => s.status === 'throttled' && s.remaining === 600000)).toBe(true);
    expect(snapshots.some(s => s.status === 'probing')).toBe(true);
  });

  it('waits a minute after a server error', async () => {
    let once = true;
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query !== 'widget history' || !once) return undefined;
        once = false;
        return reply(502, 'Bad gateway');
      },
    });
    const { run, snapshots } = await setup({ bing });
    expect(await run.start()).toMatchObject({ status: 'done', done: 3 });
    expect(snapshots.some(s => s.status === 'throttled' && s.remaining === 60000)).toBe(true);
  });

  it('pauses for the person after 12 failed probes, about an hour, keeping everything', async () => {
    const bing = fakeBing({ intercept: c => (c.body?.Query || c.body?.Pagination.PageSize === 1 ? reply(429) : undefined) });
    const { run, store, clock } = await setup({ bing });
    expect((await run.start()).status).toBe('paused');
    expect(bing.probes()).toBe(12);
    expect(clock.elapsed).toBeGreaterThanOrEqual(12 * 300000);
    expect((await store.get(KEY)).queries).toHaveLength(3);
  });

  it('marks a query failed after three throttles in a row, and a new start retries only that one', async () => {
    let blocked = true;
    const bing = fakeBing({ intercept: c => (blocked && c.body?.Query === 'how to clean widgets' ? reply(429) : undefined) });
    const { run, store } = await setup({ bing });
    expect(await run.start()).toMatchObject({ status: 'done', done: 2, failed: 1 });
    expect(run.result().failed).toEqual(['how to clean widgets']);
    expect((await store.get(KEY)).failed).toEqual(['how to clean widgets']);
    blocked = false;
    const before = bing.mappingCalls().length;
    expect(await run.start()).toMatchObject({ status: 'done', done: 3, failed: 0 });
    expect(bing.mappingCalls().slice(before)).toEqual(['how to clean widgets']);
    expect(await store.get(KEY)).toBeNull();
  });

  it('marks a query failed when Bing answers it with an error, and goes on', async () => {
    const bing = fakeBing({ intercept: c => (c.body?.Query === 'widget history' ? reply(400, 'Bad request') : undefined) });
    const { run } = await setup({ bing });
    expect(await run.start()).toMatchObject({ status: 'done', done: 2, failed: 1 });
  });

  it('stops when asked, keeps what it has, and a new run goes on from there', async () => {
    const store = memoryStore();
    let run;
    const bing = fakeBing({
      intercept: c => {
        if (c.body?.Query === 'how to clean widgets') run.stop();
        return undefined;
      },
    });
    ({ run } = await setup({ bing, store }));
    expect(await run.start()).toMatchObject({ status: 'stopped', done: 2 });
    const next = await setup({ store });
    expect(await next.run.start()).toMatchObject({ status: 'done', done: 3 });
    expect(next.bing.mappingCalls()).toEqual(['widget history']);
    expect(next.bing.calls.some(c => c.url.endsWith('/searchqueries/stats'))).toBe(false);
  });

  it('starts afresh when the saved progress is over a day old', async () => {
    const store = memoryStore();
    const now = fakeClock().now();
    const saved = { version: 1, site: SITE, range: RANGE, savedAt: now - TTL - 1, queries: [], pages: [], mapping: [], failed: [] };
    await store.set(KEY, saved);
    expect((await loadState(store, SITE, RANGE, now)).queries).toBeNull();
    await store.set(KEY, { ...saved, savedAt: now - 1000 });
    expect((await loadState(store, SITE, RANGE, now)).queries).toEqual([]);
  });

  it('ends with the session expired when Bing answers 401, keeping its progress', async () => {
    const bing = fakeBing({ intercept: c => (c.body?.Query === 'how to clean widgets' ? reply(401) : undefined) });
    const { run, store } = await setup({ bing });
    expect((await run.start()).status).toBe('expired');
    expect(await store.get(KEY)).not.toBeNull();
  });

  it('ends with the error when a list fails', async () => {
    const bing = fakeBing({ intercept: c => (c.url.endsWith('/searchqueries/stats') ? reply(400, 'Bad request') : undefined) });
    const { run } = await setup({ bing });
    expect(await run.start()).toMatchObject({ status: 'error', errorStatus: 400 });
  });

  it('handles queries named like object keys', async () => {
    const names = ['constructor', '__proto__', 'toString'];
    const queries = names.map(q => ({ GroundingQuery: q, Citations: 1, Intent: [], TopicClusters: [], CitationRate: 0.1 }));
    const mapping = Object.fromEntries(names.map(q => [q, [{ PageUrl: `https://example.com/${q}`, Citations: 1 }]]));
    const { run } = await setup({ bing: fakeBing({ queries, mapping }) });
    expect(await run.start()).toMatchObject({ status: 'done', done: 3, failed: 0 });
    expect([...run.result().mapping.keys()].sort()).toEqual([...names].sort());
  });

  it('goes on when the browser refuses to save, and says so', async () => {
    const store = { ...memoryStore(), async set() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } };
    const { run } = await setup({ store });
    expect(await run.start()).toMatchObject({ status: 'done', done: 3, unsaved: true });
  });
});
