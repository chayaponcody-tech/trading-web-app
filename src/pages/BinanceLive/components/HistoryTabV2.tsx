import { useState } from 'react';
import { SummaryStat } from './StatWidgets';

// ─── History Tab (V2 Recovery) ────────────────────────────────────────────────

interface Props {
  tradeHistory: any[];
  fetchingHistory: boolean;
  fetchHistory: () => void;
}

export default function HistoryTab({ tradeHistory, fetchingHistory, fetchHistory }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'all' | 'bot' | 'manual'>('all');

  const filtered = tradeHistory.filter((t: any) => {
    // 1. Date Filter
    let dateMatch = true;
    if (selectedDate !== 'all') {
      if (!t.exitTime) return false;
      const d = new Date(t.exitTime);
      if (isNaN(d.getTime())) return false;
      dateMatch = d.toISOString().split('T')[0] === selectedDate;
    }
    if (!dateMatch) return false;

    // 2. Source Filter
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
  const winRate = filtered.length > 0 ? (wins / (wins+losses) * 100).toFixed(1) : '0';

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', borderLeft: '4px solid #faad14', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>Archives 📜</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <input
              type="date"
              value={selectedDate !== 'all' ? selectedDate : ''}
              onChange={(e) => setSelectedDate(e.target.value || 'all')}
              style={{ background: 'transparent', color: '#faad14', border: 'none', colorScheme: 'dark' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem', borderRadius: '8px' }}>
            {['all', 'bot', 'manual'].map((btn) => (
              <button
                key={btn}
                onClick={() => setFilterType(btn as any)}
                style={{
                  background: filterType === btn ? 'rgba(250,173,20,0.8)' : 'transparent',
                  color: filterType === btn ? '#000' : '#888',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
        <button onClick={fetchHistory} disabled={fetchingHistory} style={{ color: '#faad14', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
          {fetchingHistory ? '...' : '🔄 Sync History'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.2rem' }}>
        <SummaryStat icon="📊" label="Total Trades" value={filtered.length} sub={`${wins}W - ${losses}L`} />
        <SummaryStat icon="💰" label="Net Profit" value={`$${totalPnL.toFixed(2)}`} color={totalPnL >= 0 ? '#0ecb81' : '#f6465d'} />
        <SummaryStat icon="🎯" label="Win Rate" value={`${winRate}%`} color="#faad14" />
        <SummaryStat icon="⏱️" label="Filter" value={selectedDate === 'all' ? 'Historical' : selectedDate} sub={filterType} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>No trades recorded.</div>
        ) : (
          filtered.map((t: any, i: number) => {
            const pnlVal = t.pnl !== undefined ? parseFloat(t.pnl) : 0;
            return (
              <div key={i} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderLeft: `5px solid ${pnlVal >= 0 ? '#0ecb81' : '#f6465d'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t.symbol} <b>{t.type}</b></span>
                  <span style={{ color: pnlVal >= 0 ? '#0ecb81' : '#f6465d' }}>{pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)} USDT</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.4rem' }}>
                  Reason: {t.reason || 'Closed'} | Time: {new Date(t.exitTime).toLocaleString('th-TH')}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
