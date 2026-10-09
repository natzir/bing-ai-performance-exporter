// Draws the extension icon as PNGs in extension/icons/: the natzir.com tools tile with three query dots
// joined by faint lines to two page dots, the query ↔ page mapping. Shapes are in a 128 × 128 grid,
// antialiased by 4 × 4 supersampling. The 128 px icon, the one the Chrome Web Store shows, has 96 px of
// artwork and 16 px of transparent padding around it; the toolbar sizes use the whole square.
// Usage: npm run icons
import { crc32, deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SKY = [125, 211, 252];
const WHITE = [255, 255, 255];
const TILE = { kind: 'rect', x: 0, y: 0, w: 128, h: 128, r: 28, color: [23, 34, 36], alpha: 1 };
const QUERIES = [[34, 36], [34, 64], [34, 92]];
const PAGES = [[94, 48], [94, 80]];
const LINKS = [[0, 0], [1, 0], [1, 1], [2, 1]];
const SHAPES = [
  ...LINKS.map(([q, p]) => ({ kind: 'line', a: QUERIES[q], b: PAGES[p], width: 6, color: WHITE, alpha: 0.35 })),
  ...QUERIES.map(([x, y]) => ({ kind: 'circle', x, y, r: 10, color: SKY, alpha: 1 })),
  ...PAGES.map(([x, y]) => ({ kind: 'circle', x, y, r: 13, color: WHITE, alpha: 1 })),
];

function inside(u, v, s) {
  if (s.kind === 'circle') return (u - s.x) ** 2 + (v - s.y) ** 2 <= s.r ** 2;
  if (s.kind === 'line') {
    const [ax, ay] = s.a;
    const [bx, by] = s.b;
    const t = Math.max(0, Math.min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return (u - (ax + t * (bx - ax))) ** 2 + (v - (ay + t * (by - ay))) ** 2 <= (s.width / 2) ** 2;
  }
  if (u < s.x || u > s.x + s.w || v < s.y || v > s.y + s.h) return false;
  const dx = Math.max(s.x + s.r - u, 0, u - (s.x + s.w - s.r));
  const dy = Math.max(s.y + s.r - v, 0, v - (s.y + s.h - s.r));
  return dx * dx + dy * dy <= s.r * s.r;
}

// One pixel of the artwork drawn at size × size.
export function artPixel(x, y, size) {
  const n = 4;
  const sum = [0, 0, 0];
  let covered = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = ((x + (i + 0.5) / n) * 128) / size;
      const v = ((y + (j + 0.5) / n) * 128) / size;
      if (!inside(u, v, TILE)) continue;
      let color = TILE.color;
      for (const s of SHAPES) if (inside(u, v, s)) color = color.map((c, k) => s.color[k] * s.alpha + c * (1 - s.alpha));
      color.forEach((c, k) => {
        sum[k] += c;
      });
      covered += 1;
    }
  }
  if (!covered) return [0, 0, 0, 0];
  return [...sum.map(c => Math.round(c / covered)), Math.round((covered / (n * n)) * 255)];
}

const PADDING = { 128: 16 };

export function iconPixel(x, y, size) {
  const pad = PADDING[size] ?? 0;
  const art = size - 2 * pad;
  if (x < pad || y < pad || x >= pad + art || y >= pad + art) return [0, 0, 0, 0];
  return artPixel(x - pad, y - pad, art);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) raw.set(iconPixel(x, y, size), y * stride + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = fileURLToPath(new URL('../extension/icons/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  for (const size of [16, 32, 48, 128]) writeFileSync(`${dir}${size}.png`, png(size));
}
