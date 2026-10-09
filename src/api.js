// Bing Webmaster Tools' AI Performance API, called as the report itself calls it: same origin, the
// person's session, a CSRF token. Every answer is sorted into data, no data, throttled, session expired
// or error, following what the bookmarklet learned from Bing.
import { apiDateRange } from './range.js';

export const API = '/webmasters/api/aiperformance/';
export const TOKEN_URL = '/webmasters/auth/token';
export const PAGE_SIZE = 200;
export const TIMEOUT = 45000;
export const WAIT = { throttled: 300000, server: 60000 };

// Bing sometimes throttles with a 200 or a 503 whose body says so, instead of a 429.
const THROTTLE_TEXT = /too many requests|We're sorry/i;

export class SessionExpired extends Error {
  constructor() {
    super('Your Bing session has expired.');
    this.name = 'SessionExpired';
  }
}

// The CSRF token, as text. A login page, an error or no answer at all means there is no session to use.
export async function getToken(fetchFn) {
  let text;
  let ok;
  try {
    const r = await fetchFn(TOKEN_URL, { credentials: 'include' });
    ok = r.ok;
    text = (await r.text()).trim();
  } catch {
    throw new SessionExpired();
  }
  if (!ok || !text || text.length > 1000 || /[\s<>]/.test(text)) throw new SessionExpired();
  return text;
}

export function classify(status, text, retryAfter) {
  const asked = (Number.parseInt(retryAfter ?? '', 10) || 0) * 1000;
  if (status >= 200 && status < 300) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { kind: 'throttled', wait: WAIT.throttled };
    }
    // A list answer is data even if a query or page in it mentions the throttle text.
    if (data && typeof data === 'object' && 'TotalNumOfRecords' in data) return { kind: 'data', data };
    if (THROTTLE_TEXT.test(text)) return { kind: 'throttled', wait: WAIT.throttled };
    return { kind: 'data', data };
  }
  if (status === 429 || THROTTLE_TEXT.test(text)) return { kind: 'throttled', wait: Math.max(asked, WAIT.throttled) };
  if (status === 404 && text.includes('NoDataFound')) return { kind: 'none' };
  if (status >= 500) return { kind: 'throttled', wait: WAIT.server };
  if (status === 401 || status === 403) return { kind: 'expired' };
  return { kind: 'error', status };
}

// post(endpoint, body) for one session. A network error or an answer slower than `timeout` reads as
// throttling, as in the bookmarklet: both usually mean Bing is shedding load.
export function client(fetchFn, token, { timeout = TIMEOUT } = {}) {
  return async function post(endpoint, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const r = await fetchFn(API + endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json;charset=UTF-8', 'x-csrf-token': token, accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await r.text();
      return classify(r.status, text, r.headers.get('retry-after'));
    } catch {
      return { kind: 'throttled', wait: WAIT.throttled };
    } finally {
      clearTimeout(timer);
    }
  };
}

export const payload = (site, range, { page = 1, size = PAGE_SIZE, query = '' } = {}) => ({
  SiteUrl: site,
  DateRange: apiDateRange(range),
  Pagination: { PageNum: page, PageSize: size },
  SortParameters: { SortField: 'Citations', SortOrder: 'Desc' },
  AIFilterKeyword: '',
  Query: query,
  Page: '',
});

// Every item of a list, page after page, until the total is reached or a page comes back short. With
// `query`, the pages cited for that query; no data is an empty list.
export async function paginate(post, endpoint, listKey, site, range, query = '') {
  const items = [];
  for (let page = 1; ; page++) {
    const r = await post(endpoint, payload(site, range, { page, query }));
    if (r.kind === 'none') break;
    if (r.kind !== 'data') return r;
    const batch = r.data?.[listKey] ?? [];
    items.push(...batch);
    if (items.length >= (r.data?.TotalNumOfRecords ?? 0) || batch.length < PAGE_SIZE) break;
  }
  return { kind: 'data', items };
}
