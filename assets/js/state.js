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

  /** Check if data is stale (older than threshold) */
  isStale(generatedAt) {
    if (!generatedAt) return false;
    const generated = new Date(generatedAt).getTime();
    const hoursSinceGen = (Date.now() - generated) / (1000 * 60 * 60);
    return hoursSinceGen > 6;
  },

  /** Invalidate cache for a key */
  invalidate(key) {
    delete this._cache[key];
    delete this._fetchTimestamps[key];
  }
};
