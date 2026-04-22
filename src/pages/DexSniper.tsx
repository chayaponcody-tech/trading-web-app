import React, { useState } from 'react';
import { Crosshair, Zap, Shield, Wallet, List, TrendingUp, Search, Settings2, Lock, Flame } from 'lucide-react';
import MockupBanner from '../components/MockupBanner';

const DexSniper: React.FC = () => {
  const [activeToken, setActiveToken] = useState('SOL');
  const [slippage, setSlippage] = useState(15);
  const [priorityFee, setPriorityFee] = useState(0.003);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const mockLogs = [
    { id: 1, type: 'BUY', amount: '0.5 SOL', token: 'PEPE', status: 'SUCCESS', time: '2m ago', pnl: '+12%' },
    { id: 2, type: 'BUY', amount: '1.0 SOL', token: 'WOJAK', status: 'SUCCESS', time: '5m ago', pnl: '-2%' },
    { id: 3, type: 'SELL', amount: '2.5 SOL', token: 'DOGE', status: 'SUCCESS', time: '12m ago', pnl: '+45%' },
  ];

  const quickBuyAmounts = [0.1, 0.5, 1.0, 2.0, 5.0];

  return (
    <div className="dex-sniper-container animate-fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '0' }}>
      <MockupBanner />
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header Info */}
        <div className="glass-panel flex-between" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #a78bfa' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Crosshair color="#a78bfa" size={28} /> DEX Sniper Zone
            </h2>
            <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>High-speed On-chain Execution (Solana / Base)</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', background: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.3)' }}>
              <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600 }}>PLATFORM FEE: 0.75%</span>
            </div>
            <button 
              className={isWalletConnected ? 'btn-outline' : 'btn-primary'} 
              onClick={() => setIsWalletConnected(!isWalletConnected)}
              style={{ minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
             <Wallet size={18} /> {isWalletConnected ? '4k7y...zP9q' : 'Connect Wallet'}
            </button>
          </div>
        </div>

        <div className="grid-cols-4" style={{ gridTemplateColumns: 'minmax(600px, 3fr) 1fr', gap: '1.5rem' }}>
          {/* Main Chart Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ flex: 1, minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                 <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ background: '#a78bfa', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={20} color="white" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0 }}>PEPE / SOL</h3>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>DEX: Raydium • Liquidity: $1.2M</span>
                    </div>
                 </div>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>1M</button>
                    <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: '#a78bfa', color: '#a78bfa' }}>5M</button>
                    <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>1H</button>
                 </div>
              </div>
              
              {/* Mock Chart Area */}
              <div style={{ flex: 1, background: '#0a0a0f', borderRadius: '8px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <TrendingUp size={48} color="rgba(167, 139, 250, 0.2)" />
                  <p className="text-muted" style={{ marginTop: '1rem' }}>Real-time TradingView Chart Placeholder</p>
                </div>
                {/* Fake Price Line */}
                <div style={{ position: 'absolute', bottom: '20%', left: 0, right: 0, height: '40%', borderTop: '2px solid #a78bfa', background: 'linear-gradient(to top, rgba(167, 139, 250, 0.1), transparent)' }} />
              </div>
            </div>

            {/* Activity Logs */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <List size={18} /> Recent Snipes
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.5rem' }}>Time</th>
                    <th style={{ padding: '0.5rem' }}>Token</th>
                    <th style={{ padding: '0.5rem' }}>Type</th>
                    <th style={{ padding: '0.5rem' }}>Amount</th>
                    <th style={{ padding: '0.5rem' }}>PnL</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLogs.map(log => (
                    <tr key={log.id} style={{ borderTop: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '1rem 0.5rem' }} className="text-muted">{log.time}</td>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>{log.token}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span style={{ color: log.type === 'BUY' ? 'var(--profit-color)' : 'var(--loss-color)', fontWeight: 700 }}>{log.type}</span>
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>{log.amount}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span className={log.pnl.startsWith('+') ? 'text-profit' : 'text-loss'}>{log.pnl}</span>
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(14, 203, 129, 0.1)', color: 'var(--profit-color)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{log.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Sidebar: Sniper Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Quick Snipe Panel */}
            <div className="glass-panel" style={{ border: '1px solid rgba(167, 139, 250, 0.3)', boxShadow: '0 0 20px rgba(167, 139, 250, 0.1)' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa' }}>
                <Zap size={18} fill="#a78bfa" /> Instant Snipe
              </h3>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem' }}>SOL AMOUNT</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {quickBuyAmounts.map(amt => (
                    <button 
                      key={amt} 
                      className="btn-outline" 
                      style={{ padding: '0.5rem', fontSize: '0.9rem', borderColor: amt === 1.0 ? '#a78bfa' : 'var(--border-color)' }}
                    >
                      {amt} SOL
                    </button>
                  ))}
                  <button className="btn-outline" style={{ padding: '0.5rem', fontSize: '0.9rem' }}>MAX</button>
                </div>
              </div>

              <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem', padding: '0.75rem' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                   <span className="text-muted" style={{ fontSize: '0.85rem' }}>Est. Receive</span>
                   <strong style={{ color: 'var(--text-main)' }}>~ 2,450,122 PEPE</strong>
                </div>
                <div className="flex-between">
                   <span className="text-muted" style={{ fontSize: '0.85rem' }}>Service Fee (0.75%)</span>
                   <span style={{ color: '#a78bfa', fontSize: '0.85rem' }}>0.0075 SOL</span>
                </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Lock size={18} /> SNIPE NOW
              </button>
            </div>

            {/* Sniper Settings */}
            <div className="glass-panel">
               <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings2 size={18} /> Execution Settings
              </h3>
              
              <div style={{ marginBottom: '1.25rem' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <label className="text-muted" style={{ fontSize: '0.8rem' }}>MAX SLIPPAGE</label>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>{slippage}%</span>
                </div>
                <input 
                  type="range" 
                  min="1" max="50" 
                  value={slippage} 
                  onChange={(e) => setSlippage(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#a78bfa' }} 
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                 <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <label className="text-muted" style={{ fontSize: '0.8rem' }}>PRIORITY FEE (SOL)</label>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>{priorityFee} SOL</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-outline" style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem' }} onClick={() => setPriorityFee(0.001)}>Fast</button>
                  <button className="btn-outline" style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', borderColor: '#a78bfa', color: '#a78bfa' }} onClick={() => setPriorityFee(0.005)}>Turbo</button>
                  <button className="btn-outline" style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem' }} onClick={() => setPriorityFee(0.01)}>Deegen</button>
                </div>
              </div>

              <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={14} color="#0ecb81" /> MEV PROTECTION
                </div>
                <span className="text-profit" style={{ fontWeight: 600 }}>ACTIVE</span>
              </div>
              <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={14} color="#faad14" /> PUMP.FUN MODE
                </div>
                <span style={{ color: '#faad14', fontWeight: 600 }}>AUTO</span>
              </div>
            </div>
            
            <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
               <Search size={32} className="text-muted" style={{ marginBottom: '1rem', opacity: 0.5 }} />
               <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Enter token address to start sniping</p>
               <input type="text" placeholder="Search by address..." style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', color: 'white', outline: 'none' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DexSniper;
