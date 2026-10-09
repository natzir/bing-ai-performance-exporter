// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../extension/manifest.json');
const pkg = read('../package.json');

describe('manifest', () => {
  it('asks only for activeTab and storage, and runs on Bing Webmaster Tools', () => {
    expect(manifest.permissions).toEqual(['activeTab', 'storage', 'unlimitedStorage']);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toEqual([{ matches: ['https://www.bing.com/webmasters/*'], js: ['content.js'], run_at: 'document_idle' }]);
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  it('has the store name, the description and the package\'s version', () => {
    expect(manifest.name).toBe('Bing AI Performance Exporter by Natzir');
    expect(manifest.description).toBe("Export the grounding query ↔ page mapping from Bing Webmaster Tools' AI Performance report to CSV and Excel.");
    expect(manifest.description.length).toBeLessThanOrEqual(132);
    expect(manifest.description).toHaveLength(108);
    expect(manifest.version).toBe('1.0.0');
    expect(pkg.version).toBe(manifest.version);
  });

  it('has no popup, so the icon click reaches the worker', () => {
    expect(manifest.action.default_popup).toBeUndefined();
    expect(manifest.background).toEqual({ service_worker: 'background.js' });
  });

  it('points at icons that exist, and needs Chrome 120', () => {
    for (const path of [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)]) {
      expect(existsSync(new URL(`../extension/${path}`, import.meta.url))).toBe(true);
    }
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe('120');
  });
});
