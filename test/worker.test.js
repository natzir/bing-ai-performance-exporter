import { describe, it, expect } from 'vitest';
import { REPORT, TOGGLE, WELCOME_PAGE, iconClicked, installed, reloadThenToggle } from '../src/worker.js';

// A fake of the chrome.tabs calls the worker makes. `refuse` is how many sendMessage calls fail first,
// as they do on a tab without the content script. `silent` makes reload() fire no tab events.
function fakeApi({ refuse = 0, silent = false, reloadFails = false } = {}) {
  const calls = { created: [], sent: [], reloaded: [] };
  const listeners = new Set();
  let refusals = refuse;
  let attempts = 0;
  return {
    calls,
    get attempts() {
      return attempts;
    },
    tabs: {
      async create(props) {
        calls.created.push(props);
      },
      async sendMessage(tabId, message) {
        attempts += 1;
        if (refusals > 0) {
          refusals -= 1;
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        calls.sent.push([tabId, message]);
      },
      async reload(tabId) {
        calls.reloaded.push(tabId);
        if (reloadFails) throw new Error('No tab with id');
        if (silent) return;
        for (const listener of [...listeners]) listener(tabId, { status: 'loading' });
        for (const listener of [...listeners]) listener(99, { status: 'complete' });
        for (const listener of [...listeners]) listener(tabId, { status: 'complete' });
      },
      onUpdated: {
        addListener: listener => listeners.add(listener),
        removeListener: listener => listeners.delete(listener),
      },
    },
    listeners,
  };
}

const noWait = async () => {};

describe('worker', () => {
  it('opens the welcome page on first install only', async () => {
    const api = fakeApi();
    await installed({ reason: 'install' }, api);
    for (const reason of ['update', 'chrome_update', 'shared_module_update']) await installed({ reason, previousVersion: '1.0.0' }, api);
    expect(api.calls.created).toEqual([{ url: WELCOME_PAGE }]);
  });

  it('toggles the panel in a Bing Webmaster Tools tab', async () => {
    const api = fakeApi();
    await iconClicked({ id: 7, url: 'https://www.bing.com/webmasters/aiperformance?siteUrl=https://example.com/' }, api);
    expect(api.calls.sent).toEqual([[7, TOGGLE]]);
  });

  it('reloads a Bing tab opened before the install, then opens the panel', async () => {
    const api = fakeApi({ refuse: 1 });
    await iconClicked({ id: 7, url: 'https://www.bing.com/webmasters/aiperformance?siteUrl=https://example.com/' }, api);
    expect(api.calls.reloaded).toEqual([7]);
    expect(api.calls.sent).toEqual([[7, TOGGLE]]);
    expect(api.listeners.size).toBe(0);
  });

  it('opens AI Performance in a new tab anywhere else', async () => {
    const api = fakeApi({ refuse: 1 });
    await iconClicked({ id: 7 }, api);
    expect(api.calls.created).toEqual([{ url: REPORT }]);
    expect(api.calls.reloaded).toEqual([]);
  });

  it('does nothing for a click without a tab', async () => {
    const api = fakeApi();
    await iconClicked(undefined, api);
    expect(api.calls).toEqual({ created: [], sent: [], reloaded: [] });
  });

  it("keeps trying until the reloaded tab's script answers", async () => {
    const api = fakeApi({ refuse: 2 });
    await reloadThenToggle(7, api, { sleep: noWait });
    expect(api.calls.sent).toEqual([[7, TOGGLE]]);
    expect(api.attempts).toBe(3);
    expect(api.listeners.size).toBe(0);
  });

  it('gives up after the last try', async () => {
    const api = fakeApi({ refuse: 99 });
    await reloadThenToggle(7, api, { tries: 3, sleep: noWait });
    expect(api.calls.sent).toEqual([]);
    expect(api.attempts).toBe(3);
    expect(api.listeners.size).toBe(0);
  });

  it('stops when the tab can\'t be reloaded', async () => {
    const api = fakeApi({ reloadFails: true });
    await reloadThenToggle(7, api);
    expect(api.calls.sent).toEqual([]);
    expect(api.listeners.size).toBe(0);
  });

  it('stops waiting when the tab never finishes loading', async () => {
    const api = fakeApi({ silent: true });
    await reloadThenToggle(7, api, { timeout: 5 });
    expect(api.calls.sent).toEqual([]);
    expect(api.listeners.size).toBe(0);
  });
});
