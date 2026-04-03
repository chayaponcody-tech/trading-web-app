import { useState } from 'react';
import { useTradingData } from './useTradingData';
import { StatLarge } from './components/StatWidgets';
import HistoryTab from './components/HistoryTab';
import MemoryTab from './components/MemoryTab';
import PositionsTab from './components/PositionsTab';
import TuningLogs from './components/TuningLogs';
import BotSidebar from './components/BotSidebar';
import BotCard from './components/BotCard';
import { API, type Bot } from './types';

export default function BinanceLive() {
  const {
    bots, accountInfo, binanceKeys,
    tradeMemory, tradeHistory, fetchingHistory,
    activeTab, setActiveTab,
    fetchStatus, fetchAccount, fetchHistory,
  } = useTradingData();

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'pnl' | 'symbol' | 'started' | 'none'>('pnl');
  const [groupBy, setGroupBy] = useState<'symbol' | 'strategy' | 'model' | 'aiType' | 'none'>('aiType');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'mini'>('grid');
  const [expandedBots, setExpandedBots] = useState<string[]>([]);

  // Modal States
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Form Temp State (for modals)
  const [currentAiType, setCurrentAiType] = useState<'confident' | 'grid' | 'scout'>('confident');
  const [sidebarMode, setSidebarMode] = useState<'full' | 'mini' | 'none'>('full');
  const [showThinkingModal, setShowThinkingModal] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [positionSizeUSDT, setPositionSizeUSDT] = useState(100);


  const activePositions = (accountInfo?.positions || []).filter((p: any) => parseFloat(p.positionAmt) !== 0);

  // ─── Bot Actions ────────────────────────────────────────────────────────────
  const handleStart = async (config: any) => {
    setLoading(true);
    try {
      await fetch(`${API}/api/forward-test/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, exchange: 'binance_testnet' }),
      });
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async (botId: string) => {
    await fetch(`${API}/api/forward-test/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId }) });
    await fetchStatus();
  };

  const handleResume = async (botId: string) => {
    await fetch(`${API}/api/forward-test/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId }) });
    await fetchStatus();
  };

  const handleDelete = async (botId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบอทนี้?')) return;
    await fetch(`${API}/api/forward-test/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId }) });
    await fetchStatus();
  };

  const handleReviewMistakes = async (botId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ai/review-mistakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Failed');
      setAnalysisData(data);
      setShowAnalysisModal(true);
    } catch (e: any) {
      alert('AI Review Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualClose = async (symbol: string, type: string, qty: number) => {
    if (!window.confirm(`ปิดออเดอร์ ${symbol} ${type} จำนวน ${qty}?`)) return;
    await fetch(`${API}/api/binance/close-manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, type, quantity: qty }) });
    await fetchAccount();
  };

  const handleAIRecommend = async (mode: 'confident' | 'grid' | 'scout', symbol: string, strategy: string, interval: string) => {
    if (!binanceKeys.hasKeys || !binanceKeys.hasOpenRouter) {
      alert('กรุณาตั้งค่า Binance API และ OpenRouter Key ก่อน');
      return;
    }
    
    const texts = {
      confident: `🧠 AI Precision: Analyzing ${symbol} market structure...`,
      grid: strategy === 'AI_GRID_SCALP' 
        ? `⚡ AI Grid (Scalp): Finding the fastest micro-ranges for ${symbol}...` 
        : `🏛️ AI Grid (Swing): Mapping strong mid-term boundaries for ${symbol}...`,
      scout: `🏹 Trend Scout: Scanning 1h/15m momentum for ${symbol}...`
    };
    setThinkingText(texts[mode] || 'AI is thinking...');
    setShowThinkingModal(true);
    setCurrentAiType(mode);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/binance/ai-recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategy, interval, mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Failed');
      setAiRecommendation({ ...data, symbol });
      setShowAIModal(true);
    } catch (e: any) {
      alert('AI Error: ' + e.message);
    } finally {
      setLoading(false);
      setShowThinkingModal(false);
    }
  };

  const handleOptimize = async (botId: string) => {
    setThinkingText(`✨ Optimizer: Reviewing past performance and recalibrating parameters for bot ${botId.slice(0,6)}...`);
    setShowThinkingModal(true);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ai/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Optimization Failed');
      
      if (!data.shouldUpdate) {
        alert('AI Suggestion: ' + data.reason);
        return;
      }

      const confirm = window.confirm(`🤖 AI Suggestion:\n${data.reason}\n\nApply these changes?\nStrategy: ${data.strategy}\nTP: ${data.tp}%\nSL: ${data.sl}%\nLev: ${data.leverage}x\nInterval: ${data.interval_mins} mins`);
      if (confirm) {
        await fetch(`${API}/api/forward-test/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId,
            config: {
              strategy: data.strategy,
              tpPercent: data.tp,
              slPercent: data.sl,
              leverage: data.leverage,
              aiCheckInterval: data.interval_mins
            }
          })
        });
        await fetchStatus();
      }

    } catch (e: any) {
      alert('Optimization Error: ' + e.message);
    } finally {
      setLoading(false);
      setShowThinkingModal(false);
    }
  };

  const handleResumeAll = async () => {
    const stoppedBots = bots.filter(b => !b.isRunning);
    if (stoppedBots.length === 0) return;
    if (!window.confirm(`คุณต้องการเริ่มบอทที่หยุดอยู่ทั้งหมด ${stoppedBots.length} ตัว?`)) return;
    setLoading(true);
    try {
      await Promise.all(stoppedBots.map(b => 
        fetch(`${API}/api/forward-test/resume`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ botId: b.id }) 
        })
      ));
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHistory = (botId: string) => {
    setExpandedBots(prev => 
      prev.includes(botId) ? prev.filter(id => id !== botId) : [...prev, botId]
    );
  };

  const handleToggleAllHistory = () => {
    if (expandedBots.length > 0) {
      setExpandedBots([]); // Collapse all
    } else {
      setExpandedBots(filteredBots.map(b => b.id)); // Expand all filtered
    }
  };

  const confirmAIRecommendation = () => {
    if (!aiRecommendation) return;
    handleStart({
      symbol: aiRecommendation.symbol,
      interval: aiRecommendation.interval,
      strategy: aiRecommendation.strategy,
      tpPercent: aiRecommendation.tp,
      slPercent: aiRecommendation.sl,
      leverage: aiRecommendation.leverage,
      durationMinutes: aiRecommendation.expected_duration_min,
      aiCheckInterval: aiRecommendation.ai_check_interval || 30,
      aiModel: binanceKeys.openRouterModel,
      aiReason: aiRecommendation.reason,
      aiType: currentAiType,
      gridUpper: aiRecommendation.grid_upper,
      gridLower: aiRecommendation.grid_lower,
      positionSizeUSDT: positionSizeUSDT, // CRITICAL FIX: Use shared capital
      entry_steps: aiRecommendation.entry_steps,
    });
    setShowAIModal(false);
  };

  // ─── Filtering & Grouping Logic ───────────────────────────────────────────────
  let filteredBots = bots.filter(b => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return b.config.symbol.toLowerCase().includes(search) || b.config.strategy.toLowerCase().includes(search);
  });

  if (sortBy === 'pnl') filteredBots.sort((a, b) => (b.netPnl || 0) - (a.netPnl || 0));
  else if (sortBy === 'symbol') filteredBots.sort((a, b) => a.config.symbol.localeCompare(b.config.symbol));
  else if (sortBy === 'started') filteredBots.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // ─── Render Grouped ───────────────────────────────────────────────────────────
  const renderBotList = (list: Bot[]) => (
    <div style={
      viewMode === 'grid' ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' } : 
      { display: 'flex', flexDirection: 'column', gap: viewMode === 'mini' ? '0.4rem' : '0.75rem' }
    }>
      {list.map(bot => (
        <BotCard 
          key={bot.id} bot={bot} 
          onStop={handleStop} onDelete={handleDelete} onResume={handleResume} 
          onReview={handleReviewMistakes} onOptimize={handleOptimize} 
          expanded={expandedBots.includes(bot.id)} 
          onToggle={() => handleToggleHistory(bot.id)} 
          viewMode={viewMode}
          isGrid={viewMode === 'grid'} 
        />
      ))}
    </div>
  );

  const getGroupedBots = () => {
    if (groupBy === 'none') return null;
    const groups: { [key: string]: Bot[] } = {};
    filteredBots.forEach(bot => {
      let key = 'Other';
      if (groupBy === 'symbol') key = bot.config.symbol;
      else if (groupBy === 'strategy') key = bot.config.strategy;
      else if (groupBy === 'model') key = bot.lastAiModel || (bot.config as any).aiModel || 'Technical Engine';
      else if (groupBy === 'aiType') {
         key = (bot.config as any).aiType === 'confident' ? '✨ AI Confident' : (bot.config as any).aiType === 'scout' ? '🏹 AI Scout' : (bot.config as any).aiType === 'grid' ? '📏 AI Grid' : '🛠️ Manual/Strategy';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(bot);
    });
    return groups;
  };

  const groupedBots = getGroupedBots();

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: sidebarMode === 'none' ? '0' : '1rem', height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* 3-Stage Toggle Button */}
      <button 
        onClick={() => {
           if (sidebarMode === 'full') setSidebarMode('mini');
           else if (sidebarMode === 'mini') setSidebarMode('none');
           else setSidebarMode('full');
        }}
        title={sidebarMode === 'full' ? 'Mini View' : sidebarMode === 'mini' ? 'Hide All' : 'Show Full'}
        style={{
          position: 'absolute',
          left: sidebarMode === 'full' ? '205px' : sidebarMode === 'mini' ? '55px' : '5px',
          top: '10px',
          zIndex: 1000,
          background: '#faad14',
          color: '#000',
          border: 'none',
          borderRadius: '4px',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontWeight: 'bold',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
      >
        {sidebarMode === 'full' ? '«' : (sidebarMode === 'mini' ? '»' : '⚡')}
      </button>

      <div style={{ 
        width: sidebarMode === 'full' ? '220px' : (sidebarMode === 'mini' ? '70px' : '0'), 
        overflow: 'hidden', 
        transition: 'width 0.3s ease',
        flexShrink: 0 
      }}>
        <BotSidebar 
          binanceKeys={binanceKeys} 
          onStart={handleStart} 
          onAIRecommend={handleAIRecommend} 
          loading={loading}
          positionSizeUSDT={positionSizeUSDT}
          setPositionSizeUSDT={setPositionSizeUSDT}
          isMini={sidebarMode === 'mini'}
        />
      </div>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        overflowY: 'auto', 
        paddingLeft: sidebarMode === 'none' ? '2rem' : '0', 
        transition: 'padding 0.3s ease' 
      }}>

        <div className="glass-panel" style={{ padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #faad14' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Futures Net Equity</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${parseFloat(accountInfo?.totalMarginBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ display: 'flex', gap: '2.5rem' }}>
            <StatLarge label="Total Unrealized" value={`$${parseFloat(accountInfo?.totalUnrealizedProfit || 0).toFixed(2)}`} color={parseFloat(accountInfo?.totalUnrealizedProfit || 0) >= 0 ? '#0ecb81' : '#f6465d'} />
            <StatLarge label="Used Margin" value={`$${(parseFloat(accountInfo?.totalMarginBalance || 0) - parseFloat(accountInfo?.totalAvailableBalance || 0)).toFixed(2)}`} />
            <StatLarge label="Status" value={binanceKeys.hasKeys ? 'LIVE' : 'OFFLINE'} color={binanceKeys.hasKeys ? '#0ecb81' : '#f6465d'} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', padding: '0 0.5rem' }}>
          {(['dashboard', 'positions', 'history', 'tuning', 'memory'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '1rem 1.25rem', background: 'transparent', border: 'none',
                color: activeTab === tab ? '#faad14' : 'var(--text-muted)',
                fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
                borderBottom: activeTab === tab ? '3px solid #faad14' : '3px solid transparent',
              }}
            >
              {tab === 'dashboard' ? 'CONTROL (BOTS)' :
               tab === 'positions' ? `ACTIVE 💸 (${activePositions.length})` :
               tab === 'history' ? 'CLOSED HISTORY 📜' :
               tab === 'tuning' ? 'AI TUNING 🧠' :
               'AI MEMORY 🧬'}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Manage Live Bots</h2>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.5rem 0.2rem 1.5rem', outline: 'none', fontSize: '0.75rem', width: '150px' }} />
                  <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.75rem' }}>🔍</span>
                </div>
                <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem', outline: 'none', fontSize: '0.75rem' }}>
                  <option value="pnl">Sort: PnL</option>
                  <option value="symbol">Sort: Symbol</option>
                  <option value="started">Sort: Time</option>
                </select>
                <select value={groupBy} onChange={(e: any) => setGroupBy(e.target.value)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem', outline: 'none', fontSize: '0.75rem' }}>
                  <option value="none">Group: None</option>
                  <option value="symbol">Group: Symbol</option>
                  <option value="strategy">Group: Strategy</option>
                  <option value="model">Group: AI Model</option>
                  <option value="aiType">Group: AI Type</option>
                </select>
                <div style={{ display: 'flex', background: 'var(--panel-bg)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)', gap: '2px' }}>
                  <button 
                    onClick={handleResumeAll} 
                    style={{ 
                      padding: '0.3rem 0.6rem', border: 'none', background: '#faad14', color: '#000', 
                      borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' 
                    }}
                  >
                    🚀 START ALL
                  </button>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
                  <button onClick={handleToggleAllHistory} style={{ padding: '0.3rem 0.6rem', border: 'none', background: expandedBots.length > 0 ? '#faad1422' : 'transparent', color: expandedBots.length > 0 ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📑 History {expandedBots.length > 0 ? 'Off' : 'All'}
                  </button>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
                  <button onClick={() => setViewMode('grid')} style={{ padding: '0.3rem 0.6rem', border: 'none', background: viewMode === 'grid' ? '#faad1422' : 'transparent', color: viewMode === 'grid' ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Grid</button>
                  <button onClick={() => setViewMode('list')} style={{ padding: '0.3rem 0.6rem', border: 'none', background: viewMode === 'list' ? '#faad1422' : 'transparent', color: viewMode === 'list' ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>List</button>
                  <button onClick={() => setViewMode('mini')} style={{ padding: '0.3rem 0.6rem', border: 'none', background: viewMode === 'mini' ? '#faad1422' : 'transparent', color: viewMode === 'mini' ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Mini</button>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
              {filteredBots.length === 0 ? (
                <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No live bots matching filter.</div>
              ) : groupBy === 'none' || !groupedBots ? (
                renderBotList(filteredBots)
              ) : (
                Object.entries(groupedBots).map(([groupName, list]) => (
                  <div key={groupName} style={{ marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(250,173,20,0.2)', paddingBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, color: '#faad14', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{groupName}</h3>
                      <span style={{ fontSize: '0.7rem', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.6rem', borderRadius: '10px' }}>{list.length} bots</span>
                    </div>
                    {renderBotList(list)}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'positions' && <PositionsTab activePositions={activePositions} bots={bots} onManualClose={handleManualClose} onRefresh={fetchAccount} />}
        {activeTab === 'history' && <HistoryTab tradeHistory={tradeHistory} fetchingHistory={fetchingHistory} fetchHistory={fetchHistory} />}
        {activeTab === 'tuning' && <TuningLogs />}
        {activeTab === 'memory' && <MemoryTab tradeMemory={tradeMemory} />}
      </div>

      {/* Modals */}
      {showAnalysisModal && analysisData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '2rem' }}>
          <div className="glass-panel" style={{ width: '600px', maxWidth: '95vw', padding: '2rem', borderTop: '5px solid #faad14', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <h2 style={{ margin: 0, color: '#faad14' }}>🤖 Strategy Audit Report</h2>
               <button onClick={() => setShowAnalysisModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', color: '#ddd', lineHeight: '1.6', fontSize: '0.95rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {analysisData.analysis}
            </div>
            <button onClick={() => setShowAnalysisModal(false)} style={{ width: '100%', marginTop: '2rem', padding: '1rem', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '8px', cursor: 'pointer' }}>Close Report</button>
          </div>
        </div>
      )}


      {showAIModal && aiRecommendation && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '2rem', borderTop: '5px solid #faad14' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', color: '#faad14' }}>✨ AI Strategic Plan</h2>
            <p style={{ fontStyle: 'italic', color: '#ddd', fontSize: '0.9rem', marginBottom: '1.5rem', borderLeft: '3px solid #faad14', paddingLeft: '1rem' }}>"{aiRecommendation.reason}"</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <ModalStat label="STRATEGY" value={aiRecommendation.strategy} color="#faad14" />
              <ModalStat label="LEVERAGE" value={`${aiRecommendation.leverage}x`} color="#faad14" />
              <ModalStat label="TP/SL" value={`${aiRecommendation.tp}% / ${aiRecommendation.sl}%`} />
            </div>

            {/* AI Layering Preview */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '0.6rem', fontWeight: '900', textTransform: 'uppercase' }}>🛡️ AI Scaling Steps</div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                 {aiRecommendation.entry_steps?.map((step: any, i: number) => (
                   <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                     <span style={{ color: step.type === 'MARKET' ? '#0ecb81' : '#faad14' }}>
                       Step {i+1}: {step.type}
                     </span>
                     <span style={{ color: '#fff', fontWeight: 'bold' }}>
                       {step.weightPct}% {step.offsetPct !== 0 ? `(@ ${step.offsetPct}%)` : '(Current)'}
                     </span>
                   </div>
                 ))}
               </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowAIModal(false)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmAIRecommendation} style={{ flex: 2, padding: '0.8rem', background: '#faad14', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Launch with AI Plan</button>
            </div>
          </div>
        </div>
      )}      {/* AI Thinking Modal */}
      {showThinkingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem', textAlign: 'center', border: '1px solid rgba(250,173,20,0.3)', boxShadow: '0 0 40px rgba(250,173,20,0.1)' }}>
            <div style={{ marginBottom: '1.5rem', position: 'relative', display: 'inline-block' }}>
               <div className="thinking-spinner" style={{ width: '60px', height: '60px', border: '4px solid rgba(250,173,20,0.1)', borderTop: '4px solid #faad14', borderRadius: '50%' }}></div>
               <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.2rem' }}>🤖</span>
            </div>
            <h3 style={{ margin: '0 0 0.8rem', color: '#faad14', fontSize: '1.25rem' }}>AI is Cognizing...</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
              {thinkingText}
            </p>
            <div style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: '#666', fontStyle: 'italic' }}>
               Connecting to OpenRouter High-Performance Models...
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .thinking-spinner { animation: spin 1s linear infinite; }
        @keyframes brain-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

    </div>
  );
}

const ModalStat = ({ label, value, color }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '0.1rem' }}>{label}</div>
    <div style={{ fontWeight: 'bold', color: color || '#fff', fontSize: '1rem' }}>{value}</div>
  </div>
);
