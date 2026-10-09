// A table as CSV that opens right in the spreadsheet of the browser's language: where the language
// writes decimals with a comma (es, fr, de…), Excel expects semicolons between columns and decimal
// commas. UTF-8 with a BOM, so Excel reads the accents; CRLF lines.
export function separators(lang) {
  let decimal = '.';
  try {
    decimal = new Intl.NumberFormat(lang).formatToParts(1.5).find(part => part.type === 'decimal')?.value ?? '.';
  } catch {
    // Not a language Intl knows: English separators.
  }
  return decimal === ',' ? { column: ';', decimal: ',' } : { column: ',', decimal: '.' };
}

// A text cell that starts like a formula would run as one in Excel and Sheets: a query "+500 euros" or
// "=HYPERLINK(...)" gets a leading apostrophe, which the spreadsheet hides.
const safeText = text => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

export function toCsv({ header, rows }, lang) {
  const { column, decimal } = separators(lang);
  const cell = value => {
    const text = typeof value === 'number' ? String(value).replace('.', decimal) : safeText(String(value ?? ''));
    return text.includes(column) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${[header, ...rows].map(row => row.map(cell).join(column)).join('\r\n')}\r\n`;
}
