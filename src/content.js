// Entry: runs on every Bing Webmaster Tools page. The icon's message opens or closes the exporter's
// panel; progress is kept in chrome.storage.local.
import logo from '../assets/logo-natzir.png';
import { createExporter } from './exporter.js';
import { chromeStore } from './store.js';
import { TOGGLE } from './worker.js';

// A panel left by a previous version of the extension (updated, or put in again by the icon, while this
// page was open) no longer answers the icon: it goes.
for (const stale of document.querySelectorAll('[data-bing-aip]')) stale.remove();

const exporter = createExporter({
  doc: document,
  win: window,
  store: chromeStore(chrome.storage.local),
  fetch: (url, init) => fetch(url, init),
  logo,
  again: 'click the icon again',
});

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== TOGGLE.type) return;
  exporter.toggle();
  reply(true);
});
