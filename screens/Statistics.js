/**
 * Statistics.js — Statistics screen.
 *
 * Charts:
 *   1. Bankroll Trend — line chart showing balance over time
 *   2. Monthly Profit — bar chart for last 6 months
 *
 * Summary metrics:
 *   - Total bets, Win rate, Total profit, Best win, Worst loss
 *
 * Uses Chart.js loaded via CDN in index.html.
 * Charts are destroyed and rebuilt on each render to avoid
 * stale data — performance is fine given dataset sizes.
 */

import AppState from '../js/state/AppState.js';
import {
  buildBankrollTimeline,
  buildMonthlyProfitData,
  calculateWinRate,
  calculateTotalProfit,
} from '../js/utils/calc.js';
import {
  formatCurrency,
  formatProfitCurrency,
  formatPercent,
} from '../js/utils/format.js';

/** @type {HTMLElement} */
let screenEl;

/** @type {Chart|null} */
let bankrollChart = null;
/** @type {Chart|null} */
let monthlyChart = null;

/** Track the last rendered bankroll id to avoid unnecessary redraws */
let _lastRenderedBankrollId = null;

/**
 * Called once from app.js during initialization.
 */
export function initStatistics() {
  screenEl = document.querySelector('[data-screen="statistics"]');
  if (!screenEl) return;

  AppState.subscribe('bets', () => {
    // Only re-render if stats tab is active
    if (AppState.get('ui.activeTab') === 'statistics') {
      renderStatistics();
    }
  });
}

/**
 * Full render — called by router when tab becomes active.
 */
export function renderStatistics() {
  if (!screenEl) return;

  const bankroll = AppState.get('activeBankroll');
  const bets     = AppState.get('bets');
  const currency = bankroll?.currency || 'USD';

  const noBankroll = screenEl.querySelector('#stats-no-bankroll');
  const statsContent = screenEl.querySelector('#stats-content');

  if (!bankroll) {
    if (noBankroll) noBankroll.style.display = 'flex';
    if (statsContent) statsContent.style.display = 'none';
    _destroyCharts();
    return;
  }

  if (noBankroll) noBankroll.style.display = 'none';
  if (statsContent) statsContent.style.display = '';

  _renderMetrics(bets, currency);
  _renderBankrollChart(bankroll, bets, currency);
  _renderMonthlyChart(bets, currency);
}

/**
 * Render the summary stat cards.
 */
function _renderMetrics(bets, currency) {
  const settled = bets.filter((b) => b.status === 'win' || b.status === 'loss');
  const wins    = bets.filter((b) => b.status === 'win');
  const losses  = bets.filter((b) => b.status === 'loss');
  const pending = bets.filter((b) => b.status === 'pending');

  const totalProfit = calculateTotalProfit(bets);
  const winRate     = calculateWinRate(bets);

  const bestWin = wins.length > 0
    ? Math.max(...wins.map((b) => Number(b.stake) * (Number(b.odds) - 1)))
    : 0;
  const worstLoss = losses.length > 0
    ? Math.max(...losses.map((b) => Number(b.stake)))
    : 0;

  const avgOdds = settled.length > 0
    ? settled.reduce((sum, b) => sum + Number(b.odds), 0) / settled.length
    : 0;

  _setText('#stats-total-bets',    String(bets.length));
  _setText('#stats-settled',       String(settled.length));
  _setText('#stats-pending',       String(pending.length));
  _setText('#stats-win-rate',      formatPercent(winRate));
  _setText('#stats-total-profit',  formatProfitCurrency(totalProfit, currency));
  _setText('#stats-best-win',      bestWin > 0 ? `+${formatCurrency(bestWin, currency)}` : '—');
  _setText('#stats-worst-loss',    worstLoss > 0 ? `-${formatCurrency(worstLoss, currency)}` : '—');
  _setText('#stats-avg-odds',      avgOdds > 0 ? avgOdds.toFixed(2) : '—');

  // Color profit
  const profitEl = screenEl.querySelector('#stats-total-profit');
  if (profitEl) {
    profitEl.style.color = totalProfit > 0 ? 'var(--win)'
                         : totalProfit < 0 ? 'var(--loss)'
                         : 'var(--text-primary)';
  }
  const winRateEl = screenEl.querySelector('#stats-win-rate');
  if (winRateEl) {
    winRateEl.style.color = winRate >= 0.5 ? 'var(--win)' : 'var(--loss)';
  }
}

/**
 * Render the bankroll trend line chart.
 */
function _renderBankrollChart(bankroll, bets, currency) {
  const canvas = screenEl.querySelector('#bankroll-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const timeline = buildBankrollTimeline(bankroll.initialBankroll, bets);

  // Destroy existing instance
  if (bankrollChart) {
    bankrollChart.destroy();
    bankrollChart = null;
  }

  if (timeline.length === 0) {
    canvas.style.display = 'none';
    const placeholder = screenEl.querySelector('#bankroll-chart-empty');
    if (placeholder) placeholder.style.display = 'flex';
    return;
  }

  canvas.style.display = '';
  const placeholder = screenEl.querySelector('#bankroll-chart-empty');
  if (placeholder) placeholder.style.display = 'none';

  // Prepend initial point
  const labels = ['Start', ...timeline.map((p) => _shortDate(p.date))];
  const data   = [bankroll.initialBankroll, ...timeline.map((p) => p.value)];

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor  = isDark ? 'rgba(34,43,54,0.8)' : 'rgba(226,232,240,0.8)';
  const tickColor  = isDark ? '#64748B' : '#94A3B8';
  const lineColor  = '#3B82F6';
  const fillColor  = isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)';

  bankrollChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: data.length > 20 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: lineColor,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#141A22' : '#FFFFFF',
          borderColor: isDark ? '#222B36' : '#E2E8F0',
          borderWidth: 1,
          titleColor: isDark ? '#94A3B8' : '#475569',
          bodyColor: isDark ? '#F8FAFC' : '#0F172A',
          bodyFont: { weight: '600', size: 14 },
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.raw, currency)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 },
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 11 },
            callback: (v) => formatCurrency(v, currency),
          },
        },
      },
    },
  });
}

/**
 * Render the monthly profit bar chart.
 */
function _renderMonthlyChart(bets, currency) {
  const canvas = screenEl.querySelector('#monthly-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (monthlyChart) {
    monthlyChart.destroy();
    monthlyChart = null;
  }

  const monthly = buildMonthlyProfitData(bets, 6);

  const isDark    = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(34,43,54,0.8)' : 'rgba(226,232,240,0.8)';
  const tickColor = isDark ? '#64748B' : '#94A3B8';

  const barColors = monthly.map((m) =>
    m.profit >= 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'
  );
  const borderColors = monthly.map((m) =>
    m.profit >= 0 ? '#22C55E' : '#EF4444'
  );

  monthlyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: monthly.map((m) => m.label),
      datasets: [{
        data: monthly.map((m) => m.profit),
        backgroundColor: barColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#141A22' : '#FFFFFF',
          borderColor: isDark ? '#222B36' : '#E2E8F0',
          borderWidth: 1,
          titleColor: isDark ? '#94A3B8' : '#475569',
          bodyColor: isDark ? '#F8FAFC' : '#0F172A',
          bodyFont: { weight: '600', size: 14 },
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              return ` ${val >= 0 ? '+' : ''}${formatCurrency(val, currency)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tickColor, font: { size: 11 } },
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 11 },
            callback: (v) => formatCurrency(v, currency),
          },
        },
      },
    },
  });
}

/**
 * Destroy both charts (used when bankroll changes or no bankroll).
 */
function _destroyCharts() {
  if (bankrollChart) { bankrollChart.destroy(); bankrollChart = null; }
  if (monthlyChart)  { monthlyChart.destroy();  monthlyChart = null;  }
}

function _setText(selector, text) {
  const el = screenEl?.querySelector(selector);
  if (el) el.textContent = text;
}

function _shortDate(dateStr) {
  // "2025-03-15" → "Mar 15"
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d);
}
