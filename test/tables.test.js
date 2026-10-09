import { describe, it, expect } from 'vitest';
import { share, tables } from '../src/tables.js';

const QUERIES = [
  { query: 'blue widgets price', citations: 40, intent: ['Commercial'], topic: ['Widgets'], rate: 0.7 },
  { query: 'how to clean widgets', citations: 12, intent: ['Informational'], topic: ['Care', 'Widgets'], rate: 0.125 },
  { query: 'widget history', citations: 3, intent: [], topic: [], rate: null },
];
const PAGES = [
  { url: 'https://example.com/widgets/', citations: 45 },
  { url: 'https://example.com/care/', citations: 15 },
];
const MAPPING = new Map([
  ['blue widgets price', [['https://example.com/widgets/', 30]]],
  ['how to clean widgets', [['https://example.com/care/', 8], ['https://example.com/widgets/', 2]]],
  ['widget history', []],
]);

describe('share', () => {
  it('is the citation rate as a percentage with up to two decimals, or empty', () => {
    expect(share(0.7)).toBe(70);
    expect(share(0.125)).toBe(12.5);
    expect(share(0.33333)).toBe(33.33);
    expect(share(null)).toBe('');
  });
});

describe('tables', () => {
  it('builds the post\'s three tables, with its columns', () => {
    const [mapping, queries, pages] = tables({ queries: QUERIES, pages: PAGES, mapping: MAPPING, failed: [] });
    expect(mapping).toEqual({
      file: 'mapping',
      sheet: 'mapping',
      header: ['query', 'intent', 'topic', 'citation_share', 'page', 'citations'],
      rows: [
        ['blue widgets price', 'Commercial', 'Widgets', 70, 'https://example.com/widgets/', 30],
        ['how to clean widgets', 'Informational', 'Care; Widgets', 12.5, 'https://example.com/care/', 8],
        ['how to clean widgets', 'Informational', 'Care; Widgets', 12.5, 'https://example.com/widgets/', 2],
        ['widget history', '', '', '', '', ''],
      ],
    });
    expect(queries).toEqual({
      file: 'queries-summary',
      sheet: 'queries',
      header: ['query', 'intent', 'topic', 'citation_share', 'total_citations', 'mapped_citations', 'num_pages_mapped'],
      rows: [
        ['blue widgets price', 'Commercial', 'Widgets', 70, 40, 30, 1],
        ['how to clean widgets', 'Informational', 'Care; Widgets', 12.5, 12, 10, 2],
        ['widget history', '', '', '', 3, 0, 0],
      ],
    });
    expect(pages).toEqual({
      file: 'pages-summary',
      sheet: 'pages',
      header: ['page', 'total_citations', 'mapped_citations', 'unmapped_citations', 'num_queries_mapped'],
      rows: [
        ['https://example.com/widgets/', 45, 32, 13, 2],
        ['https://example.com/care/', 15, 8, 7, 1],
      ],
    });
  });

  it('leaves a query that wasn\'t fetched out of the mapping, and its mapped columns empty', () => {
    const partial = new Map([...MAPPING].filter(([q]) => q !== 'how to clean widgets'));
    const [mapping, queries, pages] = tables({ queries: QUERIES, pages: PAGES, mapping: partial, failed: ['how to clean widgets'] });
    expect(mapping.rows.map(r => r[0])).toEqual(['blue widgets price', 'widget history']);
    expect(queries.rows[1]).toEqual(['how to clean widgets', 'Informational', 'Care; Widgets', 12.5, 12, '', '']);
    expect(pages.rows).toEqual([
      ['https://example.com/widgets/', 45, 30, 15, 1],
      ['https://example.com/care/', 15, 0, 15, 0],
    ]);
  });
});
