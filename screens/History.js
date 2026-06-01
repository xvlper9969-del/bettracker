/**
 * History.js — Bet history screen.
 *
 * Features:
 *   - Full list of all bets for the active bankroll
 *   - Status filter chips (All / Pending / Win / Loss / Void)
 *   - Date range filter
 *   - Expandable bet cards with edit + delete
 *   - Undo delete via toast
 *
 * Subscribes to 'bets' and 'historyFilters' for live updates.
 */

import AppState from '../js/state/AppState.js';
import BetService from '../js/services/BetService.js';
import { createBetCard } from '../components/BetCard.js';

/** @type {HTMLElement} */
let screenEl;
let listEl;
let filterBarEl;
let dateFromEl;
let dateToEl;
let countEl;

const STATUS_FILTERS = [
  { value: 'all',     label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'win',     label: 'Win' },
  { value: 'loss',    label: 'Loss' },
  { value: 'void',    label: 'Void' },
];

/**
 * Called once from app.js during initialization.
 */
export function initHistory() {
  screenEl = document.querySelector('[data-screen="history"]');
  if (!screenEl) return;

  listEl      = screenEl.querySelector('#history-list');
  filterBarEl = screenEl.querySelector('#history-filter-bar');
  dateFromEl  = screenEl.querySelector('#history-date-from');
  dateToEl    = screenEl.querySelector('#history-date-to');
  countEl     = screenEl.querySelector('#history-count');

  _buildFilterChips();
  _wireFilterEvents();

  // Re-render on data or filter changes
  AppState.subscribe('bets', () => renderHistory());
  AppState.subscribe('historyFilters', () => renderHistory());
}

/**
 * Full render — called by router and after data changes.
 */
export function renderHistory() {
  if (!listEl) return;

  const allBets = AppState.get('bets');
  const filters = AppState.get('historyFilters');

  // Apply filters
  const filtered = BetService.applyFilters(allBets, filters);

  // Update count label
  if (countEl) {
    countEl.textContent = filtered.length === allBets.length
      ? `${allBets.length} bet${allBets.length !== 1 ? 's' : ''}`
      : `${filtered.length} of ${allBets.length}`;
  }

  // Sync active filter chip
  _syncFilterChips(filters.status);

  // Sync date inputs
  if (dateFromEl && dateFromEl.value !== filters.dateFrom) dateFromEl.value = filters.dateFrom;
  if (dateToEl && dateToEl.value !== filters.dateTo) dateToEl.value = filters.dateTo;

  listEl.innerHTML = '';

  if (filtered.length === 0) {
    listEl.innerHTML = _emptyHTML(allBets.length > 0);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const bet of filtered) {
    fragment.appendChild(createBetCard(bet, { expandable: true }));
  }
  listEl.appendChild(fragment);
}

/**
 * Build filter chip buttons in the filter bar.
 */
function _buildFilterChips() {
  if (!filterBarEl) return;
  const chipsContainer = filterBarEl.querySelector('#status-chips');
  if (!chipsContainer) return;

  chipsContainer.innerHTML = STATUS_FILTERS.map(({ value, label }) => `
    <button class="filter-chip" data-status="${value}">${label}</button>
  `).join('');

  chipsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip[data-status]');
    if (!chip) return;
    AppState.setHistoryFilters({ status: chip.dataset.status });
  });
}

/**
 * Sync the active visual state of filter chips.
 * @param {string} activeStatus
 */
function _syncFilterChips(activeStatus) {
  filterBarEl?.querySelectorAll('.filter-chip[data-status]').forEach((chip) => {
    chip.classList.toggle('filter-chip--active', chip.dataset.status === activeStatus);
  });
}

/**
 * Wire up date range filter inputs.
 */
function _wireFilterEvents() {
  dateFromEl?.addEventListener('change', (e) => {
    AppState.setHistoryFilters({ dateFrom: e.target.value });
  });

  dateToEl?.addEventListener('change', (e) => {
    AppState.setHistoryFilters({ dateTo: e.target.value });
  });

  // Clear date filters button
  screenEl.querySelector('#clear-date-filter')?.addEventListener('click', () => {
    AppState.setHistoryFilters({ dateFrom: '', dateTo: '' });
  });
}

/**
 * Empty state HTML.
 * @param {boolean} hasFiltersApplied
 * @returns {string}
 */
function _emptyHTML(hasFiltersApplied) {
  if (hasFiltersApplied) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div class="empty-state__title">No matches</div>
        <div class="empty-state__subtitle">Try adjusting your filters</div>
      </div>
    `;
  }
  return `
    <div class="empty-state">
      <div class="empty-state__icon">
        <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      </div>
      <div class="empty-state__title">No bets yet</div>
      <div class="empty-state__subtitle">Tap + to record your first bet</div>
    </div>
  `;
}
