// A stand-in for Bing Webmaster Tools' AI Performance API as the exporter calls it: the token, the
// queries and pages lists in pages of PageSize, and each query's pages (404 NoDataFound when Bing has
// none). `intercept(call, index)` can answer a call instead — a reply, a rejected promise, a promise
// that never settles — or return undefined to let the fake answer. Sites, queries and numbers are made up.
export const SITE = 'https://example.com/';

export const reply = (status, body = '', headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: name => headers[name.toLowerCase()] ?? null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

export const QUERIES = [
  { GroundingQuery: 'blue widgets price', Citations: 40, Intent: ['Commercial'], TopicClusters: ['Widgets'], CitationRate: 0.7 },
  { GroundingQuery: 'how to clean widgets', Citations: 12, Intent: ['Informational'], TopicClusters: ['Care', 'Widgets'], CitationRate: 0.125 },
  { GroundingQuery: 'widget history', Citations: 3, Intent: [], TopicClusters: [], CitationRate: null },
];

export const PAGES = [
  { PageUrl: 'https://example.com/widgets/', Citations: 45 },
  { PageUrl: 'https://example.com/care/', Citations: 15 },
];

// 'widget history' has no mapping in Bing's sample: Bing answers 404 NoDataFound for it.
export const MAPPING = {
  'blue widgets price': [{ PageUrl: 'https://example.com/widgets/', Citations: 30 }],
  'how to clean widgets': [
    { PageUrl: 'https://example.com/care/', Citations: 8 },
    { PageUrl: 'https://example.com/widgets/', Citations: 2 },
  ],
};

export function fakeBing({ queries = QUERIES, pages = PAGES, mapping = MAPPING, token = 'tok-123', tokenStatus = 200, intercept } = {}) {
  const calls = [];
  const pageOf = (key, list, { PageNum, PageSize }) =>
    reply(200, { [key]: list.slice((PageNum - 1) * PageSize, PageNum * PageSize), TotalNumOfRecords: list.length });

  async function fetch(url, init = {}) {
    const call = { url, init, body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    const custom = intercept?.(call, calls.length - 1);
    if (custom !== undefined) return custom;
    if (url === '/webmasters/auth/token') return reply(tokenStatus, token);
    if (url.endsWith('/searchqueries/stats')) return pageOf('Queries', queries, call.body.Pagination);
    if (url.endsWith('/pages/stats')) {
      if (!call.body.Query) return pageOf('Pages', pages, call.body.Pagination);
      const cited = Object.hasOwn(mapping, call.body.Query) ? mapping[call.body.Query] : null;
      return cited ? pageOf('Pages', cited, call.body.Pagination) : reply(404, '{"ErrorCode":"NoDataFound"}');
    }
    return reply(404, 'Not found');
  }

  return {
    fetch,
    calls,
    mappingCalls: () => calls.filter(c => c.body?.Query).map(c => c.body.Query),
    probes: () => calls.filter(c => c.body?.Pagination?.PageSize === 1).length,
  };
}
