/**
 * format.js — Pure formatting helpers. No side effects.
 */

/**
 * Format a number as currency.
 * @param {number} amount
 * @param {string} currency - ISO 4217 code e.g. 'USD', 'EUR', 'GBP'
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported currency codes
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a number with sign prefix (e.g. +150.00 or -50.00).
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatProfitCurrency(amount, currency = 'USD') {
  const formatted = formatCurrency(Math.abs(amount), currency);
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Format a date string or Date to a short display format.
 * @param {string|Date} date
 * @returns {string} e.g. "15 Jan 2025"
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Format a date to YYYY-MM-DD for <input type="date">.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateInput(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format decimal odds to display string.
 * @param {number} odds
 * @returns {string} e.g. "2.50"
 */
export function formatOdds(odds) {
  return Number(odds).toFixed(2);
}

/**
 * Format a ratio as a percentage string.
 * @param {number} ratio - 0 to 1
 * @returns {string} e.g. "63.5%"
 */
export function formatPercent(ratio) {
  if (!isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Returns relative label for a date (Today, Yesterday, or formatted date).
 * @param {string|Date} date
 * @returns {string}
 */
export function formatRelativeDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const toDay = (dt) =>
    new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();

  if (toDay(d) === toDay(today)) return 'Today';
  if (toDay(d) === toDay(yesterday)) return 'Yesterday';
  return formatDate(d);
}

/**
 * Format a number compactly (e.g. 1500 → "1.5K").
 * @param {number} n
 * @returns {string}
 */
export function formatCompact(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

/**
 * Capitalize first letter of a string.
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
