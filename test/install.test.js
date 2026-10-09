// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { installPage, toBookmarkletUrl } from '../scripts/bookmarklet-url.mjs';
import { buildBookmarklet } from '../scripts/build.mjs';

const parse = html => new JSDOM(html).window.document;
const read = path => readFileSync(`${import.meta.dirname}/../${path}`, 'utf8');

describe('toBookmarkletUrl', () => {
  it('escapes only what a javascript: URL would otherwise corrupt', () => {
    const code = 'a="50%";\tb=`x\ny`;c="a&b<c>";';
    const url = toBookmarkletUrl(code);
    expect(url).toBe('javascript:a="50%25";%09b=`x%0Ay`;c="a&b<c>";');
    expect(decodeURIComponent(url.slice('javascript:'.length))).toBe(code);
  });
});

describe('installPage', () => {
  it('embeds the exact bookmarklet URL in a draggable link', () => {
    const url = toBookmarkletUrl('alert("a&b<c>")');
    expect(parse(installPage(url)).querySelector('a.bm').getAttribute('href')).toBe(url);
  });

  it('names the page and the bookmark, and links the post and the source', () => {
    const doc = parse(installPage('javascript:void 0'));
    expect(doc.title).toBe('Bing AI Performance Exporter');
    expect(doc.querySelector('h1').textContent).toBe('Bing AI Performance Exporter');
    expect(doc.querySelector('a.bm').textContent).toBe('Bing AI Performance Exporter');
    expect([...doc.querySelectorAll('a:not(.bm)')].map(a => a.getAttribute('href'))).toEqual([
      'https://natzir.com/posicionamiento-buscadores/ai-performance-bing-webmaster-tools-export/',
      'https://github.com/natzir/bing-ai-performance-exporter',
    ]);
  });
});

describe('the GitHub Pages copy', () => {
  it('is the install page with the current bookmarklet', async () => {
    expect(read('docs/index.html')).toBe(installPage(await buildBookmarklet()));
  });

  it('is served as it is, without Jekyll', () => {
    expect(existsSync(`${import.meta.dirname}/../docs/.nojekyll`)).toBe(true);
  });
});
