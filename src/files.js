// The files of an export: the three CSVs (each alone, and together in a ZIP) and one Excel workbook,
// named after the site's host and the range: bing-aip_example-com_2026-04-17_2026-05-17_mapping.csv.
import { toCsv } from './csv.js';
import { tables } from './tables.js';
import { workbook } from './xlsx.js';
import { zip } from './zip.js';

export const MIME = {
  csv: 'text/csv;charset=utf-8',
  zip: 'application/zip',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// The host of a siteUrl ("https://example.com/blog/" → "example.com"), or the siteUrl itself when it
// isn't a URL.
export function hostOf(site) {
  try {
    return new URL(site).hostname;
  } catch {
    return site;
  }
}

export const prefix = (site, { begin, end }) =>
  `bing-aip_${hostOf(site).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}_${begin}_${end}`;

export function exportFiles(result, site, range, lang, date = new Date()) {
  const name = prefix(site, range);
  const all = tables(result);
  const csvs = all.map(t => ({ name: `${name}_${t.file}.csv`, label: `${t.file}.csv`, data: toCsv(t, lang), type: MIME.csv }));
  return {
    csvs,
    zip: { name: `${name}.zip`, data: zip(csvs.map(c => ({ name: c.name, data: c.data })), date), type: MIME.zip },
    xlsx: { name: `${name}.xlsx`, data: workbook(all, date), type: MIME.xlsx },
  };
}
