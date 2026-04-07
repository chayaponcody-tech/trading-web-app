import { useState, useEffect, useRef } from 'react';
import { API, type Bot, type BinanceKeys } from './types';

// ─── Custom Hook: Trading Data ────────────────────────────────────────────────
// Centralizes all polling and data fetching logic.

export function useTradingData() {
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
      setBots(Array.isArray(data) ? data.filter((b: Bot) => b.config.exchange === 'binance_testnet') : []);
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
      const [accRes, riskRes] = await Promise.all([
        fetch(`${API}/api/binance/account`),
        fetch(`${API}/api/binance/position-risk`),
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
      const res = await fetch(`${API}/api/binance/history`);
      if (res.ok) setTradeHistory(await res.json());
    } catch {} finally { setFetchingHistory(false); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API}/api/binance/analytics`);
      if (res.ok) setAnalyticsData(await res.json());
    } catch {}
  };

  useEffect(() => {
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
  }, [activeTab]);

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
