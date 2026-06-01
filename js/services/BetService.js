/**
 * BetService.js — Business logic for bet lifecycle.
 *
 * Handles all bet mutations: create, update, delete.
 * After every mutation it triggers a stats refresh via BankrollService.
 *
 * IMPORTANT: Status transitions follow this model —
 *   pending → win | loss | void
 *   win / loss / void → can be edited back to any status
 *
 * Bankroll impact is always derived dynamically from stored bets,
 * never stored as a running total.
 */

import BetStore from '../storage/BetStore.js';
import MarketService from './MarketService.js';
import BankrollService from './BankrollService.js';
import AppState from '../state/AppState.js';
import { generateId } from '../utils/uuid.js';
import { formatDateInput } from '../utils/format.js';

const BetService = {
  /**
   * Create a new bet and add it to the active bankroll.
   *
   * @param {Object} params
   * @param {string} params.title
   * @param {string} params.market
   * @param {number} params.stake
   * @param {number} params.odds
   * @param {string} params.status  - 'pending' | 'win' | 'loss' | 'void'
   * @param {string} params.date    - YYYY-MM-DD
   * @returns {Promise<Object>} the created bet
   */
  async create({ title, market, stake, odds, status = 'pending', date }) {
    const bankroll = AppState.get('activeBankroll');
    if (!bankroll) throw new Error('No active bankroll selected.');

    // ── Validation ────────────────────────────────────────────
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) throw new Error('Bet title is required.');

    const parsedStake = parseFloat(stake);
    if (isNaN(parsedStake) || parsedStake <= 0) {
      throw new Error('Stake must be a positive number.');
    }

    const parsedOdds = parseFloat(odds);
    if (isNaN(parsedOdds) || parsedOdds < 1) {
      throw new Error('Odds must be at least 1.00 (decimal format).');
    }

    const validStatuses = ['pending', 'win', 'loss', 'void'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const betDate = date || formatDateInput();

    // ── Construct bet ─────────────────────────────────────────
    const now = new Date().toISOString();
    const bet = {
      id: generateId(),
      bankrollId: bankroll.id,
      title: trimmedTitle,
      market: market?.trim() || '',
      stake: parsedStake,
      odds: parsedOdds,
      status,
      date: betDate,
      createdAt: now,
      updatedAt: now,
    };

    // ── Persist ───────────────────────────────────────────────
    await BetStore.add(bet);

    // Optimistically prepend to state (most recent first)
    AppState.prependBet(bet);

    // Record market for autocomplete
    if (bet.market) {
      MarketService.recordMarket(bet.market); // fire-and-forget
    }

    // Refresh computed stats
    await BankrollService.refreshStats();

    return bet;
  },

  /**
   * Update an existing bet (any field).
   * After update, stats are refreshed to reflect new bankroll impact.
   *
   * @param {string} betId
   * @param {Object} changes - partial fields to update
   * @returns {Promise<Object>} updated bet
   */
  async update(betId, changes) {
    const existing = AppState.get('bets').find((b) => b.id === betId);
    if (!existing) throw new Error(`Bet ${betId} not found in current state.`);

    // Sanitize numeric fields if present
    const updates = { ...changes };
    if (updates.stake !== undefined) {
      updates.stake = parseFloat(updates.stake);
      if (isNaN(updates.stake) || updates.stake <= 0) {
        throw new Error('Stake must be a positive number.');
      }
    }
    if (updates.odds !== undefined) {
      updates.odds = parseFloat(updates.odds);
      if (isNaN(updates.odds) || updates.odds < 1) {
        throw new Error('Odds must be at least 1.00.');
      }
    }
    if (updates.title !== undefined) {
      updates.title = updates.title.trim();
      if (!updates.title) throw new Error('Bet title is required.');
    }
    if (updates.market !== undefined) {
      updates.market = updates.market.trim();
    }

    const updatedBet = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await BetStore.update(updatedBet);
    AppState.updateBet(updatedBet);

    // Record market if it changed
    if (updates.market && updates.market !== existing.market) {
      MarketService.recordMarket(updates.market);
    }

    await BankrollService.refreshStats();

    return updatedBet;
  },

  /**
   * Settle a bet — convenience wrapper around update for status changes.
   * @param {string} betId
   * @param {'win'|'loss'|'void'} newStatus
   * @returns {Promise<Object>}
   */
  async settle(betId, newStatus) {
    return this.update(betId, { status: newStatus });
  },

  /**
   * Delete a bet permanently.
   * Returns the deleted bet so callers can offer undo.
   *
   * @param {string} betId
   * @returns {Promise<Object>} the deleted bet (for undo)
   */
  async delete(betId) {
    const bet = AppState.get('bets').find((b) => b.id === betId);
    if (!bet) throw new Error(`Bet ${betId} not found.`);

    await BetStore.delete(betId);
    AppState.removeBet(betId);
    await BankrollService.refreshStats();

    return bet; // Return for undo
  },

  /**
   * Undo a delete by re-inserting the bet.
   * Only works immediately after a delete (caller must hold the bet object).
   *
   * @param {Object} bet - the previously deleted bet object
   * @returns {Promise<void>}
   */
  async undoDelete(bet) {
    await BetStore.add(bet);

    // Re-insert into state in correct position (by date desc)
    const bets = AppState.get('bets');
    const inserted = [...bets, bet].sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
    AppState.setBets(inserted);

    await BankrollService.refreshStats();
  },

  /**
   * Apply history filters to the in-memory bets array.
   * Returns filtered bets without touching persistent state.
   *
   * @param {Object[]} bets
   * @param {Object} filters - { status, market, dateFrom, dateTo }
   * @returns {Object[]}
   */
  applyFilters(bets, filters) {
    let result = bets;

    if (filters.status && filters.status !== 'all') {
      result = result.filter((b) => b.status === filters.status);
    }

    if (filters.market) {
      const q = filters.market.toLowerCase();
      result = result.filter((b) => b.market.toLowerCase().includes(q));
    }

    if (filters.dateFrom) {
      result = result.filter((b) => b.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
      result = result.filter((b) => b.date <= filters.dateTo);
    }

    return result;
  },
};

export default BetService;
