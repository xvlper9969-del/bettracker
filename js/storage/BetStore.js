/**
 * BetStore.js — Persistence layer for bets.
 * 
 * Bets are always scoped to a bankrollId.
 * All filtering is done via IndexedDB indexes where possible,
 * falling back to in-memory filtering for compound conditions.
 */

import Database, { STORES } from './Database.js';

const { promisify } = Database;

const BetStore = {
  /**
   * Insert a new bet.
   * @param {Object} bet
   * @returns {Promise<void>}
   */
  async add(bet) {
    const tx = Database.transaction(STORES.BETS, 'readwrite');
    const store = tx.objectStore(STORES.BETS);
    await promisify(store.add(bet));
    return Database.transactionComplete(tx);
  },

  /**
   * Retrieve a single bet by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    const tx = Database.transaction(STORES.BETS, 'readonly');
    const store = tx.objectStore(STORES.BETS);
    return promisify(store.get(id));
  },

  /**
   * Get all bets for a given bankroll, sorted by date descending.
   * @param {string} bankrollId
   * @returns {Promise<Object[]>}
   */
  async getByBankroll(bankrollId) {
    const tx = Database.transaction(STORES.BETS, 'readonly');
    const store = tx.objectStore(STORES.BETS);
    const index = store.index('bankrollId');
    const all = await promisify(index.getAll(bankrollId));
    // Sort: most recent date first, then by createdAt desc within same date
    return all.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  },

  /**
   * Get all bets for a bankroll filtered by status.
   * @param {string} bankrollId
   * @param {string} status - 'pending' | 'win' | 'loss' | 'void'
   * @returns {Promise<Object[]>}
   */
  async getByBankrollAndStatus(bankrollId, status) {
    const tx = Database.transaction(STORES.BETS, 'readonly');
    const store = tx.objectStore(STORES.BETS);
    const index = store.index('bankrollId_status');
    const key = [bankrollId, status];
    const results = await promisify(index.getAll(key));
    return results.sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * Get bets for a bankroll within a date range (inclusive).
   * Uses in-memory filtering after fetching all bankroll bets.
   * @param {string} bankrollId
   * @param {string} fromDate - YYYY-MM-DD
   * @param {string} toDate - YYYY-MM-DD
   * @returns {Promise<Object[]>}
   */
  async getByBankrollAndDateRange(bankrollId, fromDate, toDate) {
    const all = await this.getByBankroll(bankrollId);
    return all.filter((b) => b.date >= fromDate && b.date <= toDate);
  },

  /**
   * Get the N most recent bets for a bankroll.
   * @param {string} bankrollId
   * @param {number} limit
   * @returns {Promise<Object[]>}
   */
  async getRecentByBankroll(bankrollId, limit = 10) {
    const all = await this.getByBankroll(bankrollId);
    return all.slice(0, limit);
  },

  /**
   * Update a bet (full object replace).
   * @param {Object} bet - must include id
   * @returns {Promise<void>}
   */
  async update(bet) {
    const updatedBet = { ...bet, updatedAt: new Date().toISOString() };
    const tx = Database.transaction(STORES.BETS, 'readwrite');
    const store = tx.objectStore(STORES.BETS);
    await promisify(store.put(updatedBet));
    return Database.transactionComplete(tx);
  },

  /**
   * Delete a bet by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const tx = Database.transaction(STORES.BETS, 'readwrite');
    const store = tx.objectStore(STORES.BETS);
    await promisify(store.delete(id));
    return Database.transactionComplete(tx);
  },

  /**
   * Delete all bets belonging to a bankroll (used when deleting a bankroll).
   * @param {string} bankrollId
   * @returns {Promise<void>}
   */
  async deleteByBankroll(bankrollId) {
    const bets = await this.getByBankroll(bankrollId);
    if (bets.length === 0) return;

    const tx = Database.transaction(STORES.BETS, 'readwrite');
    const store = tx.objectStore(STORES.BETS);

    for (const bet of bets) {
      store.delete(bet.id);
    }

    return Database.transactionComplete(tx);
  },

  /**
   * Count bets for a bankroll.
   * @param {string} bankrollId
   * @returns {Promise<number>}
   */
  async countByBankroll(bankrollId) {
    const tx = Database.transaction(STORES.BETS, 'readonly');
    const store = tx.objectStore(STORES.BETS);
    const index = store.index('bankrollId');
    return promisify(index.count(bankrollId));
  },

  /**
   * Count pending bets for a bankroll.
   * @param {string} bankrollId
   * @returns {Promise<number>}
   */
  async countPendingByBankroll(bankrollId) {
    const tx = Database.transaction(STORES.BETS, 'readonly');
    const store = tx.objectStore(STORES.BETS);
    const index = store.index('bankrollId_status');
    return promisify(index.count([bankrollId, 'pending']));
  },
};

export default BetStore;
