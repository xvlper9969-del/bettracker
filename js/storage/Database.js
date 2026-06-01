/**
 * Database.js — IndexedDB wrapper with schema versioning.
 * 
 * Provides a promise-based API over the IndexedDB request model.
 * All schema changes are handled in the `onupgradeneeded` handler.
 * 
 * Single instance pattern — call Database.open() once at app start,
 * then access via Database.getInstance().
 */

const DB_NAME = 'BettingAnalyticsDB';
const DB_VERSION = 1;

// Object store names — exported as constants to avoid string typos
export const STORES = {
  BANKROLLS: 'bankrolls',
  BETS: 'bets',
  MARKETS: 'markets',
  SETTINGS: 'settings',
};

class Database {
  constructor() {
    /** @type {IDBDatabase|null} */
    this._db = null;
  }

  /**
   * Open the database and run any needed migrations.
   * Must be called once before any other database operations.
   * @returns {Promise<void>}
   */
  open() {
    return new Promise((resolve, reject) => {
      if (this._db) {
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this._createSchema(db, event.oldVersion);
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;

        // Handle unexpected connection losses
        this._db.onversionchange = () => {
          this._db.close();
          this._db = null;
          console.warn('[DB] Database version changed — connection closed.');
        };

        resolve();
      };

      request.onerror = (event) => {
        reject(new Error(`[DB] Failed to open: ${event.target.error?.message}`));
      };

      request.onblocked = () => {
        console.warn('[DB] Open blocked — another tab has an older version open.');
      };
    });
  }

  /**
   * Create or migrate the database schema.
   * @param {IDBDatabase} db
   * @param {number} oldVersion
   */
  _createSchema(db, oldVersion) {
    // Version 1 — initial schema
    if (oldVersion < 1) {
      // ── BANKROLLS ─────────────────────────────────────────
      const bankrollStore = db.createObjectStore(STORES.BANKROLLS, {
        keyPath: 'id',
      });
      bankrollStore.createIndex('createdAt', 'createdAt', { unique: false });

      // ── BETS ──────────────────────────────────────────────
      const betStore = db.createObjectStore(STORES.BETS, {
        keyPath: 'id',
      });
      betStore.createIndex('bankrollId', 'bankrollId', { unique: false });
      betStore.createIndex('status', 'status', { unique: false });
      betStore.createIndex('date', 'date', { unique: false });
      betStore.createIndex('createdAt', 'createdAt', { unique: false });
      // Compound index for common query: bets by bankroll + status
      betStore.createIndex('bankrollId_status', ['bankrollId', 'status'], {
        unique: false,
      });
      // Compound index for bets by bankroll + date (for sorting)
      betStore.createIndex('bankrollId_date', ['bankrollId', 'date'], {
        unique: false,
      });

      // ── MARKETS ───────────────────────────────────────────
      const marketStore = db.createObjectStore(STORES.MARKETS, {
        keyPath: 'id',
      });
      marketStore.createIndex('name', 'name', { unique: true });
      marketStore.createIndex('usageCount', 'usageCount', { unique: false });

      // ── SETTINGS ──────────────────────────────────────────
      // Key-value store: { key: string, value: any }
      db.createObjectStore(STORES.SETTINGS, {
        keyPath: 'key',
      });
    }

    // Future versions: add `if (oldVersion < 2) { ... }` here
  }

  /**
   * Get the active database connection.
   * @returns {IDBDatabase}
   * @throws {Error} if not yet opened
   */
  getDB() {
    if (!this._db) {
      throw new Error('[DB] Database not open. Call Database.open() first.');
    }
    return this._db;
  }

  /**
   * Start an IndexedDB transaction.
   * @param {string|string[]} storeNames
   * @param {'readonly'|'readwrite'} mode
   * @returns {IDBTransaction}
   */
  transaction(storeNames, mode = 'readonly') {
    return this.getDB().transaction(storeNames, mode);
  }

  /**
   * Wrap an IDBRequest in a Promise.
   * @param {IDBRequest} request
   * @returns {Promise<any>}
   */
  static promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Wrap a transaction in a Promise that resolves when the transaction completes.
   * @param {IDBTransaction} tx
   * @returns {Promise<void>}
   */
  static transactionComplete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  /**
   * Close the database connection. Useful for testing.
   */
  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}

// Singleton instance
const instance = new Database();
export default instance;
