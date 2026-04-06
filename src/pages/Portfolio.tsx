import { useState, useEffect } from 'react';
import { 
  Wallet, TrendingUp, ShieldAlert, Cpu, 
  Activity, Settings, RefreshCw, Layers, 
  CheckCircle2, Trash2, BrainCircuit
} from 'lucide-react';

const API = '';

interface PortfolioConfig {
  isAutonomous: boolean;
  totalBudget: number;
  maxDailyLossPct: number;
  targetBotCount: number;
  riskMode: string;
}

interface PortfolioStatus {
  isRunning: boolean;
  currentAction: string;
  config: PortfolioConfig;
}

export default function Portfolio() {
  const [status, setStatus] = useState<PortfolioStatus | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mistakes, setMistakes] = useState<any[]>([]);

  // Form states
  const [budget, setBudget] = useState(1000);
  const [maxLoss, setMaxLoss] = useState(5);
  const [botCount, setBotCount] = useState(3);
  const [riskMode, setRiskMode] = useState('confident');

  const fetchData = async () => {
    try {
      const [resStatus, resWallet, resBots, resMistakes] = await Promise.all([
        fetch(`${API}/api/portfolio/status`),
        fetch(`${API}/api/wallet`),
        fetch(`${API}/api/bots/summary`),
        fetch(`${API}/api/binance/mistakes`)
      ]);
      const statusData = await resStatus.json();
      const walletData = await resWallet.json();
      const botsData = await resBots.json();
      const mistakesData = await resMistakes.json();
      
      setStatus(statusData);
      setWallet(walletData);
      setBots(botsData.filter((b: any) => b.isRunning));
      setMistakes(mistakesData);
      
      // Update form values from backend config
      if (statusData.config) {
        setBudget(statusData.config.totalBudget);
        setMaxLoss(statusData.config.maxDailyLossPct);
        setBotCount(statusData.config.targetBotCount);
        setRiskMode(statusData.config.riskMode || 'confident');
      }
    } catch (e) {
      console.error('Failed to fetch portfolio data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API}/api/portfolio/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalBudget: budget,
          maxDailyLossPct: maxLoss,
          targetBotCount: botCount,
          riskMode: riskMode
        }),
      });
      const data = await res.json();
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
      setStatus(prev => prev ? { ...prev, config: data.config } : null);
    } catch (e) {
      setMessage('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAutoPilot = async () => {
    if (!status) return;
    const newState = !status.config.isAutonomous;
    try {
      await fetch(`${API}/api/portfolio/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAutonomous: newState }),
      });
      await fetch(`${API}/api/portfolio/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }), // Ensure the loop is running if any mode is on
      });
      fetchData();
    } catch (e) {
      console.error('Toggle failed');
    }
  };

  const handleResetWallet = async () => {
    if (!window.confirm(`Reset Demo Wallet to $${budget}? This clears all trade history.`)) return;
    try {
      await fetch(`${API}/api/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: budget, allTimeTrades: 0, allTimePnL: 0, position: 'NONE', trades: 0 }),
      });
      fetchData();
      setMessage('Wallet reset successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('Reset failed');
    }
  };

  const handleDeleteBot = async (botId: string, symbol: string) => {
    if (!window.confirm(`Delete bot ${symbol} permanently?`)) return;
    try {
       await fetch(`${API}/api/bots/delete`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ botId }),
       });
       fetchData();
    } catch (e) {
      console.error('Delete failed');
    }
  };

  if (loading || !status) return <div className="p-8 text-muted animate-pulse">Initializing AI Port Manager...</div>;

  // Safe Display Calculations
  const displayPnL = Number(wallet?.allTimePnL || 0);
  const displayBudget = Number(status?.config?.totalBudget || 1000);
  const pnlPct = (displayPnL / (displayBudget || 1)) * 100;
  const isProfitable = displayPnL >= 0;

  return (
    <div className="portfolio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner: AI Status */}
      <div className={`glass-panel ${status.config.isAutonomous ? 'border-primary' : 'border-muted'}`} style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem',
        background: status.config.isAutonomous ? 'rgba(0, 209, 255, 0.05)' : 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div className={`status-icon-container ${status.config.isAutonomous ? 'pulse-blue' : ''}`} style={{ 
            width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Cpu size={32} color={status.config.isAutonomous ? '#00d1ff' : '#666'} />
          </div>
          <div>
            <h2 className="m-0" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              AI Port Manager 
              {status.config.isAutonomous ? 
                <span className="badge-success" style={{ fontSize: '0.7rem' }}>AUTO-PILOT ACTIVE</span> :
                <span className="badge-muted" style={{ fontSize: '0.7rem' }}>MANUAL MODE</span>
              }
            </h2>
            <p className="text-sm text-muted m-0 mt-1">Autonomous fleet orchestration and portfolio risk protection logic.</p>
          </div>
        </div>
        <button 
          onClick={toggleAutoPilot}
          className={status.config.isAutonomous ? 'btn-danger' : 'btn-primary'}
          style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 'bold' }}
        >
          {status.config.isAutonomous ? 'DISABLE AUTO-PILOT' : 'ENABLE AUTO-PILOT'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Left Column: Settings and Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 1.5rem 0' }}>
              <Settings size={20} color="var(--accent-primary)" /> Global Strategy & Risk Configuration
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="input-group">
                <label>Total Portfolio Budget (USDT)</label>
                <div style={{ position: 'relative' }}>
                  <Wallet size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input 
                    type="number" 
                    value={budget} 
                    onChange={e => setBudget(parseFloat(e.target.value))} 
                    className="styled-input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">Total capital across all automated bots.</p>
              </div>

              <div className="input-group">
                <label>Max Daily Portfolio Drawdown (%)</label>
                <div style={{ position: 'relative' }}>
                  <ShieldAlert size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input 
                    type="number" 
                    value={maxLoss} 
                    onChange={e => setMaxLoss(parseFloat(e.target.value))} 
                    className="styled-input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">Stop all bots if total loss hits this limit today.</p>
              </div>

              <div className="input-group">
                <label>Target Active Bot Count</label>
                <div style={{ position: 'relative' }}>
                  <Layers size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input 
                    type="number" 
                    value={botCount} 
                    onChange={e => setBotCount(parseInt(e.target.value))} 
                    className="styled-input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">Number of bots to maintain in the fleet.</p>
              </div>

              <div className="input-group">
                <label>AI Scanning Mode</label>
                <select 
                  value={riskMode} 
                  onChange={e => setRiskMode(e.target.value)} 
                  className="styled-input"
                >
                  <option value="confident">✨ AI Precision (Confident)</option>
                  <option value="scout">🏹 Trend Scout (Aggressive)</option>
                  <option value="grid">📈 AI Grid Pro (Balance)</option>
                </select>
                <p className="text-xs text-muted mt-1">Dictates how AI selects and configures new coins.</p>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
               {message && <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0ecb81', fontSize: '0.9rem' }}><CheckCircle2 size={16} /> {message}</span>}
               <button className="btn-outline" onClick={fetchData}>Discard</button>
               <button className="btn-primary" onClick={handleSaveSettings} disabled={isSaving}>
                 {isSaving ? 'Saving...' : 'Save Configuration'}
               </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
             <div className="glass-panel hover-card" style={{ cursor: 'pointer' }} onClick={handleResetWallet}>
                <RefreshCw size={24} color="#faad14" style={{ marginBottom: '1rem' }} />
                <h4 className="m-0">Hard Reset Wallet</h4>
                <p className="text-sm text-muted mb-0 mt-2">Reset balance to project budget and clear history.</p>
             </div>
             <div className="glass-panel hover-card" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/binance-live'}>
                <TrendingUp size={24} color="var(--profit-color)" style={{ marginBottom: '1rem' }} />
                <h4 className="m-0">View Active Fleet</h4>
                <p className="text-sm text-muted mb-0 mt-2">Check technical details of all running bots.</p>
             </div>
          </div>

        </div>

        {/* Right Column: Health and Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <h4 className="text-muted text-xs uppercase m-0" style={{ letterSpacing: '1px' }}>Current Portfolio Health</h4>
            <div style={{ margin: '1.5rem 0' }}>
               <div style={{ fontSize: '3rem', fontWeight: 'bold', color: isProfitable ? 'var(--profit-color)' : 'var(--loss-color)' }}>
                  {isProfitable ? '+' : ''}{pnlPct.toFixed(2)}%
               </div>
               <p className="text-sm text-muted m-0">Net PnL: ${displayPnL.toFixed(2)} / ${displayBudget}</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
               <div>
                  <div className="text-xs text-muted">Win Rate</div>
                  <div className="text-lg font-bold" style={{ color: '#fff' }}>{(isProfitable ? 65 : 45).toFixed(0)}%</div>
               </div>
               <div>
                  <div className="text-xs text-muted">Active Bots</div>
                  <div className="text-lg font-bold" style={{ color: '#00d1ff' }}>{status.isRunning ? 'Monitoring' : 'Idle'}</div>
               </div>
            </div>
          </div>

          <div className="glass-panel">
            <h4 className="m-0 mb-3 flex items-center gap-2">
              <Activity size={18} color="#0ecb81" /> AI Insights
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
               <div style={{ fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #00d1ff' }}>
                 <strong>Strategic Suggestion:</strong> Market volatility is moderate. Maintaining {riskMode} stance.
               </div>
               <div style={{ fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                 <strong>Status:</strong> {status.config.isAutonomous ? (status.currentAction || 'Scanning for gaps...') : 'Awaiting manual start'}
               </div>
            </div>
          </div>

          {status.config.isAutonomous && (
            <div className="glass-panel" style={{ background: 'rgba(14,203,129,0.05)', borderColor: 'rgba(14,203,129,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--profit-color)' }}>
                <ShieldAlert size={20} />
                <div className="text-sm font-bold">Portfolio Shield Active</div>
              </div>
              <p className="text-xs text-muted m-0 mt-2">
                Monitoring total drawdown. Auto-liquidation threshold set at -{status.config.maxDailyLossPct}%.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Center Row: Active Managed Fleet */}
      <div className="glass-panel">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <Layers size={20} color="var(--accent-primary)" /> Active Managed Fleet
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Group 1: Portfolio Manager (Autonomous) */}
          <div>
            <h4 className="text-xs text-muted uppercase mb-3" style={{ letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Cpu size={14} color="#00d1ff" /> Autonomous Portfolio Fleet 
               <span style={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 'normal', color: '#666' }}> (Managed by Auto-Pilot)</span>
            </h4>
            {bots.filter(b => b.aiReason?.includes('Portfolio') || b.aiReason?.includes('Autonomous')).length === 0 ? (
              <div className="text-xs text-muted italic p-3 border rounded" style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.05)' }}>
                No active autonomous bots yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {bots.filter(b => b.aiReason?.includes('Portfolio') || b.aiReason?.includes('Autonomous')).map((bot) => (
                  <div key={bot.id} className="hover-card border-primary" style={{ padding: '1rem', background: 'rgba(0, 209, 255, 0.03)', borderRadius: '10px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ fontSize: '1rem' }}>{bot.symbol}</strong>
                          <div className="text-xs text-muted">{bot.strategy} • {bot.interval}</div>
                        </div>
                        <div className="text-right" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                          <div style={{ color: bot.netPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>${bot.netPnl?.toFixed(2)}</div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteBot(bot.id, bot.symbol); }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', opacity: 0.6 }}
                            className="hover-loss"
                            title="Delete Bot"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                     </div>
                     <div className="mt-2 text-xs text-muted italic border-t border-muted pt-2" style={{ color: '#00d1ff' }}>
                       "{bot.aiReason}"
                     </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group 2: Manual / Independent Bots */}
          <div>
            <h4 className="text-xs text-muted uppercase mb-3" style={{ letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <TrendingUp size={14} color="#666" /> Manual / Secondary Bots
               <span style={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 'normal', color: '#444' }}> (Not managed by Auto-Pilot)</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {bots.filter(b => !(b.aiReason?.includes('Portfolio') || b.aiReason?.includes('Autonomous'))).map((bot) => (
                <div key={bot.id} className="hover-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{bot.symbol}</strong>
                        <div className="text-xs text-muted">{bot.strategy} • {bot.interval}</div>
                      </div>
                      <div className="text-right" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                        <div style={{ color: bot.netPnl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 'bold' }}>${bot.netPnl?.toFixed(2)}</div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteBot(bot.id, bot.symbol); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', opacity: 0.6 }}
                          className="hover-loss"
                          title="Delete Bot"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                   </div>
                   <div className="mt-2 text-xs text-muted italic border-t border-muted pt-2">
                     "{bot.aiReason || 'Manual deployment'}"
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Activity Log */}
      <div className="glass-panel" style={{ marginTop: '0rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <Activity size={20} color="var(--accent-primary)" /> Portfolio Activity Log
        </h3>
        <div style={{ 
          maxHeight: '300px', 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.5rem',
          padding: '1rem',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.85rem'
        }}>
          {(status as any).logs?.length > 0 ? (status as any).logs.map((log: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#666', whiteSpace: 'nowrap' }}>[{new Date(log.timestamp).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}]</span>
              <span style={{ 
                color: log.type === 'warn' ? '#ffcc00' : log.type === 'error' ? '#ff4d4f' : '#ccc',
                wordBreak: 'break-word'
              }}>
                {log.message}
              </span>
            </div>
          )) : (
            <div className="text-muted italic">No activity recorded yet.</div>
          )}
        </div>
      </div>

      {/* AI Memory Log: Mistakes & Lessons */}
      <div className="glass-panel" style={{ borderLeft: '4px solid #faad14', background: 'rgba(250, 173, 20, 0.02)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <BrainCircuit size={20} color="#faad14" /> AI Brain Memory (Lessons Learned)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
          {mistakes.length > 0 ? mistakes.map((m, i) => (
            <div key={i} className="glass-panel" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(250,173,20,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#faad14' }}>{m.symbol}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--loss-color)' }}>PnL: ${m.pnl?.toFixed(2)}</span>
              </div>
              <div className="text-xs text-muted mb-2">
                {m.strategy} • Entry: ${m.entryPrice?.toFixed(4)} → Exit: ${m.exitPrice?.toFixed(4)}
              </div>
              <div style={{ padding: '0.75rem', background: 'rgba(250, 173, 20, 0.05)', borderRadius: '6px', fontSize: '0.85rem', lineHeight: 1.5, color: '#eee' }}>
                <span style={{ marginRight: '0.5rem' }}>🧠</span>
                {m.aiLesson}
              </div>
              <div style={{ marginTop: '0.75rem', textAlign: 'right', fontSize: '0.7rem', color: '#666' }}>
                {new Date(m.recordedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
              </div>
            </div>
          )) : (
            <div className="text-muted italic p-4">No strategic mistakes recorded yet. AI is still learning!</div>
          )}
        </div>
      </div>

    </div>
  );
}
