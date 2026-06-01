/**
 * Settings.js — Settings screen.
 *
 * Options:
 *   - Theme: Dark / Light / System (segment control)
 *   - App info: version, about
 *
 * No dynamic data loading needed — purely UI preference management.
 */

import AppState from '../js/state/AppState.js';
import ThemeService from '../js/services/ThemeService.js';

/** @type {HTMLElement} */
let screenEl;

/**
 * Called once from app.js during initialization.
 */
export function initSettings() {
  screenEl = document.querySelector('[data-screen="settings"]');
  if (!screenEl) return;

  _initThemeSelector();

  // Sync theme selector when theme changes from outside
  AppState.subscribe('ui.theme', (theme) => {
    _syncThemeSelector(theme);
  });
}

/**
 * Wire up the theme segment control.
 */
function _initThemeSelector() {
  const segmentEl = screenEl.querySelector('#theme-segment');
  if (!segmentEl) return;

  segmentEl.addEventListener('click', (e) => {
    const option = e.target.closest('.segment-option[data-theme]');
    if (!option) return;
    const theme = option.dataset.theme;
    ThemeService.setTheme(theme);
  });

  // Set initial state
  _syncThemeSelector(AppState.get('ui.theme'));
}

/**
 * Update the active segment option to match the current theme.
 * @param {string} theme
 */
function _syncThemeSelector(theme) {
  const segmentEl = screenEl?.querySelector('#theme-segment');
  if (!segmentEl) return;

  segmentEl.querySelectorAll('.segment-option').forEach((opt) => {
    opt.classList.toggle('segment-option--active', opt.dataset.theme === theme);
  });
}
