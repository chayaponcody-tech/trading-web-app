import { useState, useEffect, useRef } from 'react';
import { API, type Bot, type BinanceKeys } from './types';

// ─── Custom Hook: Trading Data ────────────────────────────────────────────────
// Centralizes all polling and data fetching logic.

export function useTradingData({ isRealMode = false }: { isRealMode?: boolean } = {}) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [fleets, setFleets] = useState<any[]>([]);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [tradeMemory, setTradeMemory] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [binanceKeys, setBinanceKeys] = useState<BinanceKeys>({
    apiKey: '', apiSecret: '', openRouterKey: '',
    openRouterModel: 'deepseek/deepseek-v3.2',
    hasKeys: false, hasOpenRouter: false,
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'positions' | 'history' | 'groups' | 'memory' | 'tuning'>('dashboard');
  const pollRef = useRef<number | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/forward-test/status`);
      const data = await res.json();
      if (isRealMode) {
        setBots(Array.isArray(data) ? data.filter((b: Bot) => b.config.exchange === 'binance_live') : []);
      } else {
        setBots(Array.isArray(data) ? data.filter((b: Bot) => b.config.exchange !== 'binance_live') : []);
      }
    } catch {}
  };

  const fetchFleets = async () => {
    try {
      const res = await fetch(`${API}/api/portfolio/fleets`);
      if (res.ok) setFleets(await res.json());
    } catch {}
  };

  const fetchAccount = async () => {
    try {
      const basePath = isRealMode ? '/api/binance/live' : '/api/binance';
      const [accRes, riskRes] = await Promise.all([
        fetch(`${API}${basePath}/account`),
        fetch(`${API}${basePath}/position-risk`),
      ]);
      if (accRes.ok && riskRes.ok) {
        const acc = await accRes.json();
        const risk = await riskRes.json();
        setAccountInfo({ ...acc, positions: risk });
      } else if (accRes.ok) setAccountInfo(await accRes.json());
    } catch {}
  };

  const fetchBinanceConfig = async () => {
    try {
      const res = await fetch(`${API}/api/binance/config`);
      const data = await res.json();
      const updatedModel = data.openRouterModel || binanceKeys.openRouterModel;
      setBinanceKeys((prev) => ({
        ...prev,
        apiKey: data.apiKey,
        hasKeys: !!data.apiKey && data.hasSecret,
        hasOpenRouter: data.hasOpenRouter,
        openRouterModel: updatedModel,
      }));
    } catch {}
  };

  const fetchMemory = async () => {
    try {
      const res = await fetch(`${API}/api/ai/memory`);
      if (res.ok) setTradeMemory(await res.json());
    } catch {}
  };

  const fetchHistory = async () => {
    setFetchingHistory(true);
    try {
      const endpoint = isRealMode ? '/api/binance/live/history' : '/api/binance/history';
      const res = await fetch(`${API}${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        // Standardize format (Live returns CCXT trades, system returns DB rows)
        const standardized = data.map((t: any) => ({
          timestamp: t.timestamp || t.exitTime || Date.now(),
          symbol: t.symbol,
          side: (t.side || t.type || 'N/A').toUpperCase(),
          price: t.price || t.exitPrice || 0,
          amount: t.amount || t.quantity || 0,
          realizedPnl: t.realizedPnl !== undefined ? t.realizedPnl : (t.pnl || 0)
        }));
        setTradeHistory(standardized);
      }
    } catch {} finally { setFetchingHistory(false); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API}/api/binance/analytics`);
      if (res.ok) setAnalyticsData(await res.json());
    } catch {}
  };

  useEffect(() => {
    // Clear old data when mode changes to prevent showing stale info
    setBots([]);
    setAccountInfo(null);
    setAnalyticsData(null);

    fetchStatus();
    fetchFleets();
    fetchBinanceConfig();
    fetchAccount();
    if (activeTab === 'memory') fetchMemory();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'analytics') fetchAnalytics();

    pollRef.current = window.setInterval(() => {
      fetchStatus();
      fetchFleets();
      fetchAccount();
      if (activeTab === 'memory') fetchMemory();
      if (activeTab === 'analytics') fetchAnalytics();
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab, isRealMode]);

  return {
    bots, setBots,
    fleets, setFleets,
    accountInfo,
    binanceKeys, setBinanceKeys,
    tradeMemory,
    tradeHistory,
    fetchingHistory,
    analyticsData,
    activeTab, setActiveTab,
    fetchStatus, fetchAccount, fetchHistory, fetchMemory, fetchAnalytics, fetchFleets,
  };
}
