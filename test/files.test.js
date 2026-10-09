// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MIME, exportFiles, hostOf, prefix } from '../src/files.js';

const RANGE = { begin: '2026-04-17', end: '2026-05-17' };
const RESULT = {
  queries: [{ query: 'blue widgets price', citations: 40, intent: ['Commercial'], topic: ['Widgets'], rate: 0.125 }],
  pages: [{ url: 'https://example.com/widgets/', citations: 45 }],
  mapping: new Map([['blue widgets price', [['https://example.com/widgets/', 30]]]]),
  failed: [],
};

describe('prefix', () => {
  it('names files after the site\'s host, whatever siteUrl looks like', () => {
    expect(prefix('https://example.com/', RANGE)).toBe('bing-aip_example-com_2026-04-17_2026-05-17');
    expect(prefix('https://Shop.Example.com/blog/', RANGE)).toBe('bing-aip_shop-example-com_2026-04-17_2026-05-17');
    expect(prefix('example.com', RANGE)).toBe('bing-aip_example-com_2026-04-17_2026-05-17');
    expect(prefix('not a url!', RANGE)).toBe('bing-aip_not-a-url-_2026-04-17_2026-05-17');
    expect(hostOf('https://example.com/blog/')).toBe('example.com');
    expect(hostOf('not a url!')).toBe('not a url!');
  });
});

describe('exportFiles', () => {
  it('gives three CSVs in the language\'s format, a ZIP of them and an Excel workbook', () => {
    const files = exportFiles(RESULT, 'https://example.com/', RANGE, 'es-ES', new Date(2026, 4, 17));
    expect(files.csvs.map(f => [f.name, f.label, f.type])).toEqual([
      ['bing-aip_example-com_2026-04-17_2026-05-17_mapping.csv', 'mapping.csv', MIME.csv],
      ['bing-aip_example-com_2026-04-17_2026-05-17_queries-summary.csv', 'queries-summary.csv', MIME.csv],
      ['bing-aip_example-com_2026-04-17_2026-05-17_pages-summary.csv', 'pages-summary.csv', MIME.csv],
    ]);
    expect(files.csvs[0].data).toContain('blue widgets price;Commercial;Widgets;12,5;https://example.com/widgets/;30');
    expect([files.zip.name, files.zip.type]).toEqual(['bing-aip_example-com_2026-04-17_2026-05-17.zip', 'application/zip']);
    expect([files.xlsx.name, files.xlsx.type]).toEqual([
      'bing-aip_example-com_2026-04-17_2026-05-17.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    expect([...files.zip.data.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...files.xlsx.data.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});
