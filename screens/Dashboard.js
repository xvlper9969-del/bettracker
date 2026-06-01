/**
 * Dashboard.js — Dashboard screen.
 *
 * Sections:
 *   1. Bankroll selector (mounted in header)
 *   2. Primary bankroll card (current balance + total profit)
 *   3. 2×2 stat grid (win rate, pending, active stake, today's profit)
 *   4. Weekly profit stat
 *   5. Recent bets list (last 8)
 *
 * Subscribes to AppState 'computed' and 'bets' for live updates.
 */

import AppState from '../js/state/AppState.js';
import { createBetCard } from '../components/BetCard.js';
import {
  formatCurrency,
  formatProfitCurrency,
  formatPercent,
} from '../js/utils/format.js';

/** @type {HTMLElement} */
let screenEl;

/** @type {Function[]} unsubscribe callbacks */
const _unsubs = [];

/**
 * Called once from app.js to set up subscriptions.
 */
export function initDashboard() {
  screenEl = document.querySelector('[data-screen="dashboard"]');
  if (!screenEl) return;

  // Re-render whenever computed stats or bets change
  _unsubs.push(AppState.subscribe('computed', () => _renderStats()));
  _unsubs.push(AppState.subscribe('bets', () => _renderRecentBets()));
  _unsubs.push(AppState.subscribe('activeBankroll', () => {
    _renderStats();
    _renderRecentBets();
  }));
}

/**
 * Full screen render — called by router when tab becomes active.
 */
export function renderDashboard() {
  _renderStats();
  _renderRecentBets();
}

/**
 * Render the bankroll card and stat grid.
 */
function _renderStats() {
  const bankroll = AppState.get('activeBankroll');
  const computed = AppState.get('computed');
  const currency = bankroll?.currency || 'USD';

  // ── No bankroll state ───────────────────────────────────────
  const noBankroll = screenEl.querySelector('#dashboard-no-bankroll');
  const dashContent = screenEl.querySelector('#dashboard-content');

  if (!bankroll) {
    if (noBankroll) noBankroll.style.display = 'flex';
    if (dashContent) dashContent.style.display = 'none';
    return;
  }

  if (noBankroll) noBankroll.style.display = 'none';
  if (dashContent) dashContent.style.display = '';

  // ── Bankroll card ────────────────────────────────────────────
  const currentBankroll = computed.currentBankroll;
  const totalProfit     = computed.totalProfit;
  const profitClass     = totalProfit > 0 ? 'bankroll-card__profit--pos'
                        : totalProfit < 0 ? 'bankroll-card__profit--neg'
                        : 'bankroll-card__profit--zero';

  const bankrollValueEl = screenEl.querySelector('#dash-bankroll-value');
  const bankrollProfitEl = screenEl.querySelector('#dash-bankroll-profit');
  const bankrollInitialEl = screenEl.querySelector('#dash-bankroll-initial');

  if (bankrollValueEl) {
    bankrollValueEl.textContent = formatCurrency(currentBankroll, currency);
  }
  if (bankrollProfitEl) {
    bankrollProfitEl.textContent = formatProfitCurrency(totalProfit, currency);
    bankrollProfitEl.className = `bankroll-card__profit ${profitClass}`;
  }
  if (bankrollInitialEl) {
    bankrollInitialEl.textContent = `Initial: ${formatCurrency(bankroll.initialBankroll, currency)}`;
  }

  // ── Stat cards ───────────────────────────────────────────────
  _setText('#dash-win-rate',    formatPercent(computed.winRate));
  _setText('#dash-pending',     String(computed.pendingCount));
  _setText('#dash-active-stake', formatCurrency(computed.activeStake, currency));
  _setText('#dash-profit-today', formatProfitCurrency(computed.profitToday, currency));
  _setText('#dash-profit-week',  formatProfitCurrency(computed.profitThisWeek, currency));

  // Colour profit values
  _colorProfit('#dash-profit-today', computed.profitToday);
  _colorProfit('#dash-profit-week',  computed.profitThisWeek);
}

/**
 * Render the recent bets list (last 8 bets).
 */
function _renderRecentBets() {
  const listEl = screenEl.querySelector('#recent-bets-list');
  if (!listEl) return;

  const bets = AppState.get('bets').slice(0, 8);

  listEl.innerHTML = '';

  if (bets.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <div class="empty-state__title">No bets yet</div>
        <div class="empty-state__subtitle">Tap + to record your first bet</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const bet of bets) {
    fragment.appendChild(createBetCard(bet, { expandable: true }));
  }
  listEl.appendChild(fragment);
}

// ── Helpers ───────────────────────────────────────────────────

function _setText(selector, text) {
  const el = screenEl.querySelector(selector);
  if (el) el.textContent = text;
}

function _colorProfit(selector, value) {
  const el = screenEl.querySelector(selector);
  if (!el) return;
  el.style.color = value > 0 ? 'var(--win)'
                 : value < 0 ? 'var(--loss)'
                 : 'var(--text-primary)';
}
