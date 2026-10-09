// The service worker's logic; it takes the Chrome APIs as `api`, so tests pass a fake.
export const WELCOME_PAGE = 'welcome.html';
export const REPORT = 'https://www.bing.com/webmasters/aiperformance';
export const TOGGLE = { type: 'bing-aip-toggle' };

export const onBing = url => /^https:\/\/www\.bing\.com\/webmasters\//.test(url ?? '');

export async function installed(details, api) {
  if (details.reason === 'install') await api.tabs.create({ url: WELCOME_PAGE });
}

// The icon opens or closes the panel in a Bing Webmaster Tools tab. A Bing tab opened before the install
// has no content script to answer: it is reloaded, and the panel opens once it has loaded. Anywhere else
// (where the extension can't even read the tab's address) the icon opens AI Performance in a new tab.
export async function iconClicked(tab, api) {
  if (tab?.id === undefined) return;
  try {
    await api.tabs.sendMessage(tab.id, TOGGLE);
  } catch {
    if (onBing(tab.url)) await reloadThenToggle(tab.id, api);
    else await api.tabs.create({ url: REPORT });
  }
}

export function reloadThenToggle(tabId, api) {
  return new Promise(resolve => {
    const listener = (id, change) => {
      if (id !== tabId || change.status !== 'complete') return;
      api.tabs.onUpdated.removeListener(listener);
      api.tabs.sendMessage(tabId, TOGGLE).catch(() => {}).finally(resolve);
    };
    api.tabs.onUpdated.addListener(listener);
    api.tabs.reload(tabId);
  });
}
