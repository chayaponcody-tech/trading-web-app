import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SymbolSelector from '../components/SymbolSelector';

const API = 'http://localhost:4001';

const STRATEGIES = [
  { value: 'EMA', label: 'EMA Crossover (20/50)' },
  { value: 'BB', label: 'BB Mean Reversion' },
  { value: 'RSI', label: 'RSI (30/70) Cross' },
  { value: 'EMA_RSI', label: '⚡ EMA + RSI' },
  { value: 'BB_RSI', label: '⚡ BB + RSI' },
  { value: 'EMA_BB_RSI', label: '⚡ EMA + BB + RSI' },
  { value: 'GRID', label: 'Grid Bot Simulation' },
  { value: 'AI_GRID', label: '🤖 AI Grid (Range Trading)' },
  { value: 'AI_SCOUTER', label: '🏹 AI Scouting (5m Scalp)' },
];

const INTERVALS = ['5m', '15m', '1h', '4h', '1d'];

interface OpenPosition {
  id: string;
  type: string;
  entryPrice: number;
  entryTime: string;
  entryReason?: string; // Add reason field
  liqId?: number;
  initialMargin?: number;
}

interface Trade {
  entryTime: string;
  exitTime: string;
  type: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  reason: string;
}

interface Bot {
  id: string;
  isRunning: boolean;
  config: { 
    symbol: string; 
    interval: string; 
    strategy: string; 
    tpPercent: number; 
    slPercent: number; 
    capital: number; 
    maxPositions?: number;
    leverage?: number;
    positionSizeUSDT?: number;
    exchange?: string;
    aiCheckInterval?: number;
    syncAiWithInterval?: boolean;
    aiReason?: string;
    aiModel?: string;
    aiType?: 'confident' | 'grid' | 'scout';
    gridLower?: number;
    gridUpper?: number;
    durationMinutes?: number;
    groupName?: string;
    groupCapital?: number;
    groupTpPercent?: number;
    groupSlPercent?: number;
    useReflection?: boolean;
    groupId?: string;
  };
  openPositions: OpenPosition[];
  expiresAt?: string; 
  capital: number;
  equity: number;
  currentCash: number;
  netPnl: number;
  netPnlPct: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  totalTrades: number;
  lastSignal: string;
  lastChecked: string;
  lastAiCheck?: string;
  startedAt: string;
  aiReason?: string;
  lastAiModel?: string;
  currentPrice: number;
  unrealizedPnl: number;
  trades: Trade[];
  aiHistory?: {
    time: string;
    reason: string;
    model?: string;
    changes: {
      strategy: { from: string; to: string } | null;
      interval: { from: string; to: string } | null;
      tp: { from: number; to: number } | null;
      sl: { from: number; to: number } | null;
      leverage: { from: number; to: number } | null;
    };
  }[];
  useReflection?: boolean;
  reflectionStatus?: string | null;
  reflectionHistory?: {
    time: string;
    signal: string;
    approved: boolean;
    reason: string;
  }[];
}

const statusColor = (pos: string) =>
  pos === 'LONG' ? 'var(--profit-color)' : pos === 'SHORT' ? 'var(--loss-color)' : 'var(--text-muted)';

export default function BinanceTestnet() {
  const navigate = useNavigate();
  
  const SummaryStat = ({ icon, label, value, sub, color }: any) => (
    <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', alignItems: 'center', transition: 'transform 0.2s' }}>
      <div style={{ fontSize: '1.5rem', background: 'rgba(250,173,20,0.1)', minWidth: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}>{icon}</div>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color || '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        <div style={{ fontSize: '0.6rem', opacity: 0.5, whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
    </div>
  );

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [intervalTime, setIntervalTime] = useState('1h');
  const [strategy, setStrategy] = useState('EMA');
  const [tpPercent, setTpPercent] = useState(2);
  const [slPercent, setSlPercent] = useState(1);
  const [leverage, setLeverage] = useState(10);
  const [positionSizeUSDT, setPositionSizeUSDT] = useState(100);
  const [durationMinutes, setDurationMinutes] = useState(240); // 4 hours default
  const [aiCheckInterval, setAiCheckInterval] = useState(30); 
  const [syncAiWithInterval, setSyncAiWithInterval] = useState(true);
  const [useReflection, setUseReflection] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [setupMode, setSetupMode] = useState<'single' | 'fleet'>('single');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'pnl' | 'symbol' | 'started' | 'none'>('pnl');
  const [groupBy, setGroupBy] = useState<'symbol' | 'strategy' | 'model' | 'aiType' | 'none'>('none');
  const [posSortBy, setPosSortBy] = useState<'symbol' | 'pnl' | 'roe'>('symbol');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'positions' | 'history' | 'groups' | 'memory'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedGroup, setScannedGroup] = useState<any[]>([]);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scanType, setScanType] = useState<'scout'|'confident'|'grid'>('scout');
  const [bots, setBots] = useState<Bot[]>([]);
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiMode, setAiMode] = useState<'confident' | 'grid' | 'scout'>('confident');
  const [analysisType, _setAnalysisType] = useState<'system'|'ai'>('system');

  // Group Launch Configurations
  const [showGroupLaunchModal, setShowGroupLaunchModal] = useState(false);
  const [groupName, setGroupName] = useState<string>('Alpha Fleet');
  const [groupCapital, setGroupCapital] = useState<number>(500);
  const [groupTpPercent] = useState<number>(5);
  const [groupSlPercent] = useState<number>(2);
  const [groupMaxCoins, setGroupMaxCoins] = useState<number>(5);
  const [groupDuration, setGroupDuration] = useState<number>(480);
  const [groupAiInterval] = useState<number>(30);
  const [groupAiModel, setGroupAiModel] = useState<string>('deepseek/deepseek-chat');
  const [groupAiGoal, setGroupAiGoal] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [groupAiProposals, setGroupAiProposals] = useState<any>(null);

  const [analysisData, _setAnalysisData] = useState<any>(null);
  const [binanceKeys, setBinanceKeys] = useState({ 
    apiKey: '', 
    apiSecret: '', 
    openRouterKey: '', 
    openRouterModel: 'deepseek/deepseek-v3.2',
    hasKeys: false, 
    hasOpenRouter: false 
  });
  const [tradeMemory, setTradeMemory] = useState<any[]>([]);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);
  const [activeFleetGroup, setActiveFleetGroup] = useState<string>('all');
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('all');
  const [fleetGroupNames, setFleetGroupNames] = useState<Record<string, string>>({});
  const [scanStatus, setScanStatus] = useState<string>('Initializing Scanner...');
  const [showMistakeModal, setShowMistakeModal] = useState(false);
  const [currentMistakeAnalysis, setCurrentMistakeAnalysis] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchHistory = async () => {
    setFetchingHistory(true);
    try {
      const res = await fetch(`${API}/api/binance/history`);
      if (res.ok) setTradeHistory(await res.json());
    } catch {} finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);
  const [currentAiReason, setCurrentAiReason] = useState<string>('');

  const fetchMemory = async () => {
    try {
      const res = await fetch(`${API}/api/ai/memory`);
      if (res.ok) setTradeMemory(await res.json());
    } catch {}
  };
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const pollRef = useRef<number | null>(null);

  const handleReviewMistakes = async (botId: string) => {
    setIsReviewing(true);
    setCurrentMistakeAnalysis('');
    setShowMistakeModal(true);
    try {
      const res = await fetch(`${API}/api/forward-test/review-mistakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCurrentMistakeAnalysis(data.analysis || 'No analysis returned.');
    } catch (e: any) {
      setCurrentMistakeAnalysis('Failed to analyze mistakes: ' + e.message);
    } finally {
      setIsReviewing(false);
    }
  };

  const fetchBinanceConfig = async () => {
    try {
      const res = await fetch(`${API}/api/binance/config`);
      const data = await res.json();
      const updatedModel = data.openRouterModel || binanceKeys.openRouterModel;
      setBinanceKeys(prev => ({ 
          ...prev, 
          apiKey: data.apiKey, 
          hasKeys: !!data.apiKey && data.hasSecret,
          hasOpenRouter: data.hasOpenRouter,
          openRouterModel: updatedModel
      }));
      setGroupAiModel(updatedModel);
    } catch {}
  };

  const fetchAccount = async () => {
    try {
      const [accRes, riskRes] = await Promise.all([
        fetch(`${API}/api/binance/account`),
        fetch(`${API}/api/binance/position-risk`)
      ]);
      if (accRes.ok && riskRes.ok) {
        const acc = await accRes.json();
        const risk = await riskRes.json();
        // Merge risk into account info to get markPrice and unrealizedProfit more accurately
        setAccountInfo({ ...acc, positions: risk });
      } else if (accRes.ok) {
        setAccountInfo(await accRes.json());
      }
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/forward-test/status`);
      const data = await res.json();
      setBots(Array.isArray(data) ? data.filter(b => b.config.exchange === 'binance_testnet') : []);
    } catch {}
  };



  useEffect(() => {
    fetchStatus();
    fetchBinanceConfig();
    fetchAccount();
    if (activeTab === 'memory') fetchMemory();
    
    (window as any).handleReviewMistakes = handleReviewMistakes;

    pollRef.current = window.setInterval(() => {
        fetchStatus();
        fetchAccount();
        if (activeTab === 'memory') fetchMemory();
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab]);

  const handleStart = async () => {
    if (!binanceKeys.hasKeys) {
      alert('กรุณาตั้งค่า API Keys ของ Binance ในหน้า Configuration ก่อน');
      navigate('/config');
      return;
    }
    setLoading(true);
    const config = {
        symbol,
        interval: intervalTime,
        strategy,
        tpPercent,
        slPercent,
        capital: 0,
        leverage,
        positionSizeUSDT,
        exchange: 'binance_testnet',
        durationMinutes,
        aiCheckInterval,
        syncAiWithInterval,
        useReflection,
        aiReason: currentAiReason,
        aiModel: binanceKeys.openRouterModel,
        aiType: aiMode,
        gridUpper: (window as any)._gridUpper,
        gridLower: (window as any)._gridLower,
    };
    await fetch(`${API}/api/forward-test/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    await fetchStatus();
    setCurrentAiReason(''); // Clear after start
    setLoading(false);
  };

  const handleFleetPropose = async () => {
    if (!binanceKeys.hasOpenRouter) {
        alert('กรุณาตั้งค่า OpenRouter API Key ก่อนใช้งาน AI Setup Assistant');
        return;
    }
    setIsOptimizing(true);
    setGroupAiProposals(null);
    try {
        const res = await fetch(`${API}/api/binance/ai-fleet-propose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                count: groupMaxCoins, 
                capital: groupCapital, 
                durationMins: groupDuration,
                instructions: groupAiGoal,
                model: groupAiModel
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        if (data.confident && data.scout) {
            setGroupAiProposals(data);
            setShowGroupLaunchModal(true);
        } else {
            throw new Error('AI returned an invalid format: ' + JSON.stringify(data));
        }
    } catch (e: any) {
        alert('Optimization Error: ' + e.message);
    } finally {
        setIsOptimizing(false);
    }
  };

  const launchProposedFleet = async (fleetKey: 'confident' | 'scout') => {
    if (!groupAiProposals || !groupAiProposals[fleetKey]) return;
    const fleetInfo = groupAiProposals[fleetKey];
    const coins = fleetInfo.coins;
    
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการเริ่ม ${fleetInfo.name} พร้อมกัน ${coins.length} เหรียญ?`)) return;
    
    setLoading(true);
    const groupId = `group_${Date.now()}`;
    const capitalPerBot = groupCapital > 0 ? (groupCapital / coins.length) : positionSizeUSDT;
    if (fleetInfo.name) setGroupName(fleetInfo.name);

    try {
      for (const rec of coins) {
        const config = {
          symbol: rec.symbol,
          interval: rec.interval || '5m',
          strategy: rec.strategy || 'AI_SCOUTER',
          tpPercent: rec.tp || 1,
          slPercent: rec.sl || 0.5,
          capital: capitalPerBot,
          leverage: rec.leverage || 10,
          positionSizeUSDT: capitalPerBot,
          exchange: 'binance_testnet',
          durationMinutes: groupDuration,
          aiCheckInterval: 30, // Default 30 min strategic check interval
          syncAiWithInterval: syncAiWithInterval,
          useReflection: useReflection,
          aiReason: fleetInfo.description || `Launched via AI ${fleetInfo.name}`,
          aiModel: groupAiModel,
          aiType: fleetKey,
          groupId: groupId,
          groupName: fleetInfo.name || groupName,
          groupCapital: groupCapital,
          groupTpPercent: rec.tp || 1,
          groupSlPercent: rec.sl || 0.5,
          gridLower: rec.grid_lower,
          gridUpper: rec.grid_upper
        };
        
        await fetch(`${API}/api/forward-test/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
      }
      setShowGroupLaunchModal(false);
      setGroupAiProposals(null); // Clear for next time
      fetchStatus();
    } catch (e: any) {
      alert('Launch Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };


  const handleStop = async (botId: string) => {
    await fetch(`${API}/api/forward-test/stop`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    await fetchStatus();
  };

  const handleDelete = async (botId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบอทนี้?')) return;
    await fetch(`${API}/api/forward-test/delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    await fetchStatus();
  };

  const handleDeleteGroup = async (botList: Bot[]) => {
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to STOP and DELETE all ${botList.length} bots in this group? This action cannot be undone.`)) return;
    
    setLoading(true);
    try {
        for (const bot of botList) {
            // 1. Stop if running
            if (bot.isRunning) {
                await fetch(`${API}/api/forward-test/stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botId: bot.id })
                });
            }
            // 2. Delete
            await fetch(`${API}/api/forward-test/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botId: bot.id })
            });
        }
        await fetchStatus();
    } catch (err) {
        console.error('Group delete error:', err);
        alert('เกิดข้อผิดพลาดในการลบกลุ่มบางส่วน');
    } finally {
        setLoading(false);
    }
  };

  const handleResume = async (botId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/forward-test/resume`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchStatus();
    } catch (e: any) {
      alert('ไม่สามารถเริ่มบอทได้: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAIRecommend = async (mode: 'confident' | 'grid' | 'scout') => {
    if (!binanceKeys.hasKeys || !binanceKeys.hasOpenRouter) {
      alert('กรุณาตั้งค่า Binance API และ OpenRouter Key ก่อน');
      return;
    }
    setAiMode(mode);
    if (mode === 'scout') setSyncAiWithInterval(true);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/binance/ai-recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategy, interval: intervalTime, mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Failed');
      
      setAiRecommendation(data);
      setShowAIModal(true);
    } catch (e: any) {
      alert('AI Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };


  const confirmAIRecommendation = () => {
    if (!aiRecommendation) return;
    if (aiRecommendation.tp) setTpPercent(aiRecommendation.tp);
    if (aiRecommendation.sl) setSlPercent(aiRecommendation.sl);
    if (aiRecommendation.leverage) setLeverage(aiRecommendation.leverage);
    if (aiRecommendation.strategy) setStrategy(aiRecommendation.strategy);
    if (aiRecommendation.interval) setIntervalTime(aiRecommendation.interval);
    if (aiRecommendation.expected_duration_min) setDurationMinutes(aiRecommendation.expected_duration_min);
    if (aiRecommendation.ai_check_interval) setAiCheckInterval(aiRecommendation.ai_check_interval);
    // Grid Boundaries injection
    if (aiRecommendation.grid_upper) {
      (window as any)._gridUpper = aiRecommendation.grid_upper;
      (window as any)._gridLower = aiRecommendation.grid_lower;
    } else {
      (window as any)._gridUpper = null;
      (window as any)._gridLower = null;
    }
    if (aiRecommendation.reason) setCurrentAiReason(aiRecommendation.reason);
    setShowAIModal(false);
  };

  const handleManualClose = async (symbol: string, type: string, qty: number) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการปิดออเดอร์ ${symbol} ${type} จำนวน ${qty}?`)) return;
    try {
      const res = await fetch(`${API}/api/binance/close-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, type, quantity: qty })
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAccount();
    } catch (e: any) {
      alert('ไม่สามารถปิดออเดอร์ได้: ' + e.message);
    }
  };


  const usdtAsset = accountInfo?.assets?.find((a: any) => a.asset === 'USDT') || { walletBalance: 0, marginBalance: 0, availableBalance: 0 };
  const activePositions = (accountInfo?.positions || []).filter((p: any) => parseFloat(p.positionAmt) !== 0);


  const launchScannedGroup = async () => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการเริ่ม ${groupName} พร้อมกัน ${scannedGroup.length} เหรียญ?`)) return;
    
    setLoading(true);
    const groupId = `group_${Date.now()}`;
    const capitalPerBot = groupCapital > 0 ? (groupCapital / scannedGroup.length) : positionSizeUSDT;

    try {
      for (const rec of scannedGroup) {
        const config = {
          symbol: rec.symbol,
          interval: rec.interval || '5m',
          strategy: rec.strategy || 'AI_SCOUTER',
          tpPercent: rec.tp || 1,
          slPercent: rec.sl || 0.5,
          capital: capitalPerBot,
          leverage: rec.leverage || 10,
          positionSizeUSDT: capitalPerBot,
          exchange: 'binance_testnet',
          durationMinutes: groupDuration,
          aiCheckInterval: groupAiInterval,
          syncAiWithInterval: syncAiWithInterval,
          useReflection: useReflection,
          aiReason: rec.reason || `Launched as part of ${groupName}`,
          aiModel: groupAiModel,
          aiType: scanType,
          groupId: groupId,
          groupName: groupName,
          groupCapital: groupCapital,
          groupTpPercent: groupTpPercent,
          groupSlPercent: groupSlPercent
        };
        
        await fetch(`${API}/api/forward-test/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
      }
      setShowScannerModal(false);
      fetchStatus();
    } catch (e: any) {
      alert('Launch Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar - Config Section */}
      <div className="glass-panel" style={{ width: '220px', flexShrink: 0, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
        <h4 className="m-0" style={{ paddingBottom: '0.5rem', fontSize: '1rem', color: '#faad14' }}>🔶 Strategy Setup</h4>
        
        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
           <button 
             onClick={() => setSetupMode('single')}
             style={{ flex: 1, padding: '0.5rem', background: setupMode === 'single' ? '#faad14' : 'transparent', border: 'none', color: setupMode === 'single' ? '#000' : '#888', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
             🎯 Single
           </button>
           <button 
             onClick={() => setSetupMode('fleet')}
             style={{ flex: 1, padding: '0.5rem', background: setupMode === 'fleet' ? '#faad14' : 'transparent', border: 'none', color: setupMode === 'fleet' ? '#000' : '#888', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
             🚀 AI Fleet
           </button>
        </div>

        {setupMode === 'single' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 1. Asset & Connectivity */}
            <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🎯 Target Asset
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button onClick={() => navigate('/config')} style={{ width: '100%', background: 'rgba(250, 173, 20, 0.05)', border: '1px solid #faad1444', color: '#faad14', padding: '0.5rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>
                    {binanceKeys.hasKeys ? '✅ API Connected' : '➕ Link Binance Keys'}
                </button>
                <SymbolSelector value={symbol} onSelect={setSymbol} compact />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Timeframe:</span>
                  <select value={intervalTime} onChange={e => setIntervalTime(e.target.value)} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.3rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Execution Strategy */}
            <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⚙️ Strategy Core
              </div>
              <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.6rem' }}>
                {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Order Size ($):</span>
                    <input type="number" value={positionSizeUSDT} onChange={e => setPositionSizeUSDT(parseFloat(e.target.value))} style={{ width: '70px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.3rem', borderRadius: '4px', textAlign: 'right', fontSize: '0.75rem' }} />
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leverage:</span>
                    <select value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ width: '70px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#faad14', padding: '0.3rem', fontWeight: 'bold', borderRadius: '4px', textAlign: 'right', fontSize: '0.75rem' }}>
                      {[1, 2, 5, 10, 20, 50, 100].map(x => <option key={x} value={x}>{x}x</option>)}
                    </select>
                 </div>
              </div>
            </div>

            <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', justifyContent: 'center', letterSpacing: '1px', opacity: 0.8 }}>
                🛡️ Risk Guard System
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', background: 'var(--border-color)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '0.8rem' }}>
                {/* Take Profit Side */}
                <div style={{ background: 'var(--bg-dark)', padding: '0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.55rem', color: '#0ecb81', fontWeight: 'bold', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Take Profit</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <input 
                      type="number" step="0.1" value={tpPercent} onChange={e => setTpPercent(parseFloat(e.target.value))} 
                      style={{ width: '100%', background: 'transparent', border: 'none', color: '#0ecb81', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} 
                    />
                    <span style={{ fontSize: '0.7rem', color: '#0ecb81', opacity: 0.6 }}>%</span>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div style={{ background: 'var(--border-color)' }}></div>
                
                {/* Stop Loss Side */}
                <div style={{ background: 'var(--bg-dark)', padding: '0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.55rem', color: '#f6465d', fontWeight: 'bold', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Stop Loss</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <input 
                      type="number" step="0.1" value={slPercent} onChange={e => setSlPercent(parseFloat(e.target.value))} 
                      style={{ width: '100%', background: 'transparent', border: 'none', color: '#f6465d', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} 
                    />
                    <span style={{ fontSize: '0.7rem', color: '#f6465d', opacity: 0.6 }}>%</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.4rem', borderRadius: '6px' }}>
                 <span style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>R/R RATIO:</span>
                 <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: (tpPercent / (slPercent || 1)) >= 2 ? '#0ecb81' : '#faad14' }}>
                   1 : {(tpPercent / (slPercent || 0.1)).toFixed(1)}
                 </span>
              </div>
            </div>

            {/* 4. AI Co-Pilot Tools */}
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, rgba(250,173,20,0.08), rgba(14,203,129,0.08))', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🧠 AI Co-Pilot
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
                <button onClick={() => handleAIRecommend('confident')} disabled={loading} style={{ padding: '0.6rem', background: 'rgba(0,0,0,0.3)', border: '1px solid #faad1488', color: '#faad14', borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold', transition: 'all 0.2s' }}>
                  {loading && aiMode === 'confident' ? '...' : '✨ Precision'}
                </button>
                <button onClick={() => handleAIRecommend('grid')} disabled={loading} style={{ padding: '0.6rem', background: 'rgba(0,0,0,0.3)', border: '1px solid #0ecb8188', color: '#0ecb81', borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold', transition: 'all 0.2s' }}>
                  {loading && aiMode === 'grid' ? '...' : '📈 AI Grid'}
                </button>
              </div>
              <button onClick={() => handleAIRecommend('scout')} disabled={loading} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.3)', border: '1px solid #f6465d88', color: '#f6465d', borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold', marginBottom: '0.8rem' }}>
                {loading && aiMode === 'scout' ? '...' : '🏹 Quick Scout / Scalp'}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: '#888' }}>Auto Review (m):</span>
                    <input type="number" value={aiCheckInterval} onChange={e => setAiCheckInterval(parseInt(e.target.value))} style={{ width: '50px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#faad14', padding: '0.2rem', textAlign: 'center', fontSize: '0.7rem' }} />
                </div>
                <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={syncAiWithInterval} onChange={e => setSyncAiWithInterval(e.target.checked)} />
                  Sync Candle Close ⚡
                </label>
                <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={useReflection} onChange={e => setUseReflection(e.target.checked)} />
                  Multi-Agent Reflection 🧠
                </label>
              </div>
            </div>

            <button onClick={handleStart} disabled={loading} style={{ background: 'linear-gradient(to bottom, #faad14, #ffc53d)', color: '#000', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: '900', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem', boxShadow: '0 8px 25px rgba(250,173,20,0.3)', transition: 'transform 0.1s active' }}>
              {loading ? 'STARTING...' : '🚀 LAUNCH BOT'}
            </button>
          </div>
        ) : (
          /* Fleet Mode View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', animation: 'fadeIn 0.3s ease-out' }}>
             <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fleet Name:
                <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem', borderRadius: '4px' }} />
             </label>

             <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI Brain:
                <select value={groupAiModel} onChange={e => setGroupAiModel(e.target.value)} style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem', borderRadius: '4px' }}>
                   <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash</option>
                   <option value="google/gemini-pro-1.5">Gemini 1.5 Pro</option>
                   <option value="deepseek/deepseek-chat">DeepSeek V3</option>
                </select>
             </label>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Cap ($):
                   <input type="number" value={groupCapital} onChange={e => setGroupCapital(parseFloat(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#faad14', padding: '0.4rem', fontWeight: 'bold' }} />
                </label>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max Coins:
                   <input type="number" value={groupMaxCoins} onChange={e => setGroupMaxCoins(parseInt(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem' }} />
                </label>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duration (Mins):
                   <input type="number" step="30" value={groupDuration} onChange={e => setGroupDuration(parseInt(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem', borderRadius: '4px' }} />
                </label>
             </div>

             <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI Instructions:
                <textarea 
                  value={groupAiGoal} 
                  onChange={e => setGroupAiGoal(e.target.value)} 
                  placeholder="e.g. Focus on high volume coins"
                  style={{ width: '100%', height: '50px', boxSizing: 'border-box', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem', borderRadius: '4px', resize: 'none', fontSize: '0.75rem' }} />
             </label>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.7rem', color: '#faad14' }}>
                   <input type="checkbox" checked={syncAiWithInterval} onChange={e => setSyncAiWithInterval(e.target.checked)} style={{ accentColor: '#faad14' }} />
                   Sync AI with Candle Close ⚡
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.7rem', color: '#0ecb81' }}>
                   <input type="checkbox" checked={useReflection} onChange={e => setUseReflection(e.target.checked)} style={{ accentColor: '#0ecb81' }} />
                   🧠 Multi-Agent Reflection
                </label>
             </div>

             <button 
               onClick={handleFleetPropose} 
               disabled={isOptimizing} 
               style={{ background: '#faad14', color: '#000', border: 'none', padding: '0.75rem', borderRadius: '4px', fontWeight: 'bold', cursor: isOptimizing ? 'not-allowed' : 'pointer', marginTop: '0.4rem', boxShadow: '0 4px 15px rgba(250,173,20,0.3)' }}>
               {isOptimizing ? '🤖 ANALYZING MARKET...' : '🔍 AI PROPOSE FLEET'}
             </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        
        {/* Account Summary Header */}
        <div className="glass-panel" style={{ padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #faad14' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Futures Net Equity (Sync)</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${parseFloat(accountInfo?.totalMarginBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ display: 'flex', gap: '2.5rem' }}>
            <StatLarge label="Total Unrealized" value={`$${parseFloat(accountInfo?.totalUnrealizedProfit || 0).toFixed(2)}`} color={parseFloat(accountInfo?.totalUnrealizedProfit || 0) >= 0 ? '#0ecb81' : '#f6465d'} />
            <StatLarge label="Used Margin" value={`$${(parseFloat(accountInfo?.totalMarginBalance || 0) - parseFloat(accountInfo?.totalAvailableBalance || 0)).toFixed(2)}`} />
            <StatLarge label="Conn Status" value={binanceKeys.hasKeys ? 'LIVE' : 'OFFLINE'} color={binanceKeys.hasKeys ? '#0ecb81' : '#f6465d'} />
          </div>
        </div>

        {/* Tab System Selection */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '0 0.5rem' }}>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            style={{ 
              padding: '1rem 1.25rem', background: 'transparent', border: 'none', 
              color: activeTab === 'dashboard' ? '#faad14' : 'var(--text-muted)', 
              fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
              borderBottom: activeTab === 'dashboard' ? '3px solid #faad14' : '3px solid transparent' 
            }}>
            CONTROL (BOTS)
          </button>
          <button 
            onClick={() => setActiveTab('positions')} 
            style={{ 
              padding: '1rem 1.25rem', background: 'transparent', border: 'none', 
              color: activeTab === 'positions' ? '#faad14' : 'var(--text-muted)', 
              fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
              borderBottom: activeTab === 'positions' ? '3px solid #faad14' : '3px solid transparent',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
            ACTIVE 💸
            <span style={{ background: activePositions.length > 0 ? '#faad14' : 'rgba(255,255,255,0.1)', color: activePositions.length > 0 ? '#000' : '#fff', padding: '0.05rem 0.4rem', borderRadius: '8px', fontSize: '0.65rem' }}>
              {activePositions.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            style={{ 
              padding: '1rem 1.25rem', background: 'transparent', border: 'none', 
              color: activeTab === 'history' ? '#faad14' : 'var(--text-muted)', 
              fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
              borderBottom: activeTab === 'history' ? '3px solid #faad14' : '3px solid transparent'
            }}>
            CLOSED HISTORY 📜
          </button>
            <button 
            onClick={() => setActiveTab('groups')} 
            style={{ 
              padding: '1rem 1.25rem', background: 'transparent', border: 'none', 
              color: activeTab === 'groups' ? '#faad14' : 'var(--text-muted)', 
              fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
              borderBottom: activeTab === 'groups' ? '3px solid #faad14' : '3px solid transparent',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
            FLEET GROUPS <span style={{ fontSize: '0.65rem', background: '#faad1422', padding: '1px 5px', borderRadius: '4px' }}>{Array.from(new Set(bots.map(b => b.startedAt).filter(list => list))).length}</span> 🚀
          </button>
          <button 
            onClick={() => setActiveTab('memory')} 
            style={{ 
              padding: '1rem 1.25rem', background: 'transparent', border: 'none', 
              color: activeTab === 'memory' ? '#faad14' : 'var(--text-muted)', 
              fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
              borderBottom: activeTab === 'memory' ? '3px solid #faad14' : '3px solid transparent'
            }}>
            AI MEMORY 🧬
          </button>
        </div>

        {activeTab === 'groups' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', padding: '1rem', minHeight: '600px' }}>
            {(() => {
              const groups: Record<string, Bot[]> = {};
              bots.forEach(b => {
                const key = b.startedAt || 'Manual';
                if (!groups[key]) groups[key] = [];
                groups[key].push(b);
              });
              
              const groupList = Object.entries(groups).filter(([_, list]) => list.length >= 2);
              
              if (groupList.length === 0) {
                return (
                  <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', color: '#555', border: '1px dashed var(--border-color)', margin: '1rem' }}>
                     <div style={{ fontSize: '4rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 20px rgba(250,173,20,0.2))' }}>🚢</div>
                     <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: '0 0 0.5rem 0' }}>No AI Fleet Groups Active</h2>
                     <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 0 2rem 0' }}>It looks like you don't have any bot clusters running together right now. Start multiple bots using the Smart Tools to create a fleet.</p>
                     <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ padding: '0.8rem 1.5rem', background: 'rgba(250,173,20,0.1)', border: '1px solid #faad1444', borderRadius: '8px', color: '#faad14', fontSize: '0.8rem', fontWeight: 'bold' }}>
                           ⚡ TIP: Use Smart Tools in the sidebar
                        </div>
                     </div>
                  </div>
                );
              }

              return groupList.reverse().map(([time, list]) => {
                const totalPnL = list.reduce((sum, b) => sum + (b.netPnl || 0), 0);
                const aiType = list[0]?.config.aiType || 'scout';

                return (
                  <div key={time} className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #faad14', background: 'linear-gradient(to right, rgba(250,173,20,0.05), transparent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(250,173,20,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                             {aiType === 'scout' ? '🏹' : aiType === 'confident' ? '✨' : '📈'}
                          </div>
                          <div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fleet Squadron • {time}</div>
                                <button 
                                  onClick={() => {
                                    const name = window.prompt('Enter Fleet Name:', fleetGroupNames[time] || '');
                                    if (name !== null) setFleetGroupNames({...fleetGroupNames, [time]: name});
                                  }}
                                  style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid rgba(250, 173, 20, 0.2)', color: '#faad14', cursor: 'pointer', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', marginLeft: '0.5rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                  onMouseOver={(e: any) => e.target.style.background = 'rgba(250, 173, 20, 0.2)'}
                                  onMouseOut={(e: any) => e.target.style.background = 'rgba(250, 173, 20, 0.1)'}
                                >✏️ Edit Name</button>
                             </div>
                             <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                {fleetGroupNames[time] ? <span style={{ color: '#fff' }}>{fleetGroupNames[time]}</span> : aiType.toUpperCase() + ' Deployment'}
                             </h3>
                             <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '0.2rem' }}>
                                <span style={{ fontSize: '0.75rem', color: '#888' }}>({list.length} Bots)</span>
                                {list[0]?.config?.groupCapital && (
                                   <span style={{ color: '#aaa', fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.1rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      💰 CAP: <b style={{ color: '#faad14' }}>{list[0].config.groupCapital} USDT</b>
                                   </span>
                                )}
                                {list[0]?.config?.groupTpPercent !== undefined && (
                                   <span style={{ color: '#aaa', fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.1rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      🎯 TP/SL: <b style={{ color: '#0ecb81' }}>{list[0].config.groupTpPercent}%</b> / <b style={{ color: '#f6465d' }}>{list[0].config.groupSlPercent}%</b>
                                   </span>
                                )}
                             </div>
                          </div>
                       </div>
                       
                       <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                          <div style={{ textAlign: 'right' }}>
                             <div style={{ fontSize: '0.6rem', color: '#888' }}>TOTAL PNL (FLEET)</div>
                             <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: totalPnL >= 0 ? '#0ecb81' : '#f6465d' }}>
                                ${totalPnL.toFixed(2)}
                                 {list[0]?.config?.groupCapital && (
                                   <span style={{ fontSize: '0.8rem', marginLeft: '0.4rem', opacity: 0.8 }}>
                                      ({((totalPnL / list[0].config.groupCapital) * 100).toFixed(2)}%)
                                   </span>
                                 )}
                             </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column', minWidth: '150px' }}>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                 <button onClick={() => list.forEach(b => !b.isRunning && handleResume(b.id))} style={{ flex: 1, padding: '0.45rem 0.5rem', background: '#faad14', border: 'none', color: '#000', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>START ALL</button>
                                 <button onClick={() => list.forEach(b => b.isRunning && handleStop(b.id))} style={{ flex: 1, padding: '0.45rem 0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}>STOP ALL</button>
                              </div>
                              <button 
                                onClick={() => handleDeleteGroup(list)} 
                                style={{ width: '100%', padding: '0.4rem', background: 'rgba(246, 70, 93, 0.05)', border: '1px solid rgba(246, 70, 93, 0.2)', color: '#f6465d', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                onMouseOver={(e: any) => { e.currentTarget.style.background = 'rgba(246, 70, 93, 0.1)'; e.currentTarget.style.borderColor = '#f6465d'; }}
                                onMouseOut={(e: any) => { e.currentTarget.style.background = 'rgba(246, 70, 93, 0.05)'; e.currentTarget.style.borderColor = 'rgba(246, 70, 93, 0.2)'; }}
                              >🗑️ STOP & DELETE GROUP</button>
                          </div>
                       </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                       {list.map(b => (
                         <div key={b.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '0.4rem 0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '130px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.isRunning ? '#0ecb81' : '#f6465d' }}></div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{b.config.symbol}</span>
                            <span style={{ fontSize: '0.7rem', color: (b.netPnl || 0) >= 0 ? '#0ecb81' : '#f6465d', marginLeft: 'auto' }}>${(b.netPnl || 0).toFixed(1)}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', borderLeft: '4px solid #faad14', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* History Header & Filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' }}>Archives 📜</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                  <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>Filter Date:</span>
                  <input 
                    type="date" 
                    value={selectedHistoryDate !== 'all' ? selectedHistoryDate : ''} 
                    onChange={(e) => setSelectedHistoryDate(e.target.value || 'all')}
                    style={{ 
                        background: 'transparent', 
                        color: '#faad14', 
                        border: 'none', 
                        fontSize: '0.8rem', 
                        outline: 'none', 
                        cursor: 'pointer', 
                        fontWeight: 'bold',
                        colorScheme: 'dark' // ทำให้ไอคอน UI ของเบราว์เซอร์เป็นสีขาวโดยอัตโนมัติในโหมดมืด
                    }}
                  />
                  <style>{`
                    input[type="date"]::-webkit-calendar-picker-indicator {
                      filter: invert(1); /* บังคับให้ไอคอนเป็นสีขาวชัดเจน */
                      cursor: pointer;
                    }
                  `}</style>
                  {selectedHistoryDate !== 'all' && (
                    <button 
                      onClick={() => setSelectedHistoryDate('all')}
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '0.65rem', width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                      onMouseOver={(e: any) => e.target.style.background = '#f6465d'}
                      onMouseOut={(e: any) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                    >✕</button>
                  )}
                </div>
              </div>
              <button 
                onClick={fetchHistory} 
                disabled={fetchingHistory}
                style={{ background: 'linear-gradient(135deg, rgba(250, 173, 20, 0.2), rgba(250, 173, 20, 0.05))', border: '1px solid rgba(250, 173, 20, 0.3)', color: '#faad14', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {fetchingHistory ? 'Syncing...' : <>🔄 <span style={{ opacity: 0.8 }}>Sync History</span></>}
              </button>
            </div>

            {/* Daily Summary Analytics - Premium Redesign */}
            {(() => {
                const filtered = selectedHistoryDate === 'all' 
                ? tradeHistory 
                : tradeHistory.filter(t => {
                    if (!t.exitTime) return false;
                    const d = new Date(t.exitTime);
                    if (isNaN(d.getTime())) return false;
                    return d.toISOString().split('T')[0] === selectedHistoryDate;
                  });
              
              const totalPnL = filtered.reduce((sum, t) => {
                const pnlValue = t.pnl !== undefined ? parseFloat(t.pnl) : 0;
                return sum + (isNaN(pnlValue) ? 0 : pnlValue);
              }, 0);
              const wins = filtered.filter(t => parseFloat(t.pnl || 0) > 0).length;
              const losses = filtered.filter(t => parseFloat(t.pnl || 0) < 0).length;
              const winRate = filtered.length > 0 ? (wins / filtered.length * 100).toFixed(1) : 0;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.2rem' }}>
                  <SummaryStat icon="📊" label="Total Trades" value={filtered.length} sub={`${wins}W - ${losses}L`} />
                  <SummaryStat icon="💰" label="Net Profit" value={`$${totalPnL.toFixed(2)}`} color={totalPnL >= 0 ? '#0ecb81' : '#f6465d'} sub={totalPnL >= 0 ? 'Profitable Session' : 'Loss Session'} />
                  <SummaryStat icon="🎯" label="Avg Win Rate" value={`${winRate}%`} color="#faad14" sub="Accuracy Score" />
                  <SummaryStat icon="⏱️" label="Date Context" value={selectedHistoryDate === 'all' ? 'Historical' : selectedHistoryDate} sub="Analysis Range" />
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {tradeHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#555', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                   <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>📭</div>
                   <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#888' }}>No trades recorded in history.</div>
                </div>
              ) : (
                tradeHistory
                  .filter(t => {
                    if (selectedHistoryDate === 'all') return true;
                    if (!t.exitTime) return false;
                    const d = new Date(t.exitTime);
                    if (isNaN(d.getTime())) return false;
                    return d.toISOString().split('T')[0] === selectedHistoryDate;
                  })
                  .map((t, i) => {
                    const pnlVal = t.pnl !== undefined ? parseFloat(t.pnl) : 0;
                    return (
                  <div key={i} className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderLeft: `5px solid ${pnlVal >= 0 ? '#0ecb81' : '#f6465d'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                         <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t.symbol}</span>
                         <span style={{ background: t.type === 'LONG' ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)', color: t.type === 'LONG' ? '#0ecb81' : '#f6465d', padding: '1px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>{t.type}</span>
                         <span style={{ color: '#888', fontSize: '0.75rem' }}>{t.strategy}</span>
                      </div>
                      <span style={{ color: pnlVal >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold', fontSize: '1.1rem' }}>
                         {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(2)} USDT
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '6px' }}>
                      <div>Entry: <span style={{ color: '#eee' }}>${parseFloat(t.entryPrice).toFixed(4)}</span></div>
                      <div>Exit: <span style={{ color: '#eee' }}>${parseFloat(t.exitPrice).toFixed(4)}</span></div>
                      <div>Reason: <span style={{ color: '#faad14' }}>{t.reason || 'Closed'}</span></div>
                      <div style={{ textAlign: 'right' }}>Time: <span style={{ color: '#888' }}>{new Date(t.exitTime).toLocaleString('th-TH')}</span></div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    )}

        {activeTab === 'memory' && (
          <div className="glass-panel" style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', borderLeft: '4px solid #faad14' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#faad14', fontSize: '1.2rem' }}>AI Trade Memory (RAG Data) 🧠</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>ข้อมูลเหล่านี้คือ "ประสบการณ์" ที่ AI ใช้ในการวิเคราะห์และปรับปรุงกลยุทธ์ให้คุณในอนาคต</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tradeMemory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#555' }}>ยังไม่มีความทรงจำบันทึกไว้ (บอทต้องปิดออเดอร์ก่อน)</div>
              ) : (
                tradeMemory.slice().reverse().map((t, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `4px solid ${t.pnl >= 0 ? '#0ecb81' : '#f6465d'}`, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{t.symbol} <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.75rem' }}>({t.type})</span></span>
                      <span style={{ color: t.pnl >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold' }}>{t.pnl >= 0 ? '+' : ''}{parseFloat(t.pnl).toFixed(2)} USDT</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div>Strategy: <span style={{ color: '#eee' }}>{t.strategy}</span></div>
                      <div>Reason: <span style={{ color: '#eee' }}>{t.reason}</span></div>
                      <div>Closed At: <span style={{ color: '#eee' }}>{new Date(t.exitTime).toLocaleString('th-TH')}</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            {/* Quick Summary Row */}
            {activePositions.length > 0 && !searchTerm && (
              <div className="glass-panel" style={{ padding: '0.8rem 1.2rem', background: 'rgba(250, 173, 20, 0.05)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#faad14', textTransform: 'uppercase' }}>Quick View: Running Trades</span>
                  <button onClick={() => setActiveTab('positions')} style={{ background: 'transparent', border: 'none', color: '#faad14', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>See All Details →</button>
                </div>
                <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                  {activePositions.map((p: any, i: number) => {
                    const upnl = parseFloat(p.unrealizedProfit || p.unRealizedProfit || 0);
                    const amt = parseFloat(p.positionAmt || 0);
                    const side = amt > 0 ? 'LONG' : 'SHORT';
                    
                    return (
                      <div key={i} style={{ minWidth: '160px', padding: '0.5rem', background: 'var(--panel-bg)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>{p.symbol}</span>
                          <span style={{ color: upnl >= 0 ? '#0ecb81' : '#f6465d' }}>
                            {upnl >= 0 ? '+' : ''}{upnl.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{side} · {p.leverage}x</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Manage Live Bots</h2>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Fleet:
                  <select value={activeFleetGroup} onChange={(e: any) => setActiveFleetGroup(e.target.value)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.4rem', outline: 'none' }}>
                    <option value="all">All Fleets</option>
                    {(() => {
                      const groups: { [key: string]: { name: string, time: string } } = {};
                      bots.forEach(b => {
                        const key = b.config.groupId || b.startedAt;
                        if (!key) return;
                        if (!groups[key]) {
                          groups[key] = { 
                            name: b.config.groupName || b.startedAt, 
                            time: b.startedAt 
                          };
                        }
                      });
                      return Object.entries(groups).map(([key, info]) => (
                        <option key={key} value={key}>
                          {info.name} ({info.time})
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Filter (Symbol, Strategy...)" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.5rem 0.2rem 1.5rem', outline: 'none', fontSize: '0.75rem', width: '180px' }} 
                  />
                  <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.75rem' }}>🔍</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Order:
                  <select value={sortBy} onChange={(e: any) => setSortBy(e.target.value)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.4rem', outline: 'none' }}>
                    <option value="pnl">PnL (High)</option>
                    <option value="symbol">Symbol (A-Z)</option>
                    <option value="started">Time (Newest)</option>
                    <option value="none">None</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Group:
                  <select value={groupBy} onChange={(e: any) => setGroupBy(e.target.value)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.4rem', outline: 'none' }}>
                     <option value="none">None</option>
                    <option value="symbol">Symbol</option>
                    <option value="strategy">Strategy</option>
                    <option value="model">AI Model</option>
                    <option value="aiType">AI Logic Type</option>
                    <option value="launchGroup">⚡ Launch Group (Folder)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', background: 'var(--panel-bg)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
                  <button onClick={() => setViewMode('grid')} style={{ padding: '0.3rem 0.6rem', border: 'none', background: viewMode === 'grid' ? '#faad1422' : 'transparent', color: viewMode === 'grid' ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Grid</button>
                  <button onClick={() => setViewMode('list')} style={{ padding: '0.3rem 0.6rem', border: 'none', background: viewMode === 'list' ? '#faad1422' : 'transparent', color: viewMode === 'list' ? '#faad14' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>List</button>
                </div>
              </div>
            </div>

            {/* Render Bots List with Grouping Logic */}
            {(() => {
              let list = bots.filter(b => {
                if (activeFleetGroup !== 'all') {
                  const key = b.config.groupId || b.startedAt;
                  if (key !== activeFleetGroup) return false;
                }
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                const sym = b.config.symbol.toLowerCase();
                const strat = b.config.strategy.toLowerCase();
                const model = (b.lastAiModel || b.config.aiModel || '').toLowerCase();
                const type = (b.config.aiType || '').toLowerCase();
                return sym.includes(search) || strat.includes(search) || model.includes(search) || type.includes(search);
              });

              if (sortBy === 'pnl') list.sort((a, b) => (b.netPnl || 0) - (a.netPnl || 0));
              else if (sortBy === 'symbol') list.sort((a, b) => b.config.symbol.localeCompare(a.config.symbol));
              else if (sortBy === 'started') list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
              
              if (groupBy === 'none') {
                return (
                  <div style={viewMode === 'grid' 
                    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }
                    : { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
                  }>
                    {list.length === 0 && <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No live bots. Launch one to get started.</div>}
                    {list.map(bot => (
                      <BotCard 
                        key={bot.id} bot={bot} onStop={handleStop} onDelete={handleDelete} onResume={handleResume}
                        expanded={expandedBot === bot.id} onToggle={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} 
                        isGrid={viewMode === 'grid'} 
                      />
                    ))}
                  </div>
                );
              } else {
                const groups: Record<string, Bot[]> = {};
                list.forEach(bot => {
                  let key = 'Other';
                  if (groupBy === 'symbol') key = bot.config.symbol;
                  else if (groupBy === 'strategy') key = bot.config.strategy;
                  else if (groupBy === 'model') key = bot.lastAiModel || (bot.config as any).aiModel || 'Strategy Engine';
                  else if (groupBy === 'aiType') {
                    const type = bot.config.aiType;
                    if (type === 'confident') key = '✨ Precision / Confident';
                    else if (type === 'grid') key = '📈 AI Grid Trading';
                    else if (type === 'scout') key = '🏹 AI Scouting / Scalp';
                    else key = 'Manual / Standard';
                  }
                  else if (groupBy === 'launchGroup') {
                    key = `🚀 Launch @ ${bot.startedAt || 'Manual'}`;
                  }
                  
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(bot);
                });

                return Object.entries(groups).map(([groupName, groupBots]) => (
                  <div key={groupName} style={{ marginBottom: '2rem', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                         <span style={{ fontSize: '1.1rem' }}>📂</span>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                            <span style={{ fontSize: '0.9rem', color: '#faad14', fontWeight: 'bold' }}>{groupBots[0]?.config?.groupName || groupName}</span>
                            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                               <span style={{ background: 'rgba(250,173,20,0.1)', color: '#faad14', padding: '0.1rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem' }}>{groupBots.length} Bots</span>
                               {groupBots[0]?.config?.groupCapital && (
                                  <span style={{ color: '#aaa', fontSize: '0.7rem' }}>
                                     💰 CAP: <b style={{ color: '#faad14' }}>{groupBots[0].config.groupCapital} USDT</b>
                                  </span>
                               )}
                               {groupBots[0]?.config?.groupTpPercent !== undefined && (
                                  <span style={{ color: '#aaa', fontSize: '0.7rem' }}>
                                     🎯 TP/SL: <b style={{ color: '#0ecb81' }}>{groupBots[0].config.groupTpPercent}%</b> / <b style={{ color: '#f6465d' }}>{groupBots[0].config.groupSlPercent}%</b>
                                  </span>
                               )}
                            </div>
                         </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.6rem' }}>
                         <button 
                            onClick={async () => {
                               if(!window.confirm(`Start all bots in ${groupName}?`)) return;
                               for(const b of groupBots) if(!b.isRunning) await handleResume(b.id);
                            }}
                            style={{ background: '#faad14', border: 'none', color: '#000', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            ▶ START ALL
                         </button>
                         <button 
                            onClick={async () => {
                               if(!window.confirm(`Stop all bots in ${groupName}?`)) return;
                               for(const b of groupBots) if(b.isRunning) await handleStop(b.id);
                            }}
                            style={{ background: 'rgba(246, 70, 93, 0.1)', border: '1px solid rgba(246, 70, 93, 0.3)', color: '#f6465d', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            ■ STOP ALL
                         </button>
                      </div>
                    </div>
                    <div style={viewMode === 'grid' 
                      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }
                      : { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
                    }>
                      {groupBots.map(bot => (
                        <BotCard 
                          key={bot.id} bot={bot} onStop={handleStop} onDelete={handleDelete} onResume={handleResume}
                          expanded={expandedBot === bot.id} onToggle={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} 
                          isGrid={viewMode === 'grid'} 
                        />
                      ))}
                    </div>
                  </div>
                ));
              }
            })()}
          </>
        )}

        {activeTab === 'positions' && (
          <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #faad14' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#faad14', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Live Positions
                    <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'normal' }}>({activePositions.length})</span>
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                   Order symbols:
                   <select value={posSortBy} onChange={e => setPosSortBy(e.target.value as any)} style={{ background: '#1e222d', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.4rem' }}>
                      <option value="symbol">Symbol (A-Z)</option>
                      <option value="pnl">Unrealized PnL (Highest)</option>
                      <option value="roe">ROE % (Winning)</option>
                   </select>
                </div>
                <button 
                    onClick={fetchAccount} 
                    style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid #faad14', color: '#faad14', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    🔄 Sync Binance
                </button>
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.85rem' }}>
                    <th style={{ padding: '1rem' }}>Symbol / Info</th>
                    <th style={{ padding: '1rem' }}>Size</th>
                    <th style={{ padding: '1rem' }}>Entry Time</th>
                    <th style={{ padding: '1rem' }}>Strategy</th>
                    <th style={{ padding: '1rem' }}>Entry / Mark</th>
                    <th style={{ padding: '1rem' }}>Entry Reason</th>
                    <th style={{ padding: '1rem' }}>TP / SL Target ($)</th>
                    <th style={{ padding: '1rem' }}>Net PnL % (ROE / Raw)</th>
                    <th style={{ padding: '1rem' }}>Unrealized PNL</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activePositions.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-muted)' }}>No active positions.</td></tr>
                  ) : (() => {
                      const formatPrice = (val: number) => {
                        if (Math.abs(val) < 0.01) return val.toFixed(6);
                        if (Math.abs(val) < 10) return val.toFixed(4);
                        return val.toFixed(2);
                      };

                      let sorted = [...activePositions];
                      if (posSortBy === 'pnl') {
                         sorted.sort((a: any, b: any) => {
                            const pA = parseFloat(a.unrealizedProfit || a.unRealizedProfit || 0);
                            const pB = parseFloat(b.unrealizedProfit || b.unRealizedProfit || 0);
                            return pB - pA;
                         });
                      }
                      else if (posSortBy === 'roe') {
                          sorted.sort((a: any, b: any) => {
                             const pA = parseFloat(a.unrealizedProfit || a.unRealizedProfit || 0);
                             const pB = parseFloat(b.unrealizedProfit || b.unRealizedProfit || 0);
                             const marginA = (Math.abs(parseFloat(a.positionAmt)) * parseFloat(a.markPrice)) / parseFloat(a.leverage);
                             const marginB = (Math.abs(parseFloat(b.positionAmt)) * parseFloat(b.markPrice)) / parseFloat(b.leverage);
                             const roeA = (pA / (marginA || 1));
                             const roeB = (pB / (marginB || 1));
                             return roeB - roeA;
                          });
                      } else {
                          sorted.sort((a: any, b: any) => a.symbol.localeCompare(b.symbol));
                      }
                      
                      return sorted.map((p: any, i: number) => {
                        const amt = parseFloat(p.positionAmt);
                        const side = amt > 0 ? 'LONG' : 'SHORT';
                        const upnl = parseFloat(p.unrealizedProfit || p.unRealizedProfit || 0);
                        const markPrice = parseFloat(p.markPrice);
                        const leverage = parseFloat(p.leverage);
                        const marginValue = (Math.abs(amt) * markPrice) / leverage;
                        const roe = (upnl / (marginValue || 1)) * 100;
                        const rawPct = (upnl / (Math.abs(amt) * parseFloat(p.entryPrice))) * 100;
                        
                        const linkedBot = bots.find(b => b.config.symbol === p.symbol);
                        const botPos = linkedBot?.openPositions?.find((op: any) => op.type === side);
                        const entryTime = botPos?.entryTime || p.entryTime;

                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)22' }}>
                            <td style={{ padding: '1rem' }}>
                              <div style={{ fontWeight: 'bold' }}>{p.symbol}</div>
                              <div style={{ fontSize: '0.65rem' }}>
                                  <span style={{ color: side === 'LONG' ? '#0ecb81' : '#f6465d' }}>{side}</span> · {p.leverage}x
                              </div>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 'bold' }}>{Math.abs(amt)}</td>
                            <td style={{ padding: '1rem' }}>
                               {entryTime ? (
                                 <div style={{ fontSize: '0.85rem', color: '#fff' }}>
                                   {new Date(entryTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                   <div style={{ fontSize: '0.65rem', color: '#888' }}>{new Date(entryTime).toLocaleDateString('th-TH')}</div>
                                 </div>
                               ) : (
                                 <span style={{ color: '#555' }}>N/A</span>
                               )}
                            </td>
                            <td style={{ padding: '1rem' }}>
                               <div style={{ 
                                 fontSize: '0.7rem', 
                                 fontWeight: 'bold', 
                                 background: 'rgba(250, 173, 20, 0.1)', 
                                 color: '#faad14', 
                                 padding: '0.2rem 0.5rem', 
                                 borderRadius: '4px',
                                 display: 'inline-block',
                                 border: '1px solid rgba(250, 173, 20, 0.2)'
                               }}>
                                 {linkedBot?.config?.strategy || 'MANUAL / API'}
                               </div>
                               {linkedBot?.config?.aiModel && (
                                 <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.2rem' }}>
                                   🧠 {linkedBot.config.aiModel.split('/').pop()}
                                 </div>
                               )}
                            </td>
                            <td style={{ padding: '1rem' }}>
                               <div style={{ fontSize: '0.8rem' }}>E: {formatPrice(parseFloat(p.entryPrice))}</div>
                               <div style={{ fontSize: '0.8rem', color: '#faad14' }}>M: {formatPrice(parseFloat(p.markPrice || 0))}</div>
                             </td>
                             <td style={{ padding: '1rem' }}>
                                {(() => {
                                  let entryReason = 'Technical / API Entry';
                                  let lastUpdated = null;
                                  if (linkedBot) {
                                      if (botPos?.entryReason) entryReason = botPos.entryReason;
                                      else if (linkedBot.aiReason) entryReason = linkedBot.aiReason;
                                      else if (linkedBot.config.strategy) entryReason = `Strategy: ${linkedBot.config.strategy}`;
                                      
                                      if (linkedBot.lastAiCheck) lastUpdated = linkedBot.lastAiCheck;
                                  }
                                  return (
                                    <>
                                      <div style={{ fontSize: '0.75rem', color: '#faad14', maxWidth: '180px', lineHeight: '1.4' }}>{entryReason}</div>
                                      {lastUpdated && (
                                        <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '0.2rem' }}>
                                          ⏱️ AI update: {new Date(lastUpdated).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                            </td>
                            <td style={{ padding: '1rem' }}>
                               {(() => {
                                 if (!linkedBot) return <span style={{ color: '#555' }}>N/A</span>;
                                 const tpVal = parseFloat(p.entryPrice) * (1 + (side === 'LONG' ? linkedBot.config.tpPercent / 100 : -linkedBot.config.tpPercent / 100));
                                 const slVal = parseFloat(p.entryPrice) * (1 + (side === 'LONG' ? -linkedBot.config.slPercent / 100 : linkedBot.config.slPercent / 100));
                                 return (
                                   <>
                                     <div style={{ fontSize: '0.8rem', color: '#0ecb81', fontWeight: 'bold' }}>TP: {formatPrice(tpVal)}</div>
                                     <div style={{ fontSize: '0.8rem', color: '#f6465d', fontWeight: 'bold' }}>SL: {formatPrice(slVal)}</div>
                                   </>
                                 );
                               })()}
                            </td>
                            <td style={{ padding: '1rem', color: roe >= 0 ? '#0ecb81' : '#f6465d' }}>
                               <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{roe.toFixed(2)}%</span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Raw: {rawPct.toFixed(2)}%</div>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 'bold', color: upnl >= 0 ? '#0ecb81' : '#f6465d' }}>
                              {upnl.toFixed(4)} USDT
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                              <button onClick={() => handleManualClose(p.symbol, side, Math.abs(amt))} style={{ background: '#f6465d', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}




        {/* AI Analysis Modal */}
        {showAnalysis && analysisData && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '2rem' }}>
            <div className="glass-panel" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderTop: '5px solid #faad14' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h2 style={{ margin: 0, color: '#faad14' }}>🤖 Strategy Audit Report</h2>
                 <button onClick={() => setShowAnalysis(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
              </div>

              {/* Stats Summary (Only for System type) */}
              {analysisType === 'system' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}>WIN RATE</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: parseFloat(analysisData.stats.winRate) >= 50 ? '#0ecb81' : '#f6465d' }}>{analysisData.stats.winRate}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}>TOTAL TRADES</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analysisData.stats.totalTrades}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}>TOTAL PNL</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: parseFloat(analysisData.stats.totalPnl) >= 0 ? '#0ecb81' : '#f6465d' }}>{analysisData.stats.totalPnl} <span style={{ fontSize: '0.6rem' }}>USDT</span></div>
                    </div>
                  </div>
              )}

              {/* Insights List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 <h4 style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    {analysisType === 'ai' ? 'Deep Strategic Analysis' : 'System Observations & Suggestions'}
                 </h4>
                 
                 {analysisType === 'system' ? (
                    analysisData.insights.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            Everything looks optimal! Continue monitoring your current parameters.
                        </div>
                    ) : (
                        analysisData.insights.map((insight: any, i: number) => (
                            <div key={i} style={{ padding: '1.25rem', background: insight.type === 'CRITICAL' ? 'rgba(246, 70, 93, 0.1)' : 'rgba(250, 173, 20, 0.1)', borderRadius: '8px', borderLeft: `4px solid ${insight.type === 'CRITICAL' ? '#f6465d' : '#faad14'}` }}>
                            <div style={{ fontWeight: 'bold', color: insight.type === 'CRITICAL' ? '#f6465d' : '#faad14', marginBottom: '0.4rem', fontSize: '1rem' }}>
                                {insight.type === 'CRITICAL' ? '🚩' : '⚠️'} {insight.title}
                            </div>
                            <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: '#ddd', lineHeight: '1.4' }}>{insight.message}</p>
                            {insight.suggestion && (
                                <div style={{ fontSize: '0.85rem', color: '#fff', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '4px' }}>
                                    <strong>Recommendation:</strong> {insight.suggestion}
                                </div>
                            )}
                            </div>
                        ))
                    )
                 ) : (
                    <div style={{ whiteSpace: 'pre-wrap', color: '#ddd', lineHeight: '1.6', fontSize: '0.95rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {analysisData.analysis}
                    </div>
                 )}
              </div>

              <button onClick={() => setShowAnalysis(false)} style={{ width: '100%', marginTop: '2rem', padding: '1rem', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '4px', cursor: 'pointer' }}>Close Report</button>
            </div>
          </div>
        )}

        {/* Group Scanner Modal */}
        {showScannerModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '2rem' }}>
            <div className="glass-panel" style={{ width: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '4px solid #faad14' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <h2 style={{ margin: 0, color: '#faad14', fontSize: '1.5rem' }}>🎯 AI Market Scan Result</h2>
                   <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      Found {scannedGroup.length} crypto opportunities for {scanType === 'confident' ? '✨ AI แม่นยำ (Trend)' : scanType === 'grid' ? '📈 AI Grid (Ranging)' : '🏹 AI Scouting (Scalping)'}
                   </div>
                </div>
                <button onClick={() => setShowScannerModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                {isScanning ? (
                  <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="loading-spinner" style={{ border: '4px solid #faad1422', borderTop: '4px solid #faad14', borderRadius: '50%', width: '50px', height: '50px', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }}></div>
                    <h3 style={{ color: '#fff' }}>{scanStatus}</h3>
                    <p style={{ color: '#888', fontSize: '0.85rem' }}>Fetching prices and volume from Binance to identify best setups</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    {scannedGroup.map((rec, i) => (
                      <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(250,173,20,0.1)', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#faad14' }}>{rec.symbol}</div>
                          <div style={{ fontSize: '0.7rem', background: 'rgba(14,203,129,0.1)', color: '#0ecb81', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Level: Strong</div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#ddd', marginBottom: '0.8rem', lineHeight: '1.4', fontStyle: 'italic' }}>"{rec.reason}"</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                          <ModalStat label="TP" value={`${rec.tp}%`} color="#0ecb81" />
                          <ModalStat label="SL" value={`${rec.sl}%`} color="#f6465d" />
                          <ModalStat label="LEV" value={`${rec.leverage}x`} />
                          <ModalStat label="TF" value={rec.interval} color="#faad14" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isScanning && scannedGroup.length > 0 && (
                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(250,173,20,0.05)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Estimated Requirement</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>Total USDT: {groupCapital.toLocaleString()} USDT</div>
                  </div>
                  <button 
                    onClick={launchScannedGroup}
                    disabled={loading}
                    style={{ flex: 2, padding: '1rem', background: '#faad14', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(250,173,20,0.4)' }}>
                    {loading ? 'Launching Fleet...' : `🚀 LAUNCH ALL ${scannedGroup.length} BOTS NOW`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Group Launch Configuration Modal */}
        {showGroupLaunchModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '2rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: groupAiProposals ? '900px' : '500px', maxWidth: '95vw', padding: '2rem', borderTop: '5px solid #faad14', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h2 style={{ margin: 0, color: '#faad14', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>⚡ Configure AI Fleet</h2>
                 <button onClick={() => { setShowGroupLaunchModal(false); setGroupAiProposals(null); }} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
              </div>

              {groupAiProposals ? (
                // Presentation Phase (AI Plans generated)
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                   <p style={{ margin: 0, color: '#ccc', textAlign: 'center', marginBottom: '1rem' }}>AI has proposed two optimal fleet setups based on your criteria. Select one to deploy immediately.</p>
                   
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                     {/* Confident Plan */}
                     <div style={{ background: 'rgba(14,203,129,0.05)', border: '1px solid #0ecb8144', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#0ecb81', fontSize: '1.2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>{groupAiProposals.confident?.name || '🛡️ Confident Fleet'}</h3>
                        <div style={{ fontSize: '0.85rem', color: '#ddd', fontStyle: 'italic', height: '60px', overflowY: 'auto' }}>"{groupAiProposals.confident?.description}"</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                           <ModalStat label="STRATEGY" value={groupAiProposals.confident?.coins?.[0]?.strategy || 'EMA_RSI'} color="#0ecb81" />
                           <ModalStat label="MAX COINS" value={`${groupAiProposals.confident?.coins?.length || 0} pairs`} />
                           <ModalStat label="AVG LEVERAGE" value={`${groupAiProposals.confident?.coins?.[0]?.leverage || 10}x`} />
                           <ModalStat label="INTERVAL" value={groupAiProposals.confident?.coins?.[0]?.interval || '15m'} />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                           {groupAiProposals.confident?.coins?.slice(0, 6).map((c: any) => <span key={c.symbol} style={{ background: 'rgba(14,203,129,0.1)', border: '1px solid #0ecb8144', color: '#0ecb81', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem' }}>{c.symbol}</span>)}
                           {groupAiProposals.confident?.coins?.length > 6 && <span style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: '#888' }}>+{groupAiProposals.confident.coins.length - 6}</span>}
                        </div>

                        <button onClick={() => launchProposedFleet('confident')} style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(14,203,129,0.1)', border: '1px solid #0ecb81', color: '#0ecb81', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🚀 Launch Confident Fleet</button>
                     </div>

                     {/* Scout Plan */}
                     <div style={{ background: 'rgba(250,173,20,0.05)', border: '1px solid #faad1444', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#faad14', fontSize: '1.2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>{groupAiProposals.scout?.name || '🏹 Scouting Fleet'}</h3>
                        <div style={{ fontSize: '0.85rem', color: '#ddd', fontStyle: 'italic', height: '60px', overflowY: 'auto' }}>"{groupAiProposals.scout?.description}"</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                           <ModalStat label="STRATEGY" value={groupAiProposals.scout?.coins?.[0]?.strategy || 'AI_SCOUTER'} color="#faad14" />
                           <ModalStat label="MAX COINS" value={`${groupAiProposals.scout?.coins?.length || 0} pairs`} />
                           <ModalStat label="AVG LEVERAGE" value={`${groupAiProposals.scout?.coins?.[0]?.leverage || 20}x`} />
                           <ModalStat label="INTERVAL" value={groupAiProposals.scout?.coins?.[0]?.interval || '5m'} />
                        </div>

                        {groupAiProposals.scout?.coins?.some((c: any) => c.strategy === 'AI_GRID') && (
                           <div style={{ fontSize: '0.75rem', color: '#faad14', padding: '0.5rem', background: 'rgba(250,173,20,0.1)', borderRadius: '6px', border: '1px solid #faad1422', marginTop: '0.5rem' }}>
                               📏 Includes AI Price Boundaries
                           </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                           {groupAiProposals.scout?.coins?.slice(0, 6).map((c: any) => <span key={c.symbol} style={{ background: 'rgba(250,173,20,0.1)', border: '1px solid #faad1444', color: '#faad14', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem' }}>{c.symbol}</span>)}
                           {groupAiProposals.scout?.coins?.length > 6 && <span style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: '#888' }}>+{groupAiProposals.scout.coins.length - 6}</span>}
                        </div>

                        <button onClick={() => launchProposedFleet('scout')} style={{ marginTop: 'auto', padding: '1rem', background: '#faad14', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Launch Scouting Fleet</button>
                     </div>
                   </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                   <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
                   <h3>Waiting for AI Proposals...</h3>
                   <p>Configure your fleet in the sidebar and click "AI Propose Fleet" to see options here.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {showAIModal && aiRecommendation && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '2rem' }}>
            <div className="glass-panel" style={{ width: '480px', padding: '2rem', borderTop: '5px solid #faad14', position: 'relative', overflow: 'hidden' }}>
               <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'rgba(250,173,20,0.1)', borderRadius: '50%' }}></div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, color: '#faad14', fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    ✨ AI Strategic Plan
                  </h2>
                  <button onClick={() => setShowAIModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
               </div>

               <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
                 <p style={{ margin: '0 0 1.2rem 0', color: '#ddd', fontStyle: 'italic', fontSize: '0.95rem', lineHeight: '1.6', borderLeft: '3px solid #faad14', paddingLeft: '1rem' }}>
                    "{aiRecommendation.reason}"
                 </p>
                 
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '0.65rem', color: '#888' }}>STRATEGY</div>
                      <div style={{ color: '#faad14', fontWeight: 'bold' }}>{aiRecommendation.strategy}</div>
                      <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '0.4rem' }}>TRADING PAIR</div>
                      <div style={{ fontWeight: 'bold' }}>{symbol}</div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <div style={{ fontSize: '0.65rem', color: '#888' }}>TIME FRAME</div>
                       <select 
                          value={aiRecommendation.interval || intervalTime} 
                          onChange={e => setAiRecommendation({...aiRecommendation, interval: e.target.value})}
                          style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #faad14', color: '#faad14', fontWeight: 'bold', fontSize: '1rem', padding: '0', cursor: 'pointer' }}>
                          {INTERVALS.map(i => <option key={i} value={i} style={{ background: '#1e222d' }}>{i}</option>)}
                       </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.65rem', color: '#888' }}>LEVERAGE (x)</div>
                        <input 
                           type="number" 
                           value={aiRecommendation.leverage} 
                           onChange={e => setAiRecommendation({...aiRecommendation, leverage: parseInt(e.target.value)})}
                           style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #fff', color: '#fff', fontWeight: 'bold', fontSize: '1rem', width: '100%', padding: '0' }} 
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.65rem', color: '#888' }}>TAKE PROFIT (%)</div>
                        <input 
                           type="number" step="0.1"
                           value={aiRecommendation.tp} 
                           onChange={e => setAiRecommendation({...aiRecommendation, tp: parseFloat(e.target.value)})}
                           style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #0ecb81', color: '#0ecb81', fontWeight: 'bold', fontSize: '1rem', width: '100%', padding: '0' }} 
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.65rem', color: '#888' }}>STOP LOSS (%)</div>
                        <input 
                           type="number" step="0.1"
                           value={aiRecommendation.sl} 
                           onChange={e => setAiRecommendation({...aiRecommendation, sl: parseFloat(e.target.value)})}
                           style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #f6465d', color: '#f6465d', fontWeight: 'bold', fontSize: '1rem', width: '100%', padding: '0' }} 
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.65rem', color: '#888' }}>LIFE DURATION (MIN)</div>
                        <input 
                           type="number" 
                           value={aiRecommendation.expected_duration_min} 
                           onChange={e => setAiRecommendation({...aiRecommendation, expected_duration_min: parseInt(e.target.value)})}
                           style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #faad14', color: '#faad14', fontWeight: 'bold', fontSize: '1rem', width: '100%', padding: '0' }} 
                        />
                    </div>
                  </div>

                  {aiRecommendation.strategy?.includes('GRID') && (
                    <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(250,173,20,0.05)', borderRadius: '8px', border: '1px solid rgba(250,173,20,0.1)' }}>
                       <div style={{ fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', marginBottom: '0.5rem' }}>AI GRID BOUNDARIES 📏</div>
                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                             <div style={{ fontSize: '0.6rem', color: '#888' }}>LOWER ($)</div>
                             <input 
                                type="number" 
                                value={aiRecommendation.grid_lower} 
                                onChange={e => setAiRecommendation({...aiRecommendation, grid_lower: parseFloat(e.target.value)})}
                                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #888', color: '#eee', fontSize: '0.9rem', width: '100%' }} 
                             />
                          </div>
                          <div>
                             <div style={{ fontSize: '0.6rem', color: '#888' }}>UPPER ($)</div>
                             <input 
                                type="number" 
                                value={aiRecommendation.grid_upper} 
                                onChange={e => setAiRecommendation({...aiRecommendation, grid_upper: parseFloat(e.target.value)})}
                                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #888', color: '#eee', fontSize: '0.9rem', width: '100%' }} 
                             />
                          </div>
                       </div>
                    </div>
                  )}
               </div>

               <div style={{ display: 'flex', gap: '1rem' }}>
                 <button 
                    onClick={() => setShowAIModal(false)} 
                    style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Cancel
                 </button>
                 <button 
                    onClick={confirmAIRecommendation} 
                    style={{ flex: 2, padding: '1rem', background: '#faad14', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(250,173,20,0.3)' }}>
                    Confirm & Apply ⚡
                 </button>
               </div>
               
               <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.75rem', color: '#666' }}>
                 After confirming, the settings will be pre-filled in your sidebar.
               </p>
            </div>
          </div>
        )}

        {/* AI Mistake Review Modal */}
        {showMistakeModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: '2rem' }}>
            <div className="glass-panel" style={{ width: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '5px solid #f6465d' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(246, 70, 93, 0.05)' }}>
                <div>
                   <h2 style={{ margin: 0, color: '#f6465d', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      🚩 AI Mistake Reflection
                   </h2>
                   <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      วิเคราะห์ความผิดพลาดและบทเรียนจากการเทรดที่ขาดทุน
                   </div>
                </div>
                <button onClick={() => setShowMistakeModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.95rem', color: '#eee' }}>
                {isReviewing ? (
                  <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="loading-spinner" style={{ border: '4px solid #f6465d22', borderTop: '4px solid #f6465d', borderRadius: '50%', width: '50px', height: '50px', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }}></div>
                    <h3 style={{ color: '#fff' }}>🧠 AI กำลังทบทวนความผิดพลาด...</h3>
                    <p style={{ color: '#888', fontSize: '0.85rem' }}>กำลังวิเคราะห์ไม้ที่ขาดทุนเพื่อหาจุดบกพร่องของกลยุทธ์</p>
                  </div>
                ) : (
                  <div className="markdown-content">
                    {currentMistakeAnalysis || 'No analysis available.'}
                  </div>
                )}
              </div>

              <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={() => setShowMistakeModal(false)}
                  style={{ padding: '0.75rem 2rem', background: 'rgba(246, 70, 93, 0.1)', border: '1px solid #f6465d88', color: '#f6465d', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ปิดการวิเคราะห์
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BotCard({ bot, onStop, onDelete, onResume, expanded, onToggle, isGrid = false }: {
  bot: Bot; onStop: (id: string) => void; onDelete: (id: string) => void; onResume: (id: string) => void;
  expanded: boolean; onToggle: () => void; isGrid?: boolean;
}) {
  const [showReason, setShowReason] = useState(false);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const [showReflectionHistory, setShowReflectionHistory] = useState(false);
  const [editingInterval, setEditingInterval] = useState<number>(bot.config.aiCheckInterval || 0);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateInterval = async () => {
    setIsUpdating(true);
    try {
      await fetch(`${API}/api/forward-test/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: bot.id, config: { aiCheckInterval: editingInterval } }),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const netPnl = bot.netPnl || 0;
  const netPnlColor = netPnl >= 0 ? '#0ecb81' : '#f6465d';
  const winRate = bot.totalTrades > 0 ? ((bot.winCount / bot.totalTrades) * 100).toFixed(1) : '0.0';
  const signal = bot.lastSignal || 'NONE';

  const getTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Stopping...';
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
  };
  const timeRemaining = getTimeRemaining(bot.expiresAt);

  if (isGrid) {
    return (
      <div className="glass-panel" style={{ padding: '1rem', borderTop: '4px solid #faad14', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                 <span style={{ color: bot.isRunning ? '#0ecb81' : '#888', fontSize: '0.6rem' }}>●</span>
                 <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{bot.config.symbol}</div>
               </div>
               <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.1rem' }}>
                 <span style={{ background: '#faad1415', color: '#faad14', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem' }}>{bot.config.strategy} | {bot.config.interval}</span>
                 <span style={{ background: 'rgba(250,173,20,0.1)', color: '#faad14', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem' }}>{bot.config.leverage}x</span>
               </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                   <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.65rem' }}>
                      <span style={{ color: '#0ecb81' }}>TP (Raw): {bot.config.tpPercent}%</span>
                      <span style={{ color: '#f6465d' }}>SL (Raw): {bot.config.slPercent}%</span>
                      {bot.config.aiCheckInterval && (
                        <span style={{ color: '#faad14', marginLeft: '0.5rem' }}>✨ AI: {bot.config.aiCheckInterval}m</span>
                      )}
                   </div>
                   {bot.config.gridUpper && (
                     <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.65rem', color: '#faad14', fontWeight: 'bold', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem' }}>📏</span>
                        Range: ${bot.config.gridLower?.toLocaleString()} - ${bot.config.gridUpper?.toLocaleString()}
                     </div>
                   )}
                </div>
            </div>
          </div>
          {bot.currentPrice > 0 && (
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Market Price</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#faad14' }}>
                ${bot.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {bot.openPositions.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.62rem', fontWeight: 'bold' }}>
                  <span style={{ color: '#0ecb81' }}>🎯 TP { (bot.openPositions[0].type === 'LONG' ? bot.openPositions[0].entryPrice * (1 + bot.config.tpPercent / 100) : bot.openPositions[0].entryPrice * (1 - bot.config.tpPercent / 100)).toFixed(2) }</span>
                  <span style={{ color: '#f6465d' }}>🛑 SL { (bot.openPositions[0].type === 'LONG' ? bot.openPositions[0].entryPrice * (1 - bot.config.slPercent / 100) : bot.openPositions[0].entryPrice * (1 + bot.config.slPercent / 100)).toFixed(2) }</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px' }}>
          <MiniStat label="Bot Net PnL" value={`${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}`} color={netPnlColor} />
          <MiniStat label="Win Rate" value={`${winRate}%`} color={parseFloat(winRate) >= 50 ? '#0ecb81' : '#f6465d'} />
          <MiniStat label="Life Remaining" value={timeRemaining || 'Unlimited'} color="#faad14" />
          <MiniStat label="Total Trades" value={bot.totalTrades} />
        </div>

        {bot.reflectionStatus && (
           <div style={{ padding: '0.5rem', background: 'rgba(14,203,129,0.1)', border: '1px solid #0ecb81', borderRadius: '6px', fontSize: '0.7rem', color: '#0ecb81', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
             <div className="loading-spinner" style={{ border: '2px solid rgba(14,203,129,0.2)', borderTop: '2px solid #0ecb81', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }}></div>
             {bot.reflectionStatus}
           </div>
        )}

        {bot.aiReason && (
          <button 
            onClick={() => setShowReason(!showReason)} 
            style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid #faad1444', color: '#faad14', padding: '0.4rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>
            💡 ทำไมถึงใช้การตั้งค่านี้?
          </button>
        )}

        {showReason && bot.aiReason && (
          <div style={{ background: 'rgba(250, 173, 20, 0.05)', padding: '0.8rem', borderRadius: '6px', fontSize: '0.75rem', color: '#ddd', fontStyle: 'italic', borderLeft: '3px solid #faad14', lineHeight: '1.4' }}>
            <div style={{ fontSize: '0.64rem', color: '#faad14', marginBottom: '0.3rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🧠 MODEL: {bot.lastAiModel || (bot.config as any).aiModel || 'Strategy Engine'}
            </div>
            {bot.aiReason}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
          <div style={{ fontSize: '0.62rem', color: '#666' }}>Started: {bot.startedAt}</div>
          <div style={{ fontSize: '0.62rem', color: '#faad1466' }}>
            <span style={{ color: '#faad14' }}>⚡ Scan:</span> {bot.lastChecked?.split(' ')[1] || '---'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onToggle} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#888', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
            {expanded ? 'Hide History' : 'View History'}
          </button>
          
          <button 
            onClick={() => (window as any).handleReviewMistakes(bot.id)} 
            disabled={(bot.trades || []).filter(t => t.pnl < 0).length === 0}
            title={(bot.trades || []).filter(t => t.pnl < 0).length === 0 ? "No losses to review" : "AI Review Mistakes"}
            style={{ 
              background: 'rgba(246, 70, 93, 0.1)', 
              border: '1px solid rgba(246, 70, 93, 0.3)', 
              color: '#f6465d', 
              padding: '0.6rem', 
              borderRadius: '4px', 
              cursor: (bot.trades || []).filter(t => t.pnl < 0).length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: '0.75rem', 
              fontWeight: 'bold',
              opacity: (bot.trades || []).filter(t => t.pnl < 0).length === 0 ? 0.5 : 1
            }}>
            🔍 Review Mistakes
          </button>
          
          {bot.isRunning ? (
             <button onClick={() => onStop(bot.id)} style={{ border: 'none', background: '#f6465d22', color: '#f6465d', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
               Stop
             </button>
          ) : (
             <button onClick={() => onResume(bot.id)} style={{ border: 'none', background: '#faad14', color: '#000', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
               Start
             </button>
          )}

          {!bot.isRunning && (
            <button onClick={() => onDelete(bot.id)} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
          )}
        </div>

        {expanded && (
          <div style={{ marginTop: '0.2rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', background: 'rgba(250,173,20,0.05)', padding: '0.5rem', borderRadius: '6px', border: '1px solid #faad1422' }}>
              <span style={{ fontSize: '0.7rem', color: '#faad14' }}>🤖 AI Rev (min):</span>
              <input 
                type="number" 
                value={editingInterval} 
                onChange={e => setEditingInterval(parseInt(e.target.value))} 
                style={{ width: '45px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.1rem', borderRadius: '4px', fontSize: '0.7rem' }}
              />
              <button 
                  onClick={handleUpdateInterval} 
                  disabled={isUpdating || editingInterval === (bot.config.aiCheckInterval || 0)}
                  style={{ background: isUpdating ? '#444' : '#faad14', color: '#000', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>
                {isUpdating ? '...' : 'Save'}
              </button>
            </div>
            <TradeList trades={bot.trades} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '0', borderLeft: '4px solid #faad14', position: 'relative' }}>
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
          <span style={{ color: bot.isRunning ? '#0ecb81' : '#888', fontSize: '0.7rem', flexShrink: 0 }}>●</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flexShrink: 0 }}>
             <span style={{ fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>{bot.config.symbol}</span>
             <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ background: '#faad1415', color: '#faad14', padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>{bot.config.leverage}x</span>
                <span style={{ color: statusColor(signal), border: `1px solid ${statusColor(signal)}33`, padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>{signal}</span>
             </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 0.5rem' }}></div>

          {/* New Clean Price View Area */}
          {bot.currentPrice > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: '100px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#faad14' }}>
                ${bot.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {bot.openPositions.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.65rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#0ecb81' }}>🎯 TP { (bot.openPositions[0].type === 'LONG' ? bot.openPositions[0].entryPrice * (1 + bot.config.tpPercent / 100) : bot.openPositions[0].entryPrice * (1 - bot.config.tpPercent / 100)).toFixed(bot.currentPrice < 0.01 ? 6 : bot.currentPrice < 10 ? 4 : 2) }</span>
                  <span style={{ color: '#f6465d' }}>🛑 SL { (bot.openPositions[0].type === 'LONG' ? bot.openPositions[0].entryPrice * (1 - bot.config.slPercent / 100) : bot.openPositions[0].entryPrice * (1 + bot.config.slPercent / 100)).toFixed(bot.currentPrice < 0.01 ? 6 : bot.currentPrice < 10 ? 4 : 2) }</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginLeft: '1.5rem', opacity: 0.8 }}>
             <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ color: '#888', fontSize: '0.7rem' }}>{bot.config.strategy} · {bot.config.interval}</span>
             </div>
             <div style={{ fontSize: '0.65rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>TP: {bot.config.tpPercent}%</span>
                <span style={{ color: 'var(--text-muted)' }}>SL: {bot.config.slPercent}%</span>
                {bot.config.useReflection && (
                   <span style={{ color: '#0ecb81', fontWeight: 'bold' }}>🧠 Reflection ON</span>
                )}
             </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: 0, paddingLeft: '1rem' }}>
            {bot.aiReason && (
                <button 
                    onClick={() => setShowReason(!showReason)} 
                    style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid #faad1444', color: '#faad14', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', alignSelf: 'flex-start' }}>
                    💡 AI Reason
                </button>
            )}
            <div style={{ fontSize: '0.6rem', color: '#666', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span>Started: {bot.startedAt}</span>
                <span style={{ color: '#faad1488' }}><span style={{ color: '#faad14' }}>⚡ Scan:</span> {bot.lastChecked?.split(' ')[1] || '---'}</span>
            </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <MiniStat label="Net PnL" value={`${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}`} color={netPnlColor} />
          <MiniStat label="Life" value={timeRemaining || '-'} color="#faad14" />
          <MiniStat label="Unrealized" value={`${(bot.unrealizedPnl || 0).toFixed(2)}`} color={(bot.unrealizedPnl || 0) >= 0 ? '#0ecb81' : '#f6465d'} />
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onToggle} style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#888', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {expanded ? '▲ Hide' : '▼ Detail'}
            </button>

            {bot.isRunning ? (
              <button onClick={() => onStop(bot.id)} style={{ border: 'none', background: '#f6465d22', color: '#f6465d', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                ■ Stop
              </button>
            ) : (
              <button onClick={() => onResume(bot.id)} style={{ border: 'none', background: '#faad14', color: '#000', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                ▶ Start
              </button>
            )}

            <button 
              onClick={() => (window as any).handleReviewMistakes(bot.id)} 
              disabled={(bot.trades || []).filter(t => t.pnl < 0).length === 0}
              style={{ 
                background: 'rgba(246, 70, 93, 0.1)', 
                border: '1px solid rgba(246, 70, 93, 0.3)', 
                color: '#f6465d', 
                padding: '0.4rem 0.6rem', 
                borderRadius: '4px', 
                cursor: (bot.trades || []).filter(t => t.pnl < 0).length === 0 ? 'not-allowed' : 'pointer', 
                fontSize: '0.7rem', 
                fontWeight: 'bold',
                opacity: (bot.trades || []).filter(t => t.pnl < 0).length === 0 ? 0.5 : 1
              }}>
              🔍
            </button>

            {!bot.isRunning && (
              <button onClick={() => onDelete(bot.id)} style={{ padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
            )}
          </div>
        </div>
      </div>

      {showReason && bot.aiReason && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'rgba(250, 173, 20, 0.05)', fontSize: '0.85rem', color: '#ddd', fontStyle: 'italic', borderLeft: '4px solid #faad14' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <strong style={{ color: '#faad14' }}>💡 AI Configuration Logic ({bot.lastAiModel || (bot.config as any).aiModel || 'Strategy Engine'}):</strong>
            <button onClick={() => setShowReason(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
          </div>
          {bot.aiReason}
        </div>
      )}

      {expanded && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', background: 'rgba(250,173,20,0.05)', padding: '0.8rem', borderRadius: '8px', border: '1px solid #faad1422' }}>
            <div style={{ fontSize: '0.8rem', color: '#faad14', fontWeight: 'bold' }}>🤖 AI Review Plan:</div>
            {bot.config.syncAiWithInterval ? (
              <div style={{ fontSize: '0.8rem', color: '#0ecb81', fontWeight: 'bold', background: 'rgba(14,203,129,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Synced with Candle Close ({bot.config.interval}) ⚡
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input 
                  type="number" 
                  value={editingInterval} 
                  onChange={e => setEditingInterval(parseInt(e.target.value))} 
                  style={{ width: '60px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.2rem', borderRadius: '4px' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#888' }}>min</span>
              </div>
            )}
            <button 
                onClick={handleUpdateInterval} 
                disabled={isUpdating || editingInterval === (bot.config.aiCheckInterval || 0)}
                style={{ background: isUpdating ? '#444' : '#faad14', color: '#000', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>
              {isUpdating ? '...' : 'Save Interval'}
            </button>
            <div style={{ fontSize: '0.65rem', color: '#666', borderLeft: '1px solid #444', paddingLeft: '1rem' }}>
              Last AI Checked: {bot.lastAiCheck ? new Date(bot.lastAiCheck).toLocaleTimeString() : 'Never'}
            </div>
            {(bot.aiHistory?.length || 0) > 0 && (
              <button 
                onClick={() => setShowAiHistory(!showAiHistory)} 
                style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #faad1488', color: '#faad14', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>
                {showAiHistory ? 'Hide AI Log' : `View AI Log (${bot.aiHistory?.length})`}
              </button>
            )}
          </div>

          {showAiHistory && bot.aiHistory && <AiHistoryList history={bot.aiHistory} />}
          
          {(bot.reflectionHistory?.length || 0) > 0 && (
             <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h5 style={{ margin: 0, color: '#0ecb81', fontSize: '0.85rem' }}>🧠 Reflection History</h5>
                    <button onClick={() => setShowReflectionHistory(!showReflectionHistory)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#888', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>
                        {showReflectionHistory ? 'Hide' : `View (${bot.reflectionHistory?.length})`}
                    </button>
                </div>
                {showReflectionHistory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {bot.reflectionHistory?.map((item, idx) => (
                            <div key={idx} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: `3px solid ${item.approved ? '#0ecb81' : '#f6465d'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#888' }}>{item.time}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: item.approved ? '#0ecb81' : '#f6465d' }}>
                                        {item.approved ? `✅ Approved ${item.signal}` : `❌ Rejected ${item.signal}`}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#ccc', fontStyle: 'italic' }}>"{item.reason}"</div>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          )}
          
          <TradeList trades={bot.trades} />
        </div>
      )}
    </div>
  );
}

function AiHistoryList({ history }: { history: any[] }) {
    return (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#faad14', fontSize: '0.85rem' }}>📜 AI Modification Log (History)</h5>
            {[...history].reverse().map((item, idx) => (
                <div key={idx} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(250,173,20,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                           <span style={{ fontSize: '0.7rem', color: '#888' }}>{item.time}</span>
                           <span style={{ fontSize: '0.6rem', color: '#faad1488', background: 'rgba(250,173,20,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{item.model || 'Review Engine'}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#faad14', fontWeight: 'bold' }}>ADJUSTMENT APPLIED</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#ddd', fontStyle: 'italic', marginBottom: '0.6rem' }}>"{item.reason}"</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {Object.entries(item.changes || {}).map(([key, delta]: [string, any]) => {
                            if (!delta) return null;
                            return (
                                <div key={key} style={{ background: 'rgba(250,173,20,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem' }}>
                                    <span style={{ color: '#888', textTransform: 'uppercase' }}>{key}:</span> {delta.from} → <span style={{ color: '#faad14', fontWeight: 'bold' }}>{delta.to}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

function TradeList({ trades }: { trades: any[] }) {
    if (!trades || trades.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem' }}>No trade history yet.</div>;
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.5rem' }}>Exit Time</th>
              <th style={{ padding: '0.5rem' }}>Side</th>
              <th style={{ padding: '0.5rem' }}>PnL (USDT)</th>
              <th style={{ padding: '0.5rem' }}>Entry Reason</th>
              <th style={{ padding: '0.5rem' }}>Exit Reason</th>
            </tr>
          </thead>
          <tbody>
            {[...trades].reverse().slice(0, 5).map((t, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)22' }}>
                <td style={{ padding: '0.5rem', color: '#888' }}>{t.exitTime || 'Manual Close'}</td>
                <td style={{ padding: '0.5rem', color: t.type === 'LONG' ? '#0ecb81' : '#f6465d', fontWeight: 'bold' }}>{t.type}</td>
                <td style={{ padding: '0.5rem', color: (t.pnl || 0) >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 'bold' }}>
                  {(t.pnl || 0) >= 0 ? '+' : ''}${(t.pnl || 0).toFixed(2)}
                </td>
                <td style={{ padding: '0.5rem', color: '#faad14', fontSize: '0.7rem' }}>{t.entryReason || 'Technical Entry'}</td>
                <td style={{ padding: '0.5rem', color: '#888' }}>{t.reason || 'Manual'}</td>
              </tr>
            ))}
          </tbody>
        </table>
    );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function StatLarge({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.1rem' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function ModalStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: '0.5rem' }}>
      <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.2rem', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
    </div>
  );
}
