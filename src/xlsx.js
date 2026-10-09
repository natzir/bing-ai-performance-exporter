// An .xlsx workbook written by hand on top of zip.js: one sheet per table, text as inline strings,
// numbers as numbers, the header row bold, frozen and filtered. No library, so the bookmarklet stays small.
import { zip } from './zip.js';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DOC_RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// XML 1.0 can't carry control characters, U+FFFE/U+FFFF or lone surrogates: they are dropped.
// The five special characters are escaped.
export const xmlText = value =>
  String(value)
    .replace(/[^\t\n\r\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// A–Z is enough: the widest table has 7 columns.
export const columnName = index => String.fromCharCode(65 + index);

const width = name => (name === 'query' || name === 'page' ? 50 : name === 'intent' || name === 'topic' ? 24 : 16);

function cell(value, ref, style) {
  const s = style ? ` s="${style}"` : '';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  if (value === '' || value == null) return '';
  // A cell holds at most 32,767 characters.
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xmlText(String(value).slice(0, 32767))}</t></is></c>`;
}

export function sheetXml({ header, rows }) {
  const last = columnName(header.length - 1);
  const data = [header, ...rows]
    .map((row, r) => `<row r="${r + 1}">${row.map((value, c) => cell(value, `${columnName(c)}${r + 1}`, r === 0 ? 1 : 0)).join('')}</row>`)
    .join('');
  const cols = header.map((name, c) => `<col min="${c + 1}" max="${c + 1}" width="${width(name)}" customWidth="1"/>`).join('');
  return (
    `${XML}<worksheet xmlns="${MAIN}">` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${data}</sheetData>` +
    `<autoFilter ref="A1:${last}${rows.length + 1}"/></worksheet>`
  );
}

const STYLES =
  `${XML}<styleSheet xmlns="${MAIN}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

export function workbook(sheets, date = new Date()) {
  const types =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('') +
    '</Types>';
  const rels = `${XML}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${DOC_RELS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const book =
    `${XML}<workbook xmlns="${MAIN}" xmlns:r="${DOC_RELS}"><sheets>` +
    sheets.map((s, i) => `<sheet name="${xmlText(s.sheet)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets><definedNames>' +
    sheets
      .map((s, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlText(s.sheet)}'!$A$1:$${columnName(s.header.length - 1)}$${s.rows.length + 1}</definedName>`)
      .join('') +
    '</definedNames></workbook>';
  const bookRels =
    `${XML}<Relationships xmlns="${RELS}">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${DOC_RELS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="${DOC_RELS}/styles" Target="styles.xml"/></Relationships>`;
  return zip(
    [
      { name: '[Content_Types].xml', data: types },
      { name: '_rels/.rels', data: rels },
      { name: 'xl/workbook.xml', data: book },
      { name: 'xl/_rels/workbook.xml.rels', data: bookRels },
      { name: 'xl/styles.xml', data: STYLES },
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
    ],
    date,
  );
}
