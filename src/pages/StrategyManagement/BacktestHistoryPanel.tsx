import { useState, useEffect } from 'react';
import type { BacktestHistoryItem, MultiAssetBacktestResult, RandomWindowBacktestResult } from '../../types/strategy';
import { getBacktestHistory, getBacktestDetail } from '../../api/strategyApi';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BacktestHistoryPanelProps {
  strategyId: string;
  onSelectResult: (result: MultiAssetBacktestResult | RandomWindowBacktestResult) => void;
}

// ─── Relative time helper (Thai) ──────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'เมื่อกี้';
  if (diffHr < 1) return `${diffMin} นาทีที่แล้ว`;
  if (diffDay < 1) return `${diffHr} ชั่วโมงที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;

  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Symbol display helper ────────────────────────────────────────────────────

function formatSymbols(symbols: string[]): string {
  if (symbols.length <= 3) return symbols.join(', ');
  const rest = symbols.length - 3;
  return `${symbols.slice(0, 3).join(', ')} +${rest}`;
}

// ─── PnL color helper ─────────────────────────────────────────────────────────

function pnlClass(val: number): string {
  if (val > 0) return 'text-profit';
  if (val < 0) return 'text-loss';
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BacktestHistoryPanel({ strategyId, onSelectResult }: BacktestHistoryPanelProps) {
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getBacktestHistory(strategyId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [strategyId]);

  async function handleSelectItem(item: BacktestHistoryItem) {
    if (loadingItemId) return;
    setLoadingItemId(item.backtestId);
    try {
      const detail = await getBacktestDetail(strategyId, item.backtestId);
      onSelectResult(detail);
    } catch (err) {
      console.error('Failed to load backtest detail:', err);
    } finally {
      setLoadingItemId(null);
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #888)' }}>
        <span>กำลังโหลดประวัติ backtest...</span>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-loss, #f87171)' }}>
        <span>เกิดข้อผิดพลาด: {error}</span>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (history.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #888)' }}>
        <span>ยังไม่มีประวัติ backtest สำหรับกลยุทธ์นี้</span>
      </div>
    );
  }

  // ─── List ───────────────────────────────────────────────────────────────────

  return (
    <div className="glass-panel" style={{ padding: '1rem' }}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }}>
        ประวัติ Backtest
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {history.map((item) => {
          const avgPnl = typeof item.summaryMetrics?.avgTotalPnl === 'number'
            ? (item.summaryMetrics.avgTotalPnl as number)
            : null;
          const isLoadingThis = loadingItemId === item.backtestId;

          return (
            <li key={item.backtestId}>
              <button
                className="btn-outline"
                onClick={() => handleSelectItem(item)}
                disabled={!!loadingItemId}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  opacity: loadingItemId && !isLoadingThis ? 0.6 : 1,
                  cursor: loadingItemId ? 'wait' : 'pointer',
                }}
              >
                {/* Left: type badge + symbols + time */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: item.backtestType === 'multi-asset'
                          ? 'rgba(99,102,241,0.25)'
                          : 'rgba(234,179,8,0.25)',
                        color: item.backtestType === 'multi-asset' ? '#a5b4fc' : '#fde047',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.backtestType === 'multi-asset' ? 'Multi-Asset' : 'Random Window'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatSymbols(item.symbols)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #888)' }}>
                    {relativeTime(item.createdAt)}
                  </span>
                </div>

                {/* Right: avgTotalPnl + loading spinner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  {avgPnl !== null && (
                    <span
                      className={pnlClass(avgPnl)}
                      style={{ fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {avgPnl >= 0 ? '+' : ''}{avgPnl.toFixed(2)}
                    </span>
                  )}
                  {isLoadingThis && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        border: '2px solid currentColor',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                      }}
                    />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
