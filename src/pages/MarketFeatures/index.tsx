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
    onchain: any;
  };
}

export default function MarketFeatures() {
  const [lang, setLang] = useState<'TH' | 'EN'>('EN');
  const [definitions, setDefinitions] = useState<FeatureDefinition[]>([]);
  const [sampleData, setSampleData] = useState<FeatureData | null>(null);
  const [symbol, setSymbol] = useState('');
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh timer
  useEffect(() => {
    let timer: any;
    if (autoRefresh && symbol && !loading) {
      timer = window.setInterval(() => {
        fetchSampleData();
      }, 15000); // Refresh every 15 seconds
    }
    return () => window.clearInterval(timer);
  }, [autoRefresh, symbol, loading, interval]);
  
  // Auto-suggest states
  const [allSymbols, setAllSymbols] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDefinitions();
    fetchBinanceSymbols();
  }, []);

  const fetchBinanceSymbols = async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      const data = await res.json();
      const usdtPairs = data.symbols
        .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .map((s: any) => s.symbol);
      setAllSymbols(usdtPairs);
    } catch (e) {
      console.error('Fetch symbols error:', e);
    }
  };

  const handleSearchChange = (val: string) => {
    const query = val.toUpperCase();
    setSearchQuery(query);
    if (query.length > 0) {
      const filtered = allSymbols
        .filter(s => s.startsWith(query))
        .slice(0, 10);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSymbol = (s: string) => {
    setSymbol(s);
    setSearchQuery('');
    setShowSuggestions(false);
    setTimeout(fetchSampleData, 100);
  };

  const t = (th: string, en: string) => lang === 'TH' ? th : en;

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
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/market/features?symbol=${symbol}&interval=${interval}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (data && data.price) {
        setSampleData(data);
      }
    } catch (e) {
      console.error('Fetch sample data error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '0.75rem', 
      padding: '0.75rem', 
      maxWidth: '100%', 
      margin: '0 auto',
    }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', zIndex: 100, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: '#faad14', fontSize: '1.25rem' }}>🧬 Market Features Engine</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.75rem' }}>{t('บริหารจัดการและระบุ "DNA ตลาด" จากหนึ่งที่เดียว', 'Centralized Alpha Factor Registry & Market DNA Management')}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
             <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {/* Language Switcher */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '4px', marginRight: '0.5rem' }}>
                  <button onClick={() => setLang('TH')} style={{ background: lang === 'TH' ? '#faad14' : 'transparent', border: 'none', color: lang === 'TH' ? '#000' : '#888', padding: '2px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer' }}>TH</button>
                  <button onClick={() => setLang('EN')} style={{ background: lang === 'EN' ? '#faad14' : 'transparent', border: 'none', color: lang === 'EN' ? '#000' : '#888', padding: '2px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer' }}>EN</button>
                </div>

                {/* Auto Refresh Toggle */}
                <div 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: autoRefresh ? 'rgba(14, 203, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                    marginRight: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    background: autoRefresh ? '#0ecb81' : '#555',
                    boxShadow: autoRefresh ? '0 0 8px #0ecb81' : 'none',
                    animation: autoRefresh ? 'pulse 2s infinite' : 'none'
                  }} />
                  <span style={{ fontSize: '0.55rem', fontWeight: 'bold', color: autoRefresh ? '#0ecb81' : '#666' }}>
                    {autoRefresh ? 'LIVE SYNC' : 'STATIC'}
                  </span>
                </div>

                <div style={{ position: 'relative', display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                   <div style={{ position: 'relative' }}>
                     <input 
                       value={searchQuery || symbol} 
                       onChange={e => handleSearchChange(e.target.value)}
                       onFocus={() => searchQuery && setShowSuggestions(true)}
                       placeholder={t('ค้นหาเหรียญ...', 'Search token...')}
                       style={{ 
                         background: 'transparent', 
                         border: 'none', 
                         color: '#fff', 
                         width: '120px', 
                         fontWeight: '900',
                         fontSize: '0.85rem',
                         letterSpacing: '0.5px'
                       }}
                     />
                     
                     {showSuggestions && (
                       <div style={{ 
                         position: 'absolute', 
                         top: 'calc(100% + 12px)', 
                         left: '-8px', 
                         width: '240px', 
                         background: '#1e2329', 
                         borderRadius: '8px', 
                         boxShadow: '0 12px 24px rgba(0,0,0,0.6)',
                         zIndex: 2000,
                         overflow: 'hidden',
                         border: '1px solid #333'
                       }}>
                         {suggestions.map(s => (
                           <div 
                             key={s} 
                             onClick={() => selectSymbol(s)}
                             style={{ 
                               padding: '12px 16px', 
                               cursor: 'pointer', 
                               display: 'flex', 
                               justifyContent: 'space-between', 
                               alignItems: 'center',
                               transition: 'all 0.1s',
                               borderBottom: '1px solid #2b3139'
                             }}
                             onMouseEnter={e => {
                               e.currentTarget.style.background = '#2b3139';
                               e.currentTarget.style.paddingLeft = '20px';
                             }}
                             onMouseLeave={e => {
                               e.currentTarget.style.background = 'transparent';
                               e.currentTarget.style.paddingLeft = '16px';
                             }}
                           >
                             <span style={{ color: '#fff', fontWeight: '900', fontSize: '0.9rem' }}>{s.replace('USDT', '')}</span>
                             <span style={{ color: '#faad14', fontSize: '0.6rem', fontWeight: 'bold', opacity: 0.8 }}>USDT</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>

                   <select 
                     value={interval} 
                     onChange={e => setInterval(e.target.value)}
                     style={{ background: 'transparent', border: 'none', color: '#faad14', fontWeight: 'bold' }}
                   >
                     {['1m', '5m', '15m', '1h', '4h', '1d'].map(i => <option key={i} value={i}>{i}</option>)}
                   </select>
                   <button 
                     onClick={fetchSampleData} 
                     disabled={loading}
                     style={{ background: '#faad14', border: 'none', color: '#000', padding: '2px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: '900' }}
                   >
                     {loading ? '...' : t('สแกน', 'SCAN')}
                   </button>
                </div>
              </div>
             
             {/* Quick Access Chips */}
             <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'STXUSDT', 'BNBUSDT', 'XRPUSDT'].map(s => (
                  <button 
                    key={s} 
                    onClick={() => { setSymbol(s); setTimeout(fetchSampleData, 100); }}
                    style={{ 
                      background: symbol === s ? 'rgba(250, 173, 20, 0.15)' : 'rgba(255,255,255,0.03)', 
                      border: `1px solid ${symbol === s ? '#faad14' : 'rgba(255,255,255,0.1)'}`,
                      color: symbol === s ? '#faad14' : '#888',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.6rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {s.replace('USDT', '')}
                  </button>
                ))}
             </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Top Insights Panel: Horizontal Analysis */}
      <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
        <h5 style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <Activity size={16} color="#0ecb81" /> {t('สรุปข้อมูลตลาดสด', 'Live Insights')} {symbol && `(${symbol})`}
        </h5>

        {!sampleData || !symbol ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#666', fontSize: '0.85rem', border: '1px dashed #333', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ marginBottom: '0.5rem' }}><Search size={24} style={{ opacity: 0.3 }} /></div>
            {t('เริ่มต้นด้วยการค้นหาคู่เงินที่คุณต้องการวิเคราะห์', 'Start by searching for a token pair to analyze')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr 1.2fr', gap: '1rem' }}>
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '1rem' }}>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>{t('ราคาตลาด', 'MKT PRICE')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>${sampleData?.price?.toLocaleString() || '0.00'}</div>
              <div style={{ fontSize: '0.6rem', color: '#0ecb81', marginTop: '4px' }}>{t('เชื่อมต่อข้อมูลสดแล้ว', 'LIVE FEED ACTIVE')}</div>
            </div>

            <FeatureGroup title={t('เครื่องมือทางเทคนิค', 'TECHNICALS')} color="#0ecb81">
              <StatRow label="RSI(14)" value={sampleData?.features?.technicals?.rsi?.toFixed(2)} />
              <StatRow label={t('แนวโน้ม', 'Trend')} value={sampleData?.features?.technicals?.trend_direction} />
              <StatRow label="EMA 20" value={sampleData?.features?.technicals?.ema20?.toFixed(1)} />
            </FeatureGroup>

            <FeatureGroup title={t('ดัชนีเชิงปริมาณ', 'QUANT (TQI)')} color="#00d1ff">
              <StatRow label={t('คะแนน TQI', 'TQI Score')} value={sampleData?.features?.quant?.tqi} highlight />
              <StatRow label={t('ประสิทธิภาพ', 'Efficiency')} value={sampleData?.features?.quant?.efficiency_ratio} />
              <StatRow label={t('ความผันผวน', 'Volatility')} value={sampleData?.features?.quant?.volatility_ratio} />
            </FeatureGroup>

            <FeatureGroup title={t('โครงสร้างตลาด', 'MICROSTRUCTURE')} color="#a78bfa">
               <StatRow label={t('อัตราดอกเบี้ย', 'Funding')} value={sampleData?.features?.microstructure?.fundingRate ? `${(sampleData.features.microstructure.fundingRate * 100).toFixed(4)}%` : 'N/A'} />
               <StatRow label={t('การล้างพอร์ต', 'Liq. Vol')} value={sampleData?.features?.microstructure?.liquidationVolume ? '$' + (sampleData.features.microstructure.liquidationVolume / 1000).toFixed(1) + 'K' : 'N/A'} highlight />
               <StatRow label={t('แรงซื้อขาย', 'OF Delta')} value={sampleData?.features?.microstructure?.orderFlowDelta} highlight />
            </FeatureGroup>

            <FeatureGroup title={t('ข้อมูลออนเชน', 'ON-CHAIN')} color="#fb923c">
               <StatRow label={t('เงินไหลเข้าออก', 'EX Netflow')} value={sampleData?.features?.onchain?.exchangeNetflow?.toFixed(2)} />
               <StatRow label={t('กิจกรรมวาฬ', 'Whale Act.')} value={sampleData?.features?.onchain?.whaleActivity} highlight />
               <StatRow label={t('สัดส่วนเหรียญนิ่ง', 'STB Ratio')} value={sampleData?.features?.onchain?.stablecoinRatio ? sampleData.features.onchain.stablecoinRatio.toFixed(1) + '%' : 'N/A'} />
            </FeatureGroup>
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
            <h5 style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Target size={16} color="#faad14" /> {t('สารบัญเครื่องมือวิเคราะห์ตลาด', 'Active Market Features Registry')}
            </h5>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Table Header */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '150px 1fr 220px 130px 120px 90px', 
                gap: '1rem', 
                padding: '0.75rem 1rem', 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '8px',
                fontSize: '0.65rem',
                fontWeight: '900',
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                <div>{t('ชื่อเครื่องมือ', 'Feature Name')}</div>
                <div>{t('ตรรกะและสูตรคำนวณ', 'Logic & Formula')}</div>
                <div>{t('ผลกระทบ / สัญญาณ', 'Market Impact / Signal')}</div>
                <div>{t('แหล่งข้อมูล', 'Data Source')}</div>
                <div>{t('ความถี่ข้อมูล', 'Update Nature')}</div>
                <div style={{ textAlign: 'right' }}>{t('หมวดหมู่', 'Category')}</div>
              </div>

              {/* Data Rows */}
              {definitions.map(def => (
                <div key={def.id} style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  padding: '0.75rem 1rem', 
                  display: 'grid', 
                  gridTemplateColumns: '150px 1fr 220px 130px 120px 90px', 
                  gap: '1rem', 
                  alignItems: 'center',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.03)',
                }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#faad14', fontSize: '0.8rem' }}>{t((def as any).name_th || def.name, def.name)}</div>
                    <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{def.id.toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#fff', marginBottom: '2px', lineHeight: '1.2' }}>{t((def as any).description_th || def.description, def.description)}</div>
                    <div style={{ fontSize: '0.6rem', color: '#555', fontFamily: 'monospace' }}>{def.formula}</div>
                  </div>
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: '#0ecb81', 
                    fontWeight: '600', 
                    background: 'rgba(14,203,129,0.03)', 
                    padding: '6px', 
                    borderRadius: '6px'
                  }}>
                    {t((def as any).impact_th || (def as any).impact, (def as any).impact || 'N/A')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#00d1ff', fontWeight: '900', opacity: 0.8 }}>
                    {(def as any).source}
                  </div>
                  <div>
                    <span style={{ 
                      fontSize: '0.55rem', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontWeight: 'bold',
                      background: (def as any).update_type === 'Real-time' ? 'rgba(14, 203, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: (def as any).update_type === 'Real-time' ? '#0ecb81' : '#888',
                      border: `1px solid ${(def as any).update_type === 'Real-time' ? 'rgba(14, 203, 129, 0.2)' : 'rgba(255,255,255,0.1)'}`
                    }}>
                      {t((def as any).update_type_th || (def as any).update_type, (def as any).update_type || 'N/A')}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: '0.55rem', 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      fontWeight: '800',
                      letterSpacing: '0.5px',
                      background: def.category === 'Quant' ? 'rgba(0, 209, 255, 0.1)' : def.category === 'Technical' ? 'rgba(14, 203, 129, 0.1)' : 'rgba(251, 146, 60, 0.1)',
                      color: def.category === 'Quant' ? '#00d1ff' : def.category === 'Technical' ? '#0ecb81' : '#fb923c',
                      border: `1px solid ${def.category === 'Quant' ? '#00d1ff44' : def.category === 'Technical' ? '#0ecb8144' : '#fb923c44'}`
                    }}>
                      {def.category.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}

              {/* Proposed / Future Features (SMC & Advanced Quant) */}
              {[
                { id: 'obi', name: 'Order Book Imbalance', name_th: 'ความต่างของออเดอร์ (OBI)', desc: 'Order Book Imbalance (Bid-Ask)', desc_th: 'ความไม่สมดุลของปริมาณการตั้งซื้อและตั้งขาย', formula: '(Bid-Ask)/(Bid+Ask)', impact: 'Predict short-term price pressure', impact_th: 'ทำนายแรงดันราคาระยะสั้น', source: 'L2 WS', category: 'Microstructure' },
                { id: 'taker_ratio', name: 'Taker Buy/Sell Ratio', name_th: 'อัตราส่วนแรงซื้อขายจริง', desc: 'Ratio of market buy volume to market sell volume', desc_th: 'แรงเคาะซื้อจริงเทียบกับแรงเคาะขายจริง', formula: 'Buy Vol / Sell Vol', impact: 'Real aggresive force indicator', impact_th: 'ตัวชี้วัดแรงกระทำจริงของรายใหญ่', source: 'AggTrade WS', category: 'Microstructure' },
                { id: 'z_score', name: 'Price Z-Score', name_th: 'ดัชนีเบี่ยงเบนราคา (Z-Score)', desc: 'Standard deviations from the mean price', desc_th: 'การเบี่ยงเบนของราคากับค่าเฉลี่ยในเชิงสถิติ', formula: '(Price - SMA)/StdDev', impact: 'Mean reversion identifyer', impact_th: 'ระบุจุดที่ราคาเบี่ยงเบนมากเกินไป', source: 'Quant Node', category: 'Quant' },
                { id: 'rvol', name: 'Relative Volume (RVOL)', name_th: 'ปริมาณซื้อขายสัมพัทธ์ (RVOL)', desc: 'Volume compared to trailing average', desc_th: 'ปริมาณการซื้อขายเทียบกับสภาวะปกติ', formula: 'Volume / SMA(Vol, 20)', impact: 'Separating signal from noise', impact_th: 'แยกสัญญาณจริงจากสัญญาณหลอก', source: 'Exchange API', category: 'Quant' },
                { id: 'sentiment', name: 'Sentiment Alpha', name_th: 'ดัชนีความรู้สึกตลาด', desc: 'Social & News aggregated sentiment', desc_th: 'ความรู้สึกของตลาดจากโซเชียลมีเดียและข่าว', formula: 'AI Neural sentiment index', impact: 'Early trend reversal detection', impact_th: 'ดักจังหวะกลับตัวก่อนเทคนิเคิล', source: 'Sentiment API', category: 'Alternative' },
                { id: 'mempool', name: 'Mempool Flows', name_th: 'การเคลื่อนไหวใน Mempool', desc: 'Whale movements in the mempool', desc_th: 'ธุรกรรมขนาดใหญ่ที่รอการยืนยันบนเชน', formula: 'Mempool agg activity', impact: 'Pre-dump/pump alert', impact_th: 'เตือนภัยล่วงหน้าก่อนเกิดการเทขาย', source: 'On-chain Node', category: 'On-chain' }
              ].map(feat => (
                <div key={feat.id} style={{ 
                  background: 'rgba(255,255,255,0.01)', 
                  padding: '0.75rem 1rem', 
                  display: 'grid', 
                  gridTemplateColumns: '150px 1fr 220px 130px 120px 90px', 
                  gap: '1rem', 
                  alignItems: 'center',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255,255,255,0.05)',
                  opacity: 0.6
                }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#888', fontSize: '0.8rem' }}>{t(feat.name_th, feat.name)}</div>
                    <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{feat.id.toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px', lineHeight: '1.2' }}>{t(feat.desc_th, feat.desc)}</div>
                    <div style={{ fontSize: '0.55rem', color: '#444', fontFamily: 'monospace' }}>{feat.formula}</div>
                  </div>
                  <div style={{ 
                    fontSize: '0.65rem', 
                    color: '#444', 
                    fontStyle: 'italic',
                    padding: '2px', 
                  }}>
                    {t(feat.impact_th, feat.impact)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#333', fontWeight: 'bold' }}>
                    {feat.source}
                  </div>
                  <div>
                    <span style={{ 
                      fontSize: '0.5rem', 
                      padding: '1px 6px', 
                      borderRadius: '4px', 
                      fontWeight: 'bold',
                      background: 'rgba(255,255,255,0.03)',
                      color: '#444',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {t('ยังไม่มี', 'NOT AVAILABLE')}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: '0.5rem', 
                      padding: '3px 8px', 
                      borderRadius: '20px', 
                      fontWeight: '800',
                      background: 'rgba(255,255,255,0.02)',
                      color: '#444',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                      {feat.category.toUpperCase()}
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

        {/* 🧬 Scanning Overlay (Loading UI) */}
        {loading && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            background: 'rgba(0,0,0,0.7)', 
            backdropFilter: 'blur(6px)',
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999,
            transition: 'all 0.4s ease-in-out'
          }}>
            <div style={{ 
              background: 'rgba(30, 35, 41, 0.98)', 
              padding: '2.5rem 4rem', 
              borderRadius: '24px', 
              border: '1px solid #faad1433',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              animation: 'popUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
              <div style={{ position: 'relative' }}>
                 <Activity size={64} color="#faad14" className="pulse-slow" />
                 <div style={{ 
                    position: 'absolute', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)',
                    width: '30px', 
                    height: '30px', 
                    background: '#faad1422',
                    borderRadius: '50%',
                    filter: 'blur(10px)',
                    animation: 'pulseGlow 2s infinite'
                 }} />
              </div>
              
              <div style={{ textAlign: 'center' }}>
                 <div style={{ 
                    color: '#fff', 
                    fontWeight: '900', 
                    fontSize: '1.25rem', 
                    letterSpacing: '3px', 
                    marginBottom: '0.4rem',
                    textShadow: '0 0 10px rgba(250, 173, 20, 0.5)' 
                 }}>
                   {t('กำลังสแกน DNA ตลาด...', 'SCANNING MARKET DNA...')}
                 </div>
                 <div style={{ color: '#848e9c', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '2px', opacity: 0.8 }}>
                   {symbol || 'INITIALIZING'} • {interval} • LIVE ADAPTIVE
                 </div>
              </div>
              
              <div style={{ width: '200px', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                 <div className="loading-bar-scan" style={{ position: 'absolute', width: '30%', height: '100%', background: 'linear-gradient(90deg, transparent, #faad14, transparent)' }} />
              </div>
            </div>
            
            <style>{`
              @keyframes popUp {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              @keyframes scanMove {
                0% { left: -100%; }
                100% { left: 100%; }
              }
              @keyframes pulseGlow {
                0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.8; }
              }
              .loading-bar-scan {
                animation: scanMove 1.5s infinite ease-in-out;
              }
              .pulse-slow {
                animation: pulseIcon 2s infinite ease-in-out;
              }
              @keyframes pulseIcon {
                0%, 100% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 0px #faad1400); }
                50% { opacity: 0.7; transform: scale(0.95); filter: drop-shadow(0 0 10px #faad1455); }
              }
            `}</style>
          </div>
        )}
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
