// The export engine. It lists every grounding query and cited page, then asks for each query's pages at
// a pace Bing tolerates: a 45 s pause every 150 queries and, when Bing throttles, a wait and a probe
// until it answers again (after 12 failed probes, about an hour, it pauses for the person). Progress
// lives in `state`, plain data saved every 20 queries and whenever the run ends, so a stop, a reload or
// a closed tab loses nothing. A new start goes on from there and retries the queries that failed.
import { paginate, payload } from './api.js';

export const SAVE_EVERY = 20;
export const COOLDOWN = { every: 150, ms: 45000 };
export const PROBE = { wait: 300000, max: 12 };
export const ATTEMPTS = 3;
export const TTL = 86400000;

export const realClock = {
  now: () => Date.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};

export const stateKey = (site, { begin, end }) => `bing-aip:${site}|${begin}|${end}`;

// The bookmarklet's pace: bigger sites go slower so Bing throttles less.
export function pacing(total) {
  if (total > 500) return { concurrency: 1, gap: 500 };
  if (total > 100) return { concurrency: 2, gap: 300 };
  return { concurrency: 2, gap: 200 };
}

const toQuery = q => ({
  query: q.GroundingQuery,
  citations: q.Citations ?? 0,
  intent: q.Intent ?? [],
  topic: q.TopicClusters ?? [],
  rate: q.CitationRate ?? null,
});
const toPage = p => ({ url: p.PageUrl, citations: p.Citations ?? 0 });

// The saved progress for this site and range, or a fresh start when there is none or it is over a day old.
export async function loadState(store, site, range, now) {
  const saved = await store.get(stateKey(site, range)).catch(() => null);
  if (saved?.version === 1 && now - saved.savedAt < TTL) return saved;
  return { version: 1, site, range: { begin: range.begin, end: range.end }, savedAt: now, queries: null, pages: null, mapping: [], failed: [] };
}

export function createRun({ post, site, range, store, state, clock = realClock, pace, onChange = () => {} }) {
  const key = stateKey(site, range);
  // A Map, not an object: a query called "constructor" or "__proto__" is a query like any other.
  const mapped = new Map(state.mapping);
  let status = 'idle';
  let phase = 'listing';
  let waitUntil = 0;
  let outcome = null;
  let stopRequested = false;
  let throttled = false;
  let cooldownUntil = 0;
  let probes = 0;
  let probing = null;
  let fresh = 0;
  let sinceSave = 0;
  let unsaved = false;
  let running = null;

  const snapshot = () => ({
    status,
    done: mapped.size,
    total: state.queries?.length ?? 0,
    pages: state.pages?.length ?? 0,
    failed: state.failed.length,
    remaining: Math.max(0, waitUntil - clock.now()),
    probes,
    unsaved,
    errorStatus: outcome?.errorStatus,
  });

  const set = (next, until = 0) => {
    status = next;
    waitUntil = until;
    onChange(snapshot());
  };

  async function save() {
    state.mapping = [...mapped];
    state.savedAt = clock.now();
    sinceSave = 0;
    try {
      await store.set(key, state);
      unsaved = false;
    } catch {
      unsaved = true;
    }
  }

  const end = next => {
    outcome ??= next;
  };

  const throttle = wait => {
    throttled = true;
    cooldownUntil = Math.max(cooldownUntil, clock.now() + wait);
  };

  async function probe() {
    set('probing');
    const r = await post('pages/stats', payload(site, range, { size: 1 }));
    if (r.kind === 'throttled') {
      probes += 1;
      if (probes >= PROBE.max) end({ status: 'paused' });
      else cooldownUntil = clock.now() + PROBE.wait;
    } else if (r.kind === 'expired') {
      end({ status: 'expired' });
    } else {
      throttled = false;
      probes = 0;
      set(phase);
    }
  }

  // Waits out a pause or a throttle; while throttled, one lane probes for all. False when the run must
  // end: stopped, paused after too many probes, or the session expired.
  async function gate() {
    for (;;) {
      if (stopRequested || outcome) return false;
      const now = clock.now();
      if (cooldownUntil > now) {
        set(throttled ? 'throttled' : 'cooling', cooldownUntil);
        await clock.sleep(Math.min(1000, cooldownUntil - now));
        continue;
      }
      if (!throttled) return true;
      probing ??= probe().finally(() => {
        probing = null;
      });
      await probing;
    }
  }

  async function list(endpoint, listKey) {
    for (;;) {
      if (!(await gate())) return null;
      const r = await paginate(post, endpoint, listKey, site, range);
      if (r.kind === 'data') return r.items;
      if (r.kind === 'throttled') {
        throttle(r.wait);
        continue;
      }
      end(r.kind === 'expired' ? { status: 'expired' } : { status: 'error', errorStatus: r.status });
      return null;
    }
  }

  async function mapQuery(q) {
    for (let attempt = 1; ; attempt++) {
      if (!(await gate())) return;
      const r = await paginate(post, 'pages/stats', 'Pages', site, range, q.query);
      if (r.kind === 'data') {
        mapped.set(q.query, r.items.map(p => [p.PageUrl, p.Citations ?? 0]));
        fresh += 1;
        sinceSave += 1;
        if (fresh % COOLDOWN.every === 0) cooldownUntil = Math.max(cooldownUntil, clock.now() + COOLDOWN.ms);
        set('mapping');
        if (sinceSave >= SAVE_EVERY) await save();
        return;
      }
      if (r.kind === 'throttled') {
        throttle(r.wait);
        if (attempt < ATTEMPTS) continue;
      } else if (r.kind === 'expired') {
        end({ status: 'expired' });
        return;
      }
      state.failed.push(q.query);
      set('mapping');
      return;
    }
  }

  async function pool(items, { concurrency, gap }) {
    let next = 0;
    const lane = async () => {
      while (next < items.length && !stopRequested && !outcome) {
        await mapQuery(items[next++]);
        if (gap && next < items.length) await clock.sleep(gap);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, lane));
  }

  async function go() {
    stopRequested = false;
    outcome = null;
    throttled = false;
    cooldownUntil = 0;
    probes = 0;
    fresh = 0;
    state.failed = [];
    phase = 'listing';
    set('listing');
    if (!state.queries) {
      const items = await list('searchqueries/stats', 'Queries');
      if (items) {
        state.queries = items.map(toQuery);
        await save();
      }
    }
    if (state.queries && !state.pages) {
      const items = await list('pages/stats', 'Pages');
      if (items) {
        state.pages = items.map(toPage);
        await save();
      }
    }
    if (state.queries && state.pages && !stopRequested && !outcome) {
      phase = 'mapping';
      set('mapping');
      const todo = state.queries.filter(q => !mapped.has(q.query));
      await pool(todo, pace ?? pacing(state.queries.length));
    }
    const complete = Boolean(state.queries && state.pages) && !stopRequested && !outcome;
    if (complete && state.failed.length === 0) await store.remove(key).catch(() => {});
    else await save();
    set(stopRequested ? 'stopped' : (outcome?.status ?? 'done'));
    return snapshot();
  }

  return {
    state,
    start() {
      running ??= go().finally(() => {
        running = null;
      });
      return running;
    },
    stop() {
      stopRequested = true;
    },
    get running() {
      return running !== null;
    },
    finished: () => running ?? Promise.resolve(),
    snapshot,
    result: () => ({ queries: state.queries, pages: state.pages, mapping: new Map(mapped), failed: [...state.failed] }),
  };
}
