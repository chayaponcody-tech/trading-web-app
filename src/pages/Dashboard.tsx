import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Activity, Brain, Zap } from 'lucide-react';
import AutoTrendChart from '../components/AutoTrendChart';

const QUANT_URL = '/api/quant';

interface QuantSentiment {
  symbol: string;
  score: number;
  funding_rate: number;
  timestamp: string;
}

interface QuantStrategy {
  strategy_key: string;
  status: string;
  backtest_metrics: Record<string, number>;
  approved_at: string;
}

interface TradeInfo {
  type: string;
  pnl: number;
  time: string;
}

interface PaperState {
  equity: number;
  position: string;
  trades: number;
}

interface BackendState {
  paperState: PaperState;
  tradeHistory: TradeInfo[];
  isBotRunning: boolean;
}

export default function Dashboard() {
  const [activeSymbol] = useState('BTC/USDT');
  const [backendState, setBackendState] = useState<BackendState | null>(null);
  const [quantSentiment, setQuantSentiment] = useState<QuantSentiment[]>([]);
  const [quantStrategies, setQuantStrategies] = useState<QuantStrategy[]>([]);

  useEffect(() => {
    const fetchBackend = () => {
       fetch('/api/state')
         .then(res => res.json())
         .then(data => setBackendState(data))
         .catch(err => console.error(err));
    };
    fetchBackend();
    const intervalId = setInterval(fetchBackend, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchQuant = async () => {
      try {
        const [btcRes, ethRes, stratRes] = await Promise.allSettled([
          fetch(`${QUANT_URL}/sentiment/BTCUSDT`),
          fetch(`${QUANT_URL}/sentiment/ETHUSDT`),
          fetch(`${QUANT_URL}/strategies`),
        ]);
        const scores: QuantSentiment[] = [];
        if (btcRes.status === 'fulfilled' && btcRes.value.ok) scores.push(await btcRes.value.json());
        if (ethRes.status === 'fulfilled' && ethRes.value.ok) scores.push(await ethRes.value.json());
        setQuantSentiment(scores);
        if (stratRes.status === 'fulfilled' && stratRes.value.ok) {
          setQuantStrategies(await stratRes.value.json());
        }
      } catch { /* quant-engine offline — silent */ }
    };
    fetchQuant();
    const id = setInterval(fetchQuant, 30000);
    return () => clearInterval(id);
  }, []);



  // Compute dynamic stats from backend
  let totalProfitValue = 0;
  let winRateValue = 0;
  let totalTradesCount = 0;
  let recentTrades: Record<string, string | number>[] = [];
  let isBotActive = false;

  if (backendState) {
    const { paperState, tradeHistory, isBotRunning } = backendState;
    isBotActive = isBotRunning;
    totalProfitValue = paperState.equity - 10000;
    
    totalTradesCount = tradeHistory.length;
    const wins = tradeHistory.filter((t) => t.pnl > 0).length;
    winRateValue = totalTradesCount > 0 ? (wins / totalTradesCount) * 100 : 0;
    
    recentTrades = tradeHistory.slice(0, 5).map((t, i) => ({
      id: i.toString(),
      pair: activeSymbol, // Mocking pair for now as chart is single-symbol
      side: t.type,
      profit: (t.pnl >= 0 ? '+$' : '-$') + Math.abs(t.pnl).toFixed(2),
      status: 'CLOSED',
      time: t.time
    }));

    // Add active trade if exists
    if (paperState.position !== 'NONE') {
       recentTrades.unshift({
          id: 'active',
          pair: activeSymbol,
          side: paperState.position,
          profit: 'OPEN',
          status: 'OPEN',
          time: 'Active'
       });
    }
  }

  const stats = [
    { label: 'Total PnL', value: (totalProfitValue >= 0 ? '+$' : '-$') + Math.abs(totalProfitValue).toFixed(2), icon: <DollarSign />, isPositive: totalProfitValue >= 0 },
    { label: 'Bot Status', value: isBotActive ? 'Running' : 'Stopped', icon: <Activity />, isPositive: isBotActive },
    { label: 'Total Trades', value: totalTradesCount.toString(), icon: <Activity />, isPositive: true },
    { label: 'Win Rate', value: winRateValue.toFixed(1) + '%', icon: <TrendingUp />, isPositive: winRateValue >= 50 },
  ];

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
        {stats.map((stat, i) => (
          <div key={i} className="glass-panel flex-between" style={{ padding: '1.25rem' }}>
            <div>
              <p className="text-muted text-sm m-0" style={{ marginBottom: '0.5rem' }}>{stat.label}</p>
              <h2 className={`m-0 ${stat.isPositive ? 'text-profit' : 'text-loss'}`}>{stat.value}</h2>
            </div>
            <div className={`icon-wrapper ${stat.isPositive ? 'text-profit' : 'text-loss'}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column' }}>
          <h3 className="m-0" style={{ marginBottom: '1.25rem' }}>{activeSymbol} Auto-Trend Chart</h3>
          <div style={{ flex: 1, minHeight: '550px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <AutoTrendChart symbol={activeSymbol} />
          </div>
        </div>
        <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ flex: 1 }}>
            <h3 className="m-0" style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>SBot V2 details <span style={{color: 'var(--text-muted)', fontSize:'0.9rem', cursor: 'pointer'}}>❓</span></h3>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
              <li className="flex-between">
                 <span className="text-muted">Bot type</span>
                 <strong style={{color: 'var(--text-main)'}}>AI Trend V2</strong>
              </li>
              <li className="flex-between">
                 <span className="text-muted">Exchange</span>
                 <strong style={{color: 'var(--text-main)'}}>Binance</strong>
              </li>
              <li className="flex-between">
                 <span className="text-muted">Pair</span>
                 <strong style={{color: 'var(--text-main)'}}>{activeSymbol}</strong>
              </li>
              <li className="flex-between">
                 <span className="text-muted">Profit currency</span>
                 <strong style={{color: 'var(--text-main)'}}>USDT</strong>
              </li>
              <hr style={{border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0'}} />
              <li className="flex-between">
                 <span className="text-muted">Status</span>
                 <strong style={{color: isBotActive ? 'var(--profit-color)' : 'var(--text-muted)'}}>{isBotActive ? 'Active' : 'Stopped'}</strong>
              </li>
              <li className="flex-between">
                 <span className="text-muted">Current Pos</span>
                 <strong style={{color: backendState?.paperState?.position === 'LONG' ? 'var(--profit-color)' : backendState?.paperState?.position === 'SHORT' ? 'var(--loss-color)' : 'var(--text-main)'}}>{backendState?.paperState?.position || 'NONE'}</strong>
              </li>
            </ul>
            <button className="btn-primary" style={{ width: '100%', marginTop: '1.5rem', borderRadius: '4px' }}>Modify</button>
          </div>

          <div className="glass-panel" style={{ flex: 1 }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
               <span style={{color: 'var(--text-main)', fontWeight: 600}}>Strategies (427)</span>
               <span className="text-muted" style={{cursor: 'pointer'}}>Balance</span>
            </div>
            <p className="text-muted text-sm" style={{marginBottom: '1rem'}}>Month <strong style={{color: 'var(--text-main)'}}>backtest result</strong></p>
            <p className="text-muted text-sm" style={{marginBottom: '0.5rem', background: 'var(--bg-dark)', padding: '0.3rem 0.6rem', borderRadius: '4px'}}>Recommended strategies</p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem' }}>
              <li className="flex-between"><strong style={{color: 'var(--text-main)'}}>BTCST / USDT</strong><span className="text-profit">⬆ 13.5%</span></li>
              <li className="flex-between"><strong style={{color: 'var(--text-main)'}}>LDO / BTC</strong><span className="text-profit">⬆ 12.03%</span></li>
              <li className="flex-between"><strong style={{color: 'var(--text-main)'}}>WAVES / BTC</strong><span className="text-profit">⬆ 8.13%</span></li>
              <li className="flex-between"><strong style={{color: 'var(--text-main)'}}>ATOM / BTC</strong><span className="text-profit">⬆ 7.28%</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quant Engine Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Sentiment Widget */}
        <div className="glass-panel">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 className="m-0" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={16} color="var(--accent-primary)" /> Quant Sentiment
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>via quant-engine</span>
          </div>
          {quantSentiment.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Quant engine offline or no data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {quantSentiment.map(s => {
                const color = s.score >= 60 ? 'var(--profit-color)' : s.score <= 40 ? 'var(--loss-color)' : '#faad14';
                const label = s.score >= 60 ? 'Bullish' : s.score <= 40 ? 'Bearish' : 'Neutral';
                return (
                  <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 600, width: '80px', color: 'var(--text-main)' }}>{s.symbol}</span>
                    <div style={{ flex: 1, height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${s.score}%`, height: '100%', background: color, borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontWeight: 700, color, width: '40px', textAlign: 'right' }}>{s.score.toFixed(0)}</span>
                    <span style={{ fontSize: '0.75rem', color, width: '55px' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Approved Strategies Widget */}
        <div className="glass-panel">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 className="m-0" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={16} color="#faad14" /> Evolutionary Strategies
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {quantStrategies.filter(s => s.status === 'active').length} active
            </span>
          </div>
          {quantStrategies.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No strategies yet. Trigger a generation cycle.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {quantStrategies.slice(0, 5).map((s, i) => (
                <div key={i} className="flex-between" style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-main)', fontFamily: 'monospace', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{s.strategy_key}</span>
                  <span style={{ color: (s.backtest_metrics?.sharpe ?? 0) > 1.5 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 600 }}>
                    Sharpe {(s.backtest_metrics?.sharpe ?? 0).toFixed(2)}
                  </span>
                  <span style={{ color: s.status === 'active' ? 'var(--profit-color)' : 'var(--loss-color)', fontSize: '0.75rem' }}>● {s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel">
        <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <h3 className="m-0" style={{ fontSize: '1.1rem', borderBottom: '2px solid var(--accent-primary)', paddingBottom: '0.75rem', marginBottom: '-0.75rem' }}>Spot bots (3)</h3>
            <span className="text-muted" style={{ cursor: 'pointer', fontSize: '1rem' }}>Spot history</span>
          </div>
          <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>$</span> Share & Earn
          </button>
        </div>
        
        {/* Sum Stats Bar */}
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', background: 'var(--bg-dark)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
          <div><span className="text-muted">Sum. total P&L:</span> <strong style={{color: 'var(--text-main)', marginLeft: '0.5rem'}}>$ 7 668.67</strong> <span className="text-profit">(+23.41%)</span></div>
          <div><span className="text-muted">Sum. bot profit:</span> <strong style={{color: 'var(--text-main)', marginLeft: '0.5rem'}}>$ 6 782.42</strong> <span className="text-profit">(+20.7%)</span></div>
          <div><span className="text-muted">Sum. value:</span> <strong style={{color: 'var(--text-main)', marginLeft: '0.5rem'}}>$ 40 421.17</strong></div>
          <div style={{ marginLeft: 'auto', border: '1px solid var(--border-color)', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>⚙</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Pair <br/><span style={{fontSize: '0.75rem'}}>Bot type</span></th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Value</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Change</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Bot profit</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Avg. daily <br/><span style={{fontSize: '0.75rem'}}>Trading time</span></th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Transactions <br/><span style={{fontSize: '0.75rem'}}>Levels</span></th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '0.75rem 0', fontWeight: 500, textAlign: 'right' }}>Bot options</th>
              </tr>
            </thead>
            <tbody>
              {[
                { pair: activeSymbol, type: 'AI TREND', value: backendState?.paperState?.equity || 10000, change: '+5.24%', profit: '+$524.00', profitPct: '+5.24%', daily: '0.52%', uptime: '10d 4h', txs: backendState?.paperState?.trades || 0, status: isBotActive ? 'Active' : 'Stopped' },
                { pair: 'ETH/USDT', type: 'DCA', value: 4366.36, change: '+33.51%', profit: '+$1184.99', profitPct: '+36.23%', daily: '1.57%', uptime: '23d 8h', txs: 232, status: 'Active' },
                { pair: 'SOL/USDT', type: 'GRID', value: 8519.20, change: '+20.93%', profit: '+$660.10', profitPct: '+9.37%', daily: '0.26%', uptime: '1m 6d', txs: 54, status: 'Stopped' }
              ].map((bot, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '20px', height: '20px', background: bot.pair === activeSymbol ? '#f3ba2f' : '#627eea', borderRadius: '50%' }}></div>
                      <div>
                         <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.95rem' }}>{bot.pair}</strong>
                         <span style={{ fontSize: '0.65rem', background: 'rgba(14, 203, 129, 0.2)', color: 'var(--profit-color)', padding: '0.1rem 0.3rem', borderRadius: '2px', fontWeight: 600 }}>{bot.type}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 0', fontWeight: 600, color: 'var(--text-main)' }}>$ {bot.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ padding: '1rem 0', fontWeight: 600 }} className={bot.change.startsWith('+') ? 'text-profit' : 'text-loss'}>{bot.change}</td>
                  <td style={{ padding: '1rem 0' }}>
                    <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.95rem' }}>{bot.profit} <span className="text-profit" style={{fontWeight: 400, marginLeft: '0.25rem'}}>{bot.profitPct}</span></strong>
                    <span className="text-muted" style={{fontSize: '0.75rem'}}>in USDT</span>
                  </td>
                  <td style={{ padding: '1rem 0' }}>
                    <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.95rem' }}>{bot.daily}</strong>
                    <span className="text-muted" style={{fontSize: '0.75rem'}}>{bot.uptime}</span>
                  </td>
                  <td style={{ padding: '1rem 0' }}>
                    <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.95rem' }}>{bot.txs}</strong>
                    <span className="text-muted" style={{fontSize: '0.75rem'}}>Open</span>
                  </td>
                  <td style={{ padding: '1rem 0' }}>
                    <span style={{ color: bot.status === 'Active' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 500, display: 'block' }}>{bot.status}</span>
                    <span className="text-muted" style={{fontSize: '0.75rem'}}>{bot.status === 'Active' ? 'TU' : 'Manual'}</span>
                  </td>
                  <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                     <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>📊</button>
                        <button style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>🚫</button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
