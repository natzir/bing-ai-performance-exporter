// The exporter's panel: a dark card at the top right of the page, in a Shadow DOM so Bing's styles can't
// reach it and its own can't leak out. It shows a title line, one message, an optional question and a
// list of actions; exporter.js decides what they say.
const STYLE = `
  :host { all: initial; }
  [hidden] { display: none !important; }
  .panel {
    position: fixed; top: 20px; right: 20px; z-index: 2147483647; box-sizing: border-box;
    width: 340px; max-width: calc(100vw - 40px); max-height: calc(100vh - 40px); overflow: auto;
    padding: 16px; border-radius: 16px; background: #172224; color: #fff;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 18px 44px -10px rgba(0, 0, 0, .45);
    -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; text-wrap: pretty;
    animation: enter .32s cubic-bezier(.2, 0, 0, 1) both;
  }
  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .logo { height: 18px; width: auto; display: block; border-radius: 2px; outline: 1px solid rgba(255, 255, 255, .1); }
  .names { flex: 1; min-width: 0; }
  .name { font-weight: 600; font-size: 14px; line-height: 1.2; }
  .by { color: rgba(255, 255, 255, .62); font-size: 11px; line-height: 1.3; margin-top: 2px; letter-spacing: .02em; }
  .by a { color: inherit; text-decoration: none; }
  .by a:hover { text-decoration: underline; }
  .close {
    width: 28px; height: 28px; margin: -4px -4px -4px 0; border: 0; border-radius: 8px; background: transparent;
    color: #fff; font-size: 18px; line-height: 1; cursor: pointer;
  }
  .close:hover, .btn:hover { background: rgba(255, 255, 255, .11); }
  .title { margin: 0 0 6px; font-weight: 500; }
  .status { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; color: rgba(255, 255, 255, .62); }
  .status.done { color: #fff; }
  .status.error { color: #ff6b54; }
  .spin {
    flex: 0 0 12px; width: 12px; height: 12px; margin-top: 3px; border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, .22); border-top-color: #fff; animation: spin .7s linear infinite;
  }
  .status:not(.busy) .spin { display: none; }
  .question { margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
  .ask { margin: 0; }
  .choices, .row { display: flex; flex-wrap: wrap; gap: 6px; }
  .dates { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .dates input {
    font: inherit; color: #fff; background: rgba(255, 255, 255, .06); color-scheme: dark;
    border: 1px solid rgba(255, 255, 255, .16); border-radius: 8px; padding: 4px 6px;
  }
  .actions { display: flex; flex-direction: column; gap: 6px; }
  .btn {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px; box-sizing: border-box;
    padding: 9px 12px; border: 0; border-radius: 10px; background: rgba(255, 255, 255, .06);
    color: #fff; font-family: inherit; font-size: 12px; font-weight: 500; line-height: 1.3; text-align: left; text-decoration: none; cursor: pointer;
  }
  .choices .btn, .row .btn, .dates .btn { display: inline-flex; }
  .btn.primary { background: #fff; color: #172224; font-weight: 600; }
  .btn.primary:hover { background: #e7eeee; }
  .desc { color: rgba(255, 255, 255, .62); font-weight: 400; }
  .primary .desc { color: rgba(23, 34, 36, .7); }
  :focus-visible { outline: 2px solid #7dd3fc; outline-offset: 2px; }
  @keyframes enter { from { opacity: 0; transform: translateY(-4px); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .panel, .spin { animation: none; } }
`;

const PRESETS = [
  ['Last 7 days', 7],
  ['Last 30 days', 30],
  ['Last 3 months', 90],
  ['Last 6 months', 180],
];

export function createPanel(doc, { logo, onClose }) {
  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (label, className, onClick) => {
    const node = el('button', className, label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  };

  const host = el('div');
  // Inline, so no rule of the page's own can hide or move it.
  host.style.cssText = 'all: initial; display: block;';
  host.setAttribute('data-bing-aip', '');
  const root = host.attachShadow({ mode: 'open' });

  const panel = el('section', 'panel');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Bing AI Performance Exporter');

  const head = el('div', 'head');
  if (logo) {
    const img = el('img', 'logo');
    img.alt = 'natzir';
    img.src = logo;
    img.addEventListener('error', () => img.remove());
    head.append(img);
  }
  const by = el('div', 'by', 'by ');
  const link = el('a', null, 'natzir.com');
  link.href = 'https://natzir.com/';
  link.target = '_blank';
  link.rel = 'noopener';
  by.append(link);
  const names = el('div', 'names');
  names.append(el('div', 'name', 'AI Performance Exporter'), by);
  const close = button('×', 'close', () => onClose());
  close.setAttribute('aria-label', 'Close');
  head.append(names, close);

  const titleLine = el('p', 'title');
  titleLine.hidden = true;
  const status = el('div', 'status busy');
  status.setAttribute('role', 'status');
  const spin = el('span', 'spin');
  spin.setAttribute('aria-hidden', 'true');
  const text = el('span', 'text');
  status.append(spin, text);
  const question = el('div', 'question');
  question.hidden = true;
  const list = el('div', 'actions');

  panel.append(head, titleLine, status, question, list);
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  });
  root.append(el('style', null, STYLE), panel);

  function action(item) {
    const className = item.primary ? 'btn primary' : 'btn';
    let node;
    if (item.download || item.href) {
      node = el('a', className);
      node.href = item.download ? item.download.url : item.href;
      if (item.download) node.download = item.download.name;
    } else {
      node = button('', className, () => item.onClick());
    }
    node.append(el('span', 'label', item.label));
    if (item.desc) node.append(el('span', 'desc', item.desc));
    return node;
  }

  function clearQuestion() {
    question.replaceChildren();
    question.hidden = true;
  }

  return {
    host,
    root,
    title(value) {
      titleLine.textContent = value;
      titleLine.hidden = !value;
    },
    message(value, tone = 'busy') {
      text.textContent = value;
      status.className = `status ${tone}`;
    },
    actions(items) {
      list.replaceChildren(...items.map(action));
    },
    askRange(onChoose) {
      clearQuestion();
      const choices = el('div', 'choices');
      for (const [label, days] of PRESETS) {
        choices.append(button(label, 'btn', () => {
          clearQuestion();
          onChoose({ days });
        }));
      }
      const input = name => {
        const node = el('input');
        node.type = 'date';
        node.name = name;
        node.required = true;
        return node;
      };
      const begin = input('begin');
      const end = input('end');
      const from = el('label', null, 'From ');
      from.append(begin);
      const to = el('label', null, 'to ');
      to.append(end);
      const submit = el('button', 'btn primary', 'Export');
      submit.type = 'submit';
      const form = el('form', 'dates');
      form.append(from, to, submit);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!begin.value || !end.value || begin.value > end.value) {
          begin.focus();
          return;
        }
        clearQuestion();
        onChoose({ begin: begin.value, end: end.value });
      });
      question.append(choices, form);
      question.hidden = false;
      choices.querySelector('button').focus();
    },
    askStop(onAnswer, { kept = true } = {}) {
      clearQuestion();
      const row = el('div', 'row');
      row.append(
        button('Stop', 'btn primary', () => {
          clearQuestion();
          onAnswer(true);
        }),
        button('Keep going', 'btn', () => {
          clearQuestion();
          onAnswer(false);
        }),
      );
      const note = kept ? 'Your progress is kept.' : "Progress can't be saved in this browser.";
      question.append(el('p', 'ask', `Stop the export? ${note}`), row);
      question.hidden = false;
      row.querySelectorAll('button')[1].focus();
    },
    clearQuestion,
    remove() {
      host.remove();
    },
  };
}
