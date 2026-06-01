/**
 * Modal.js — Generic bottom-sheet modal manager.
 *
 * One overlay element is reused for all modals.
 * Content is swapped by each feature that opens a modal.
 * AppState drives open/close via 'ui.modalOpen' subscription.
 */

import AppState from '../js/state/AppState.js';

/** @type {HTMLElement} */
let overlay;
/** @type {HTMLElement} */
let sheet;

/**
 * Initialize the modal system.
 * Must be called once after DOM is ready.
 */
export function initModal() {
  overlay = document.getElementById('modal-overlay');
  sheet = document.getElementById('modal-sheet');

  if (!overlay || !sheet) {
    console.error('[Modal] modal-overlay or modal-sheet element not found.');
    return;
  }

  // Close on backdrop tap
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      AppState.closeModal();
    }
  });

  // Subscribe to modal state changes
  AppState.subscribe('ui.modalOpen', (modal) => {
    if (modal) {
      _open();
    } else {
      _close();
    }
  });
}

/**
 * Set the inner content of the modal sheet.
 * Called by feature components before opening.
 * @param {string} html
 */
export function setModalContent(html) {
  // Preserve handle + header structure; replace body content
  const body = sheet.querySelector('.modal-body');
  if (body) {
    body.innerHTML = html;
  }
}

/**
 * Set the full sheet HTML (replaces everything inside the sheet).
 * @param {string} html
 */
export function setModalHTML(html) {
  sheet.innerHTML = html;
}

/**
 * Show the modal overlay.
 */
function _open() {
  overlay.classList.add('modal-overlay--visible');
  // Prevent body scroll on iOS
  document.body.style.overflow = 'hidden';
}

/**
 * Hide the modal overlay.
 */
function _close() {
  overlay.classList.remove('modal-overlay--visible');
  document.body.style.overflow = '';

  // After animation, clear content to avoid stale DOM
  setTimeout(() => {
    if (!overlay.classList.contains('modal-overlay--visible')) {
      const body = sheet.querySelector('.modal-body');
      if (body) body.innerHTML = '';
    }
  }, 250);
}

/**
 * Programmatically close the active modal.
 * Equivalent to user tapping backdrop.
 */
export function closeModal() {
  AppState.closeModal();
}
