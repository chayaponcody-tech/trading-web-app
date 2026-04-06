import React from 'react';

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
}

export const ChartHeader: React.FC<Props> = ({ 
  symbol, interval, strategy, entryPrice, type, reason, showRSI, setShowRSI, onClose 
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem', borderBottom: '1px solid #333', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
      <div>
         <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
            {symbol} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({interval})</span>
            <span style={{ fontSize: '0.7rem', background: '#faad1422', color: '#faad14', padding: '2px 8px', borderRadius: '4px', border: '1px solid #faad1444' }}>{strategy}</span>
         </h3>
         <div style={{ fontSize: '0.85rem', color: '#faad14', marginTop: '6px', fontWeight: '500' }}>Entry: ${entryPrice.toFixed(4)} ({type})</div>
         
         {reason && (
           <div style={{ marginTop: '0.8rem', background: 'rgba(250,173,20,0.05)', borderLeft: '3px solid #faad14', padding: '0.6rem 1rem', borderRadius: '6px', maxWidth: '800px' }}>
             <div style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.3rem' }}>🧠 Selection Reason</div>
             <div style={{ fontSize: '0.85rem', color: '#ccc', fontStyle: 'italic', lineHeight: '1.5' }}>"{reason}"</div>
           </div>
         )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button 
          onClick={() => setShowRSI(!showRSI)} 
          style={{ background: showRSI ? '#faad1422' : 'transparent', border: '1px solid #faad1444', color: showRSI ? '#faad14' : '#666', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
        >
          {showRSI ? 'Hide RSI 👁️' : 'Show RSI 👁️'}
        </button>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>✕</button>
      </div>
    </div>
  );
};
