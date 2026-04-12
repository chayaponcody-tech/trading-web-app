import type { Trade } from '../utils/backtestUtils';
import {
  computeWinStreak,
  computeAvgR,
  formatWL,
  formatWinRate,
} from '../utils/backtestUtils';

interface MetricsPanelProps {
  trades: Trade[];
  avgWin: number;
  avgLoss: number;
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.15rem',
};

const valueStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: 'var(--text-primary, #e2e8f0)',
  fontFamily: 'Outfit, sans-serif',
};

const metricItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '0.4rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(255,255,255,0.04)',
  minWidth: '80px',
};

export default function MetricsPanel({ trades, avgWin, avgLoss }: MetricsPanelProps) {
  const empty = trades.length === 0;

  const winRateDisplay = empty
    ? '--'
    : formatWinRate((trades.filter(t => t.pnl > 0).length / trades.length) * 100);

  const avgRDisplay = empty
    ? '--'
    : computeAvgR(avgWin, avgLoss).toFixed(2);

  const streakDisplay = empty
    ? '--'
    : String(computeWinStreak(trades));

  const wlDisplay = empty
    ? '--'
    : formatWL(trades);

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      <div style={metricItemStyle}>
        <span style={labelStyle}>Win Rate</span>
        <span style={valueStyle}>{winRateDisplay}</span>
      </div>
      <div style={metricItemStyle}>
        <span style={labelStyle}>Avg R</span>
        <span style={valueStyle}>{avgRDisplay}</span>
      </div>
      <div style={metricItemStyle}>
        <span style={labelStyle}>Streak Win</span>
        <span style={valueStyle}>{streakDisplay}</span>
      </div>
      <div style={metricItemStyle}>
        <span style={labelStyle}>All-Time W/L</span>
        <span style={valueStyle}>{wlDisplay}</span>
      </div>
    </div>
  );
}
