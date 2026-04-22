import React, { useState } from 'react';
import { 
  Shuffle, 
  ArrowRightLeft, 
  TrendingUp, 
  Zap, 
  Activity, 
  AlertCircle, 
  Play, 
  Settings2,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import MockupBanner from '../components/MockupBanner';

const Arbitrage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'funding' | 'dex_cex' | 'triangular'>('funding');

  const mockOpportunities = [
    { id: 1, symbol: 'SOL/USDT', type: 'Funding', source: 'Binance', target: 'Bybit', gap: '+45.2%', status: 'Hot', risk: 'Low' },
    { id: 2, symbol: 'PEPE/SOL', type: 'DEX-CEX', source: 'Raydium', target: 'Binance', gap: '+2.4%', status: 'Stable', risk: 'Medium' },
    { id: 3, symbol: 'DOGE/USDT', type: 'Funding', source: 'Binance', target: 'OKX', gap: '+12.8%', status: 'Normal', risk: 'Low' },
    { id: 4, symbol: 'JUP/USDT', type: 'Triangular', source: 'SOL', target: 'USDT', gap: '+0.85%', status: 'Fast', risk: 'High' },
  ];

  return (
    <div className="arbitrage-container animate-fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <MockupBanner />
      
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header Section */}
        <div className="glass-panel" style={{ borderLeft: '4px solid #0ecb81' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Shuffle color="#0ecb81" size={28} /> Arbitrage Hub
              </h2>
              <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>Detect & Execute price discrepancies across markets</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '0.5rem 1rem', background: 'rgba(14, 203, 129, 0.1)', borderColor: 'rgba(14, 203, 129, 0.3)' }}>
                <span style={{ fontSize: '0.8rem', color: '#0ecb81' }}>SYSTEM LOAD: <strong style={{ color: '#0ecb81' }}>NORMAL</strong></span>
              </div>
              <button className="btn-primary" style={{ background: '#0ecb81', color: '#000' }}>
                <Zap size={16} fill="black" /> Deploy Bot
              </button>
            </div>
          </div>
        </div>

        {/* Filters/Tabs */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[
            { id: 'funding', label: 'Funding Arbi', icon: <Clock size={16} /> },
            { id: 'dex_cex', label: 'DEX-CEX Gap', icon: <ArrowRightLeft size={16} /> },
            { id: 'triangular', label: 'Triangular', icon: <Activity size={16} /> },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="glass-panel"
              style={{
                flex: 1,
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                border: activeTab === tab.id ? '1px solid #0ecb81' : '1px solid rgba(255,255,255,0.05)',
                background: activeTab === tab.id ? 'rgba(14, 203, 129, 0.05)' : 'rgba(255,255,255,0.02)',
                color: activeTab === tab.id ? '#0ecb81' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid-cols-4" style={{ gridTemplateColumns: '3fr 1fr', gap: '1.5rem' }}>
          {/* Main Scanner Table */}
          <div className="glass-panel" style={{ padding: '0' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Live Signal Scanner</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#0ecb81', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <RefreshCw size={14} className="animate-spin" /> Auto-refreshing
                </span>
              </div>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <th style={{ padding: '1rem' }}>Asset</th>
                  <th>Type</th>
                  <th>Source 1</th>
                  <th>Source 2</th>
                  <th>Spread / APR</th>
                  <th>Risk</th>
                  <th style={{ paddingRight: '1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {mockOpportunities.map(opp => (
                  <tr key={opp.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: 700 }}>{opp.symbol}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>{opp.type}</span>
                    </td>
                    <td>{opp.source}</td>
                    <td>{opp.target}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0ecb81', fontWeight: 'bold' }}>
                        <ArrowUpRight size={14} /> {opp.gap}
                      </div>
                    </td>
                    <td>
                      <span style={{ color: opp.risk === 'Low' ? '#0ecb81' : opp.risk === 'Medium' ? '#faad14' : '#f6465d' }}>{opp.risk}</span>
                    </td>
                    <td style={{ paddingRight: '1rem', textAlign: 'right' }}>
                       <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: '#0ecb81', color: '#0ecb81' }}>Exploit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sidebar: Bot Config / Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Strategy Insight */}
            <div className="glass-panel" style={{ background: 'rgba(0, 209, 255, 0.05)', borderColor: 'rgba(0, 209, 255, 0.2)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00d1ff' }}>
                <TrendingUp size={16} /> Market Insight
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#aaa', lineHeight: 1.5 }}>
                Current funding rates on SOL are extremely high. Shorting on Binance while holding Spot on-chain could yield ~45% APR with low risk.
              </p>
            </div>

            {/* Execution Controls */}
            <div className="glass-panel">
              <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings2 size={16} /> Parameters
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>MINIMUM GP %</label>
                  <input type="number" defaultValue="1.5" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', padding: '0.5rem', color: '#fff', borderRadius: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>MAX RISK LEVEL</label>
                  <select style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', padding: '0.5rem', color: '#fff', borderRadius: '4px' }}>
                    <option>Low Risk Only</option>
                    <option>Medium Balanced</option>
                    <option>Aggressive</option>
                  </select>
                </div>
                <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                   <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <span className="text-muted">Estimated Profit</span>
                      <span style={{ color: '#0ecb81' }}>+$124.50</span>
                   </div>
                   <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                      <span className="text-muted">Daily Target</span>
                      <span>85% Reach</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Help / Alert */}
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: 'rgba(246, 70, 93, 0.05)', borderColor: 'rgba(246, 70, 93, 0.2)' }}>
               <AlertCircle size={18} color="#f6465d" style={{ flexShrink: 0 }} />
               <p style={{ margin: 0, fontSize: '0.75rem', color: '#f6465d', lineHeight: 1.4 }}>
                 Ensure you have sufficient liquidity on both source and target platforms to avoid execution failure.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Arbitrage;
