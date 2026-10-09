// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { sheetXml, workbook, xmlText } from '../src/xlsx.js';

const MAPPING = {
  file: 'mapping',
  sheet: 'mapping',
  header: ['query', 'intent', 'topic', 'citation_share', 'page', 'citations'],
  rows: [
    ['blue widgets price', 'Commercial', 'Widgets', 70, 'https://example.com/widgets/', 30],
    ['widgets & "care" <tips>', '', '', '', '', ''],
  ],
};
const PAGES = {
  file: 'pages-summary',
  sheet: 'pages',
  header: ['page', 'total_citations', 'mapped_citations', 'unmapped_citations', 'num_queries_mapped'],
  rows: [['https://example.com/widgets/', 45, 32, 13, 2]],
};

const write = bytes => {
  const path = join(mkdtempSync(join(tmpdir(), 'bing-aip-xlsx-')), 'x.xlsx');
  writeFileSync(path, bytes);
  return path;
};
// unzip treats '[' as a wildcard, so it is escaped to match '[Content_Types].xml' literally.
const part = (path, name) => execFileSync('unzip', ['-p', path, name.replace(/\[/g, '[[]')], { encoding: 'utf8' });
const { DOMParser } = new JSDOM().window;
const wellFormed = xml => new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length === 0;

describe('xmlText', () => {
  it('escapes XML\'s special characters and drops the ones it cannot carry', () => {
    expect(xmlText('a & b < c > "d"')).toBe('a &amp; b &lt; c &gt; &quot;d&quot;');
    expect(xmlText('bad\u0001char\uFFFF')).toBe('badchar');
    expect(xmlText('tab\tok')).toBe('tab\tok');
  });
});

describe('sheetXml', () => {
  it('writes numbers as numbers, text inline, the header bold, frozen and filtered', () => {
    const xml = sheetXml(MAPPING);
    expect(wellFormed(xml)).toBe(true);
    expect(xml).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">query</t></is></c>');
    expect(xml).toContain('<c r="D2"><v>70</v></c>');
    expect(xml).toContain('<c r="F2"><v>30</v></c>');
    expect(xml).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">widgets &amp; &quot;care&quot; &lt;tips&gt;</t></is></c>');
    expect(xml).not.toContain('r="B3"');
    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<autoFilter ref="A1:F3"/>');
  });
});

describe('workbook', () => {
  it('is an .xlsx with one well-formed sheet per table, named after it', () => {
    const path = write(workbook([MAPPING, PAGES], new Date(2026, 4, 17)));
    expect(execFileSync('unzip', ['-t', path], { encoding: 'utf8' })).toContain('No errors detected');
    const names = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).trim().split('\n');
    expect(names).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    for (const name of names) expect(wellFormed(part(path, name))).toBe(true);
    const book = part(path, 'xl/workbook.xml');
    expect(book).toContain('<sheet name="mapping" sheetId="1" r:id="rId1"/>');
    expect(book).toContain('<sheet name="pages" sheetId="2" r:id="rId2"/>');
    expect(book).toContain('<definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">\'pages\'!$A$1:$E$2</definedName>');
    expect(part(path, 'xl/worksheets/sheet2.xml')).toContain('<c r="D2"><v>13</v></c>');
  });
});
