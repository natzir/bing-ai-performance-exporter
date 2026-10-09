// The service worker's logic; it takes the Chrome APIs as `api`, so tests pass a fake.
export const WELCOME_PAGE = 'welcome.html';
export const REPORT = 'https://www.bing.com/webmasters/aiperformance';
export const TOGGLE = { type: 'bing-aip-toggle' };

export const onBing = url => /^https:\/\/www\.bing\.com\/webmasters\//.test(url ?? '');

export async function installed(details, api) {
  if (details.reason === 'install') await api.tabs.create({ url: WELCOME_PAGE });
}

// The icon opens or closes the panel in a Bing Webmaster Tools tab. A Bing tab opened before the install
// has no content script to answer: the icon puts it in (activeTab + scripting, on the clicked tab only)
// and opens the panel, as a bookmark would, with no reload; only if that fails is the tab reloaded. The
// clicked tab's address is readable thanks to activeTab. Without an address (or off Bing) the icon opens
// AI Performance in a new tab.
export async function iconClicked(tab, api) {
  if (tab?.id === undefined) return;
  try {
    await api.tabs.sendMessage(tab.id, TOGGLE);
  } catch {
    if (!onBing(tab.url)) await api.tabs.create({ url: REPORT });
    else if (!(await injectThenToggle(tab.id, api))) await reloadThenToggle(tab.id, api);
  }
}

// The content script, put into a tab that was open before the install, then the panel opened. False
// when either step fails.
export async function injectThenToggle(tabId, api) {
  try {
    await api.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await api.tabs.sendMessage(tabId, TOGGLE);
    return true;
  } catch {
    return false;
  }
}

// Chrome doesn't order the content script's document_idle injection against the tab's 'complete', so a
// TOGGLE sent right after 'complete' can still find no listener: it is retried `gap` ms apart, up to `tries`
// attempts. If the tab never reports 'complete' within `timeout` ms, the wait ends without a toggle. Never throws.
export function reloadThenToggle(tabId, api, { tries = 10, gap = 200, timeout = 30000, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  return new Promise(resolve => {
    let timer;
    const stop = () => {
      clearTimeout(timer);
      api.tabs.onUpdated.removeListener(listener);
    };
    const toggle = async () => {
      for (let attempt = 1; attempt <= tries; attempt += 1) {
        try {
          await api.tabs.sendMessage(tabId, TOGGLE);
          return;
        } catch {
          if (attempt < tries) await sleep(gap);
        }
      }
    };
    const listener = (id, change) => {
      if (id !== tabId || change.status !== 'complete') return;
      stop();
      toggle().finally(resolve);
    };
    timer = setTimeout(() => {
      stop();
      resolve();
    }, timeout);
    api.tabs.onUpdated.addListener(listener);
    // A tab that closed or can't be reloaded: nothing to wait for.
    Promise.resolve()
      .then(() => api.tabs.reload(tabId))
      .catch(() => {
        stop();
        resolve();
      });
  });
}
