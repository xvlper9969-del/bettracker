/**
 * AddBetForm.js — Add and Edit bet form.
 *
 * Opened via the FAB (add) or bet card edit button (edit).
 * Features:
 *   - Market autocomplete from previously used markets
 *   - Status pill selector
 *   - Numeric keyboards for stake/odds
 *   - Inline validation
 *   - Fast UX: date defaults to today, status defaults to pending
 *
 * Flow:
 *   FAB click → AppState.openModal('addBet') → subscriber fires → _openForm(null)
 *   Edit click → AppState.openModal('editBet', bet) → subscriber fires → _openForm(bet)
 *
 * NOTE: _openForm must NOT call AppState.openModal() again — the modal is
 * already open when the subscriber fires. It only populates content via
 * setModalHTML(), which is safe to call on an already-open modal.
 */

import AppState from '../js/state/AppState.js';
import BetService from '../js/services/BetService.js';
import MarketService from '../js/services/MarketService.js';
import { setModalHTML, closeModal } from './Modal.js';
import { showToast } from './Toast.js';
import { formatDateInput } from '../js/utils/format.js';

/**
 * Initialize the add-bet form subscriber.
 * Must be called once after DOM is ready.
 */
export function initAddBetForm() {
  AppState.subscribe('ui.modalOpen', (modal) => {
    if (modal === 'addBet') {
      _openForm(null);
    } else if (modal === 'editBet') {
      const bet = AppState.get('ui.editingBet');
      _openForm(bet);
    }
  });
}

/**
 * Populate the modal with the bet form.
 * The modal is already open when this runs.
 *
 * @param {Object|null} existingBet - null for create, bet object for edit
 */
function _openForm(existingBet) {
  const isEdit = !!existingBet;
  const bet = existingBet || {};

  const today  = formatDateInput();
  const title  = bet.title  || '';
  const market = bet.market || '';
  const stake  = bet.stake  !== undefined ? String(bet.stake) : '';
  const odds   = bet.odds   !== undefined ? String(bet.odds)  : '';
  const status = bet.status || 'pending';
  const date   = bet.date   || today;

  // Inject form HTML into the already-open modal sheet
  setModalHTML(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">${isEdit ? 'Edit Bet' : 'New Bet'}</span>
      <button class="modal-close" id="bet-modal-close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body" id="bet-form-body">

      <!-- Title -->
      <div class="form-group">
        <label class="form-label form-label--required" for="bet-title">Title</label>
        <input class="form-input" id="bet-title" type="text"
               placeholder="e.g. Arsenal vs Chelsea" maxlength="100"
               autocomplete="off" value="${_esc(title)}"/>
        <span class="form-error" id="bet-title-err" style="display:none">Title is required</span>
      </div>

      <!-- Market with autocomplete -->
      <div class="form-group">
        <label class="form-label" for="bet-market">Market</label>
        <div class="autocomplete-wrapper" id="market-autocomplete">
          <input class="form-input" id="bet-market" type="text"
                 placeholder="e.g. BTTS, Over 2.5" maxlength="80"
                 autocomplete="off" value="${_esc(market)}"/>
          <div class="autocomplete-list" id="market-suggestions"></div>
        </div>
      </div>

      <!-- Stake + Odds row -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label form-label--required" for="bet-stake">Stake</label>
          <input class="form-input" id="bet-stake" type="number"
                 placeholder="0.00" inputmode="decimal" min="0.01" step="any"
                 value="${_esc(stake)}"/>
          <span class="form-error" id="bet-stake-err" style="display:none"></span>
        </div>
        <div class="form-group">
          <label class="form-label form-label--required" for="bet-odds">Odds</label>
          <input class="form-input" id="bet-odds" type="number"
                 placeholder="2.00" inputmode="decimal" min="1.01" step="any"
                 value="${_esc(odds)}"/>
          <span class="form-error" id="bet-odds-err" style="display:none"></span>
        </div>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label" for="bet-date">Date</label>
        <input class="form-input" id="bet-date" type="date" value="${date}"/>
      </div>

      <!-- Status -->
      <div class="form-group">
        <label class="form-label">Status</label>
        <div class="status-selector" id="status-selector" data-selected="${status}">
          ${_statusOptions(status)}
        </div>
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn--ghost" id="bet-cancel-btn">Cancel</button>
      <button class="btn btn--primary" style="flex:1" id="bet-submit-btn">
        ${isEdit ? 'Save Changes' : 'Add Bet'}
      </button>
    </div>
  `);

  // ── Wire up events ──────────────────────────────────────────
  const sheet = document.getElementById('modal-sheet');

  sheet.querySelector('#bet-modal-close')?.addEventListener('click', closeModal);
  sheet.querySelector('#bet-cancel-btn')?.addEventListener('click', closeModal);

  _initAutocomplete(sheet);
  _initStatusSelector(sheet, status);

  sheet.querySelector('#bet-submit-btn')?.addEventListener('click', () => {
    _handleSubmit(sheet, isEdit ? bet.id : null);
  });

  // Auto-focus title on new bet (after sheet animation settles)
  if (!isEdit) {
    setTimeout(() => sheet.querySelector('#bet-title')?.focus(), 350);
  }
}

/**
 * Generate status pill option HTML.
 * @param {string} selected
 * @returns {string}
 */
function _statusOptions(selected) {
  const statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'win',     label: 'Win'     },
    { value: 'loss',    label: 'Loss'    },
    { value: 'void',    label: 'Void'    },
  ];
  return statuses.map(({ value, label }) => `
    <button type="button"
      class="status-option status-option--${value}${selected === value ? ' status-option--active' : ''}"
      data-status="${value}">
      ${label}
    </button>
  `).join('');
}

/**
 * Wire up status pill selector interaction.
 * @param {HTMLElement} sheet
 * @param {string} initialStatus
 */
function _initStatusSelector(sheet, initialStatus) {
  const selector = sheet.querySelector('#status-selector');
  if (!selector) return;

  selector.addEventListener('click', (e) => {
    const btn = e.target.closest('.status-option');
    if (!btn) return;
    const newStatus = btn.dataset.status;

    selector.querySelectorAll('.status-option').forEach((el) => {
      el.classList.toggle('status-option--active', el.dataset.status === newStatus);
    });

    selector.dataset.selected = newStatus;
  });
}

/**
 * Wire up market input autocomplete dropdown.
 * @param {HTMLElement} sheet
 */
function _initAutocomplete(sheet) {
  const input = sheet.querySelector('#bet-market');
  const list  = sheet.querySelector('#market-suggestions');
  if (!input || !list) return;

  let hasFocus = false;

  function renderSuggestions(query) {
    if (!hasFocus) { list.innerHTML = ''; return; }
    const suggestions = MarketService.getSuggestions(query, 6);
    if (!suggestions.length) { list.innerHTML = ''; return; }
    list.innerHTML = suggestions
      .map((s) => `<div class="autocomplete-item" data-value="${_esc(s)}">${_esc(s)}</div>`)
      .join('');
  }

  input.addEventListener('focus', () => {
    hasFocus = true;
    renderSuggestions(input.value);
  });

  input.addEventListener('input', () => renderSuggestions(input.value));

  input.addEventListener('blur', () => {
    // Delay so a tap on a suggestion registers before the list disappears
    setTimeout(() => { hasFocus = false; list.innerHTML = ''; }, 200);
  });

  // Mousedown (not click) to fire before blur
  list.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    e.preventDefault();
    input.value = item.dataset.value;
    list.innerHTML = '';
  });

  // Touch support for Android
  list.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    e.preventDefault();
    input.value = item.dataset.value;
    list.innerHTML = '';
    hasFocus = false;
  }, { passive: false });
}

/**
 * Validate form inputs and submit.
 * @param {HTMLElement} sheet
 * @param {string|null} editId - null = create new, string = update existing
 */
async function _handleSubmit(sheet, editId) {
  const titleInput  = sheet.querySelector('#bet-title');
  const stakeInput  = sheet.querySelector('#bet-stake');
  const oddsInput   = sheet.querySelector('#bet-odds');
  const dateInput   = sheet.querySelector('#bet-date');
  const selector    = sheet.querySelector('#status-selector');
  const marketInput = sheet.querySelector('#bet-market');

  const title  = titleInput?.value.trim();
  const stake  = stakeInput?.value;
  const odds   = oddsInput?.value;
  const date   = dateInput?.value || formatDateInput();
  const status = selector?.dataset.selected || 'pending';
  const market = marketInput?.value.trim() || '';

  let valid = true;

  // Title
  const titleErr = sheet.querySelector('#bet-title-err');
  if (!title) {
    titleErr.style.display = 'flex';
    titleInput?.classList.add('form-input--error');
    valid = false;
  } else {
    titleErr.style.display = 'none';
    titleInput?.classList.remove('form-input--error');
  }

  // Stake
  const stakeErr   = sheet.querySelector('#bet-stake-err');
  const parsedStake = parseFloat(stake);
  if (isNaN(parsedStake) || parsedStake <= 0) {
    stakeErr.textContent = 'Enter a valid stake';
    stakeErr.style.display = 'flex';
    stakeInput?.classList.add('form-input--error');
    valid = false;
  } else {
    stakeErr.style.display = 'none';
    stakeInput?.classList.remove('form-input--error');
  }

  // Odds
  const oddsErr   = sheet.querySelector('#bet-odds-err');
  const parsedOdds = parseFloat(odds);
  if (isNaN(parsedOdds) || parsedOdds < 1) {
    oddsErr.textContent = 'Odds must be ≥ 1.00';
    oddsErr.style.display = 'flex';
    oddsInput?.classList.add('form-input--error');
    valid = false;
  } else {
    oddsErr.style.display = 'none';
    oddsInput?.classList.remove('form-input--error');
  }

  if (!valid) return;

  const submitBtn = sheet.querySelector('#bet-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = editId ? 'Saving…' : 'Adding…';

  try {
    if (editId) {
      await BetService.update(editId, {
        title, market, stake: parsedStake, odds: parsedOdds, status, date,
      });
      showToast({ message: 'Bet updated' });
    } else {
      await BetService.create({
        title, market, stake: parsedStake, odds: parsedOdds, status, date,
      });
      showToast({ message: 'Bet added' });
    }
    closeModal();
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = editId ? 'Save Changes' : 'Add Bet';
    showToast({ message: err.message || 'Something went wrong' });
  }
}

/** Escape HTML to prevent XSS in injected content. */
function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
