import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPanel } from '../src/panel.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function make() {
  const onClose = vi.fn();
  const panel = createPanel(document, { logo: 'data:image/png;base64,AAAA', onClose });
  document.body.append(panel.host);
  return { panel, onClose, root: panel.root };
}

describe('panel', () => {
  it('is a card in a shadow root, with its name, the natzir link and a close button', () => {
    const { panel, root } = make();
    expect(panel.host.hasAttribute('data-bing-aip')).toBe(true);
    expect(root.querySelector('section').getAttribute('aria-label')).toBe('Bing AI Performance Exporter');
    expect(root.querySelector('.name').textContent).toBe('AI Performance Exporter');
    expect(root.querySelector('.by a').getAttribute('href')).toBe('https://natzir.com/');
    expect(root.querySelector('img.logo').getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(root.querySelector('button.close').getAttribute('aria-label')).toBe('Close');
    expect(root.querySelector('style').textContent).toContain('.panel');
  });

  it('drops the logo when it can\'t load', () => {
    const { root } = make();
    root.querySelector('img.logo').dispatchEvent(new Event('error'));
    expect(root.querySelector('img.logo')).toBeNull();
  });

  it('shows a title only once there is one', () => {
    const { panel, root } = make();
    expect(root.querySelector('.title').hidden).toBe(true);
    panel.title('example.com · Apr 17 – May 17, 2026');
    expect(root.querySelector('.title').hidden).toBe(false);
    expect(root.querySelector('.title').textContent).toBe('example.com · Apr 17 – May 17, 2026');
  });

  it('shows one message with its tone, in a polite status region', () => {
    const { panel, root } = make();
    const status = root.querySelector('.status');
    expect(status.getAttribute('role')).toBe('status');
    panel.message('Mapping query → pages: 1/3', 'busy');
    expect([status.className, status.querySelector('.text').textContent]).toEqual(['status busy', 'Mapping query → pages: 1/3']);
    panel.message('Done.', 'done');
    expect(status.className).toBe('status done');
  });

  it('turns actions into buttons, links and download links', () => {
    const { panel, root } = make();
    const stop = vi.fn();
    panel.actions([
      { label: 'Stop and download what I have', onClick: stop },
      { label: 'Download Excel', primary: true, desc: 'The same three tables, one sheet each.', download: { name: 'x.xlsx', url: 'blob:1' } },
      { label: 'Open AI Performance', href: 'https://www.bing.com/webmasters/aiperformance' },
    ]);
    const [button, file, link] = root.querySelectorAll('.actions > *');
    expect([button.tagName, button.type, button.className]).toEqual(['BUTTON', 'button', 'btn']);
    button.click();
    expect(stop).toHaveBeenCalledOnce();
    expect([file.tagName, file.className, file.getAttribute('href'), file.getAttribute('download')]).toEqual(['A', 'btn primary', 'blob:1', 'x.xlsx']);
    expect(file.querySelector('.desc').textContent).toBe('The same three tables, one sheet each.');
    expect([link.getAttribute('href'), link.hasAttribute('download')]).toEqual(['https://www.bing.com/webmasters/aiperformance', false]);
    panel.actions([]);
    expect(root.querySelectorAll('.actions > *')).toHaveLength(0);
  });

  it('closes with its × and with Escape', () => {
    const { root, onClose } = make();
    root.querySelector('button.close').click();
    root.querySelector('section').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('asks for the range: four presets, or two days in order', () => {
    const { panel, root } = make();
    const onChoose = vi.fn();
    panel.askRange(onChoose);
    const presets = [...root.querySelectorAll('.choices button')];
    expect(presets.map(b => b.textContent)).toEqual(['Last 7 days', 'Last 30 days', 'Last 3 months', 'Last 6 months']);
    presets[1].click();
    expect(onChoose).toHaveBeenLastCalledWith({ days: 30 });
    expect(root.querySelector('.question').hidden).toBe(true);

    panel.askRange(onChoose);
    const form = root.querySelector('form.dates');
    form.querySelector('[name="begin"]').value = '2026-03-03';
    form.querySelector('[name="end"]').value = '2026-02-01';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    form.querySelector('[name="begin"]').value = '2026-02-01';
    form.querySelector('[name="end"]').value = '2026-03-03';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onChoose).toHaveBeenLastCalledWith({ begin: '2026-02-01', end: '2026-03-03' });
  });

  it('asks before stopping', () => {
    const { panel, root } = make();
    const onAnswer = vi.fn();
    panel.askStop(onAnswer);
    expect(root.querySelector('.question .ask').textContent).toBe('Stop the export? Your progress is kept.');
    const [stop, keep] = root.querySelectorAll('.question button');
    expect([stop.textContent, keep.textContent]).toEqual(['Stop', 'Keep going']);
    keep.click();
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    panel.askStop(onAnswer);
    root.querySelector('.question button').click();
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('leaves the page when removed', () => {
    const { panel } = make();
    panel.remove();
    expect(document.querySelector('[data-bing-aip]')).toBeNull();
  });
});
