// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { artPixel, iconPixel } from '../scripts/make-icons.mjs';

const TILE = [23, 34, 36];
const SKY = [125, 211, 252, 255];
const WHITE = [255, 255, 255, 255];
const over = (top, bottom, alpha) => [...bottom.map((c, k) => Math.round(top[k] * alpha + c * (1 - alpha))), 255];

describe('icon', () => {
  it('is the dark tools tile with query dots joined to page dots', () => {
    expect(artPixel(0, 0, 128)[3]).toBe(0);
    expect(artPixel(64, 6, 128)).toEqual([...TILE, 255]);
    expect(artPixel(34, 64, 128)).toEqual(SKY);
    expect(artPixel(94, 48, 128)).toEqual(WHITE);
    expect(artPixel(64, 42, 128)).toEqual(over([255, 255, 255], TILE, 0.35));
  });

  it('keeps a query dot whole at 16 px', () => {
    expect(artPixel(4, 8, 16)).toEqual(SKY);
  });

  it('gives the 128 px store icon 16 px of transparent padding', () => {
    expect(iconPixel(8, 64, 128)).toEqual([0, 0, 0, 0]);
    expect(iconPixel(64, 20, 128)).toEqual(artPixel(48, 4, 96));
    expect(iconPixel(8, 1, 16)).toEqual(artPixel(8, 1, 16));
  });
});
