/**
 * AppState.js — Centralized observable application state.
 *
 * Single source of truth for all runtime data.
 * UI components subscribe to slices of state and re-render
 * only when their relevant slice changes.
 *
 * Pattern: Pub/Sub with named channels.
 * No framework dependency — pure vanilla JS.
 */

const AppState = (() => {
  // ── Internal state object ───────────────────────────────────
  const state = {
    // Active bankroll (full object or null)
    activeBankroll: null,

    // All bankrolls (array, for dropdown)
    bankrolls: [],

    // Bets for the active bankroll (array)
    bets: [],

    // Computed values (re-derived whenever bets/bankroll change)
    computed: {
      currentBankroll: 0,
      totalProfit: 0,
      winRate: 0,
      activeStake: 0,
      pendingCount: 0,
      profitToday: 0,
      profitThisWeek: 0,
    },

    // UI state
    ui: {
      activeTab: 'dashboard',    // 'dashboard' | 'history' | 'statistics' | 'settings'
      theme: 'dark',             // 'dark' | 'light' | 'system'
      isLoading: true,           // app-level loading state
      modalOpen: null,           // null | 'addBet' | 'editBet' | 'createBankroll' | 'deleteBankroll'
      editingBet: null,          // bet object being edited, or null
    },

    // History screen filter state
    historyFilters: {
      status: 'all',             // 'all' | 'pending' | 'win' | 'loss' | 'void'
      market: '',                // '' = no filter
      dateFrom: '',              // YYYY-MM-DD or ''
      dateTo: '',                // YYYY-MM-DD or ''
    },
  };

  // ── Subscriber registry ─────────────────────────────────────
  // Map<channel: string, Set<callback: Function>>
  const subscribers = new Map();

  // ── Internal helpers ────────────────────────────────────────

  /**
   * Notify all subscribers on a given channel.
   * @param {string} channel
   */
  function notify(channel) {
    if (subscribers.has(channel)) {
      for (const cb of subscribers.get(channel)) {
        try {
          cb(get(channel));
        } catch (err) {
          console.error(`[AppState] Error in subscriber for "${channel}":`, err);
        }
      }
    }
    // Always notify wildcard subscribers
    if (channel !== '*' && subscribers.has('*')) {
      for (const cb of subscribers.get('*')) {
        try {
          cb(channel, get(channel));
        } catch (err) {
          console.error(`[AppState] Error in wildcard subscriber:`, err);
        }
      }
    }
  }

  /**
   * Deep-get a nested key using dot notation.
   * @param {string} path — e.g. 'ui.activeTab' or 'activeBankroll'
   * @returns {*}
   */
  function get(path) {
    const parts = path.split('.');
    let current = state;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  // ── Public API ──────────────────────────────────────────────
  return {
    /**
     * Read a value from state using dot-notation path.
     * @param {string} path
     * @returns {*}
     */
    get,

    /**
     * Subscribe to a state channel.
     * Callback is called immediately with current value on subscription.
     *
     * @param {string} channel — dot-notation path or '*' for all changes
     * @param {Function} callback
     * @returns {Function} unsubscribe function
     */
    subscribe(channel, callback) {
      if (!subscribers.has(channel)) {
        subscribers.set(channel, new Set());
      }
      subscribers.get(channel).add(callback);
      // Fire immediately with current value
      try {
        callback(get(channel));
      } catch (err) {
        console.error(`[AppState] Error in initial subscribe call for "${channel}":`, err);
      }
      // Return unsubscribe
      return () => {
        subscribers.get(channel)?.delete(callback);
      };
    },

    // ── Bankroll state ────────────────────────────────────────

    /**
     * Set the list of all bankrolls.
     * @param {Object[]} bankrolls
     */
    setBankrolls(bankrolls) {
      state.bankrolls = bankrolls;
      notify('bankrolls');
    },

    /**
     * Set the active (selected) bankroll.
     * @param {Object|null} bankroll
     */
    setActiveBankroll(bankroll) {
      state.activeBankroll = bankroll;
      notify('activeBankroll');
    },

    // ── Bet state ─────────────────────────────────────────────

    /**
     * Replace the entire bets array for the active bankroll.
     * @param {Object[]} bets
     */
    setBets(bets) {
      state.bets = bets;
      notify('bets');
    },

    /**
     * Add a single bet to the front of the bets list (optimistic update).
     * @param {Object} bet
     */
    prependBet(bet) {
      state.bets = [bet, ...state.bets];
      notify('bets');
    },

    /**
     * Update a single bet in the list in-place.
     * @param {Object} updatedBet
     */
    updateBet(updatedBet) {
      state.bets = state.bets.map((b) =>
        b.id === updatedBet.id ? updatedBet : b
      );
      notify('bets');
    },

    /**
     * Remove a bet by id.
     * @param {string} betId
     */
    removeBet(betId) {
      state.bets = state.bets.filter((b) => b.id !== betId);
      notify('bets');
    },

    // ── Computed state ────────────────────────────────────────

    /**
     * Update all computed values at once (called by services after any bet/bankroll change).
     * @param {Object} computed
     */
    setComputed(computed) {
      state.computed = { ...state.computed, ...computed };
      notify('computed');
    },

    // ── UI state ──────────────────────────────────────────────

    /**
     * Switch the active bottom-nav tab.
     * @param {'dashboard'|'history'|'statistics'|'settings'} tab
     */
    setActiveTab(tab) {
      state.ui.activeTab = tab;
      notify('ui.activeTab');
    },

    /**
     * Set the current theme.
     * @param {'dark'|'light'|'system'} theme
     */
    setTheme(theme) {
      state.ui.theme = theme;
      notify('ui.theme');
    },

    /**
     * Show or hide the app-level loading indicator.
     * @param {boolean} loading
     */
    setLoading(loading) {
      state.ui.isLoading = loading;
      notify('ui.isLoading');
    },

    /**
     * Open a named modal.
     * @param {'addBet'|'editBet'|'createBankroll'|'deleteBankroll'|null} modal
     * @param {Object|null} context - e.g. the bet being edited
     */
    openModal(modal, context = null) {
      state.ui.modalOpen = modal;
      state.ui.editingBet = context;
      notify('ui.modalOpen');
    },

    /**
     * Close whichever modal is open.
     */
    closeModal() {
      state.ui.modalOpen = null;
      state.ui.editingBet = null;
      notify('ui.modalOpen');
    },

    // ── History filters ───────────────────────────────────────

    /**
     * Update one or more history filter fields.
     * @param {Partial<typeof state.historyFilters>} filters
     */
    setHistoryFilters(filters) {
      state.historyFilters = { ...state.historyFilters, ...filters };
      notify('historyFilters');
    },

    /**
     * Reset all history filters to defaults.
     */
    resetHistoryFilters() {
      state.historyFilters = {
        status: 'all',
        market: '',
        dateFrom: '',
        dateTo: '',
      };
      notify('historyFilters');
    },

    // ── Debug ─────────────────────────────────────────────────

    /**
     * Return a snapshot of the full state (for debugging only).
     * @returns {Object}
     */
    snapshot() {
      return JSON.parse(JSON.stringify(state));
    },
  };
})();

export default AppState;
