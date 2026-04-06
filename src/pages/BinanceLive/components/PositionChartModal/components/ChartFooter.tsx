import React from 'react';

export const ChartFooter: React.FC = () => {
  return (
    <div style={{ padding: '1rem', borderTop: '1px solid #333', fontSize: '0.75rem', color: '#666', display: 'flex', gap: '1.5rem' }}>
       <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: '#2962FF', borderRadius: '50%' }}></span> EMA 20</div>
       <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: '#FF6D00', borderRadius: '50%' }}></span> EMA 50</div>
       <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: '#ab47bc', borderRadius: '50%' }}></span> RSI</div>
       <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '0', borderTop: '2px solid #faad14' }}></span> ENTRY PX</div>
    </div>
  );
};
