// npm run build → dist/bookmarklet.txt (paste into a bookmark), dist/install.html (drag it), its copy in
// docs/index.html (GitHub Pages serves docs/, so the button can be dragged straight from the web) and
// dist/extension/ (ready for Load unpacked; npm run pack zips it). The logo is bundled as a data URL in
// both, so nothing is loaded from outside.
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installPage, toBookmarkletUrl } from './bookmarklet-url.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const BUNDLE = {
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'chrome120',
  charset: 'utf8',
  legalComments: 'none',
  loader: { '.png': 'dataurl' },
};

export async function buildBookmarklet() {
  const result = await build({ entryPoints: [`${root}src/bookmarklet.js`], ...BUNDLE, write: false });
  return toBookmarkletUrl(result.outputFiles[0].text.trim());
}

// The extension's static files (no dotfiles, such as macOS's .DS_Store) and two bundles: content.js and
// the background.js service worker.
export async function buildExtension({ from = `${root}extension`, out = `${root}dist/extension` } = {}) {
  await rm(out, { recursive: true, force: true });
  await cp(from, out, { recursive: true, filter: source => !basename(source).startsWith('.') });
  await build({
    entryPoints: { content: `${root}src/content.js`, background: `${root}src/background.js` },
    outdir: out,
    ...BUNDLE,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bookmarklet = await buildBookmarklet();
  await mkdir(`${root}dist`, { recursive: true });
  await mkdir(`${root}docs`, { recursive: true });
  await writeFile(`${root}dist/bookmarklet.txt`, `${bookmarklet}\n`);
  await writeFile(`${root}dist/install.html`, installPage(bookmarklet));
  await writeFile(`${root}docs/index.html`, installPage(bookmarklet));
  await writeFile(`${root}docs/.nojekyll`, '');
  console.log(`bookmarklet: ${(bookmarklet.length / 1024).toFixed(1)} KB → dist/install.html, docs/index.html`);
  await buildExtension();
  console.log('extension → dist/extension/');
}
