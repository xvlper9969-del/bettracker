/**
 * MarketService.js — Business logic for market autocomplete.
 *
 * Wraps MarketStore with caching so UI input fields can call
 * getSuggestions() synchronously on every keystroke without
 * hitting IndexedDB each time.
 *
 * Cache is refreshed whenever a new market is recorded.
 */

import MarketStore from '../storage/MarketStore.js';

const MarketService = {
  /** @type {string[]} In-memory cache of market names (sorted by usage) */
  _cache: [],

  /** @type {boolean} Whether the cache has been loaded */
  _loaded: false,

  /**
   * Prime the cache from IndexedDB.
   * Called once during app init. Safe to call multiple times.
   * @returns {Promise<void>}
   */
  async initialize() {
    this._cache = await MarketStore.getAllNames();
    this._loaded = true;
  },

  /**
   * Record that a market name was used.
   * Updates IndexedDB and refreshes cache.
   * Fire-and-forget safe.
   *
   * @param {string} name
   * @returns {Promise<void>}
   */
  async recordMarket(name) {
    const trimmed = name?.trim();
    if (!trimmed) return;
    await MarketStore.upsert(trimmed);
    // Refresh cache
    this._cache = await MarketStore.getAllNames();
  },

  /**
   * Get autocomplete suggestions for a partial input.
   * Synchronous — uses in-memory cache.
   *
   * @param {string} query - partial market name
   * @param {number} limit - max results
   * @returns {string[]}
   */
  getSuggestions(query, limit = 8) {
    if (!this._loaded) return [];
    const q = query?.toLowerCase().trim();
    if (!q) return this._cache.slice(0, limit);
    return this._cache
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, limit);
  },

  /**
   * Get all known market names (for filter dropdowns etc).
   * @returns {string[]}
   */
  getAllMarkets() {
    return [...this._cache];
  },
};

export default MarketService;
