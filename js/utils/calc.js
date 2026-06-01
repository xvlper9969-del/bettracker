/**
 * calc.js — Pure calculation functions for bankroll math.
 *
 * Stateless and side-effect-free. All functions accept raw bet
 * arrays and return computed numbers. Nothing is ever stored.
 *
 * BANKROLL LOGIC (derived from initial on every call):
 *   PENDING → deduct stake (money is locked up / at risk)
 *   WIN     → add profit: stake × (odds - 1)
 *   LOSS    → deduct stake (full loss)
 *   VOID    → no effect (stake returned, net zero)
 */

/**
 * Calculate the current bankroll from initial value + all bets.
 *
 * @param {number} initialBankroll
 * @param {Array<{stake: number, odds: number, status: string}>} bets
 * @returns {number}
 */
export function calculateCurrentBankroll(initialBankroll, bets) {
  let bankroll = Number(initialBankroll);

  for (const bet of bets) {
    const stake = Number(bet.stake);
    const odds  = Number(bet.odds);

    switch (bet.status) {
      case 'pending':
        bankroll -= stake;
        break;
      case 'win':
        bankroll += stake * (odds - 1);
        break;
      case 'loss':
        bankroll -= stake;
        break;
      case 'void':
        // No net effect — stake was returned
        break;
    }
  }

  return bankroll;
}

/**
 * Calculate total profit/loss from all settled bets.
 * Pending and void bets do not contribute to profit.
 *
 * @param {Array<{stake: number, odds: number, status: string}>} bets
 * @returns {number}
 */
export function calculateTotalProfit(bets) {
  let profit = 0;

  for (const bet of bets) {
    const stake = Number(bet.stake);
    const odds  = Number(bet.odds);

    switch (bet.status) {
      case 'win':
        profit += stake * (odds - 1);
        break;
      case 'loss':
        profit -= stake;
        break;
      case 'pending':
      case 'void':
        break;
    }
  }

  return profit;
}

/**
 * Calculate win rate from settled bets (win + loss only).
 * Void and pending bets are excluded.
 *
 * @param {Array<{status: string}>} bets
 * @returns {number} 0–1, or 0 if no settled bets
 */
export function calculateWinRate(bets) {
  const settled = bets.filter((b) => b.status === 'win' || b.status === 'loss');
  if (settled.length === 0) return 0;
  const wins = settled.filter((b) => b.status === 'win').length;
  return wins / settled.length;
}

/**
 * Calculate total active stake across all pending bets.
 *
 * @param {Array<{stake: number, status: string}>} bets
 * @returns {number}
 */
export function calculateActiveStake(bets) {
  return bets
    .filter((b) => b.status === 'pending')
    .reduce((sum, b) => sum + Number(b.stake), 0);
}

/**
 * Calculate profit for bets with a specific date string.
 *
 * @param {Array<{stake: number, odds: number, status: string, date: string}>} bets
 * @param {string} dateStr — YYYY-MM-DD
 * @returns {number}
 */
export function calculateProfitForDate(bets, dateStr) {
  return calculateTotalProfit(bets.filter((b) => b.date === dateStr));
}

/**
 * Calculate profit for bets within an inclusive date range.
 *
 * @param {Array<{stake: number, odds: number, status: string, date: string}>} bets
 * @param {string} fromDate — YYYY-MM-DD
 * @param {string} toDate — YYYY-MM-DD
 * @returns {number}
 */
export function calculateProfitForRange(bets, fromDate, toDate) {
  return calculateTotalProfit(
    bets.filter((b) => b.date >= fromDate && b.date <= toDate)
  );
}

/**
 * Build a chronological bankroll balance timeline for charting.
 * Each entry is one data point at end-of-day for days that have bets.
 *
 * @param {number} initialBankroll
 * @param {Array<{stake: number, odds: number, status: string, date: string}>} bets
 * @returns {Array<{date: string, value: number}>}
 */
export function buildBankrollTimeline(initialBankroll, bets) {
  if (bets.length === 0) return [];

  const sorted = [...bets].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.createdAt.localeCompare(b.createdAt);
  });

  // Group by date
  const byDate = new Map();
  for (const bet of sorted) {
    if (!byDate.has(bet.date)) byDate.set(bet.date, []);
    byDate.get(bet.date).push(bet);
  }

  const timeline = [];
  let running = Number(initialBankroll);

  for (const [date, dateBets] of byDate) {
    for (const bet of dateBets) {
      const stake = Number(bet.stake);
      const odds  = Number(bet.odds);
      switch (bet.status) {
        case 'pending': running -= stake;             break;
        case 'win':     running += stake * (odds - 1); break;
        case 'loss':    running -= stake;             break;
        case 'void':                                  break;
      }
    }
    timeline.push({ date, value: running });
  }

  return timeline;
}

/**
 * Build monthly profit data for a bar chart.
 *
 * @param {Array<{stake: number, odds: number, status: string, date: string}>} bets
 * @param {number} months — number of past months to include (default 6)
 * @returns {Array<{label: string, profit: number}>}
 */
export function buildMonthlyProfitData(bets, months = 6) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year  = d.getFullYear();
    const month = d.getMonth(); // 0-indexed

    const label = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: '2-digit',
    }).format(d);

    const monthBets = bets.filter((b) => {
      const bd = new Date(b.date + 'T00:00:00');
      return bd.getFullYear() === year && bd.getMonth() === month;
    });

    result.push({ label, profit: calculateTotalProfit(monthBets) });
  }

  return result;
}

/**
 * Get today's date as YYYY-MM-DD in local time.
 * @returns {string}
 */
export function getTodayString() {
  const d = new Date();
  return _toLocalDateString(d);
}

/**
 * Get the Monday of the current ISO week as YYYY-MM-DD.
 * @returns {string}
 */
export function getWeekStartString() {
  const d   = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  d.setDate(d.getDate() + diff);
  return _toLocalDateString(d);
}

/**
 * Format a Date as YYYY-MM-DD using local timezone.
 * @param {Date} d
 * @returns {string}
 */
function _toLocalDateString(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
        }
