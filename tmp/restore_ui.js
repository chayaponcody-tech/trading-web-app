import fs from 'fs';
const content = `import { useState } from 'react';
import { SummaryStat } from './StatWidgets';

interface Props {
  tradeHistory: any[];
  fetchingHistory: boolean;
  fetchHistory: () => void;
}

export default function HistoryTab({ tradeHistory, fetchingHistory, fetchHistory }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'all' | 'bot' | 'manual'>('all');

  const filtered = tradeHistory.filter((t: any) => {
    let dateMatch = true;
    if (selectedDate !== 'all') {
      if (!t.exitTime) return false;
      const d = new Date(t.exitTime);
      if (isNaN(d.getTime())) return false;
      dateMatch = d.toISOString().split('T')[0] === selectedDate;
    }
    if (!dateMatch) return false;

    const isManual = t.botId === 'MANUAL_CLOSE' || (t.reason && t.reason.includes('[MANUAL]'));
    if (filterType === 'bot') return !isManual;
    if (filterType === 'manual') return isManual;
    return true;
  });

  const totalPnL = filtered.reduce((sum: number, t: any) => {
    const v = t.pnl !== undefined ? parseFloat(t.pnl) : 0;
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
  const wins = filtered.filter((t: any) => parseFloat(t.pnl || 0) > 0).length;
  const losses = filtered.filter((t: any) => parseFloat(t.pnl || 0) < 0).length;
  const winRate = filtered.length > 0 ? (wins / filtered.length * 100).toFixed(1) : '0';

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', borderLeft: '4px solid #faad14', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' }}>Archives 📜</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>Filter Date:</span>
            <input
              type="date"
              value={selectedDate !== 'all' ? selectedDate : ''}
              onChange={(e) => setSelectedDate(e.target.value || 'all')}
              style={{ background: 'transparent', color: '#faad14', border: 'none', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontWeight: 'bold', colorScheme: 'dark' }}
            />
            {selectedDate !== 'all' && (
              <button onClick={() => setSelectedDate('all')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '0.65rem', width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem', borderRadius: '8px' }}>
            {['all', 'bot', 'manual'].map((btn) => (
              <button
                key={btn}
                onClick={() => setFilterType(btn as any)}
                style={{
                  background: filterType === btn ? 'rgba(250,173,20,0.8)' : 'transparent',
                  color: filterType === btn ? '#000' : '#888',
                  border: 'none',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
        <button onClick={fetchHistory} disabled={fetchingHistory} style={{ background: 'linear-gradient(135deg, rgba(250,173,20,0.2), rgba(250,173,20,0.05))', border: '1px solid rgba(250,173,20,0.3)', color: '#faad14', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
          {fetchingHistory ? 'Syncing...' : '🔄 Sync History'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.2rem' }}>
        <SummaryStat icon="📊" label="Total Trades" value={filtered.length} sub={wins + 'W - ' + losses + 'L'} />
        <SummaryStat icon="💰" label="Net Profit" value={'$' + totalPnL.toFixed(2)} color={totalPnL >= 0 ? '#0ecb81' : '#f6465d'} sub={totalPnL >= 0 ? 'Profitable Session' : 'Loss Session'} />
        <SummaryStat icon="🎯" label="Avg Win Rate" value={winRate + '%'} color="#faad14" sub="Accuracy Score" />
        <SummaryStat icon="⏱️" label="Date Context" value={selectedDate === 'all' ? 'Historical' : selectedDate} sub={'Filter: ' + filterType} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#555', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>📭</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#888' }}>No trades found.</div>
          </div>
        ) : (
          filtered.map((t, i) => {
            const pnlVal = t.pnl !== undefined ? parseFloat(t.pnl) : 0;
            return (
              <div key={i} className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderLeft: '5px solid ' + (pnlVal >= 0 ? '#0ecb81' : '#f6465d') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.symbol}</span>
                    <span style={{ background: t.type === 'SELL' ? 'rgba(246,70,93,0.1)' : 'rgba(14,203,129,0.1)', color: t.type === 'SELL' ? '#f6465d' : '#0ecb81', padding: '1px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>{t.type}</span>
                    <span style={{ color: '#888', fontSize: '0.75rem' }}>{t.strategy}</span>
                  </div>
                  <span style={{ color: pnlVal >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold', fontSize: '1.1rem' }}>{(pnlVal >= 0 ? '+' : '') + pnlVal.toFixed(2)} USDT</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.8rem', color: '#888', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '6px' }}>
                  <div>Entry: <span style={{ color: '#eee' }}>$'+parseFloat(t.entryPrice || 0).toFixed(4)+'</span></div>
                  <div>Exit: <span style={{ color: '#eee' }}>$'+parseFloat(t.exitPrice || 0).toFixed(4)+'</span></div>
                  <div>Reason: <span style={{ color: '#faad14', fontWeight: 'bold' }}>{t.reason || 'Closed'}</span></div>
                  <div style={{ textAlign: 'right' }}>Time: <span style={{ color: '#888' }}>{new Date(t.exitTime).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</span></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
\`;

fs.writeFileSync('d:/Crypto/trading-web-app/src/pages/BinanceLive/components/HistoryTab.tsx', content, 'utf8');
console.log('File restored successfully');
