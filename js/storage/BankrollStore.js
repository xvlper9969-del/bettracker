/**
 * BankrollStore.js — Persistence layer for bankrolls.
 * 
 * All methods are async and return plain JavaScript objects.
 * No business logic here — only reads and writes to IndexedDB.
 */

import Database, { STORES } from './Database.js';

const { promisify } = Database;

const BankrollStore = {
  /**
   * Insert a new bankroll record.
   * @param {Object} bankroll - { id, name, initialBankroll, currency, createdAt }
   * @returns {Promise<void>}
   */
  async add(bankroll) {
    const tx = Database.transaction(STORES.BANKROLLS, 'readwrite');
    const store = tx.objectStore(STORES.BANKROLLS);
    await promisify(store.add(bankroll));
    return Database.transactionComplete(tx);
  },

  /**
   * Retrieve a bankroll by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    const tx = Database.transaction(STORES.BANKROLLS, 'readonly');
    const store = tx.objectStore(STORES.BANKROLLS);
    return promisify(store.get(id));
  },

  /**
   * Retrieve all bankrolls, sorted by createdAt ascending.
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    const tx = Database.transaction(STORES.BANKROLLS, 'readonly');
    const store = tx.objectStore(STORES.BANKROLLS);
    const all = await promisify(store.getAll());
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /**
   * Update an existing bankroll (full object replace).
   * @param {Object} bankroll - must include id
   * @returns {Promise<void>}
   */
  async update(bankroll) {
    const tx = Database.transaction(STORES.BANKROLLS, 'readwrite');
    const store = tx.objectStore(STORES.BANKROLLS);
    await promisify(store.put(bankroll));
    return Database.transactionComplete(tx);
  },

  /**
   * Delete a bankroll by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const tx = Database.transaction(STORES.BANKROLLS, 'readwrite');
    const store = tx.objectStore(STORES.BANKROLLS);
    await promisify(store.delete(id));
    return Database.transactionComplete(tx);
  },

  /**
   * Count total bankrolls.
   * @returns {Promise<number>}
   */
  async count() {
    const tx = Database.transaction(STORES.BANKROLLS, 'readonly');
    const store = tx.objectStore(STORES.BANKROLLS);
    return promisify(store.count());
  },
};

export default BankrollStore;
