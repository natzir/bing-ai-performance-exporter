// One exporter per page. The icon (or the bookmark) toggles its panel. On AI Performance it reads the
// range (or asks for it), takes Bing's token and runs the export, telling the panel how it goes; at the
// end it offers the files. Anywhere else it points to AI Performance.
import { client, getToken } from './api.js';
import { exportFiles, hostOf } from './files.js';
import { createPanel } from './panel.js';
import { presetRange, rangeLabel, rangeTabsShown, readRange } from './range.js';
import { createRun, loadState, realClock } from './run.js';

export const REPORT = 'https://www.bing.com/webmasters/aiperformance';

// The range question's presets, as the report's own tabs.
const PRESET_OF = { 7: '7 D', 30: '30 D', 90: '3 M', 180: '6 M' };

const count = n => n.toLocaleString('en-US');
const progress = s => `${count(s.done)}/${count(s.total)}${s.failed ? ` · ${count(s.failed)} failed` : ''}`;

export function clockText(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function createExporter({ doc, win, store, fetch: fetchFn, clock = realClock, logo, again, lang, files = exportFiles }) {
  const language = lang ?? win.navigator?.language ?? 'en';
  let panel = null;
  let run = null;
  let work = Promise.resolve();
  // A run that is stopping saves its progress once more; the next one waits for it, so two never overlap.
  let ending = Promise.resolve();
  let urls = [];

  function revoke() {
    for (const url of urls) win.URL.revokeObjectURL?.(url);
    urls = [];
  }

  function close() {
    if (run) {
      run.stop();
      ending = run.finished();
      run = null;
    }
    revoke();
    panel?.remove();
    panel = null;
  }

  function toggle() {
    if (!panel) {
      open();
      return;
    }
    if (run?.running) {
      const asked = panel;
      asked.askStop(
        stop => {
          if (stop && panel === asked) close();
        },
        { kept: !run.snapshot().unsaved },
      );
      return;
    }
    close();
  }

  function open() {
    const mine = createPanel(doc, { logo, onClose: toggle });
    panel = mine;
    doc.body.append(mine.host);
    const url = new URL(win.location.href);
    const site = url.searchParams.get('siteUrl');
    const onReport = url.hostname === 'www.bing.com' && url.pathname.replace(/\/+$/, '') === '/webmasters/aiperformance';
    if (!onReport || !site) {
      mine.message('Open the AI Performance report to export its mapping.', 'idle');
      mine.actions([{ label: 'Open AI Performance', primary: true, href: site ? `${REPORT}?siteUrl=${encodeURIComponent(site)}` : REPORT }]);
      return;
    }
    work = choose(mine, site);
  }

  // The range on screen, once Bing has drawn its tabs (up to 5 s after the page loads); otherwise the
  // question.
  async function choose(mine, site) {
    if (!rangeTabsShown(doc)) {
      mine.message('Waiting for the report to load…', 'busy');
      for (let i = 0; i < 20 && !rangeTabsShown(doc) && panel === mine; i += 1) await clock.sleep(250);
      if (panel !== mine) return;
    }
    const today = new Date(clock.now());
    const range = readRange(doc, today);
    if (range) {
      await begin(mine, site, range);
      return;
    }
    mine.message('Which dates should it export?', 'idle');
    mine.askRange(choice => {
      const chosen = choice.days ? presetRange(PRESET_OF[choice.days], today) : { begin: choice.begin, end: choice.end };
      work = begin(mine, site, chosen);
    });
  }

  async function begin(mine, site, range) {
    const live = () => panel === mine;
    mine.title(`${hostOf(site)} · ${rangeLabel(range)}`);
    mine.message('Starting…', 'busy');
    mine.actions([]);
    await ending;
    let token;
    try {
      token = await getToken(fetchFn);
    } catch {
      if (live()) mine.message(`Your Bing session has expired. Reload the page and ${again}.`, 'error');
      return;
    }
    let current;
    try {
      const state = await loadState(store, site, range, clock.now());
      if (live()) current = start(mine, site, range, state, token);
    } catch (error) {
      failed(mine, error);
      return;
    }
    if (current) await go(mine, current, site, range);
  }

  function start(mine, site, range, state, token) {
    const live = () => panel === mine;
    const current = createRun({
      post: client(fetchFn, token),
      site,
      range,
      store,
      state,
      clock,
      onChange: s => {
        if (live()) show(mine, s);
      },
    });
    run = current;
    return current;
  }

  // Anything unexpected ends in a sentence, never in a panel that says nothing.
  function failed(mine, error) {
    if (panel !== mine) return;
    const detail = String(error?.message ?? error);
    const kept = run ? ` ${run.snapshot().unsaved ? "Progress can't be saved in this browser." : 'Your progress is kept.'}` : '';
    mine.clearQuestion();
    mine.message(`Something went wrong: ${detail}.${kept}`, 'error');
    mine.actions([]);
  }

  async function go(mine, current, site, range) {
    try {
      mine.actions([{ label: 'Stop and download what I have', onClick: () => current.stop() }]);
      const end = await current.start();
      if (panel === mine) await finish(mine, current, end, site, range);
    } catch (error) {
      failed(mine, error);
    }
  }

  function show(mine, s) {
    const wait = clockText(s.remaining);
    const text = {
      listing: s.total ? `Resuming from ${progress(s)}…` : 'Fetching queries and pages…',
      mapping: `Mapping query → pages: ${progress(s)}`,
      cooling: `Short pause to stay under Bing's limits: ${wait} · ${progress(s)}`,
      throttled: `Bing is pausing requests. Resuming in ${wait}. You can leave this tab in the background.`,
      probing: `Checking whether Bing is back (attempt ${s.probes + 1})…`,
    }[s.status];
    if (text) mine.message(text, 'busy');
  }

  async function finish(mine, current, s, site, range) {
    mine.clearQuestion();
    const result = current.result();
    const listed = Boolean(result.queries && result.pages);
    const kept = s.unsaved ? "Progress can't be saved in this browser." : 'Your progress is kept.';
    const resume = label => ({
      label,
      primary: true,
      onClick: () => {
        work = go(mine, current, site, range);
      },
    });
    let text;
    let tone = 'done';
    let items = [];
    if (s.status === 'expired') {
      text = `Your Bing session has expired. Reload the page and ${again}. ${kept}`;
      tone = 'error';
    } else if (s.status === 'error') {
      text = `Bing answered with an error (${s.errorStatus}). ${kept}`;
      tone = 'error';
      items = [resume('Resume')];
    } else if (s.status === 'paused') {
      text = `Bing has been pausing requests for an hour. Stopped at ${progress(s)}. ${kept}`;
      tone = 'error';
      items = [resume('Resume')];
    } else if (s.status === 'stopped') {
      text = `Stopped at ${progress(s)}. ${kept}`;
      items = [resume('Resume')];
    } else if (listed && result.queries.length === 0) {
      text = 'Bing has no AI Performance data for this site and range.';
    } else {
      text = `${count(s.total)} queries · ${count(s.pages)} pages mapped${s.failed ? ` · ${count(s.failed)} failed` : ''}. Download below.`;
      if (s.failed) items = [resume('Retry failed')];
    }
    if (listed && result.queries.length) items = [...items, ...downloads(result, site, range)];
    // The files are built: a complete run with nothing failed has no use for its saved progress.
    if (s.status === 'done' && listed && !s.failed) await current.discard();
    mine.message(text, tone);
    mine.actions(items);
  }

  function downloads(result, site, range) {
    revoke();
    const built = files(result, site, range, language, new Date(clock.now()));
    const link = file => {
      const url = win.URL.createObjectURL(new Blob([file.data], { type: file.type }));
      urls.push(url);
      return { name: file.name, url };
    };
    return [
      { label: 'Download CSV (ZIP)', primary: true, desc: 'mapping, queries-summary and pages-summary, in one file.', download: link(built.zip) },
      { label: 'Download Excel', primary: true, desc: 'The same three tables, one sheet each.', download: link(built.xlsx) },
    ];
  }

  return { toggle, settled: () => work };
}
