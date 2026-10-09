import { describe, it, expect } from 'vitest';
import { separators, toCsv } from '../src/csv.js';

const BOM = '\uFEFF';

const TABLE = {
  file: 'mapping',
  sheet: 'mapping',
  header: ['query', 'intent', 'topic', 'citation_share', 'page', 'citations'],
  rows: [
    ['how to clean widgets', 'Informational', 'Care; Widgets', 12.5, 'https://example.com/care/', 8],
    ['widget history', '', '', '', '', ''],
  ],
};

describe('separators', () => {
  it('follows how the language writes decimals', () => {
    expect(separators('en-US')).toEqual({ column: ',', decimal: '.' });
    expect(separators('es-ES')).toEqual({ column: ';', decimal: ',' });
    expect(separators('de')).toEqual({ column: ';', decimal: ',' });
    expect(separators('de-CH')).toEqual({ column: ',', decimal: '.' });
    expect(separators('not a language')).toEqual({ column: ',', decimal: '.' });
  });
});

describe('toCsv', () => {
  it('writes UTF-8 with a BOM and CRLF lines, in English', () => {
    expect(toCsv(TABLE, 'en-US')).toBe(
      BOM + 'query,intent,topic,citation_share,page,citations\r\n' +
        'how to clean widgets,Informational,Care; Widgets,12.5,https://example.com/care/,8\r\n' +
        'widget history,,,,,\r\n',
    );
  });

  it('uses semicolons and decimal commas in Spanish, quoting what holds a semicolon', () => {
    expect(toCsv(TABLE, 'es-ES')).toBe(
      BOM + 'query;intent;topic;citation_share;page;citations\r\n' +
        'how to clean widgets;Informational;"Care; Widgets";12,5;https://example.com/care/;8\r\n' +
        'widget history;;;;;\r\n',
    );
  });

  it('keeps every cell whole and safe in Spanish', () => {
    const table = {
      header: ['query', 'citations'],
      rows: [
        ['=HYPERLINK("x")', 1],
        ['+500 euros', 2],
        ['-5 degrees', -3],
        ['@home', 4],
        ['say "hi"; then go', 5],
        ['two\nlines', 6],
      ],
    };
    expect(toCsv(table, 'es').split('\r\n').slice(1, -1)).toEqual([
      '"\'=HYPERLINK(""x"")";1',
      "'+500 euros;2",
      "'-5 degrees;-3",
      "'@home;4",
      '"say ""hi""; then go";5',
      '"two\nlines";6',
    ]);
  });
});
