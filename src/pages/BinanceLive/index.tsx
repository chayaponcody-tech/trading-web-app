import { useState } from 'react';
import { useTradingData } from './useTradingData';
import { StatLarge } from './components/StatWidgets';
import HistoryTab from './components/HistoryTabV2';
import MemoryTab from './components/MemoryTab';
import PositionsTab from './components/PositionsTab';
import TuningLogs from './components/TuningLogs';
import BotSidebar from './components/BotSidebar';
import BotCard from './components/BotCard';
import AnalyticsTab from './components/AnalyticsTab';
import PositionChartModal from './components/PositionChartModal';
import { API, type Bot, normalizeSymbol } from './types';


export default function BinanceLive({ isRealMode = false }: { isRealMode?: boolean }) {
  const {
    bots, fleets, accountInfo, binanceKeys,
    tradeMemory, tradeHistory, fetchingHistory,
    analyticsData,
    activeTab, setActiveTab,
    fetchStatus, fetchAccount, fetchHistory, fetchMemory, fetchAnalytics,
  } = useTradingData({ isRealMode });

  // Modal States
  const [chartData, setChartData] = useState<{ symbol: string, interval: string, price: number, entryTime: string | number, type: string, reason: string, strategy: string, gridUpper?: number, gridLower?: number, tp?: number, sl?: number } | null>(null);

  const handleViewChart = (symbol: string, interval: string, price: number, entryTime: string | number, type: string, reason: string, strategy: string, gridUpper?: number, gridLower?: number, tp?: number, sl?: number) => {
    setChartData({ symbol, interval, price, entryTime, type, reason, strategy, gridUpper, gridLower, tp, sl });
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'pnl' | 'symbol' | 'started' | 'none'>('pnl');
  const [groupBy, setGroupBy] = useState<'symbol' | 'strategy' | 'model' | 'aiType' | 'fleet' | 'none'>('fleet');
  const [viewMode, setViewMode] = useState<'grid' | 'mini' | 'compact' | 'table'>('table');
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
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev =>
      prev.includes(groupName) ? prev.filter(g => g !== groupName) : [...prev, groupName]
    );
  };
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
        body: JSON.stringify({ ...config, exchange: isRealMode ? 'binance_live' : 'binance_testnet' }),
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
    await fetch(`${API}/api/binance/close-manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, type, quantity: qty, isLive: isRealMode }) });
    await fetchAccount();
  };

  const handleAdopt = (symbol: string) => {
    // 1. Check if there is already a running bot for this symbol
    const existingBot = bots.find(b => 
      normalizeSymbol(b.config.symbol) === normalizeSymbol(symbol) && 
      b.isRunning
    );

    if (existingBot) {
      // 2. UI Alert & Stop to save AI Tokens
      alert(`⚠️ มีบอทกำลังควบคุม ${symbol} อยู่แล้ว (ID: ${existingBot.id.slice(0, 8)})\nคุณไม่จำเป็นต้อง Adopt ใหม่ครับ หากต้องการเปลี่ยนกลยุทธ์ให้หยุดบอทตัวเดิมก่อน`);
      return;
    }
    
    // Instead of direct adoption, we trigger AI analysis first as requested
    handleAIRecommend('confident', symbol, 'EMA_SCALP', '15m');
  };

  const handleAIRecommend = async (mode: 'confident' | 'grid' | 'scout', symbol: string, strategy: string, interval: string) => {
    if (!binanceKeys.hasKeys || !binanceKeys.hasOpenRouter) {
      alert('กรุณาตั้งค่า Binance API และ OpenRouter Key ก่อน');
      return;
    }
    
    const STRATEGY_LABELS: Record<string, string> = {
      'EMA_SCALP':  '⚡ EMA Scalp (3/8)',
      'STOCH_RSI':  '🎯 Stochastic RSI',
      'VWAP_SCALP': '📊 VWAP Scalp',
      'AI_SCOUTER': '🏹 Trend Scout',
      'AI_GRID_SCALP': '⚡ Grid Scalp',
      'AI_GRID_SWING': '🏛️ Grid Swing',
    };
    const stratLabel = STRATEGY_LABELS[strategy] || strategy;

    const texts: Record<string, string> = {
      confident: `🧠 AI Precision: Analyzing ${symbol} market structure...`,
      grid: strategy === 'AI_GRID_SCALP'
        ? `⚡ AI Grid (Scalp): Finding the fastest micro-ranges for ${symbol}...`
        : `🏛️ AI Grid (Swing): Mapping strong mid-term boundaries for ${symbol}...`,
      scout: `${stratLabel}: Scanning momentum for ${symbol}...`
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
    
    // Check if we are adopting an existing position (the symbol should be in activePositions but no managed bot)
    const isAdopting = activePositions.some(p => normalizeSymbol(p.symbol) === normalizeSymbol(aiRecommendation.symbol)) && 
                       !bots.some(b => normalizeSymbol(b.config.symbol) === normalizeSymbol(aiRecommendation.symbol) && b.isRunning);

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
      managedBy: 'manual',
      isAdopted: isAdopting,
      exchange: 'binance_testnet' // Ensure it's visible in Filter
    });
    
    setShowAIModal(false);
    if (isAdopting) {
       setActiveTab('dashboard');
       alert(`🛡️ กำลังสร้างบอท AI เพื่อเข้าควบคุม ${aiRecommendation.symbol} กรุณารักษาหน้าต่างนี้ไว้สักครู่ครับ`);
    }
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
  const renderBotList = (list: Bot[]) => {
    const cards = list.map(bot => (
      <BotCard
        key={bot.id} bot={bot}
        onStop={handleStop} onDelete={handleDelete} onResume={handleResume}
        onReview={handleReviewMistakes} onOptimize={handleOptimize}
        expanded={expandedBots.includes(bot.id)}
        onToggle={() => handleToggleHistory(bot.id)}
        onViewChart={handleViewChart}
        viewMode={viewMode}
        isGrid={viewMode === 'grid'}
        exchangePositions={activePositions}
      />
    ));

    if (viewMode === 'table') {
      return (
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '18px 160px 90px 90px 90px 70px 70px auto', gap: '0.5rem', padding: '0.4rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
            {['', 'Pair', 'Price', 'Net PnL', 'Realized', 'Win%', 'Funding', ''].map((h, i) => (
              <div key={i} style={{ fontSize: '0.58rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: i >= 2 && i <= 6 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {cards}
        </div>
      );
    }

    return (
      <div style={
        viewMode === 'grid' ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1rem' } :
        { display: 'flex', flexDirection: 'column', gap: viewMode === 'mini' ? '0.4rem' : '0.5rem' }
      }>
        {cards}
      </div>
    );
  };

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
      } else if (groupBy === 'fleet') {
        // Support both config.managedBy and root-level managedBy for robustness
        const managedBy = (bot.config as any).managedBy || (bot as any).managedBy;
        const fleet = fleets.find(f => f.id === managedBy);
        
        if (fleet) {
          key = `🚀 ${fleet.name}`;
        } else if (managedBy === 'manual') {
          key = '🛠️ Manual Operations';
        } else {
          key = '🛠️ Manual / Unassigned';
        }
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(bot);
    });

    // Sort keys so Manual is usually at the bottom or top consistently
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a.includes('Manual')) return 1;
      if (b.includes('Manual')) return -1;
      return a.localeCompare(b);
    });

    const sortedGroups: { [key: string]: Bot[] } = {};
    sortedKeys.forEach(k => { sortedGroups[k] = groups[k]; });
    return sortedGroups;
  };


  const groupedBots = getGroupedBots();

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Dynamic Warning Banner based on connection mode */}
      {isRealMode ? (
        <div style={{ background: 'linear-gradient(90deg, #f6465d22, #f6465d11)', border: '1px solid #f6465d55', borderRadius: '6px', padding: '0.35rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#f6465d', margin: '0 0 0.5rem 0', flexShrink: 0 }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span><strong>LIVE TRADING — เงินจริง</strong> — ทุก order ที่ส่งจะถูก execute บน Binance Futures ด้วยเงินจริง ตรวจสอบ config ให้ถูกต้องก่อนเริ่ม bot</span>
        </div>
      ) : (
        <div style={{ background: 'linear-gradient(90deg, #1890ff22, #1890ff11)', border: '1px solid #1890ff55', borderRadius: '6px', padding: '0.35rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#1890ff', margin: '0 0 0.5rem 0', flexShrink: 0 }}>
          <span style={{ fontSize: '1.1rem' }}>🧪</span>
          <span><strong>TESTNET SIMULATOR</strong> — No real funds are at risk.</span>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: sidebarMode === 'none' ? '0' : '1rem', flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* 3-Stage Toggle Button — desktop only */}
      <button 
        onClick={() => {
           if (sidebarMode === 'full') setSidebarMode('mini');
           else if (sidebarMode === 'mini') setSidebarMode('none');
           else setSidebarMode('full');
        }}
        title={sidebarMode === 'full' ? 'Mini View' : sidebarMode === 'mini' ? 'Hide All' : 'Show Full'}
        className="sidebar-toggle-btn"
        style={{
          position: 'absolute',
          left: sidebarMode === 'full' ? '218px' : sidebarMode === 'mini' ? '44px' : '5px',
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

      {/* Desktop sidebar */}
      <div className="sidebar-desktop" style={{ 
        width: sidebarMode === 'full' ? '240px' : (sidebarMode === 'mini' ? '56px' : '0'), 
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

      {/* Mobile FAB */}
      <button
        className="sidebar-fab"
        onClick={() => setShowMobilePanel(true)}
        style={{
          display: 'none', // shown via CSS media query
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1100,
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg,#faad14,#ffc53d)',
          color: '#000', border: 'none', fontSize: '1.4rem',
          boxShadow: '0 4px 20px rgba(250,173,20,0.4)', cursor: 'pointer',
        }}
      >🚀</button>

      {/* Mobile bottom sheet */}
      {showMobilePanel && (
        <div className="sidebar-sheet-overlay" onClick={() => setShowMobilePanel(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              maxHeight: '90vh', borderRadius: '16px 16px 0 0',
              background: '#0d0d1a', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
            {/* drag handle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '0.8rem', color: '#faad14', fontWeight: 'bold' }}>🎯 MANUAL ENTRY</span>
              <button onClick={() => setShowMobilePanel(false)}
                style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <BotSidebar
                binanceKeys={binanceKeys}
                onStart={async (cfg) => { await handleStart(cfg); setShowMobilePanel(false); }}
                onAIRecommend={async (...args) => { await handleAIRecommend(...args); setShowMobilePanel(false); }}
                loading={loading}
                positionSizeUSDT={positionSizeUSDT}
                setPositionSizeUSDT={setPositionSizeUSDT}
                isMobile
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        overflowY: 'auto', 
        paddingLeft: sidebarMode === 'none' ? '2rem' : '0', 
        transition: 'padding 0.3s ease' 
      }}>

        <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #faad14' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Futures Net Equity</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${parseFloat(accountInfo?.totalMarginBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ display: 'flex', gap: '2.5rem' }}>
            <StatLarge label="Total Unrealized" value={`$${parseFloat(accountInfo?.totalUnrealizedProfit || 0).toFixed(2)}`} color={parseFloat(accountInfo?.totalUnrealizedProfit || 0) >= 0 ? '#0ecb81' : '#f6465d'} />
            <StatLarge label="Used Margin" value={`$${(parseFloat(accountInfo?.totalMarginBalance || 0) - parseFloat(accountInfo?.totalAvailableBalance || 0)).toFixed(2)}`} />
            <StatLarge label="Status" value={binanceKeys.hasKeys ? 'LIVE' : 'OFFLINE'} color={binanceKeys.hasKeys ? '#0ecb81' : '#f6465d'} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', padding: '0 0.5rem' }}>
          {(['dashboard', 'analytics', 'positions', 'history', 'tuning', 'memory'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.65rem 1rem', background: 'transparent', border: 'none',
                color: activeTab === tab ? '#faad14' : 'var(--text-muted)',
                fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem',
                borderBottom: activeTab === tab ? '3px solid #faad14' : '3px solid transparent',
              }}
            >
              {tab === 'dashboard' ? 'CONTROL (BOTS)' :
               tab === 'positions' ? `ACTIVE 💸 (${activePositions.length})` :
               tab === 'analytics' ? 'ANALYTICS 📊' :
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
                  <option value="fleet">Group: Fleet</option>
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
                  <button onClick={() => setViewMode('compact')} style={{ padding: '0.3rem 0.6rem', border: 'none', background: viewMode === 'compact' ? '#faad1422' : 'transparent', color: viewMode === 'compact' ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Compact</button>
                  <button onClick={() => setViewMode('table')} style={{ padding: '0.3rem 0.6rem', border: 'none', background: viewMode === 'table' ? '#faad1422' : 'transparent', color: viewMode === 'table' ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Table</button>
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
                Object.entries(groupedBots).map(([groupName, list]) => {
                  const groupPnl = list.reduce((s, b) => s + (b.netPnl || 0), 0);
                  const runningCount = list.filter(b => b.isRunning).length;
                  const fleetObj = groupBy === 'fleet'
                    ? fleets.find(f => groupName === `🚀 ${f.name}`)
                    : null;
                  const isAutoFleet = fleetObj?.config?.isAutonomous;

                  return (
                    <div key={groupName} style={{ marginBottom: '2.5rem' }}>
                      <div 
                        onClick={() => toggleGroup(groupName)}
                        style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: collapsedGroups.includes(groupName) ? '0' : '1rem', borderBottom: '1px solid rgba(250,173,20,0.2)', paddingBottom: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ color: '#faad14', fontSize: '0.8rem', width: '16px' }}>
                          {collapsedGroups.includes(groupName) ? '▶' : '▼'}
                        </span>
                        <h3 style={{ margin: 0, color: '#faad14', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{groupName}</h3>
                        <span style={{ fontSize: '0.7rem', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.6rem', borderRadius: '10px' }}>{list.length} bots</span>
                        {groupBy === 'fleet' && (
                          <>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: groupPnl >= 0 ? '#0ecb81' : '#f6465d' }}>
                              {groupPnl >= 0 ? '+' : ''}{groupPnl.toFixed(2)} USDT
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#555' }}>{runningCount} running</span>
                            {isAutoFleet && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '10px', background: 'rgba(14,203,129,0.15)', color: '#0ecb81', border: '1px solid rgba(14,203,129,0.25)' }}>
                                ● AUTO-PILOT
                              </span>
                            )}
                            {fleetObj && (
                              <span style={{ fontSize: '0.65rem', color: '#555' }}>
                                {fleetObj.config?.riskMode} · ${fleetObj.config?.totalBudget?.toLocaleString()} budget
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {!collapsedGroups.includes(groupName) && renderBotList(list)}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === 'positions' && (
          <PositionsTab 
            activePositions={activePositions} 
            bots={bots} 
            fleets={fleets} 
            onManualClose={handleManualClose} 
            onAdopt={handleAdopt}
            onRefresh={async () => { await fetchAccount(); await fetchStatus(); }} 
            onViewChart={handleViewChart}
          />
        )}
        {activeTab === 'analytics' && <AnalyticsTab analyticsData={analyticsData} />}
        {activeTab === 'history' && <HistoryTab tradeHistory={tradeHistory} fetchingHistory={fetchingHistory} fetchHistory={fetchHistory} />}
        {activeTab === 'tuning' && <TuningLogs />}
        {activeTab === 'memory' && <MemoryTab tradeMemory={tradeMemory} />}

        {chartData && (
          <PositionChartModal 
            symbol={chartData.symbol}
            interval={chartData.interval}
            entryPrice={chartData.price}
            entryTime={chartData.entryTime}
            type={chartData.type}
            reason={chartData.reason}
            strategy={chartData.strategy}
            gridUpper={chartData.gridUpper}
            gridLower={chartData.gridLower}
            tp={chartData.tp}
            sl={chartData.sl}
            onClose={() => setChartData(null)} 
          />
        )}
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
    </div>
  );
}

const ModalStat = ({ label, value, color }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '0.1rem' }}>{label}</div>
    <div style={{ fontWeight: 'bold', color: color || '#fff', fontSize: '1rem' }}>{value}</div>
  </div>
);
