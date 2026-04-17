import { useState, useEffect } from 'react';
import { Target, Activity, Zap, TrendingUp, Info, ShieldCheck, Search } from 'lucide-react';

const API = 'http://localhost:4001';

interface FeatureDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  formula: string;
}

interface FeatureData {
  symbol: string;
  price: number;
  features: {
    technicals: any;
    quant: any;
    microstructure: any;
  };
}

export default function MarketFeatures() {
  const [definitions, setDefinitions] = useState<FeatureDefinition[]>([]);
  const [sampleData, setSampleData] = useState<FeatureData | null>(null);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const fetchDefinitions = async () => {
    try {
      const res = await fetch(`${API}/api/market/definitions`);
      const data = await res.json();
      setDefinitions(data);
    } catch (e) {
      console.error('Fetch definitions error:', e);
    }
  };

  const fetchSampleData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/market/features?symbol=${symbol}&interval=${interval}`);
      const data = await res.json();
      setSampleData(data);
    } catch (e) {
      console.error('Fetch sample data error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#faad14' }}>🧬 Market Features Engine</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>บริหารจัดการและระบุ "DNA ตลาด" (Alpha Factors) จากหนึ่งที่เดียว</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
             <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                <input 
                  value={symbol} 
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                  placeholder="Symbol"
                  style={{ background: 'transparent', border: 'none', color: '#fff', width: '100px', fontWeight: 'bold' }}
                />
                <select 
                  value={interval} 
                  onChange={e => setInterval(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#faad14' }}
                >
                  {['5m', '15m', '1h', '4h', '1d'].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <button 
                  onClick={fetchSampleData} 
                  disabled={loading}
                  style={{ background: '#faad14', border: 'none', color: '#000', padding: '2px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {loading ? '...' : 'SCAN'}
                </button>
             </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem' }}>
        {/* Left: Definitions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} color="#faad14" /> Active Market Features Registry
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {definitions.map(def => (
                <div key={def.id} style={{ background: 'var(--bg-main)', padding: '1rem', display: 'grid', gridTemplateColumns: '150px 1fr 150px', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#faad14' }}>{def.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#666' }}>{def.id.toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem' }}>{def.description}</div>
                    <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '4px', fontFamily: 'monospace' }}>Formula: {def.formula}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      padding: '2px 8px', 
                      borderRadius: '10px', 
                      background: def.category === 'Quant' ? 'rgba(0, 209, 255, 0.1)' : def.category === 'Technical' ? 'rgba(14, 203, 129, 0.1)' : 'rgba(167, 139, 250, 0.1)',
                      color: def.category === 'Quant' ? '#00d1ff' : def.category === 'Technical' ? '#0ecb81' : '#a78bfa',
                      border: `1px solid ${def.category === 'Quant' ? '#00d1ff44' : def.category === 'Technical' ? '#0ecb8144' : '#a78bfa44'}`
                    }}>
                      {def.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button style={{ 
              marginTop: '1.5rem', 
              width: '100%', 
              padding: '1rem', 
              borderRadius: '8px', 
              border: '2px dashed var(--border-color)', 
              background: 'transparent', 
              color: '#555', 
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              + REGISTER NEW ALPHA FEATURE (FUTURE)
            </button>
          </div>
        </div>

        {/* Right: Real-time Sample Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', height: 'fit-content' }}>
            <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="#0ecb81" /> Live Insights ({symbol})
            </h4>

            {!sampleData ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#444' }}>
                คลิก SCAN เพื่อดึงข้อมูลปัจจุบัน
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MKT PRICE</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${sampleData.price.toLocaleString()}</div>
                </div>

                {/* Technicals */}
                <FeatureGroup title="TECHNICALS" color="#0ecb81">
                  <StatRow label="RSI(14)" value={sampleData.features.technicals.rsi?.toFixed(2)} />
                  <StatRow label="Trend" value={sampleData.features.technicals.trend_direction} />
                  <StatRow label="EMA 20" value={sampleData.features.technicals.ema20?.toFixed(1)} />
                </FeatureGroup>

                {/* Quant (TQI) */}
                <FeatureGroup title="QUANT (TQI)" color="#00d1ff">
                  <StatRow label="TQI Score" value={sampleData.features.quant.tqi} highlight />
                  <StatRow label="Efficiency" value={sampleData.features.quant.efficiency_ratio} />
                  <StatRow label="Volatility Z" value={sampleData.features.quant.volatility_ratio} />
                  <StatRow label="Momentum" value={sampleData.features.quant.momentum_persistence} />
                </FeatureGroup>

                {/* Microstructure */}
                <FeatureGroup title="MICROSTRUCTURE" color="#a78bfa">
                   <StatRow label="Funding Rate" value={`${(sampleData.features.microstructure.fundingRate * 100).toFixed(4)}%`} />
                   <StatRow label="Open Interest" value={(sampleData.features.microstructure.openInterest / 1000).toFixed(1) + 'K'} />
                </FeatureGroup>
              </div>
            )}
          </div>
          
          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(250, 173, 20, 0.05)', border: '1px solid #faad1444' }}>
            <div style={{ display: 'flex', gap: '0.5rem', color: '#faad14', marginBottom: '0.5rem' }}>
              <Info size={16} /> <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>QUANT NOTE</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#faad14', margin: 0, lineHeight: 1.5 }}>
              Market Features เหล่านี้ถูกดึงผ่าน Logic กลาง (MarketDataEngine) ซึ่งรับประกันว่าบอททุกตัวในระบบจะเห็นภาพรวมตลาดที่เหมือนกัน 100%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureGroup({ title, children, color }: { title: string; children: React.ReactNode; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.55rem', fontWeight: '900', color, letterSpacing: '1px' }}>{title}</div>
      {children}
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: highlight ? '1rem' : '0.85rem', fontWeight: 'bold', color: highlight ? '#faad14' : 'var(--text-main)' }}>{value ?? 'N/A'}</span>
    </div>
  );
}
