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
  const [fleets, setFleets] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mistakes, setMistakes] = useState<any[]>([]);

  // Form states (targets selected fleet)
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [budget, setBudget] = useState(1000);
  const [maxLoss, setMaxLoss] = useState(5);
  const [botCount, setBotCount] = useState(3);
  const [riskMode, setRiskMode] = useState('confident');

  const fetchData = async () => {
    try {
      const [resFleets, resWallet, resBots, resMistakes] = await Promise.all([
        fetch(`${API}/api/portfolio/fleets`),
        fetch(`${API}/api/wallet`),
        fetch(`${API}/api/bots/summary`),
        fetch(`${API}/api/binance/mistakes`)
      ]);
      const fleetsData = await resFleets.json();
      const walletData = await resWallet.json();
      const botsData = await resBots.json();
      const mistakesData = await resMistakes.json();
      
      // If a fleet is selected, fetch its detailed status (including logs)
      let enrichedFleets = [...fleetsData];
      if (selectedFleetId) {
        try {
          const resStatus = await fetch(`${API}/api/portfolio/fleets/${selectedFleetId}/status`);
          const statusData = await resStatus.json();
          enrichedFleets = fleetsData.map((f: any) => 
            f.id === selectedFleetId ? { ...f, ...statusData } : f
          );
        } catch (e) {
          console.error('Failed to fetch detailed fleet status');
        }
      }

      setFleets(enrichedFleets);
      setWallet(walletData);
      setBots(botsData.filter((b: any) => b.isRunning));
      setMistakes(mistakesData);
      
      // Auto-select first fleet if none selected
      if (!selectedFleetId && enrichedFleets.length > 0) {
        const first = enrichedFleets[0];
        setSelectedFleetId(first.id);
        updateFormFromFleet(first);
      } else if (selectedFleetId) {
        const current = enrichedFleets.find((f: any) => f.id === selectedFleetId);
        if (current) updateFormFromFleet(current);
      }
    } catch (e) {
      console.error('Failed to fetch portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const updateFormFromFleet = (fleet: any) => {
    setBudget(fleet.config.totalBudget);
    setMaxLoss(fleet.config.maxDailyLossPct);
    setBotCount(fleet.config.targetBotCount);
    setRiskMode(fleet.config.riskMode || 'confident');
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [selectedFleetId]);

  const handleSaveSettings = async (payload: any = null) => {
    if (!selectedFleetId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API}/api/portfolio/fleets/${selectedFleetId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {
          totalBudget: budget,
          maxDailyLossPct: maxLoss,
          targetBotCount: botCount,
          riskMode: riskMode
        }),
      });
      const data = await res.json();
      if (!payload) {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
      fetchData();
    } catch (e) {
      setMessage('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFleet = async () => {
    const name = window.prompt('Enter new fleet name:');
    if (!name) return;
    try {
      await fetch(`${API}/api/portfolio/fleets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      fetchData();
    } catch (e) {}
  };

  const toggleAutoPilot = async (fleetId: string) => {
    const fleet = fleets.find(f => f.id === fleetId);
    if (!fleet) return;
    const newState = !fleet.config.isAutonomous;
    try {
      await fetch(`${API}/api/portfolio/fleets/${fleetId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAutonomous: newState }),
      });
      await fetch(`${API}/api/portfolio/fleets/${fleetId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }), 
      });
      fetchData();
    } catch (e) {
      console.error('Toggle failed');
    }
  };

  const handleDeleteFleet = async (id: string, name: string) => {
    if (!window.confirm(`Delete fleet "${name}"? All associated autonomous bots will stop.`)) return;
    try {
      await fetch(`${API}/api/portfolio/fleets/${id}`, { method: 'DELETE' });
      if (selectedFleetId === id) setSelectedFleetId(null);
      fetchData();
    } catch (e) {}
  }

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

  if (loading) return <div className="p-8 text-muted animate-pulse">Initializing AI Port Manager...</div>;
  if (fleets.length === 0) return (
    <div className="p-8 text-center glass-panel m-4">
      <h3>No Active Fleets</h3>
      <button className="btn-primary mt-4" onClick={handleCreateFleet}>Create First Fleet</button>
    </div>
  );

  const currentFleet = fleets.find(f => f.id === selectedFleetId) || fleets[0];

  // Safe Display Calculations
  const displayPnL = Number(wallet?.allTimePnL || 0);
  const displayBudget = Number(currentFleet?.config?.totalBudget || 1000);
  const pnlPct = (displayPnL / (displayBudget || 1)) * 100;
  const isProfitable = displayPnL >= 0;

  return (
    <div className="portfolio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner: Fleet Selector & Status */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h2 style={{ margin: 0 }}>AI Portfolio Command</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-sm text-muted">Editing:</span>
                <input 
                  type="text"
                  value={currentFleet.name}
                  onChange={(e) => handleSaveSettings({ name: e.target.value })}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.9rem', width: '150px', outline: 'none' }}
                />
                <Settings size={14} className="text-muted" />
              </div>
            </div>
            <button className="btn-outline btn-sm" onClick={handleCreateFleet}>➕ Create New Fleet</button>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {fleets.map(f => (
                <div 
                    key={f.id} 
                    onClick={() => setSelectedFleetId(f.id)}
                    className={`glass-panel hover-card ${selectedFleetId === f.id ? 'border-primary' : 'border-muted'}`}
                    style={{ 
                        flex: '1', minWidth: '240px', padding: '1rem', cursor: 'pointer',
                        background: selectedFleetId === f.id ? 'rgba(0, 209, 255, 0.05)' : 'rgba(255,255,255,0.02)',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Cpu size={24} color={f.config.isAutonomous ? '#00d1ff' : '#666'} />
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{f.name}</div>
                                <div className="text-xs text-muted">{f.config.isAutonomous ? 'AUTO-PILOT' : 'MANUAL'} • {f.currentAction}</div>
                            </div>
                        </div>
                        {f.id !== 'portfolio1' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteFleet(f.id, f.name); }}
                                className="text-muted hover-loss" style={{ background: 'none', border: 'none', padding: 0 }}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>

        <div className={`glass-panel ${currentFleet.config.isAutonomous ? 'border-success' : 'border-muted'}`} style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <Activity size={24} color={currentFleet.config.isAutonomous ? 'var(--profit-color)' : '#666'} />
             <div>
                <span className="text-sm font-bold">{currentFleet.name} Control Center</span>
                <p className="text-xs text-muted m-0">Dynamic risk configuration for specifically assigned bots.</p>
             </div>
          </div>
          <button 
            onClick={() => toggleAutoPilot(currentFleet.id)}
            className={currentFleet.config.isAutonomous ? 'btn-danger' : 'btn-primary'}
            style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
          >
            {currentFleet.config.isAutonomous ? 'DISABLE AUTO-PILOT' : 'ENABLE AUTO-PILOT'}
          </button>
        </div>
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

              <div className="input-group">
                <label>AI Brain (Model)</label>
                <select 
                  value={currentFleet.config.aiModel || ''} 
                  onChange={e => handleSaveSettings({ aiModel: e.target.value })} 
                  className="styled-input"
                >
                  <option value="">Default (System Managed)</option>
                  <option value="deepseek/deepseek-chat">🤖 DeepSeek V3 (Fast & Sharp)</option>
                  <option value="google/gemini-pro-1.5">♊ Gemini 1.5 Pro (Balanced)</option>
                  <option value="anthropic/claude-3.5-sonnet">🎭 Claude 3.5 Sonnet (Analytical)</option>
                  <option value="meta-llama/llama-3.1-405b">🦙 Llama 3.1 405B (Powerful)</option>
                </select>
                <p className="text-xs text-muted mt-1">Specific AI intelligence for THIS fleet.</p>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
               {message && <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0ecb81', fontSize: '0.9rem' }}><CheckCircle2 size={16} /> {message}</span>}
               <button className="btn-outline" onClick={fetchData}>Discard</button>
               <button className="btn-primary" onClick={() => handleSaveSettings()} disabled={isSaving}>
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
            <h4 className="text-muted text-xs uppercase m-0" style={{ letterSpacing: '1px' }}>Fleet Performance ({currentFleet.name})</h4>
            <div style={{ margin: '1.5rem 0' }}>
               <div style={{ fontSize: '3rem', fontWeight: 'bold', color: isProfitable ? 'var(--profit-color)' : 'var(--loss-color)' }}>
                  {isProfitable ? '+' : ''}{pnlPct.toFixed(2)}%
               </div>
               <p className="text-sm text-muted m-0">Unrealized: ${bots.filter(b => b.managedBy === currentFleet.id).reduce((sum, b) => sum + b.unrealizedPnl, 0).toFixed(2)} USDT</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
               <div>
                  <div className="text-xs text-muted">Fleet Size</div>
                  <div className="text-lg font-bold" style={{ color: '#fff' }}>{bots.filter(b => b.managedBy === currentFleet.id).length} / {currentFleet.config.targetBotCount}</div>
               </div>
               <div>
                  <div className="text-xs text-muted">Status</div>
                  <div className="text-lg font-bold" style={{ color: '#00d1ff' }}>{currentFleet.isRunning ? 'Active' : 'Stopped'}</div>
               </div>
            </div>
          </div>

          <div className="glass-panel">
            <h4 className="m-0 mb-3 flex items-center gap-2">
              <Activity size={18} color="#0ecb81" /> AI Strategy
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
               <div style={{ fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #00d1ff' }}>
                 <strong>Config:</strong> Maintaining {currentFleet.config.riskMode} stance with ${currentFleet.config.totalBudget} budget.
               </div>
               <div style={{ fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                 <strong>Action:</strong> {currentFleet.config.isAutonomous ? (currentFleet.currentAction || 'Scanning for gaps...') : 'Awaiting manual start'}
               </div>
            </div>
          </div>

          {currentFleet.config.isAutonomous && (
            <div className="glass-panel" style={{ background: 'rgba(14,203,129,0.05)', borderColor: 'rgba(14,203,129,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--profit-color)' }}>
                <ShieldAlert size={20} />
                <div className="text-sm font-bold">Fleet Shield Active</div>
              </div>
              <p className="text-xs text-muted m-0 mt-2">
                Monitoring drawdown for {currentFleet.name}. Threshold set at -{currentFleet.config.maxDailyLossPct}%.
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
          
          {/* Group 1: Selected Fleet (Autonomous) */}
          <div>
            <h4 className="text-xs text-muted uppercase mb-3" style={{ letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Cpu size={14} color="#00d1ff" /> Assigned to: {currentFleet.name} 
               <span style={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 'normal', color: '#666' }}> (Managed by Fleet Engine)</span>
            </h4>
            {bots.filter(b => 
              (b.managedBy === currentFleet.id) || 
              (currentFleet.id === 'portfolio1' && (b.managedBy === null || b.managedBy === 'auto-pilot' || b.managedBy === 'portfolio1'))
            ).length === 0 ? (
              <div className="text-xs text-muted italic p-3 border rounded" style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.05)' }}>
                No active autonomous bots assigned to "{currentFleet.name}" yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {bots.filter(b => 
                  (b.managedBy === currentFleet.id) || 
                  (currentFleet.id === 'portfolio1' && (b.managedBy === null || b.managedBy === 'auto-pilot' || b.managedBy === 'portfolio1'))
                ).map((bot) => (
                  <div key={bot.id} className="hover-card border-primary" style={{ padding: '1rem', background: 'rgba(0, 209, 255, 0.03)', borderRadius: '10px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <strong style={{ fontSize: '1rem' }}>{bot.symbol}</strong>
                            <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0, 209, 255, 0.2)', color: '#00d1ff', border: '1px solid rgba(0, 209, 255, 0.3)' }}>
                              {fleets.find(f => f.id === bot.managedBy)?.name || 'Main AI'}
                            </span>
                          </div>
                          <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>{bot.strategy} • {bot.interval}</div>
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
                     <div className="mt-2 text-xs text-muted italic border-t border-muted pt-2" style={{ color: '#00d1ff', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
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
               <TrendingUp size={14} color="#666" /> All Other Bots
               <span style={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 'normal', color: '#444' }}> (Manual or Managed by other fleets)</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {bots.filter(b => 
                !fleets.some(f => f.id === b.managedBy) && 
                b.managedBy !== 'auto-pilot' && 
                b.managedBy !== 'portfolio1'
              ).map((bot) => (
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
          {currentFleet.logs?.length > 0 ? currentFleet.logs.map((log: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.4rem', alignItems: 'flex-start' }}>
              <span style={{ color: '#00d1ff', minWidth: '150px', fontSize: '0.75rem', opacity: 0.8 }}>[{log.timestamp || 'Time Unknown'}]</span>
              <span style={{ 
                color: log.type === 'warn' ? '#ffcc00' : log.type === 'error' ? '#ff4d4f' : '#ccc',
                wordBreak: 'break-word'
              }}>
                {log.message}
              </span>
            </div>
          )) : (
            <div className="text-muted italic">No activity recorded for {currentFleet.name} yet.</div>
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
