/**
 * Global state management — cached JSON data, refresh control.
 */
const State = {
  _cache: {},
  _cacheTTL: 5 * 60 * 1000, // 5 minutes
  _fetchTimestamps: {},

  /** Fetch data with caching */
  async get(key, url) {
    const now = Date.now();
    const cached = this._cache[key];
    const ts = this._fetchTimestamps[key] || 0;

    if (cached && (now - ts) < this._cacheTTL) {
      return cached;
    }

    const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    const data = await Utils.fetchJSON(cacheBustUrl);
    if (data) {
      this._cache[key] = data;
      this._fetchTimestamps[key] = now;
    }
    return data;
  },

  /** Check if data is stale (older than threshold).
   *  Default 6h suits the 30-min-refresh datasets (latest.json, GEX). */
  isStale(generatedAt, maxHours = 6) {
    if (!generatedAt) return false;
    const generated = new Date(generatedAt).getTime();
    const hoursSinceGen = (Date.now() - generated) / (1000 * 60 * 60);
    return hoursSinceGen > maxHours;
  },

  /** Staleness for once-a-day datasets (the screener runs ~10:30 AM ET on
   *  trading days). Such data is fresh for its whole ET calendar day — a
   *  flat 6h window wrongly flagged every afternoon/evening as stale. */
  isStaleDaily(generatedAt) {
    if (!generatedAt) return false;
    const gen = new Date(generatedAt);
    if (isNaN(gen.getTime())) return false;
    const etDay = d => d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    return etDay(gen) !== etDay(new Date());
  },

  /** Invalidate cache for a key */
  invalidate(key) {
    delete this._cache[key];
    delete this._fetchTimestamps[key];
  }
};
