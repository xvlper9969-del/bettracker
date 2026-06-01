/**
 * BankrollSelector.js — Bankroll switcher in the dashboard header.
 *
 * Renders the active bankroll name as a tappable selector.
 * Opens a bottom sheet listing all bankrolls with switch/delete actions.
 * Includes "New Bankroll" option that opens a create form.
 */

import AppState from '../js/state/AppState.js';
import BankrollService from '../js/services/BankrollService.js';
import { setModalHTML, closeModal } from './Modal.js';
import { showToast } from './Toast.js';
import { formatCurrency } from '../js/utils/format.js';

/** @type {HTMLElement} */
let selectorEl;

/**
 * Initialize the bankroll selector button.
 */
export function initBankrollSelector() {
  selectorEl = document.getElementById('bankroll-selector');
  if (!selectorEl) return;

  selectorEl.addEventListener('click', _openSwitcher);

  // Re-render selector label when bankroll changes
  AppState.subscribe('activeBankroll', (bankroll) => {
    _renderSelectorLabel(bankroll);
  });

  AppState.subscribe('bankrolls', () => {
    const bankroll = AppState.get('activeBankroll');
    _renderSelectorLabel(bankroll);
  });
}

/**
 * Update the selector button text.
 * @param {Object|null} bankroll
 */
function _renderSelectorLabel(bankroll) {
  if (!selectorEl) return;
  const nameEl = selectorEl.querySelector('.bankroll-selector__name');
  if (nameEl) {
    nameEl.textContent = bankroll ? bankroll.name : 'No Bankroll';
  }
}

/**
 * Open the bankroll switcher modal.
 */
function _openSwitcher() {
  const bankrolls = AppState.get('bankrolls');
  const active = AppState.get('activeBankroll');

  const listHTML = bankrolls.map((b) => {
    const isActive = b.id === active?.id;
    return `
      <div class="bankroll-list-item ${isActive ? 'bankroll-list-item--active' : ''}"
           data-action="switch" data-id="${b.id}">
        <div class="bankroll-list-item__info">
          <div class="bankroll-list-item__name">${_esc(b.name)}</div>
          <div class="bankroll-list-item__meta">
            ${_esc(b.currency)} · Initial: ${formatCurrency(b.initialBankroll, b.currency)}
          </div>
        </div>
        ${isActive
          ? `<svg class="bankroll-list-item__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
          : ''}
        ${bankrolls.length > 1
          ? `<button class="bankroll-list-item__delete" data-action="delete" data-id="${b.id}" aria-label="Delete ${_esc(b.name)}">
               <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
             </button>`
          : ''}
      </div>
    `;
  }).join('');

  setModalHTML(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">Bankrolls</span>
      <button class="modal-close" id="modal-close-btn" aria-label="Close">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="bankroll-list">
        ${listHTML || '<p style="color:var(--text-tertiary);font-size:14px;text-align:center;padding:16px">No bankrolls yet</p>'}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn--primary btn--full" id="create-bankroll-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Bankroll
      </button>
    </div>
  `);

  AppState.openModal('switchBankroll');

  // Wire events inside the modal
  const sheet = document.getElementById('modal-sheet');

  sheet.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);

  sheet.querySelector('#create-bankroll-btn')?.addEventListener('click', () => {
    closeModal();
    setTimeout(() => _openCreateBankroll(), 200);
  });

  // Event delegation for list items
  sheet.querySelector('.bankroll-list')?.addEventListener('click', (e) => {
    const switchEl = e.target.closest('[data-action="switch"]');
    const deleteEl = e.target.closest('[data-action="delete"]');

    if (deleteEl) {
      e.stopPropagation();
      const id = deleteEl.dataset.id;
      _confirmDelete(id);
      return;
    }

    if (switchEl) {
      const id = switchEl.dataset.id;
      if (id !== AppState.get('activeBankroll')?.id) {
        closeModal();
        BankrollService.selectBankroll(id);
      } else {
        closeModal();
      }
    }
  });
}

/**
 * Open the "Create Bankroll" form modal.
 */
function _openCreateBankroll() {
  setModalHTML(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">New Bankroll</span>
      <button class="modal-close" id="modal-close-btn" aria-label="Close">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label form-label--required" for="new-br-name">Name</label>
        <input class="form-input" id="new-br-name" type="text"
               placeholder="e.g. Football Strategy" maxlength="50" autocomplete="off"/>
        <span class="form-error" id="new-br-name-err" style="display:none"></span>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label form-label--required" for="new-br-amount">Initial Bankroll</label>
          <input class="form-input" id="new-br-amount" type="number"
                 placeholder="1000" inputmode="decimal" min="0" step="any"/>
          <span class="form-error" id="new-br-amount-err" style="display:none"></span>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-br-currency">Currency</label>
          <input class="form-input" id="new-br-currency" type="text"
                 placeholder="USD" maxlength="4" autocomplete="off"/>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn--ghost" id="modal-close-btn-2">Cancel</button>
      <button class="btn btn--primary" style="flex:1" id="create-bankroll-submit">Create</button>
    </div>
  `);

  AppState.openModal('createBankroll');

  const sheet = document.getElementById('modal-sheet');
  const nameInput = sheet.querySelector('#new-br-name');
  const amountInput = sheet.querySelector('#new-br-amount');
  const currencyInput = sheet.querySelector('#new-br-currency');
  const submitBtn = sheet.querySelector('#create-bankroll-submit');

  sheet.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  sheet.querySelector('#modal-close-btn-2')?.addEventListener('click', closeModal);

  // Auto-focus first field
  setTimeout(() => nameInput?.focus(), 300);

  submitBtn?.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const currency = currencyInput.value.trim().toUpperCase() || 'USD';

    let valid = true;

    const nameErr = sheet.querySelector('#new-br-name-err');
    const amountErr = sheet.querySelector('#new-br-amount-err');

    if (!name) {
      nameErr.textContent = 'Name is required';
      nameErr.style.display = 'flex';
      nameInput.classList.add('form-input--error');
      valid = false;
    } else {
      nameErr.style.display = 'none';
      nameInput.classList.remove('form-input--error');
    }

    if (isNaN(amount) || amount < 0) {
      amountErr.textContent = 'Enter a valid amount';
      amountErr.style.display = 'flex';
      amountInput.classList.add('form-input--error');
      valid = false;
    } else {
      amountErr.style.display = 'none';
      amountInput.classList.remove('form-input--error');
    }

    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    try {
      await BankrollService.create({ name, initialBankroll: amount, currency });
      closeModal();
      showToast({ message: `"${name}" created` });
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create';
      showToast({ message: err.message || 'Failed to create bankroll' });
    }
  });
}

/**
 * Show a delete confirmation for a bankroll.
 * @param {string} id
 */
function _confirmDelete(id) {
  const bankrolls = AppState.get('bankrolls');
  const bankroll = bankrolls.find((b) => b.id === id);
  if (!bankroll) return;

  setModalHTML(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">Delete Bankroll</span>
      <button class="modal-close" id="modal-close-btn" aria-label="Close">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="confirm-dialog">
        <div class="confirm-dialog__icon">🗑️</div>
        <div class="confirm-dialog__title">Delete "${_esc(bankroll.name)}"?</div>
        <div class="confirm-dialog__message">
          This will permanently delete all bets in this bankroll. This action cannot be undone.
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn--ghost" id="cancel-delete-btn">Cancel</button>
      <button class="btn btn--danger" style="flex:1" id="confirm-delete-btn">Delete</button>
    </div>
  `);

  AppState.openModal('deleteBankroll');

  const sheet = document.getElementById('modal-sheet');
  sheet.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  sheet.querySelector('#cancel-delete-btn')?.addEventListener('click', closeModal);

  sheet.querySelector('#confirm-delete-btn')?.addEventListener('click', async () => {
    try {
      await BankrollService.delete(id);
      closeModal();
      showToast({ message: `"${bankroll.name}" deleted` });
    } catch (err) {
      closeModal();
      showToast({ message: err.message || 'Failed to delete bankroll' });
    }
  });
}

/** Simple HTML escaper */
function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
