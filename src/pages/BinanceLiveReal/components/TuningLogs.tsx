import { useState, useEffect } from 'react';
import { SummaryStat } from './StatWidgets';

interface TuningLog {
  id: number;
  botId: string;
  symbol: string;
  oldParams: string;
  newParams: string;
  reasoning: string;
  marketCondition: string;
  timestamp: string;
}

export default function TuningLogs() {
  const [logs, setLogs] = useState<TuningLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/bots/tuning-history');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch tuning logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(fetchLogs, 60000); // Refresh every minute
    return () => clearInterval(timer);
  }, []);

  const getConditionColor = (cond: string) => {
    switch (cond) {
      case 'trending_up': return '#0ecb81';
      case 'trending_down': return '#f6465d';
      case 'volatile': return '#faad14';
      default: return '#888';
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', borderLeft: '4px solid #722ed1', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' }}>AI Intelligence 🧠</h2>
          <span style={{ fontSize: '0.7rem', color: '#722ed1', fontWeight: 'bold', padding: '0.2rem 0.6rem', border: '1px solid rgba(114,46,209,0.3)', borderRadius: '20px', background: 'rgba(114,46,209,0.05)' }}>Dynamic Tuning History</span>
        </div>
        <button onClick={fetchLogs} disabled={loading} style={{ background: 'rgba(114,46,209,0.1)', border: '1px solid rgba(114,46,209,0.3)', color: '#b37feb', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.2rem' }}>
        <SummaryStat icon="🤖" label="Optimization Events" value={logs.length} sub="AI Decision Points" />
        <SummaryStat icon="📈" label="Market Phase" value={logs[0]?.marketCondition?.replace('_', ' ').toUpperCase() || 'Scanning'} color={getConditionColor(logs[0]?.marketCondition)} sub="Current Leading Trend" />
        <SummaryStat icon="⚡" label="Auto Tuned" value={logs.filter(l => l.symbol === 'BTCUSDT').length} sub="BTCUSDT Optimizations" />
        <SummaryStat icon="🧠" label="RAG Context" value="Stored" sub="Ready for learning" />
      </div>

      {/* Log List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#555', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>🛰️</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#888' }}>Waiting for the first AI optimization loop...</div>
            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.5rem' }}>AI Tuner triggers every 50 bot checks.</div>
          </div>
        ) : (
          logs.map((log) => {
            const oldP = JSON.parse(log.oldParams || '{}');
            const newP = JSON.parse(log.newParams || '{}');
            return (
              <div key={log.id} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}>
                 <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: getConditionColor(log.marketCondition) }}></div>
                 
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: '900', fontSize: '1.2rem', color: '#fff' }}>{log.symbol}</span>
                        <span style={{ background: 'rgba(114,46,209,0.1)', color: '#b37feb', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(114,46,209,0.2)' }}>RAG LOG #{log.id}</span>
                        <span style={{ fontSize: '0.7rem', color: getConditionColor(log.marketCondition), fontWeight: 'bold', textTransform: 'uppercase' }}>● {log.marketCondition?.replace('_', ' ')}</span>
                    </div>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString('th-TH')}</span>
                 </div>

                 <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>AI ANALYSIS & REASONING:</div>
                    <p style={{ margin: 0, color: '#ddd', fontSize: '0.95rem', lineHeight: '1.5', fontStyle: 'italic' }}>
                        "{log.reasoning}"
                    </p>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                        <div style={{ color: '#555', fontSize: '0.65rem', marginBottom: '0.4rem', fontWeight: 'bold' }}>OLD THRESHOLDS:</div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                            <span style={{ color: '#888' }}>RSI Buy: <span style={{ color: '#bbb' }}>{oldP.rsiOversold}</span></span>
                            <span style={{ color: '#888' }}>RSI Sell: <span style={{ color: '#bbb' }}>{oldP.rsiOverbought}</span></span>
                        </div>
                    </div>
                    <div>
                        <div style={{ color: '#722ed1', fontSize: '0.65rem', marginBottom: '0.4rem', fontWeight: 'bold' }}>OPTIMIZED BY AI:</div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                            <span style={{ color: '#0ecb81', fontWeight: 'bold' }}>RSI Buy: {newP.rsiOversold}</span>
                            <span style={{ color: '#f6465d', fontWeight: 'bold' }}>RSI Sell: {newP.rsiOverbought}</span>
                        </div>
                    </div>
                 </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
