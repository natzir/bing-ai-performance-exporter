// @vitest-environment node
// The built bookmarklet, run as a bookmark would run it: in the page, against the fake Bing API.
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildBookmarklet } from '../scripts/build.mjs';
import { SITE, fakeBing } from './helpers/bing.js';

const REPORT_URL = `https://www.bing.com/webmasters/aiperformance?siteUrl=${encodeURIComponent(SITE)}`;

async function until(check, ms = 10000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

describe('bookmarklet', () => {
  it('is a javascript: URL small enough for a bookmark', async () => {
    const url = await buildBookmarklet();
    expect(url.startsWith('javascript:')).toBe(true);
    expect(url.length).toBeLessThan(60 * 1024);
  });

  it('exports on the AI Performance page, and the next click closes its panel', async () => {
    const code = decodeURIComponent((await buildBookmarklet()).slice('javascript:'.length));
    const dom = new JSDOM('<!doctype html><body><div role="tab" aria-selected="true">30 D</div></body>', {
      url: REPORT_URL,
      runScripts: 'outside-only',
    });
    const bing = fakeBing();
    Object.assign(dom.window, { fetch: bing.fetch, TextEncoder });
    dom.window.URL.createObjectURL = () => 'blob:x';
    dom.window.URL.revokeObjectURL = () => {};
    const text = () => dom.window.document.querySelector('[data-bing-aip]')?.shadowRoot.querySelector('.status .text').textContent;

    dom.window.eval(code);
    await until(() => text()?.endsWith('Download below.'));
    expect(text()).toBe('3 queries · 2 pages mapped. Download below.');
    expect(dom.window.localStorage.length).toBe(0);

    dom.window.eval(code);
    expect(dom.window.document.querySelector('[data-bing-aip]')).toBeNull();
  });
});
