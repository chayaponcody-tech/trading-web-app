import React from 'react';

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'];

interface Props {
  symbol: string;
  interval: string;
  strategy: string;
  entryPrice: number;
  type: string;
  reason: string;
  showRSI: boolean;
  setShowRSI: (val: boolean) => void;
  onClose: () => void;
  selectedInterval: string;
  setSelectedInterval: (val: string) => void;
}

export const ChartHeader: React.FC<Props> = ({ 
  symbol, strategy, entryPrice, type, reason, showRSI, setShowRSI, onClose, selectedInterval, setSelectedInterval
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: '1px solid #333', background: 'rgba(255,255,255,0.02)', flexShrink: 0, gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>{symbol}</span>
            <span style={{ fontSize: '0.7rem', background: '#faad1422', color: '#faad14', padding: '2px 8px', borderRadius: '4px', border: '1px solid #faad1444' }}>{strategy}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#faad14', marginTop: '2px' }}>Entry: ${entryPrice.toFixed(4)} ({type})</div>
        </div>
        {reason && (
          <div style={{ fontSize: '0.75rem', color: '#aaa', fontStyle: 'italic', borderLeft: '2px solid #faad1466', paddingLeft: '0.6rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{reason}"
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {/* Timeframe selector */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedInterval(tf)}
              style={{
                background: selectedInterval === tf ? '#faad14' : 'transparent',
                color: selectedInterval === tf ? '#000' : '#666',
                border: 'none',
                padding: '0.25rem 0.5rem',
                borderRadius: '5px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tf}
            </button>
          ))}
        </div>
        <button 
          onClick={() => setShowRSI(!showRSI)} 
          style={{ background: showRSI ? '#faad1422' : 'transparent', border: '1px solid #faad1444', color: showRSI ? '#faad14' : '#666', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
        >
          {showRSI ? 'Hide RSI 👁️' : 'Show RSI 👁️'}
        </button>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>✕</button>
      </div>
    </div>
  );
};
