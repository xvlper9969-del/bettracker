/**
 * Toast.js — Lightweight toast/snackbar notification.
 *
 * Supports an optional action button (used for undo-delete).
 * Auto-dismisses after a configurable duration.
 * Only one toast visible at a time.
 */

/** @type {HTMLElement} */
let container;
/** @type {HTMLElement|null} */
let activeToast = null;
/** @type {number|null} */
let dismissTimer = null;

/**
 * Initialize toast container.
 * Must be called once after DOM is ready.
 */
export function initToast() {
  container = document.getElementById('toast-container');
  if (!container) {
    console.error('[Toast] toast-container element not found.');
  }
}

/**
 * Show a toast message.
 *
 * @param {Object} options
 * @param {string} options.message - Main toast text
 * @param {string} [options.action] - Action button label (e.g. 'Undo')
 * @param {Function} [options.onAction] - Callback when action is tapped
 * @param {number} [options.duration=4000] - Auto-dismiss delay in ms
 */
export function showToast({ message, action, onAction, duration = 4000 }) {
  // Dismiss any existing toast immediately
  _dismiss(true);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast__message">${_escape(message)}</span>
    ${action ? `<button class="toast__action">${_escape(action)}</button>` : ''}
  `;

  if (action && onAction) {
    toast.querySelector('.toast__action').addEventListener('click', () => {
      _dismiss(true);
      onAction();
    });
  }

  container.appendChild(toast);
  activeToast = toast;

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });
  });

  // Auto-dismiss
  dismissTimer = setTimeout(() => _dismiss(), duration);
}

/**
 * Dismiss the current toast.
 * @param {boolean} immediate - skip exit animation if true
 */
function _dismiss(immediate = false) {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  if (!activeToast) return;

  const toast = activeToast;
  activeToast = null;

  if (immediate) {
    toast.remove();
    return;
  }

  toast.classList.remove('toast--visible');
  setTimeout(() => toast.remove(), 250);
}

/**
 * Escape HTML to prevent XSS in toast messages.
 * @param {string} str
 * @returns {string}
 */
function _escape(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
