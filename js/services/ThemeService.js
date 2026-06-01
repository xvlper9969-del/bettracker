/**
 * ThemeService.js — Manages dark/light/system theme.
 *
 * Applies theme by toggling a data-theme attribute on <html>.
 * CSS variables respond to data-theme="dark" and data-theme="light".
 * "System" mode watches the OS prefers-color-scheme media query.
 */

import SettingsStore from '../storage/SettingsStore.js';
import AppState from '../state/AppState.js';

const ThemeService = {
  /** @type {MediaQueryList|null} */
  _mediaQuery: null,

  /** @type {Function|null} Bound listener for cleanup */
  _mediaListener: null,

  /**
   * Initialize theme from persisted setting.
   * @returns {Promise<void>}
   */
  async initialize() {
    const theme = await SettingsStore.getTheme();
    AppState.setTheme(theme);
    this._apply(theme);
  },

  /**
   * Change and persist the theme.
   * @param {'dark'|'light'|'system'} theme
   * @returns {Promise<void>}
   */
  async setTheme(theme) {
    await SettingsStore.setTheme(theme);
    AppState.setTheme(theme);
    this._apply(theme);
  },

  /**
   * Apply a theme to the document.
   * @param {'dark'|'light'|'system'} theme
   */
  _apply(theme) {
    // Clean up previous system listener
    if (this._mediaQuery && this._mediaListener) {
      this._mediaQuery.removeEventListener('change', this._mediaListener);
      this._mediaListener = null;
    }

    if (theme === 'system') {
      this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this._mediaListener = (e) => {
        document.documentElement.setAttribute(
          'data-theme',
          e.matches ? 'dark' : 'light'
        );
      };
      this._mediaQuery.addEventListener('change', this._mediaListener);
      // Apply immediately
      document.documentElement.setAttribute(
        'data-theme',
        this._mediaQuery.matches ? 'dark' : 'light'
      );
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  /**
   * Get the resolved theme ('dark' or 'light'), accounting for system mode.
   * @returns {'dark'|'light'}
   */
  getResolved() {
    const stored = AppState.get('ui.theme');
    if (stored === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return stored;
  },
};

export default ThemeService;
