// Bundle entry for the bookmarklet. Each click on the bookmark runs this again, so the exporter lives
// on window and each click opens or closes its panel. Progress is kept in localStorage, or in memory
// when the page doesn't allow it.
import logo from '../assets/logo-natzir.png';
import { createExporter } from './exporter.js';
import { memoryStore, webStore } from './store.js';

const KEY = '__bingAipExporter';

function store() {
  try {
    return webStore(window.localStorage);
  } catch {
    return memoryStore();
  }
}

window[KEY] ??= createExporter({
  doc: document,
  win: window,
  store: store(),
  fetch: (url, init) => fetch(url, init),
  logo,
  again: 'click the bookmark again',
});
window[KEY].toggle();
