import { db } from '../DatabaseManager.js';

// ─── Backtest Repository ──────────────────────────────────────────────────────

export function saveBacktestResult(result) {
  try {
    const {
      backtestId, symbol, strategy, interval, config, createdAt,
      totalTrades, winRate, totalPnl, netPnlPct, sharpeRatio, maxDrawdown,
      profitFactor, avgWin, avgLoss, maxConsecutiveLosses, equityCurve,
      initialCapital, finalCapital, trades = [],
    } = result;

    const metrics = JSON.stringify({
      totalTrades, winRate, totalPnl, netPnlPct, sharpeRatio, maxDrawdown,
      profitFactor, avgWin, avgLoss, maxConsecutiveLosses, equityCurve,
      initialCapital, finalCapital,
    });

    const insertResult = db.prepare(`
      INSERT INTO backtest_results (backtestId, symbol, strategy, interval, config, metrics, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTrade = db.prepare(`
      INSERT INTO backtest_trades (backtestId, symbol, type, entryPrice, exitPrice, entryTime, exitTime, pnl, pnlPct, exitReason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const runTransaction = db.transaction(() => {
      insertResult.run(
        backtestId,
        symbol,
        strategy,
        interval,
        JSON.stringify(config),
        metrics,
        createdAt,
      );

      for (const trade of trades) {
        insertTrade.run(
          backtestId,
          trade.symbol ?? symbol,
          trade.type,
          trade.entryPrice,
          trade.exitPrice,
          trade.entryTime,
          trade.exitTime,
          trade.pnl,
          trade.pnlPct,
          trade.exitReason,
        );
      }
    });

    runTransaction();
    return true;
  } catch (e) {
    console.warn('[BacktestRepo] saveBacktestResult error:', e.message);
    return false;
  }
}

export function getBacktestHistory(limit = 50) {
  try {
    const rows = db.prepare(`
      SELECT backtestId, symbol, strategy, interval, config, metrics, createdAt
      FROM backtest_results
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(limit);

    return rows.map(row => ({
      backtestId: row.backtestId,
      symbol: row.symbol,
      strategy: row.strategy,
      interval: row.interval,
      config: JSON.parse(row.config),
      ...JSON.parse(row.metrics),
      createdAt: row.createdAt,
    }));
  } catch (e) {
    console.warn('[BacktestRepo] getBacktestHistory error:', e.message);
    return [];
  }
}

export function getBacktestById(backtestId) {
  try {
    const row = db.prepare(`
      SELECT backtestId, symbol, strategy, interval, config, metrics, createdAt
      FROM backtest_results
      WHERE backtestId = ?
    `).get(backtestId);

    if (!row) return null;

    const trades = db.prepare(`
      SELECT symbol, type, entryPrice, exitPrice, entryTime, exitTime, pnl, pnlPct, exitReason
      FROM backtest_trades
      WHERE backtestId = ?
    `).all(backtestId);

    return {
      backtestId: row.backtestId,
      symbol: row.symbol,
      strategy: row.strategy,
      interval: row.interval,
      config: JSON.parse(row.config),
      ...JSON.parse(row.metrics),
      trades,
      createdAt: row.createdAt,
    };
  } catch (e) {
    console.warn('[BacktestRepo] getBacktestById error:', e.message);
    return null;
  }
}
