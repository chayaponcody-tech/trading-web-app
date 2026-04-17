import { useState, useRef, useEffect } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import CandleChart from '../../components/CandleChart';
import type { Trade } from '../../utils/backtestUtils';
import type {
  MultiAssetBacktestResult,
  RandomWindowBacktestResult,
  AssetResult,
  AssetTrade,
} from '../../types/strategy';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BacktestResultPanelProps {
  result: MultiAssetBacktestResult | RandomWindowBacktestResult | null;
  interval?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMultiAsset(r: MultiAssetBacktestResult | RandomWindowBacktestResult): r is MultiAssetBacktestResult {
  return 'results' in r;
}

// Same TZ offset used by Backtest.tsx candle chart
const TZ_OFFSET = 7 * 3600;

function toChartTime(iso: string): Time {
  return (Math.floor(new Date(iso).getTime() / 1000) + TZ_OFFSET) as Time;
}
type SortKey = 'rank' | 'symbol' | 'totalPnl' | 'winRate' | 'sharpeRatio' | 'maxDrawdown' | 'totalTrades';
type SortDir = 'asc' | 'desc';

function sortAssets(rows: AssetResult[], key: SortKey, dir: SortDir): AssetResult[] {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (typeof av === 'string' && typeof bv === 'string')
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

function fmtPnl(v: number | undefined) {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
}

function fmtPct(v: number | undefined) {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('th-TH', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return iso; }
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ result }: { result: MultiAssetBacktestResult | RandomWindowBacktestResult }) {
  const s = result.summary;
  const isMA = isMultiAsset(result);
  let maxDrawdown = 0, totalTrades = 0;

  if (isMA) {
    const ok = (result as MultiAssetBacktestResult).results.filter(r => !r.error);
    maxDrawdown = ok.length ? Math.max(...ok.map(r => r.maxDrawdown ?? 0)) : 0;
    totalTrades = ok.reduce((a, r) => a + (r.totalTrades ?? 0), 0);
  } else {
    const rw = result as RandomWindowBacktestResult;
    maxDrawdown = rw.windows.length ? Math.max(...rw.windows.map(w => w.maxDrawdown)) : 0;
  }

  const cards = [
    { label: 'Avg PnL', value: fmtPnl(s.avgTotalPnl), color: s.avgTotalPnl > 0 ? 'var(--profit-color,#0ecb81)' : s.avgTotalPnl < 0 ? 'var(--loss-color,#f6465d)' : undefined },
    { label: 'Avg Win Rate', value: fmtPct(s.avgWinRate) },
    { label: 'Avg Sharpe', value: (s.avgSharpeRatio ?? 0).toFixed(2) },
    { label: 'Max Drawdown', value: fmtPct(maxDrawdown), color: 'var(--loss-color,#f6465d)' },
    ...(isMA ? [{ label: 'Total Trades', value: String(totalTrades) }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: '0.6rem' }}>
        {cards.map(c => (
          <div key={c.label} className="glass-panel" style={{ padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{c.label}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: c.color ?? 'var(--text-main)' }}>{c.value}</div>
          </div>
        ))}
      </div>
      {isMA && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Best', val: (result as MultiAssetBacktestResult).summary.bestSymbol, color: 'var(--profit-color,#0ecb81)' },
            { label: 'Worst', val: (result as MultiAssetBacktestResult).summary.worstSymbol, color: 'var(--loss-color,#f6465d)' },
          ].map(({ label, val, color }) => (
            <div key={label} className="glass-panel" style={{ padding: '0.6rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}:</span>
              <span style={{ fontWeight: 700, color }}>{val ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
      {!isMA && (() => {
        const rw = result as RandomWindowBacktestResult;
        const score = rw.summary.consistencyScore;
        const color = score >= 0.7 ? 'var(--profit-color,#0ecb81)' : score >= 0.4 ? '#f6a609' : 'var(--loss-color,#f6465d)';
        return (
          <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'inline-flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consistency Score</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{(score * 100).toFixed(0)}%</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({rw.windows.filter(w => w.totalPnl > 0).length}/{rw.windows.length} windows)
            </span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Multi-Asset Table ────────────────────────────────────────────────────────

function MultiAssetTable({ results, selectedSymbol, onSelectSymbol }: {
  results: AssetResult[];
  selectedSymbol: string | null;
  onSelectSymbol: (s: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const cols: { key: SortKey; label: string }[] = [
    { key: 'rank', label: '#' }, { key: 'symbol', label: 'Symbol' },
    { key: 'totalPnl', label: 'Total PnL' }, { key: 'winRate', label: 'Win Rate' },
    { key: 'sharpeRatio', label: 'Sharpe' }, { key: 'maxDrawdown', label: 'Max DD' },
    { key: 'totalTrades', label: 'Trades' },
  ];

  const th: React.CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color,rgba(255,255,255,0.1))' };
  const td: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <div className="glass-panel" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={th} onClick={() => { setSortKey(c.key); setSortDir(d => sortKey === c.key ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); }}>
                {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortAssets(results, sortKey, sortDir).map(row => {
            const sel = row.symbol === selectedSymbol;
            const err = !!row.error;
            return (
              <tr key={row.symbol} onClick={() => !err && onSelectSymbol(row.symbol)}
                style={{ cursor: err ? 'default' : 'pointer', background: sel ? 'rgba(0,209,255,0.08)' : 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!sel && !err) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <td style={td}>{row.rank ?? '—'}</td>
                <td style={{ ...td, fontWeight: 600, color: sel ? 'var(--accent-primary,#00d1ff)' : undefined }}>{row.symbol}</td>
                {err ? (
                  <td colSpan={5} style={{ ...td, color: 'var(--loss-color,#f6465d)', fontStyle: 'italic' }}>{row.error}</td>
                ) : row.totalTrades === 0 ? (
                  <td colSpan={5} style={{ ...td, color: 'var(--text-muted)', fontStyle: 'italic' }}>ไม่มี trade เกิดขึ้น</td>
                ) : (
                  <>
                    <td style={{ ...td, color: (row.totalPnl ?? 0) > 0 ? 'var(--profit-color,#0ecb81)' : (row.totalPnl ?? 0) < 0 ? 'var(--loss-color,#f6465d)' : undefined }}>{fmtPnl(row.totalPnl)}</td>
                    <td style={td}>{fmtPct(row.winRate)}</td>
                    <td style={td}>{(row.sharpeRatio ?? 0).toFixed(2)}</td>
                    <td style={{ ...td, color: 'var(--loss-color,#f6465d)' }}>{fmtPct(row.maxDrawdown)}</td>
                    <td style={td}>{row.totalTrades}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Window Table ─────────────────────────────────────────────────────────────

function WindowTable({ windows }: { windows: RandomWindowBacktestResult['windows'] }) {
  const th: React.CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color,rgba(255,255,255,0.1))' };
  const td: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.04)' };
  return (
    <div className="glass-panel" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['#','Window Start','Window End','Total PnL','Win Rate','Sharpe','Max DD'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {windows.map((w, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={td}>{fmtDate(w.windowStart)}</td>
              <td style={td}>{fmtDate(w.windowEnd)}</td>
              <td style={{ ...td, color: w.totalPnl > 0 ? 'var(--profit-color,#0ecb81)' : w.totalPnl < 0 ? 'var(--loss-color,#f6465d)' : undefined }}>{fmtPnl(w.totalPnl)}</td>
              <td style={td}>{fmtPct(w.winRate)}</td>
              <td style={td}>{w.sharpeRatio.toFixed(2)}</td>
              <td style={{ ...td, color: 'var(--loss-color,#f6465d)' }}>{fmtPct(w.maxDrawdown)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Trade Log ────────────────────────────────────────────────────────────────

function TradeLog({ trades, symbol }: { trades: AssetTrade[]; symbol: string }) {
  if (trades.length === 0) {
    return <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>ไม่มี trade สำหรับ {symbol}</div>;
  }

  const th: React.CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color,rgba(255,255,255,0.1))' };
  const td: React.CSSProperties = { padding: '0.45rem 0.75rem', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  // Sort newest first
  const sorted = [...trades].sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime());

  return (
    <div className="glass-panel" style={{ overflowX: 'auto' }}>
      <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, borderBottom: '1px solid var(--border-color,rgba(255,255,255,0.1))' }}>
        Trade Log — {symbol} ({trades.length} trades)
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['#','Type','Entry Time','Exit Time','Entry Price','Exit Price','PnL','PnL %','Entry Reason','Exit Reason'].map(h => <th key={h} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => {
            const win = t.pnl > 0;
            return (
              <tr key={i}>
                <td style={td}>{sorted.length - i}</td>
                <td style={{ ...td, fontWeight: 700, color: t.type === 'LONG' ? 'var(--profit-color,#0ecb81)' : 'var(--loss-color,#f6465d)' }}>{t.type}</td>
                <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{fmtDateTime(t.entryTime)}</td>
                <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{fmtDateTime(t.exitTime)}</td>
                <td style={td}>{t.entryPrice.toFixed(4)}</td>
                <td style={td}>{t.exitPrice.toFixed(4)}</td>
                <td style={{ ...td, fontWeight: 600, color: win ? 'var(--profit-color,#0ecb81)' : 'var(--loss-color,#f6465d)' }}>{fmtPnl(t.pnl)}</td>
                <td style={{ ...td, color: win ? 'var(--profit-color,#0ecb81)' : 'var(--loss-color,#f6465d)' }}>{fmtPct(t.pnlPct)}</td>
                <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.entryReason}>{t.entryReason ?? '—'}</td>
                <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.exitReason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Equity Chart ─────────────────────────────────────────────────────────────

function EquityChart({ equityCurve, symbol }: { equityCurve: { time: string; value: number }[]; symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848e9c' },
      grid: { vertLines: { color: '#2b313f' }, horzLines: { color: '#2b313f' } },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 10 },
      rightPriceScale: { autoScale: true },
      autoSize: true,
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(LineSeries, { color: '#0ecb81', lineWidth: 2 });
    return () => { chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !equityCurve.length) return;
    seriesRef.current.setData(equityCurve.map(p => ({ time: toChartTime(p.time), value: p.value })));
    chartRef.current?.timeScale().fitContent();
  }, [equityCurve]);

  if (!equityCurve.length) return null;

  return (
    <div className="glass-panel" style={{ padding: '1rem' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Equity Curve — {symbol}</div>
      <div ref={containerRef} style={{ height: '200px', width: '100%' }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BacktestResultPanel({ result, interval = '1h', startDate = '', endDate = '' }: BacktestResultPanelProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'chart' | 'log' | 'equity'>('chart');

  useEffect(() => { setSelectedSymbol(null); setDetailTab('chart'); }, [result]);

  if (!result) return null;

  const multi = isMultiAsset(result) ? (result as MultiAssetBacktestResult) : null;
  const rw = !multi ? (result as RandomWindowBacktestResult) : null;
  const selectedAsset = multi?.results.find(r => r.symbol === selectedSymbol) ?? null;
  const execSec = (result.executionTimeMs / 1000).toFixed(1);

  const tabBtn = (key: typeof detailTab, label: string) => (
    <button
      onClick={() => setDetailTab(key)}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        fontWeight: 600, padding: '0.4rem 0.75rem', fontSize: '0.85rem',
        color: detailTab === key ? 'var(--text-main)' : 'var(--text-muted)',
        borderBottom: detailTab === key ? '2px solid var(--accent-primary,#00d1ff)' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SummaryCards result={result} />

      {multi && (
        <MultiAssetTable
          results={multi.results}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={sym => { setSelectedSymbol(prev => prev === sym ? null : sym); setDetailTab('chart'); }}
        />
      )}

      {/* Detail panel for selected symbol */}
      {multi && selectedAsset && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color,rgba(255,255,255,0.1))', marginBottom: '0.75rem' }}>
            {tabBtn('chart', `📊 Candle Chart`)}
            {tabBtn('log', `📋 Trade Log (${selectedAsset.trades?.length ?? 0})`)}
            {tabBtn('equity', '📈 Equity Curve')}
          </div>

          {detailTab === 'chart' && (
            <CandleChart
              symbol={selectedAsset.symbol}
              interval={interval}
              startDate={startDate}
              endDate={endDate}
              trades={(selectedAsset.trades ?? []) as unknown as Trade[]}
              autoFetch
              autoRangeFromTrades
              height={420}
            />
          )}
          {detailTab === 'log' && (
            <TradeLog trades={selectedAsset.trades ?? []} symbol={selectedAsset.symbol} />
          )}
          {detailTab === 'equity' && (
            <EquityChart equityCurve={selectedAsset.equityCurve ?? []} symbol={selectedAsset.symbol} />
          )}
        </div>
      )}

      {rw && <WindowTable windows={rw.windows} />}

      <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        ใช้เวลา {execSec} วินาที
      </div>
    </div>
  );
}
