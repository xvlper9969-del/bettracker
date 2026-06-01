/**
 * BetCard.js — Renders a single bet as a tappable card.
 *
 * States:
 *   collapsed — shows title, market, stake, odds, status dot
 *   expanded  — shows full detail grid + edit/delete action buttons
 *
 * Returns an HTMLElement ready to append to the DOM.
 */

import AppState from '../js/state/AppState.js';
import BetService from '../js/services/BetService.js';
import { showToast } from './Toast.js';
import {
  formatCurrency,
  formatOdds,
  formatRelativeDate,
} from '../js/utils/format.js';

/**
 * Create a bet card DOM element.
 *
 * @param {Object} bet
 * @param {Object} opts
 * @param {boolean} opts.expandable - whether tap expands detail (default true)
 * @returns {HTMLElement}
 */
export function createBetCard(bet, opts = {}) {
  const expandable = opts.expandable !== false;
  const currency = AppState.get('activeBankroll')?.currency || 'USD';

  const el = document.createElement('div');
  el.className = 'card bet-card';
  el.dataset.betId = bet.id;

  el.innerHTML = _renderCard(bet, currency);

  if (expandable) {
    // Tap the summary row to expand/collapse
    el.querySelector('.bet-card__summary')?.addEventListener('click', () => {
      el.classList.toggle('bet-card--expanded');
    });

    // Edit button
    el.querySelector('.bet-card__edit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.openModal('editBet', bet);
    });

    // Delete button
    el.querySelector('.bet-card__delete-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const deletedBet = await BetService.delete(bet.id);
        showToast({
          message: 'Bet deleted',
          action: 'Undo',
          duration: 5000,
          onAction: () => BetService.undoDelete(deletedBet),
        });
      } catch (err) {
        showToast({ message: err.message || 'Failed to delete bet' });
      }
    });
  }

  return el;
}

/**
 * Generate the inner HTML for a bet card.
 * @param {Object} bet
 * @param {string} currency
 * @returns {string}
 */
function _renderCard(bet, currency) {
  const profit = _calcProfit(bet);
  const profitClass = profit > 0 ? 'bet-card__amount--win' : profit < 0 ? 'bet-card__amount--loss' : '';
  const profitDisplay = bet.status === 'pending'
    ? `<span style="color:var(--pending)">-${formatCurrency(bet.stake, currency)}</span>`
    : bet.status === 'void'
    ? '<span style="color:var(--void)">Void</span>'
    : `<span class="${profitClass}">${profit >= 0 ? '+' : ''}${formatCurrency(profit, currency)}</span>`;

  const dateLabel = formatRelativeDate(bet.date);
  const metaParts = [];
  if (bet.market) metaParts.push(_esc(bet.market));
  metaParts.push(dateLabel);

  return `
    <!-- Collapsed summary row -->
    <div class="bet-card__summary">
      <div class="bet-card__status-dot bet-card__status-dot--${bet.status}"></div>
      <div class="bet-card__info">
        <div class="bet-card__title">${_esc(bet.title)}</div>
        <div class="bet-card__meta">${metaParts.join(' · ')}</div>
      </div>
      <div class="bet-card__right">
        ${profitDisplay}
        <div class="bet-card__odds">${formatOdds(bet.odds)}x</div>
      </div>
    </div>

    <!-- Expanded detail -->
    <div class="bet-card__detail">
      <div class="bet-card__detail-grid">
        <div class="bet-card__detail-item">
          <span class="bet-card__detail-label">Stake</span>
          <span class="bet-card__detail-value">${formatCurrency(bet.stake, currency)}</span>
        </div>
        <div class="bet-card__detail-item">
          <span class="bet-card__detail-label">Odds</span>
          <span class="bet-card__detail-value">${formatOdds(bet.odds)}</span>
        </div>
        <div class="bet-card__detail-item">
          <span class="bet-card__detail-label">Return</span>
          <span class="bet-card__detail-value">${
            bet.status === 'win'
              ? formatCurrency(bet.stake * bet.odds, currency)
              : bet.status === 'void'
              ? formatCurrency(bet.stake, currency)
              : '—'
          }</span>
        </div>
        <div class="bet-card__detail-item">
          <span class="bet-card__detail-label">Status</span>
          <span class="badge badge--${bet.status}">${_capitalize(bet.status)}</span>
        </div>
        <div class="bet-card__detail-item">
          <span class="bet-card__detail-label">Market</span>
          <span class="bet-card__detail-value">${bet.market ? _esc(bet.market) : '—'}</span>
        </div>
        <div class="bet-card__detail-item">
          <span class="bet-card__detail-label">Date</span>
          <span class="bet-card__detail-value">${formatRelativeDate(bet.date)}</span>
        </div>
      </div>
      <div class="bet-card__actions">
        <button class="btn btn--ghost btn--sm bet-card__edit-btn" style="flex:1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
        <button class="btn btn--danger btn--sm bet-card__delete-btn" style="flex:1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg>
          Delete
        </button>
      </div>
    </div>
  `;
}

/**
 * Calculate net profit/loss for a single bet.
 * @param {Object} bet
 * @returns {number}
 */
function _calcProfit(bet) {
  const stake = Number(bet.stake);
  const odds  = Number(bet.odds);
  switch (bet.status) {
    case 'win':  return stake * (odds - 1);
    case 'loss': return -stake;
    case 'void': return 0;
    default:     return -stake; // pending = at risk
  }
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function _capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
