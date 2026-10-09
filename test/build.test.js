// @vitest-environment node
// esbuild refuses to run inside jsdom, so this file uses the node environment.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from '../scripts/build.mjs';
import { pack } from '../scripts/pack.mjs';

const EXTENSION_DIR = fileURLToPath(new URL('../extension', import.meta.url));
const FILES = ['background.js', 'content.js', 'icons/128.png', 'icons/16.png', 'icons/32.png', 'icons/48.png', 'manifest.json', 'tokens.css', 'welcome.css', 'welcome.html'];
const temp = prefix => mkdtemp(join(tmpdir(), prefix));
const list = async dir =>
  (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter(e => e.isFile())
    .map(e => join(e.parentPath, e.name).slice(dir.length + 1))
    .sort();

describe('build', () => {
  it('assembles the static files and two bundles that parse, with the logo inside', async () => {
    const out = await temp('bing-aip-ext-');
    await buildExtension({ out });
    expect(await list(out)).toEqual(FILES);
    for (const name of ['content.js', 'background.js']) {
      const code = await readFile(join(out, name), 'utf8');
      expect(() => new Function(code)).not.toThrow();
    }
    const content = await readFile(join(out, 'content.js'), 'utf8');
    expect(content).toContain('data:image/png;base64,');
    expect(content).not.toContain('natzir.com/wp-content');
  });

  it('leaves dotfiles out', async () => {
    const from = await temp('bing-aip-src-');
    await cp(EXTENSION_DIR, from, { recursive: true });
    await writeFile(join(from, '.DS_Store'), 'x');
    await writeFile(join(from, 'icons', '.DS_Store'), 'x');
    const out = await temp('bing-aip-ext-');
    await buildExtension({ from, out });
    expect(await list(out)).toEqual(FILES);
  });

  it('zips exactly the built extension', async () => {
    const out = await temp('bing-aip-ext-');
    await buildExtension({ out });
    const zip = join(await temp('bing-aip-zip-'), 'x.zip');
    pack(out, zip);
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(n => n && !n.endsWith('/')).sort();
    expect(names).toEqual(FILES);
  });
});
