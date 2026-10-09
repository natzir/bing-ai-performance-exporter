import { describe, it, expect, afterEach } from 'vitest';
import { chromeStore, memoryStore, webStore } from '../src/store.js';

afterEach(() => localStorage.clear());

function fakeArea() {
  const data = {};
  return {
    data,
    async get(keys) {
      if (keys === null) return { ...data };
      return Object.hasOwn(data, keys) ? { [keys]: data[keys] } : {};
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(key) {
      delete data[key];
    },
  };
}

describe('chromeStore', () => {
  it('gets, sets, removes and lists the keys of the area', async () => {
    const store = chromeStore(fakeArea());
    expect(await store.get('a')).toBeNull();
    await store.set('a', { n: 1 });
    await store.set('b', 2);
    expect(await store.get('a')).toEqual({ n: 1 });
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
    await store.remove('a');
    expect(await store.keys()).toEqual(['b']);
  });
});

describe('webStore', () => {
  it('reads null for a missing key and for corrupt JSON', async () => {
    const store = webStore(localStorage);
    expect(await store.get('missing')).toBeNull();
    localStorage.setItem('bad', '{not json');
    expect(await store.get('bad')).toBeNull();
  });

  it('sets, gets, removes and lists its keys', async () => {
    const store = webStore(localStorage);
    await store.set('a', { n: 1 });
    await store.set('b', 2);
    expect(await store.get('a')).toEqual({ n: 1 });
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
    await store.remove('a');
    expect(await store.keys()).toEqual(['b']);
  });

  it('lists no keys when the storage throws', async () => {
    const broken = { get length() { throw new Error('denied'); } };
    expect(await webStore(broken).keys()).toEqual([]);
  });
});

describe('memoryStore', () => {
  it('lists its keys', async () => {
    const store = memoryStore();
    await store.set('a', 1);
    await store.set('b', 2);
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
    await store.remove('a');
    expect(await store.keys()).toEqual(['b']);
  });
});
