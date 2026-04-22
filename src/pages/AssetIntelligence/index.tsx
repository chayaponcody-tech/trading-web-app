import React, { useState } from 'react';
import { Database, Plus, Search, Twitter, Globe, ArrowUpRight, Flame, BarChart2 } from 'lucide-react';
import MockupBanner from '../../components/MockupBanner';


const mockProfiles = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', sector: 'Store of Value', sentiment: 82, trend: 'bullish' },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', sector: 'Meme', sentiment: 95, trend: 'bullish' },
  { id: 'gala', name: 'Gala Games', symbol: 'GALA', sector: 'GameFi', sentiment: 45, trend: 'neutral' },
  { id: 'link', name: 'Chainlink', symbol: 'LINK', sector: 'Infrastructure', sentiment: 60, trend: 'bullish' }
];

export default function AssetIntelligence() {
  const [activeProfile, setActiveProfile] = useState(mockProfiles[1]);

  return (
    <div className="asset-intelligence-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <MockupBanner />
      <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '1rem', padding: '1rem' }}>
      
      {/* LEFT: Explorer / List */}
      <aside className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} color="#00d1ff"/> Asset Profiles
          </h3>
          <div className="search-box" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.5rem' }}>
            <Search size={16} color="var(--text-muted)" style={{ marginRight: '0.5rem' }} />
            <input type="text" placeholder="Search tokens..." style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%' }} />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {mockProfiles.map(p => (
            <div 
              key={p.id} 
              onClick={() => setActiveProfile(p)}
              style={{
                padding: '0.75rem', 
                borderRadius: '8px', 
                marginBottom: '0.5rem',
                cursor: 'pointer',
                background: activeProfile.id === p.id ? 'rgba(0, 209, 255, 0.1)' : 'transparent',
                border: activeProfile.id === p.id ? '1px solid rgba(0, 209, 255, 0.3)' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{p.symbol}</strong>
                <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{p.sector}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Score: <span style={{ color: p.sentiment > 70 ? '#0ecb81' : p.sentiment > 40 ? '#faad14' : '#f6465d' }}>{p.sentiment}</span>/100
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Add Profile
          </button>
        </div>
      </aside>

      {/* MIDDLE: Markdown Editor / Viewer */}
      <main className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', color: '#fff' }}>{activeProfile.name} ({activeProfile.symbol})</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>/research/asset_profiles/{activeProfile.symbol}.md</span>
          </div>
          <button className="btn-outline">✏️ Edit Knowledge</button>
        </div>
        
        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, lineHeight: '1.6', color: '#e0e0e0' }}>
          <h1>🪙 {activeProfile.symbol} Intelligence Profile</h1>
          <p>
            <strong>Sector:</strong> {activeProfile.sector}<br/>
            <strong>Core Narrative:</strong> {activeProfile.symbol === 'DOGE' ? 'The original meme coin backed by Elon Musk and strong community.' : 'Mainly driven by gaming adoption and node operators.'}
          </p>
          
          <h3>🎯 Key Drivers</h3>
          <ul>
            <li>Market liquidity and general risk-on sentiment</li>
            {activeProfile.symbol === 'DOGE' ? <li>Elon Musk's tweets or Tesla/X integration news</li> : <li>Game releases and user acquisition metrics</li>}
            <li>Overall sector rotation</li>
          </ul>

          <h3>📡 Targeted Social Sources</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: 'rgba(29, 161, 242, 0.1)', border: '1px solid rgba(29, 161, 242, 0.3)', padding: '0.75rem', borderRadius: '8px', flex: 1 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1DA1F2' }}><Twitter size={16}/> Primary KOL</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>@elonmusk (High Impact)</p>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px', flex: 1 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Globe size={16}/> News Aggregator</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>CryptoPanic (Meme Filter)</p>
            </div>
          </div>
        </div>
      </main>

      {/* RIGHT: Live Data & Sentiment Scoring */}
      <aside style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Sentiment Widget */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Real-time Sentiment</h4>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '3rem', fontWeight: 'bold', lineHeight: '1', color: activeProfile.sentiment > 70 ? '#0ecb81' : '#f6465d' }}>
              {activeProfile.sentiment}
            </span>
            <span style={{ color: 'var(--text-muted)', paddingBottom: '0.4rem' }}> / 100</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ 
              height: '100%', 
              width: `${activeProfile.sentiment}%`, 
              background: activeProfile.sentiment > 70 ? '#0ecb81' : '#f6465d',
              transition: 'all 0.5s ease' 
            }} />
          </div>

          <div style={{ fontSize: '0.85rem', color: '#e0e0e0', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Flame color="#faad14" size={18} style={{ flexShrink: 0 }}/>
            <div>
              <strong>Surge Detected:</strong> Mention rate on Twitter increased by 300% in the last 15 minutes.
            </div>
          </div>
        </div>

        {/* Quant Engine Integration */}
        <div className="glass-panel" style={{ padding: '1.5rem', flex: 1 }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>HunterAgent Status</h4>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
             <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeProfile.sentiment > 70 ? '#0ecb81' : 'gray', boxShadow: activeProfile.sentiment > 70 ? '0 0 10px #0ecb81' : 'none' }}></div>
             <strong style={{ fontSize: '0.9rem' }}>{activeProfile.sentiment > 70 ? 'Ready to Deploy' : 'Monitoring'}</strong>
          </div>

          <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '0.85rem' }}>
             <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
               <span style={{ color: 'var(--text-muted)' }}>Tech Indicator:</span>
               <span style={{ color: '#0ecb81' }}>Bullish Div</span>
             </li>
             <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
               <span style={{ color: 'var(--text-muted)' }}>Knowledge Edge:</span>
               <span style={{ color: '#00d1ff' }}>+20% Conviction</span>
             </li>
             <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
               <span style={{ color: 'var(--text-muted)' }}>Action:</span>
               <span>Looking for Entry</span>
             </li>
          </ul>

          <button className="btn-outline" style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
            Open Chart <ArrowUpRight size={14}/>
          </button>
        </div>

      </aside>
      </div>
    </div>
  );
}
