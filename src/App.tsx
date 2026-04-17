import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Terminal, FlaskConical, Bot, ShieldCheck, MessageSquare, Layers, Brain, TrendingUp, Search, Wallet, FileCode, Zap, LayoutList, BookOpen } from 'lucide-react';
import './App.css';

const sectionLabel = (text: string) => (
  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '1px', padding: '0.6rem 0.75rem 0.1rem', textTransform: 'uppercase' }}>{text}</div>
);

const sectionDivider = () => (
  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.25rem', paddingTop: '0.1rem' }} />
);

function Sidebar() {
  const location = useLocation();

  const NavLink = ({ item }: { item: { path: string; name: string; icon: React.ReactNode } }) => (
    <Link to={item.path} className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}>
      {item.icon}<span>{item.name}</span>
    </Link>
  );

  const cryptoItems = [
    { path: '/portfolio', name: 'AI Portfolio (PORT)', icon: <ShieldCheck size={20} color="#00d1ff" /> },
    { path: '/binance-live', name: 'Binance (Live Sim)', icon: <Bot size={20} color="#faad14" /> },
    { path: '/binance-real', name: 'Binance (Live 🔴)', icon: <Bot size={20} color="#f6465d" /> },
    { path: '/backtest', name: 'Backtest (ทดสอบ)', icon: <FlaskConical size={20} /> },
    { path: '/market-analysis', name: 'Market Analysis', icon: <TrendingUp size={20} color="#0ecb81" /> },
    { path: '/strategy-management', name: 'Strategy Management', icon: <LayoutList size={20} color="#00d1ff" /> },
  ];

  const predictionItems = [
    { path: '/polymarket', name: 'Polymarket', icon: <TrendingUp size={20} color="#ff6b35" /> },
    { path: '/markets-browser', name: 'Markets Browser', icon: <Search size={20} color="#ff6b35" /> },
    { path: '/my-bets', name: 'My Bets', icon: <Wallet size={20} color="#ff6b35" /> },
  ];

  const intelligenceItems = [
    { path: '/sentiment', name: 'Sentiment Analysis', icon: <Brain size={20} color="#a78bfa" /> },
    { path: '/quant-engine', name: 'Quant Engine 🧬', icon: <Zap size={20} color="#a78bfa" /> },
    { path: '/pine-import', name: 'Pine Import', icon: <FileCode size={20} color="#a78bfa" /> },
    { path: '/market-features', name: 'Market Features 🧬', icon: <Zap size={20} color="#faad14" /> },
    { path: '/indicator-management', name: 'Chart Indicators', icon: <Layers size={20} color="#00d1ff" /> },
    { path: '/research', name: 'Research Brain 🧠', icon: <BookOpen size={20} color="#00d1ff" /> },
  ];

  const systemItems = [
    { path: '/strategies', name: 'ภาพรวมระบบ', icon: <Layers size={20} /> },
    { path: '/logs', name: 'บันทึก (Logs)', icon: <Terminal size={20} /> },
    { path: '/telegram-logs', name: 'Telegram Logs', icon: <MessageSquare size={20} color="#0088cc" /> },
  ];

  return (
    <nav className="sidebar glass-panel">
      <div className="sidebar-logo">
        <h2 className="text-profit m-0" style={{ letterSpacing: '1px' }}>CryptoSmartTrade</h2>
        <Link to="/config" className={`nav-link ${location.pathname === '/config' ? 'active' : ''}`} style={{ marginTop: '0.75rem', fontSize: '0.75rem', background: location.pathname === '/config' ? '#faad1422' : 'rgba(255,255,255,0.05)', color: location.pathname === '/config' ? '#faad14' : '#fff', border: 'none', width: '100%', borderRadius: '4px', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Settings size={16} /> <span>CONFIGURATION</span>
        </Link>
      </div>
      <div className="nav-links">
        {sectionLabel('── CRYPTO ──')}
        {cryptoItems.map(item => <NavLink key={item.path} item={item} />)}

        {sectionDivider()}
        {sectionLabel('── PREDICTION ──')}
        {predictionItems.map(item => <NavLink key={item.path} item={item} />)}

        {sectionDivider()}
        {sectionLabel('── INTELLIGENCE ──')}
        {intelligenceItems.map(item => <NavLink key={item.path} item={item} />)}

        {sectionDivider()}
        {sectionLabel('── SYSTEM ──')}
        {systemItems.map(item => <NavLink key={item.path} item={item} />)}
      </div>
    </nav>
  );
}

function TopHeader() {
  return (
    <header className="top-header glass-panel">
      <div className="flex-between">
        <div>
          <h3 className="m-0" style={{ marginBottom: '0.25rem' }}>Trading Dashboard</h3>
          <p className="text-muted text-sm m-0">Live Trading is currently Active</p>
        </div>
        <div className="header-actions">
           <span className="status-badge pulse">● Online</span>
           <button className="btn-outline">My Account</button>
        </div>
      </div>
    </header>
  );
}

import Strategies from './pages/Strategies';
import Logs from './pages/Logs';
import Backtest from './pages/Backtest';
import BinanceLive from './pages/BinanceLive';
import BinanceLiveReal from './pages/BinanceLiveReal';
import ConfigPage from './pages/Config';
import Portfolio from './pages/Portfolio';
import TelegramLogs from './pages/TelegramLogs';
import Sentiment from './pages/Sentiment';
import Polymarket from './pages/Polymarket';
import MarketsBrowser from './pages/MarketsBrowser';
import MyBets from './pages/MyBets';
import PineImport from './pages/PineImport';
import QuantEngine from './pages/QuantEngine';
import StrategyManagement from './pages/StrategyManagement';
import IndicatorManagement from './pages/IndicatorManagement';
import MarketAnalysis from './pages/MarketAnalysis';
import MarketFeatures from './pages/MarketFeatures';
import Research from './pages/Research';

function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopHeader />
        <main className="page-content animate-fade-in">
          <Routes>
            <Route path="/" element={<Portfolio />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/binance-live" element={<BinanceLive />} />
            <Route path="/binance-real" element={<BinanceLiveReal />} />
            <Route path="/backtest" element={<Backtest />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/telegram-logs" element={<TelegramLogs />} />
            <Route path="/sentiment" element={<Sentiment />} />
            <Route path="/polymarket" element={<Polymarket />} />
            <Route path="/markets-browser" element={<MarketsBrowser />} />
            <Route path="/my-bets" element={<MyBets />} />
            <Route path="/market-analysis" element={<MarketAnalysis />} />
            <Route path="/pine-import" element={<PineImport />} />
            <Route path="/quant-engine" element={<QuantEngine />} />
            <Route path="/strategy-management" element={<StrategyManagement />} />
            <Route path="/market-features" element={<MarketFeatures />} />
            <Route path="/indicator-management" element={<IndicatorManagement />} />
            <Route path="/research" element={<Research />} />
            <Route path="/config" element={<ConfigPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
