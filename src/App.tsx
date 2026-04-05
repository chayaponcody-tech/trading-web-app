import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Terminal, FlaskConical, Bot, ShieldCheck, MessageSquare } from 'lucide-react';
import './App.css';

function Sidebar() {
  const location = useLocation();
  const cryptoItems = [
    { path: '/portfolio', name: 'AI Portfolio (PORT)', icon: <ShieldCheck size={20} color="#00d1ff" /> },
    { path: '/binance-live', name: 'Binance (Live Sim)', icon: <Bot size={20} color="#faad14" /> },
    { path: '/backtest', name: 'Backtest (ทดสอบ)', icon: <FlaskConical size={20} /> },
  ];
  const bottomItems = [
    { path: '/strategies', name: 'กลยุทธ์', icon: <Settings size={20} /> },
    { path: '/logs', name: 'บันทึก (Logs)', icon: <Terminal size={20} /> },
    { path: '/telegram-logs', name: 'Telegram Logs', icon: <MessageSquare size={20} color="#0088cc" /> },
  ];

  const NavLink = ({ item }: { item: { path: string; name: string; icon: React.ReactNode } }) => (
    <Link key={item.path} to={item.path} className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}>
      {item.icon}<span>{item.name}</span>
    </Link>
  );

  return (
    <nav className="sidebar glass-panel">
      <div className="sidebar-logo">
        <h2 className="text-profit m-0" style={{ letterSpacing: '1px' }}>CryptoSmartTrade</h2>
        <Link to="/config" className={`nav-link ${location.pathname === '/config' ? 'active' : ''}`} style={{ marginTop: '0.75rem', fontSize: '0.75rem', background: location.pathname === '/config' ? '#faad1422' : 'rgba(255,255,255,0.05)', color: location.pathname === '/config' ? '#faad14' : '#fff', border: 'none', width: '100%', borderRadius: '4px', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Settings size={16} /> <span>CONFIGURATION</span>
        </Link>
      </div>
      <div className="nav-links">
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '1px', padding: '0.5rem 0.75rem 0.1rem', textTransform: 'uppercase' }}>── CRYPTO ──</div>
        {cryptoItems.map(item => <NavLink key={item.path} item={item} />)}
        
        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
          {bottomItems.map(item => <NavLink key={item.path} item={item} />)}
        </div>
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
import ConfigPage from './pages/Config';
import Portfolio from './pages/Portfolio';
import TelegramLogs from './pages/TelegramLogs';

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
            <Route path="/backtest" element={<Backtest />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/telegram-logs" element={<TelegramLogs />} />
            <Route path="/config" element={<ConfigPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
