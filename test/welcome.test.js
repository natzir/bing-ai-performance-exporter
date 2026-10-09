import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const file = name => `${import.meta.dirname}/../extension/${name}`;
const doc = new DOMParser().parseFromString(readFileSync(file('welcome.html'), 'utf8'), 'text/html');
const text = doc.body.textContent.replace(/\s+/g, ' ');

describe('welcome page', () => {
  it('says what to pin by the store name, and how to export', () => {
    expect(text).toContain('“Bing AI Performance Exporter by Natzir”');
    expect(text).toContain('Open AI Performance in Bing Webmaster Tools');
    expect(text).toContain('Nothing is sent anywhere');
  });

  it('links the post and GitHub', () => {
    expect([...doc.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual([
      'https://natzir.com/posicionamiento-buscadores/ai-performance-bing-webmaster-tools-export/',
      'https://github.com/natzir/bing-ai-performance-exporter#readme',
    ]);
  });

  it('loads only files the extension has, and no script', () => {
    const local = [...doc.querySelectorAll('link[href], img[src]')].map(el => el.getAttribute('href') ?? el.getAttribute('src'));
    expect(local).toEqual(['tokens.css', 'welcome.css', 'icons/32.png']);
    for (const name of local) expect(existsSync(file(name))).toBe(true);
    expect(doc.querySelector('script')).toBeNull();
  });
});
