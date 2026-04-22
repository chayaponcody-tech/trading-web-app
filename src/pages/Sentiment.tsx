import { useState, useEffect, useCallback } from 'react';
import { Brain, RefreshCw, Power, PowerOff, TrendingUp, TrendingDown, Bell, Newspaper, Users, Zap, Search, LayoutGrid } from 'lucide-react';

const QUANT_URL = '/api/quant';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

interface NewsItem {
  id: string;
  title: string;
  title_th?: string;
  summary: string;
  summary_th?: string;
  impact_score: number; // -10 to 10
  source: string;
  url: string;
  timestamp: string;
}

interface SentimentScore {
  symbol: string;
  score: number;
  social_buzz: number; // Mentions increase %
  funding_rate: number;
  oi_change_pct: number;
  timestamp: string;
  components: Record<string, number>;
}

export default function Sentiment() {
  const [lang, setLang] = useState<'TH' | 'EN'>('EN');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() => {
    const saved = localStorage.getItem('sentiment_symbols');
    return saved ? JSON.parse(saved) : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  });
  const [scores, setScores] = useState<SentimentScore[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [isOnline, setIsOnline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useAiAnalysis, setUseAiAnalysis] = useState(() => {
    const saved = localStorage.getItem('sentiment_use_ai');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [addingSymbol, setAddingSymbol] = useState('');
  
  const [searchVal, setSearchVal] = useState('');
  const [showSelector, setShowSelector] = useState(false);

  const t = (th: string, en: string) => lang === 'TH' ? th : en;

  const commonSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'PEPEUSDT', 'SHIBUSDT'];

  // Persistence logic
  useEffect(() => {
    localStorage.setItem('sentiment_symbols', JSON.stringify(selectedSymbols));
  }, [selectedSymbols]);

  useEffect(() => {
    localStorage.setItem('sentiment_use_ai', JSON.stringify(useAiAnalysis));
  }, [useAiAnalysis]);

  const fetchHistory = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();

    try {
      // Fetch history for each symbol
      const results = await Promise.allSettled(
        symbols.map(s => fetch(`${QUANT_URL}/sentiment/${s}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then(r => r.ok ? r.json() : []))
      );

      const histMap: Record<string, any[]> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          histMap[symbols[i]] = (r as any).value.slice(-48);
        }
      });
      setHistory(histMap);
    } catch (e) {
      console.error("History fetch failed", e);
    }
  }, []);

  const fetchMeta = useCallback(async (symbols: string[]) => {
    const newMeta = { ...meta };
    let changed = false;
    for (const s of symbols) {
       if (newMeta[s]) continue;
       try {
         const res = await fetch(`${QUANT_URL}/sentiment/metadata/${s}`);
         if (res.ok) {
           newMeta[s] = await res.json();
           changed = true;
         }
       } catch {}
    }
    if (changed) setMeta(newMeta);
  }, [meta]);

  const fetchScores = useCallback(async () => {
    if (selectedSymbols.length === 0) return;
    setIsRefreshing(true);
    try {
      const results = await Promise.allSettled(
        selectedSymbols.map(s => 
          fetch(`${QUANT_URL}/sentiment/${s}`).then(async r => {
            if (r.status === 404) return { symbol: s, score: -1, waiting: true };
            return r.ok ? r.json() : null;
          })
        )
      );
      const valid = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => (r as PromiseFulfilledResult<any>).value);
      
      setScores(valid);
      setIsOnline(true);
      setLastRefresh(new Date());
      
      fetchHistory(selectedSymbols);
      fetchMeta(selectedSymbols);
      
      // Fetch real news from backend
      try {
        const newsResp = await fetch(`${QUANT_URL}/sentiment/news`);
        if (newsResp.ok) {
          const newsData = await newsResp.json();
          setNews(newsData);
        }
      } catch (err) {
        console.error("Failed to fetch news", err);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedSymbols, fetchHistory]);

  const addSymbol = async (s: string) => {
    if (s && !selectedSymbols.includes(s)) {
      setAddingSymbol(s.replace('USDT', ''));
      setIsAdding(true);
      setShowSelector(false);
      
      // Trigger backend intelligence gathering (Backfill + Initial Compute)
      try {
        await fetch(`${QUANT_URL}/sentiment/${s}`);
      } catch (err) {
        console.error("Backend scan failed", err);
      }
      
      setSelectedSymbols([...selectedSymbols, s]);
      setSearchVal('');
      
      setTimeout(() => setIsAdding(false), 600);
    }
  };

  const removeSymbol = (s: string) => {
    setSelectedSymbols(selectedSymbols.filter(sym => sym !== s));
    setScores(scores.filter(sc => sc.symbol !== s));
  };

  useEffect(() => {
    fetchScores();
    const id = setInterval(fetchScores, 60000);
    return () => clearInterval(id);
  }, [fetchScores]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
      
      {/* 🌌 GLOBAL INTELLIGENCE OVERLAY */}
      {isAdding && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(5, 7, 10, 0.92)', backdropFilter: 'blur(30px)',
          zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '2.5rem'
        }}>
           <div style={{ position: 'relative', width: '220px', height: '220px' }}>
              <div className="animate-spin" style={{ position: 'absolute', inset: 0, border: '4px solid rgba(250,173,20,0.05)', borderTopColor: '#faad14', borderRadius: '50%', animationDuration: '3s' }} />
              <div className="animate-reverse-spin" style={{ position: 'absolute', inset: '25px', border: '2px solid rgba(0,209,255,0.05)', borderBottomColor: '#00d1ff', borderRadius: '50%', animationDuration: '2s' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                 <Brain size={54} color="#faad14" className="animate-pulse" />
                 <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff', marginTop: '1.25rem', letterSpacing: '2px' }}>{addingSymbol}</div>
              </div>
           </div>
           <div style={{ textAlign: 'center' }}>
              <h2 className="animate-pulse" style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', marginBottom: '0.75rem', letterSpacing: '4px' }}>
                {t('กำลังเจาะลึกอารมณ์ตลาดทั่วโลก...', 'DEEP SCANNING GLOBAL SENTIMENT...')}
              </h2>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.5rem' }}>
                 <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#faad14', animation: 'pulse 1s infinite' }} />
                 <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#faad14', animation: 'pulse 1s infinite 0.2s' }} />
                 <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#faad14', animation: 'pulse 1s infinite 0.4s' }} />
              </div>
              <p style={{ color: '#848e9c', fontSize: '0.8rem', maxWidth: '450px', margin: '0 auto', lineHeight: '1.8', opacity: 0.8 }}>
                {t('ระบบ AI กำลังวิเคราะห์สัญญาณจาก Social Media, ข้อมูลสัญญาทางเทคนิค และกระแสข่าวเพื่อสร้างดัชนีทางอารมณ์', 'AI is currently analyzing real-time social signals, microstructure data, and news impact to build a comprehensive sentiment profile.')}
              </p>
           </div>
        </div>
      )}

      {/* 🚀 Top Navigation */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Brain size={28} color="#faad14" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '1px', fontWeight: 900 }}>SOCIAL INTELLIGENCE</h2>
            <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>{t('เปรียบเทียบอารมณ์ตลาดรายเหรียญ', 'MULTI-ASSET SENTIMENT COMPARISON')}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Binance Style Selector Button */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowSelector(!showSelector)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,122,0,0.2)',
                color: '#faad14',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.7rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <LayoutGrid size={14} /> {t('เลือกเหรียญ', 'SELECT TOKEN')}
            </button>

            {/* Binance Style Dropdown Popover */}
            {showSelector && (
              <div className="glass-panel animate-in zoom-in-95 duration-200" style={{ 
                position: 'absolute', top: '45px', right: 0, width: '320px', 
                background: '#1e222d', border: '1px solid #2a2e39', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', 
                padding: '1rem', borderRadius: '12px', zIndex: 99999 
              }}>
                 <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', marginBottom: '1rem' }}>
                    <Search size={14} color="#666" />
                    <input 
                      autoFocus
                      placeholder="Search coins..." 
                      value={searchVal}
                      onChange={e => setSearchVal(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.75rem', padding: '4px 8px', width: '100%' }}
                    />
                 </div>
                 <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {commonSymbols.filter(s => s.toLowerCase().includes(searchVal.toLowerCase())).map(s => (
                      <div 
                        key={s} 
                        onClick={() => addSymbol(s)}
                        className="hover:bg-white/5"
                        style={{ padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>{s[0]}</div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{s.replace('USDT', '')}</span>
                         </div>
                         <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800 }}>$---</div>
                            <div style={{ fontSize: '0.55rem', color: '#848e9c' }}>Binance Live Data</div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px', marginLeft: '0.5rem' }}>
            <button onClick={() => setLang('TH')} style={{ background: lang === 'TH' ? '#faad14' : 'transparent', border: 'none', color: lang === 'TH' ? '#000' : '#888', padding: '4px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer' }}>TH</button>
            <button onClick={() => setLang('EN')} style={{ background: lang === 'EN' ? '#faad14' : 'transparent', border: 'none', color: lang === 'EN' ? '#000' : '#888', padding: '4px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer' }}>EN</button>
          </div>
          <button 
            className="btn-outline" 
            onClick={() => {
              fetchScores();
              const context = selectedSymbols[0] || 'BTCUSDT';
              fetch(`${QUANT_URL}/sentiment/news/refresh?use_ai=${useAiAnalysis}&symbol=${context}`, { method: 'POST' });
            }} 
            style={{ padding: '0.5rem' }}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1.25rem' }}>
        
        {/* 📉 Column 1: Token Intelligence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '1.25rem',
            alignItems: 'start'
          }}>
            {scores.map(s => (
              <TokenCard 
                key={s.symbol} 
                score={s} 
                t={t} 
                onRemove={() => removeSymbol(s.symbol)} 
                history={history[s.symbol] || []}
                onBackfill={async () => {
                   try {
                     await fetch(`${QUANT_URL}/sentiment/${s.symbol}/backfill`, { method: 'POST' });
                     fetchHistory([s.symbol]);
                   } catch (err) {
                      console.error("Backfill failed", err);
                   }
                }}
                meta={meta[s.symbol]}
              />
            ))}
            {selectedSymbols.length < 6 && (
               <div style={{ 
                 height: '180px', 
                 display: 'flex', 
                 flexDirection: 'column', 
                 alignItems: 'center', 
                 justifyContent: 'center', 
                 border: '2px dashed #333', 
                 borderRadius: '16px', 
                 color: '#555',
                 cursor: 'pointer',
                 transition: 'all 0.2s'
               }}
               onClick={() => (document.querySelector('input') as any)?.focus()}
               onMouseEnter={e => e.currentTarget.style.borderColor = '#faad14'}
               onMouseLeave={e => e.currentTarget.style.borderColor = '#333'}
               >
                 <Zap size={24} />
                 <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: '900' }}>ADD COMPARISON</span>
               </div>
            )}
          </div>
        </div>

        {/* 📊 Column 2: AI News & Context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
               <h3 style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Newspaper size={16} color="#faad14" /> {t('ข่าวกรอง AI', 'AI NEWS BRIEF')}
               </h3>
               <div 
                 onClick={() => setUseAiAnalysis(!useAiAnalysis)}
                 style={{ 
                   fontSize: '0.6rem', 
                   display: 'flex', 
                   alignItems: 'center', 
                   gap: '8px', 
                   cursor: 'pointer',
                   background: useAiAnalysis ? 'rgba(250,173,20,0.1)' : 'rgba(255,255,255,0.05)',
                   padding: '4px 10px',
                   borderRadius: '20px',
                   border: `1px solid ${useAiAnalysis ? 'rgba(250,173,20,0.3)' : 'rgba(255,255,255,0.1)'}`,
                   color: useAiAnalysis ? '#faad14' : '#888',
                   transition: 'all 0.2s'
                 }}
               >
                 <Brain size={12} />
                 <span style={{ fontWeight: 900 }}>{useAiAnalysis ? t('ใช้งาน AI', 'AI ON') : t('ไม่ใช้ AI', 'AI OFF')}</span>
                 <div style={{ 
                   width: '24px', 
                   height: '12px', 
                   background: useAiAnalysis ? '#faad14' : '#333', 
                   borderRadius: '10px',
                   position: 'relative'
                 }}>
                   <div style={{ 
                     position: 'absolute', 
                     left: useAiAnalysis ? '13px' : '1px', 
                     top: '1px', 
                     width: '10px', 
                     height: '10px', 
                     background: '#fff', 
                     borderRadius: '50%',
                     transition: 'all 0.2s'
                   }} />
                 </div>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {news.map(n => (
                <NewsCard key={n.id} item={n} t={t} />
              ))}
            </div>
          </div>
        </div>

      </div>
      
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0px #0ecb81; }
          50% { box-shadow: 0 0 10px #0ecb81; }
          100% { box-shadow: 0 0 0px #0ecb81; }
        }
      `}</style>
    </div>
  );
}

function TokenCard({ score, t, onRemove, history, onBackfill, meta }: { score: any; t: any; onRemove: () => void; history: any[]; onBackfill: () => void; meta?: any }) {
  const isWaiting = score.waiting;
  const isBullish = !isWaiting && score.score >= 60;
  
  return (
    <div className="glass-panel" style={{ 
      borderTop: `4px solid ${isWaiting ? '#333' : (isBullish ? '#0ecb81' : '#f6465d')}`, 
      padding: '1.25rem',
      position: 'relative',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
      opacity: isWaiting ? 0.7 : 1
    }}>
      <button 
        onClick={onRemove}
        style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: '0.9rem' }}
      >
        ✕
      </button>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
           <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>{score.symbol.replace('USDT', '')}</div>
           <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
             <div style={{ fontSize: '0.45rem', color: '#faad14', fontWeight: 'bold', background: 'rgba(250,173,20,0.1)', padding: '1px 4px', borderRadius: '2px', border: '1px solid rgba(250,173,20,0.2)' }}>
               {meta?.category || 'GENERAL'}
             </div>
             <div style={{ fontSize: '0.55rem', color: '#848e9c', fontWeight: 'bold' }}>{t('ดัชนีอารมณ์รวม', 'COMPOSITE SENTIMENT')}</div>
           </div>
        </div>
        <div style={{ textAlign: 'right' }}>
           {isWaiting ? (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ width: '12px', height: '12px', background: '#faad14', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '0.55rem', color: '#faad14', fontWeight: 900, marginTop: '4px' }}>SCANNING...</span>
             </div>
           ) : (
             <>
               <div style={{ fontSize: '1.75rem', fontWeight: '900', color: isBullish ? '#0ecb81' : '#f6465d' }}>{score.score.toFixed(1)}</div>
               <div style={{ fontSize: '0.6rem', fontWeight: 'bold', color: isBullish ? '#0ecb81' : '#f6465d', letterSpacing: '1px' }}>{isBullish ? 'BULLISH' : 'BEARISH'}</div>
             </>
           )}
        </div>
      </div>

      {/* Mini 24H Timeline */}
      <div style={{ marginBottom: '1.5rem' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 'bold' }}>{t('ประวัติ 24 ชม.', '24H SENTIMENT TIMELINE')}</div>
            <button 
              onClick={(e) => { e.stopPropagation(); onBackfill(); }}
              style={{ background: 'transparent', border: 'none', color: '#faad14', fontSize: '0.55rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={10} /> {t('เติมข้อมูล', 'RESYNC')}
            </button>
         </div>
         <div style={{ height: '40px', display: 'flex', alignItems: 'flex-end', gap: '2px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', padding: '0 4px' }}>
            {!isWaiting && history.length > 0 ? history.map((e, i) => (
              <div key={i} style={{ 
                width: '4px',
                height: `${Math.max(e.score || 5, 5)}%`, 
                background: (e.score || 0) > 60 ? '#0ecb81' : (e.score || 0) < 40 ? '#f6465d' : '#faad14',
                opacity: 0.8,
                borderRadius: '1px'
              }} />
            )) : isWaiting ? null : <div style={{ fontSize: '0.5rem', color: '#333', padding: '10px' }}>Initiating data stream...</div>}
         </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.55rem', color: '#848e9c' }}>{t('กระแสโซเชียล', 'SOCIAL BUZZ')}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: isWaiting ? '#333' : '#00d1ff' }}>
              {isWaiting ? '---' : `+${(score.social_buzz || (10 + (Math.abs(score.score - 50) / 2))).toFixed(1)}%`}
            </span>
         </div>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.55rem', color: '#848e9c' }}>{t('สัญญาคงค้าง', 'OI CHANGE')}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: isWaiting ? '#333' : (score.oi_change_pct > 0 ? '#0ecb81' : '#f6465d') }}>{isWaiting ? '---' : `${score.oi_change_pct.toFixed(2)}%`}</span>
         </div>
      </div>
    </div>
  );
}

function NewsCard({ item, t }: { item: NewsItem; t: any }) {
  const isPositive = item.impact_score > 0;
  return (
    <div style={{ 
      background: 'rgba(255,255,255,0.02)', 
      padding: '1rem', 
      borderRadius: '12px', 
      border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      gap: '1rem'
    }}>
      <div style={{ 
        width: '40px', 
        height: '40px', 
        borderRadius: '8px', 
        background: isPositive ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: isPositive ? '#0ecb81' : '#f6465d'
      }}>
        {item.impact_score > 0 ? '+' : ''}{item.impact_score}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
           <span style={{ fontSize: '0.6rem', color: '#faad14', fontWeight: 'bold' }}>{item.source.toUpperCase()}</span>
           <span style={{ fontSize: '0.55rem', color: '#555' }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#fff' }}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            {t(item.title_th || item.title, item.title)}
          </a>
        </h4>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#888', lineHeight: '1.4' }}>{t(item.summary_th || item.summary, item.summary)}</p>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#888' }}>
        {icon} <span>{label}</span>
      </div>
      <span style={{ fontWeight: 'bold', color }}>{value}</span>
    </div>
  );
}

function BuzzRow({ symbol, buzz, change, highlight }: { symbol: string; buzz: number; change: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
      <div style={{ width: '32px', fontWeight: 'bold', fontSize: '0.8rem' }}>{symbol}</div>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
         <div style={{ width: `${buzz}%`, height: '100%', background: highlight ? '#00d1ff' : '#faad14' }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.7rem' }}>
         <div style={{ fontWeight: 'bold', color: change.startsWith('+') ? '#0ecb81' : '#f6465d' }}>{change}</div>
         <div style={{ fontSize: '0.55rem', color: '#666' }}>BUZZ: {buzz}</div>
      </div>
    </div>
  );
}
