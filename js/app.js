/**
 * app.js — Application entry point and bootstrap sequence.
 *
 * Responsibilities:
 *  1. Open IndexedDB
 *  2. Initialize all services (theme, markets, bankrolls)
 *  3. Wire up bottom-nav routing
 *  4. Mount global components (FAB, modals, toast)
 *  5. Hand off to screen modules
 *
 * Import order matters: Database must open before any store is accessed.
 */

import Database from './storage/Database.js';
import SettingsStore from './storage/SettingsStore.js';
import AppState from './state/AppState.js';
import BankrollService from './services/BankrollService.js';
import MarketService from './services/MarketService.js';
import ThemeService from './services/ThemeService.js';

// Screens
import { initDashboard, renderDashboard } from '../screens/Dashboard.js';
import { initHistory, renderHistory } from '../screens/History.js';
import { initStatistics, renderStatistics } from '../screens/Statistics.js';
import { initSettings } from '../screens/Settings.js';

// Global components
import { initModal } from '../components/Modal.js';
import { initToast } from '../components/Toast.js';
import { initAddBetForm } from '../components/AddBetForm.js';
import { initBankrollSelector } from '../components/BankrollSelector.js';

/**
 * Main bootstrap sequence.
 * Wrapped in an async IIFE so top-level await isn't required.
 */
(async () => {
  try {
    // ── 1. Open database ────────────────────────────────────────
    await Database.open();

    // ── 2. Initialize services ──────────────────────────────────
    await ThemeService.initialize();
    await MarketService.initialize();
    await BankrollService.initialize();

    // ── 3. Hide splash / loading ────────────────────────────────
    AppState.setLoading(false);
    document.getElementById('app-loading')?.remove();
    document.getElementById('app').classList.remove('app--loading');

    // ── 4. Mount global UI components ───────────────────────────
    initModal();
    initToast();
    initAddBetForm();
    initBankrollSelector();

    // ── 5. Initialize all screens ───────────────────────────────
    initDashboard();
    initHistory();
    initStatistics();
    initSettings();

    // ── 6. Wire up bottom navigation ────────────────────────────
    _initRouter();

    // ── 7. Render initial screen ────────────────────────────────
    const savedTab = await SettingsStore.get('lastTab', 'dashboard');
    _navigateTo(savedTab, { skipSave: true });

    // ── 8. FAB click → open add-bet modal ───────────────────────
    document.getElementById('fab').addEventListener('click', () => {
      AppState.openModal('addBet');
    });

  } catch (err) {
    console.error('[App] Fatal initialization error:', err);
    _showFatalError(err);
  }
})();

// ── Router ────────────────────────────────────────────────────────

/** @type {string} Currently active tab */
let _activeTab = 'dashboard';

/**
 * Wire up the bottom navigation bar tab clicks.
 */
function _initRouter() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      if (tab && tab !== _activeTab) {
        _navigateTo(tab);
      }
    });
  });

  // Subscribe to state-driven navigation (e.g. programmatic tab switch)
  AppState.subscribe('ui.activeTab', (tab) => {
    if (tab && tab !== _activeTab) {
      _navigateTo(tab, { skipStateUpdate: true });
    }
  });
}

/**
 * Navigate to a screen tab.
 *
 * @param {string} tab
 * @param {Object} opts
 * @param {boolean} opts.skipSave - don't persist to settings
 * @param {boolean} opts.skipStateUpdate - don't call AppState (avoid loop)
 */
async function _navigateTo(tab, opts = {}) {
  const validTabs = ['dashboard', 'history', 'statistics', 'settings'];
  if (!validTabs.includes(tab)) tab = 'dashboard';

  _activeTab = tab;

  // Update nav item active states
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('nav-item--active', item.dataset.tab === tab);
  });

  // Show/hide screen sections
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('screen--active', screen.dataset.screen === tab);
  });

  // Notify state (unless we're already responding to it)
  if (!opts.skipStateUpdate) {
    AppState.setActiveTab(tab);
  }

  // Persist tab choice
  if (!opts.skipSave) {
    SettingsStore.set('lastTab', tab); // fire-and-forget
  }

  // Trigger screen-specific render (data may have changed while on another tab)
  switch (tab) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'history':
      renderHistory();
      break;
    case 'statistics':
      renderStatistics();
      break;
    // settings is static — no render needed
  }
}

// ── Fatal error fallback ──────────────────────────────────────────

/**
 * Show a minimal error screen if initialization fails.
 * @param {Error} err
 */
function _showFatalError(err) {
  document.body.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; height:100vh; padding:24px;
      background:#0B0F14; color:#F8FAFC; font-family:system-ui;
      text-align:center; gap:16px;
    ">
      <div style="font-size:32px;">⚠️</div>
      <div style="font-size:18px; font-weight:600;">Failed to start</div>
      <div style="font-size:14px; color:#94A3B8; max-width:320px;">
        ${err?.message || 'An unexpected error occurred.'}
      </div>
      <button onclick="location.reload()" style="
        margin-top:8px; padding:12px 24px; background:#3B82F6;
        color:white; border:none; border-radius:12px;
        font-size:15px; cursor:pointer;
      ">Reload App</button>
    </div>
  `;
}
