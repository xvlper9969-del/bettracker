/**
 * SettingsStore.js — Persistence layer for application settings.
 * 
 * Key-value store backed by IndexedDB.
 * Keys are arbitrary strings; values are JSON-serializable.
 * 
 * Used for:
 *   - 'theme' → 'dark' | 'light' | 'system'
 *   - 'lastBankrollId' → string uuid
 */

import Database, { STORES } from './Database.js';

const promisify = Database.constructor.promisify;

const SettingsStore = {
  /**
   * Read a setting value by key.
   * @param {string} key
   * @param {*} defaultValue - returned if key doesn't exist
   * @returns {Promise<*>}
   */
  async get(key, defaultValue = null) {
    const tx = Database.transaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);
    const record = await promisify(store.get(key));
    return record !== undefined ? record.value : defaultValue;
  },

  /**
   * Write a setting value.
   * @param {string} key
   * @param {*} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    const tx = Database.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    await promisify(store.put({ key, value }));
    return Database.transactionComplete(tx);
  },

  /**
   * Delete a setting by key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(key) {
    const tx = Database.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    await promisify(store.delete(key));
    return Database.transactionComplete(tx);
  },

  /**
   * Convenience: read the active theme setting.
   * @returns {Promise<'dark'|'light'|'system'>}
   */
  async getTheme() {
    return this.get('theme', 'dark');
  },

  /**
   * Convenience: save the active theme setting.
   * @param {'dark'|'light'|'system'} theme
   * @returns {Promise<void>}
   */
  async setTheme(theme) {
    return this.set('theme', theme);
  },

  /**
   * Convenience: read the last active bankroll ID.
   * @returns {Promise<string|null>}
   */
  async getLastBankrollId() {
    return this.get('lastBankrollId', null);
  },

  /**
   * Convenience: save the last active bankroll ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async setLastBankrollId(id) {
    return this.set('lastBankrollId', id);
  },
};

export default SettingsStore;
