/**
 * BankrollService.js — Business logic for bankrolls.
 *
 * Orchestrates BankrollStore + BetStore + SettingsStore,
 * applies business rules, and updates AppState.
 *
 * This is the only place that knows how bankrolls are created,
 * switched, or deleted. UI calls these methods directly.
 */

import BankrollStore from '../storage/BankrollStore.js';
import BetStore from '../storage/BetStore.js';
import SettingsStore from '../storage/SettingsStore.js';
import AppState from '../state/AppState.js';
import { generateId } from '../utils/uuid.js';
import {
  calculateCurrentBankroll,
  calculateTotalProfit,
  calculateWinRate,
  calculateActiveStake,
  calculateProfitForDate,
  calculateProfitForRange,
  getTodayString,
  getWeekStartString,
} from '../utils/calc.js';

const BankrollService = {
  /**
   * Bootstrap: load all bankrolls and restore the last active one.
   * Called once during app initialization.
   * @returns {Promise<void>}
   */
  async initialize() {
    const bankrolls = await BankrollStore.getAll();
    AppState.setBankrolls(bankrolls);

    if (bankrolls.length === 0) return;

    // Restore last used bankroll, or fall back to first
    const lastId = await SettingsStore.getLastBankrollId();
    const target =
      (lastId && bankrolls.find((b) => b.id === lastId)) || bankrolls[0];

    await this.selectBankroll(target.id);
  },

  /**
   * Create a new bankroll and immediately switch to it.
   *
   * @param {Object} params
   * @param {string} params.name
   * @param {number} params.initialBankroll
   * @param {string} params.currency - ISO 4217 code e.g. 'USD'
   * @returns {Promise<Object>} the created bankroll
   */
  async create({ name, initialBankroll, currency }) {
    // Validation
    const trimmedName = name?.trim();
    if (!trimmedName) throw new Error('Bankroll name is required.');

    const initial = parseFloat(initialBankroll);
    if (isNaN(initial) || initial < 0) {
      throw new Error('Initial bankroll must be a non-negative number.');
    }

    const bankroll = {
      id: generateId(),
      name: trimmedName,
      initialBankroll: initial,
      currency: currency?.trim().toUpperCase() || 'USD',
      createdAt: new Date().toISOString(),
    };

    await BankrollStore.add(bankroll);

    // Refresh bankrolls list in state
    const bankrolls = await BankrollStore.getAll();
    AppState.setBankrolls(bankrolls);

    // Auto-switch to the new bankroll
    await this.selectBankroll(bankroll.id);

    return bankroll;
  },

  /**
   * Switch the active bankroll.
   * Loads its bets, recomputes stats, and updates state.
   *
   * @param {string} bankrollId
   * @returns {Promise<void>}
   */
  async selectBankroll(bankrollId) {
    const bankroll = await BankrollStore.getById(bankrollId);
    if (!bankroll) throw new Error(`Bankroll ${bankrollId} not found.`);

    AppState.setActiveBankroll(bankroll);

    // Load bets for this bankroll
    const bets = await BetStore.getByBankroll(bankrollId);
    AppState.setBets(bets);

    // Recompute all derived stats
    this._recomputeStats(bankroll, bets);

    // Persist the selection
    await SettingsStore.setLastBankrollId(bankrollId);
  },

  /**
   * Delete a bankroll and all its bets.
   * If it was the active bankroll, switches to another one (or clears state).
   *
   * @param {string} bankrollId
   * @returns {Promise<void>}
   */
  async delete(bankrollId) {
    const wasActive = AppState.get('activeBankroll')?.id === bankrollId;

    // Delete all bets first
    await BetStore.deleteByBankroll(bankrollId);
    await BankrollStore.delete(bankrollId);

    const bankrolls = await BankrollStore.getAll();
    AppState.setBankrolls(bankrolls);

    if (wasActive) {
      if (bankrolls.length > 0) {
        await this.selectBankroll(bankrolls[0].id);
      } else {
        // No bankrolls left — clear everything
        AppState.setActiveBankroll(null);
        AppState.setBets([]);
        AppState.setComputed({
          currentBankroll: 0,
          totalProfit: 0,
          winRate: 0,
          activeStake: 0,
          pendingCount: 0,
          profitToday: 0,
          profitThisWeek: 0,
        });
        await SettingsStore.setLastBankrollId(null);
      }
    }
  },

  /**
   * Refresh computed stats for the active bankroll.
   * Call this after any bet mutation to keep stats in sync.
   * @returns {Promise<void>}
   */
  async refreshStats() {
    const bankroll = AppState.get('activeBankroll');
    const bets = AppState.get('bets');
    if (!bankroll) return;
    this._recomputeStats(bankroll, bets);
  },

  /**
   * Recompute all derived stats and push to AppState.
   * Pure synchronous calculation — all data already in memory.
   *
   * @param {Object} bankroll
   * @param {Object[]} bets
   */
  _recomputeStats(bankroll, bets) {
    const today = getTodayString();
    const weekStart = getWeekStartString();

    AppState.setComputed({
      currentBankroll: calculateCurrentBankroll(bankroll.initialBankroll, bets),
      totalProfit: calculateTotalProfit(bets),
      winRate: calculateWinRate(bets),
      activeStake: calculateActiveStake(bets),
      pendingCount: bets.filter((b) => b.status === 'pending').length,
      profitToday: calculateProfitForDate(bets, today),
      profitThisWeek: calculateProfitForRange(bets, weekStart, today),
    });
  },
};

export default BankrollService;
