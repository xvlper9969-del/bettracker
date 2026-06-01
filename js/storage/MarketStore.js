/**
 * MarketStore.js — Persistence layer for markets.
 * 
 * Markets are global (not scoped to a bankroll) to enable
 * autocomplete suggestions across all bankrolls.
 * 
 * Each market tracks how many times it's been used so we can
 * rank suggestions by frequency.
 */

import Database, { STORES } from './Database.js';

const promisify = Database.constructor.promisify;

const MarketStore = {
  /**
   * Get all markets, sorted by usageCount descending.
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    const tx = Database.transaction(STORES.MARKETS, 'readonly');
    const store = tx.objectStore(STORES.MARKETS);
    const all = await promisify(store.getAll());
    return all.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  },

  /**
   * Get all market names for autocomplete (sorted by usage).
   * @returns {Promise<string[]>}
   */
  async getAllNames() {
    const markets = await this.getAll();
    return markets.map((m) => m.name);
  },

  /**
   * Find a market by its exact name (case-insensitive match via stored lowercase).
   * @param {string} name
   * @returns {Promise<Object|undefined>}
   */
  async getByName(name) {
    const tx = Database.transaction(STORES.MARKETS, 'readonly');
    const store = tx.objectStore(STORES.MARKETS);
    const index = store.index('name');
    return promisify(index.get(name.trim()));
  },

  /**
   * Add a new market or increment usageCount if it already exists.
   * This is the main entry point — call whenever a market name is used.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async upsert(name) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = await this.getByName(trimmed);

    const tx = Database.transaction(STORES.MARKETS, 'readwrite');
    const store = tx.objectStore(STORES.MARKETS);

    if (existing) {
      store.put({ ...existing, usageCount: (existing.usageCount || 0) + 1 });
    } else {
      const { generateId } = await import('../utils/uuid.js');
      store.add({
        id: generateId(),
        name: trimmed,
        usageCount: 1,
        createdAt: new Date().toISOString(),
      });
    }

    return Database.transactionComplete(tx);
  },

  /**
   * Delete a market by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const tx = Database.transaction(STORES.MARKETS, 'readwrite');
    const store = tx.objectStore(STORES.MARKETS);
    await promisify(store.delete(id));
    return Database.transactionComplete(tx);
  },

  /**
   * Get market suggestions matching a partial query string.
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<string[]>}
   */
  async getSuggestions(query, limit = 8) {
    const names = await this.getAllNames();
    const q = query.toLowerCase().trim();
    if (!q) return names.slice(0, limit);
    return names
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, limit);
  },
};

export default MarketStore;
