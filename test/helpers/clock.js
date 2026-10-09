// A clock whose sleep moves time on at once, so hours of Bing throttling take no time in a test.
// `onSleep(ms)` sees every sleep, before time moves.
export function fakeClock(start = Date.parse('2026-05-17T15:00:00Z'), onSleep) {
  let t = start;
  return {
    now: () => t,
    async sleep(ms) {
      onSleep?.(ms);
      t += ms;
      await Promise.resolve();
    },
    get elapsed() {
      return t - start;
    },
  };
}
