import { describe, it, expect } from 'vitest';
import { SessionExpired, WAIT, classify, client, getToken, paginate, payload } from '../src/api.js';
import { SITE, fakeBing, reply } from './helpers/bing.js';

const RANGE = { begin: '2026-04-17', end: '2026-05-17' };

describe('getToken', () => {
  it('reads the token the page uses', async () => {
    expect(await getToken(fakeBing({ token: '  tok-123\n' }).fetch)).toBe('tok-123');
  });

  it('says the session expired on 401, 403, a login page or an empty answer', async () => {
    const answers = [
      fakeBing({ tokenStatus: 401 }),
      fakeBing({ tokenStatus: 403 }),
      fakeBing({ token: '<!doctype html><title>Sign in</title>' }),
      fakeBing({ token: '' }),
      fakeBing({ intercept: () => Promise.reject(new TypeError('Failed to fetch')) }),
    ];
    for (const bing of answers) await expect(getToken(bing.fetch)).rejects.toBeInstanceOf(SessionExpired);
  });

  it('gives up on a token request that never answers', async () => {
    const bing = fakeBing({ intercept: () => new Promise(() => {}) });
    await expect(getToken(bing.fetch, { timeout: 5 })).rejects.toBeInstanceOf(SessionExpired);
  });
});

describe('classify', () => {
  it('reads a 404 NoDataFound as none even when the body also has throttle words', () => {
    expect(classify(404, `{"ErrorCode":"NoDataFound","Message":"We're sorry"}`, null)).toEqual({ kind: 'none' });
  });

  it('sorts every answer as the bookmarklet did', () => {
    expect(classify(200, '{"Queries":[]}', null)).toEqual({ kind: 'data', data: { Queries: [] } });
    expect(classify(404, '{"ErrorCode":"NoDataFound"}', null)).toEqual({ kind: 'none' });
    expect(classify(429, '', '600')).toEqual({ kind: 'throttled', wait: 600000 });
    expect(classify(429, '', '30')).toEqual({ kind: 'throttled', wait: WAIT.throttled });
    expect(classify(429, '', null)).toEqual({ kind: 'throttled', wait: WAIT.throttled });
    expect(classify(200, '{"Message":"Too many requests"}', null)).toEqual({ kind: 'throttled', wait: WAIT.throttled });
    expect(classify(503, "We're sorry", null)).toEqual({ kind: 'throttled', wait: WAIT.throttled });
    expect(classify(200, '<html>', null)).toEqual({ kind: 'throttled', wait: WAIT.throttled });
    expect(classify(502, 'Bad gateway', null)).toEqual({ kind: 'throttled', wait: WAIT.server });
    expect(classify(401, '', null)).toEqual({ kind: 'expired' });
    expect(classify(403, '', null)).toEqual({ kind: 'expired' });
    expect(classify(400, 'Bad request', null)).toEqual({ kind: 'error', status: 400 });
    expect(classify(404, 'Not found', null)).toEqual({ kind: 'error', status: 404 });
  });

  it('reads a list whose data mentions too many requests as data, not as throttling', () => {
    expect(classify(200, JSON.stringify({ Queries: [{ GroundingQuery: '429 too many requests' }], TotalNumOfRecords: 1 }), null))
      .toEqual({ kind: 'data', data: { Queries: [{ GroundingQuery: '429 too many requests' }], TotalNumOfRecords: 1 } });
    expect(classify(200, JSON.stringify({ Pages: [{ PageUrl: "https://example.com/?q=We're sorry", Citations: 1 }], TotalNumOfRecords: 1 }), null).kind)
      .toBe('data');
  });
});

describe('payload', () => {
  it('is the body the report itself sends', () => {
    expect(payload(SITE, RANGE, { page: 2, query: 'blue widgets price' })).toEqual({
      SiteUrl: 'https://example.com/',
      DateRange: { BeginTimeStamp: 'Fri, 17 Apr 2026 00:00:00 GMT', EndTimeStamp: 'Sun, 17 May 2026 00:00:00 GMT' },
      Pagination: { PageNum: 2, PageSize: 200 },
      SortParameters: { SortField: 'Citations', SortOrder: 'Desc' },
      AIFilterKeyword: '',
      Query: 'blue widgets price',
      Page: '',
    });
    expect(payload(SITE, RANGE).Pagination).toEqual({ PageNum: 1, PageSize: 200 });
    expect(payload(SITE, RANGE, { size: 1 }).Pagination).toEqual({ PageNum: 1, PageSize: 1 });
  });
});

describe('client', () => {
  it('posts JSON with the token and the session, same origin', async () => {
    const bing = fakeBing();
    const post = client(bing.fetch, 'tok-123');
    expect((await post('pages/stats', payload(SITE, RANGE))).kind).toBe('data');
    const call = bing.calls.at(-1);
    expect(call.url).toBe('/webmasters/api/aiperformance/pages/stats');
    expect(call.init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json;charset=UTF-8', 'x-csrf-token': 'tok-123', accept: 'application/json' },
    });
    expect(call.body.SiteUrl).toBe(SITE);
  });

  it('reads a network error as throttling', async () => {
    const post = client(fakeBing({ intercept: () => Promise.reject(new TypeError('Failed to fetch')) }).fetch, 'tok');
    expect(await post('pages/stats', {})).toEqual({ kind: 'throttled', wait: WAIT.throttled });
  });

  it('gives up on an answer that takes too long, as throttling', async () => {
    const hang = call =>
      new Promise((_, reject) => call.init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    const post = client(fakeBing({ intercept: hang }).fetch, 'tok', { timeout: 5 });
    expect(await post('pages/stats', {})).toEqual({ kind: 'throttled', wait: WAIT.throttled });
  });
});

describe('paginate', () => {
  it('asks page after page of 200 until it has them all', async () => {
    const queries = Array.from({ length: 450 }, (_, i) => ({ GroundingQuery: `query ${i}`, Citations: 1 }));
    const bing = fakeBing({ queries });
    const r = await paginate(client(bing.fetch, 'tok'), 'searchqueries/stats', 'Queries', SITE, RANGE);
    expect(r.kind).toBe('data');
    expect(r.items).toHaveLength(450);
    expect(bing.calls.map(c => c.body.Pagination.PageNum)).toEqual([1, 2, 3]);
  });

  it('stops at a short page even when the total says more', async () => {
    const bing = fakeBing({ intercept: () => reply(200, { Pages: [{ PageUrl: 'https://example.com/', Citations: 1 }], TotalNumOfRecords: 999 }) });
    const r = await paginate(client(bing.fetch, 'tok'), 'pages/stats', 'Pages', SITE, RANGE);
    expect(r.items).toHaveLength(1);
    expect(bing.calls).toHaveLength(1);
  });

  it('asks for one query\'s pages, and reads NoDataFound as none', async () => {
    const bing = fakeBing();
    const post = client(bing.fetch, 'tok');
    const cited = await paginate(post, 'pages/stats', 'Pages', SITE, RANGE, 'how to clean widgets');
    expect(cited.items.map(p => p.PageUrl)).toEqual(['https://example.com/care/', 'https://example.com/widgets/']);
    expect(bing.calls.at(-1).body.Query).toBe('how to clean widgets');
    expect(await paginate(post, 'pages/stats', 'Pages', SITE, RANGE, 'widget history')).toEqual({ kind: 'data', items: [] });
  });

  it('hands back a throttle or an error from any page', async () => {
    const queries = Array.from({ length: 250 }, (_, i) => ({ GroundingQuery: `query ${i}`, Citations: 1 }));
    const throttled = fakeBing({ queries, intercept: c => (c.body?.Pagination.PageNum === 2 ? reply(429) : undefined) });
    expect(await paginate(client(throttled.fetch, 'tok'), 'searchqueries/stats', 'Queries', SITE, RANGE))
      .toMatchObject({ kind: 'throttled', wait: WAIT.throttled, page: 2 });
    const broken = fakeBing({ intercept: () => reply(400, 'Bad request') });
    const first = await paginate(client(throttled.fetch, 'tok'), 'searchqueries/stats', 'Queries', SITE, RANGE);
    expect(first.items).toHaveLength(200);
    const again = fakeBing({ queries });
    const rest = await paginate(client(again.fetch, 'tok'), 'searchqueries/stats', 'Queries', SITE, RANGE, '', { from: first.page, items: first.items });
    expect([rest.kind, rest.items.length, again.calls.length]).toEqual(['data', 250, 1]);
    expect(await paginate(client(broken.fetch, 'tok'), 'pages/stats', 'Pages', SITE, RANGE)).toEqual({ kind: 'error', status: 400 });
  });
});
