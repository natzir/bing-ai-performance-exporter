// Where an export keeps its progress: chrome.storage.local in the extension, localStorage in the
// bookmarklet, memory when the page allows neither. All three are get/set/remove/keys; `set` rejects when
// the browser refuses (localStorage full), so the engine can say progress isn't being saved.
export const chromeStore = area => ({
  async get(key) {
    return (await area.get(key))[key] ?? null;
  },
  async set(key, value) {
    await area.set({ [key]: value });
  },
  async remove(key) {
    await area.remove(key);
  },
  async keys() {
    return Object.keys(await area.get(null));
  },
});

export const webStore = storage => ({
  async get(key) {
    try {
      return JSON.parse(storage.getItem(key) ?? 'null');
    } catch {
      return null;
    }
  },
  async set(key, value) {
    storage.setItem(key, JSON.stringify(value));
  },
  async remove(key) {
    try {
      storage.removeItem(key);
    } catch {
      // Nothing to remove, or storage is gone: either way there is nothing to keep.
    }
  },
  async keys() {
    try {
      return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(key => key !== null);
    } catch {
      return [];
    }
  },
});

export function memoryStore() {
  const data = new Map();
  return {
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async remove(key) {
      data.delete(key);
    },
    async keys() {
      return [...data.keys()];
    },
  };
}
