// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, zip } from '../src/zip.js';

const write = bytes => {
  const path = join(mkdtempSync(join(tmpdir(), 'bing-aip-zip-')), 'x.zip');
  writeFileSync(path, bytes);
  return path;
};

// Reads the archive's own bytes: the central directory's names and each entry's stored data.
// The system unzip on macOS mangles UTF-8 names when it prints them, so names are checked here.
const readEntries = bytes => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const endAt = bytes.length - 22;
  expect(view.getUint32(endAt, true)).toBe(0x06054b50);
  const count = view.getUint16(endAt + 10, true);
  let at = view.getUint32(endAt + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const flags = view.getUint16(at + 8, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const localFlags = view.getUint16(local + 6, true);
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const dataAt = local + 30 + localName + localExtra;
    entries.push({ name, flags, localFlags, data: bytes.subarray(dataAt, dataAt + size) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('zip', () => {
  it('writes an archive unzip accepts, with every file as it was', () => {
    const bytes = zip([
      { name: 'a.csv', data: '﻿query,citations\r\nblue widgets,3\r\n' },
      { name: 'año/b.txt', data: new Uint8Array([0, 1, 2, 255]) },
    ], new Date(2026, 4, 17, 15, 30, 10));
    const path = write(bytes);
    expect(execFileSync('unzip', ['-t', path], { encoding: 'utf8' })).toContain('No errors detected');
    expect(execFileSync('unzip', ['-p', path, 'a.csv'], { encoding: 'utf8' })).toBe('﻿query,citations\r\nblue widgets,3\r\n');
    const entries = readEntries(bytes);
    expect(entries.map(e => e.name)).toEqual(['a.csv', 'año/b.txt']);
    for (const e of entries) {
      expect(e.flags & 0x0800).toBe(0x0800);
      expect(e.localFlags & 0x0800).toBe(0x0800);
    }
    expect([...entries[1].data]).toEqual([0, 1, 2, 255]);
  });
});
