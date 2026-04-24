import { useState, useEffect } from 'react';
import { AI_MODELS } from '../constants/aiModels';
import { Settings, Shield, Cpu, Key, Brain, TrendingUp, Activity, Zap, RefreshCw, Globe } from 'lucide-react';

const API = '';
const POLY_API = '/poly'; // Use proxy if available
let QUANT_URL = '/api/quant'; // Use Gateway proxy

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' };
const selectStyle = { ...inputStyle, background: 'rgba(0,0,0,0.3)' };
export default function ConfigPage() {
  const [view, setView] = useState<'customer' | 'admin'>('customer');
  const [activeTab, setActiveTab] = useState('crypto'); // Secondary tabs inside views

  // ── Quant Engine state ────────────────────────────────────────────────────
  const [quantCfg, setQuantCfg] = useState({
    backend_url: '/api',
    strategy_ai_url: 'http://localhost:8000',
    etl_symbols: 'BTCUSDT,ETHUSDT',
    etl_interval: '15m',
    decay_threshold: 70,
  });
  const [quantOnline, setQuantOnline] = useState<boolean | null>(null);
  const [quantSaving, setQuantSaving] = useState(false);
  const [quantSaved, setQuantSaved] = useState(false);
  const [quantPinging, setQuantPinging] = useState(false);

  // ── Crypto state ──────────────────────────────────────────────────────────
  const [cfg, setCfg] = useState({
    apiKey: '', apiSecret: '', openRouterKey: '', openRouterModel: 'meta-llama/llama-3.1-8b-instruct',
    telegramToken: '', telegramChatId: '',
    hasKeys: false, hasOpenRouter: false, hasTelegram: false,
    strategyAiMode: 'off', strategyAiUrl: 'http://strategy-ai:8000',
    strategyAiConfidenceThreshold: 0.70,
    tradeValidatorEnabled: true,
    liveApiKey: '', liveApiSecret: '', hasLiveKeys: false,
  });
  const [tempORKey, setTempORKey] = useState('');
  const [tempTGToken, setTempTGToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [myIp, setMyIp] = useState('');
  const [ipCopied, setIpCopied] = useState(false);
  const [strategyAiStatus, setStrategyAiStatus] = useState<{ online: boolean | null; lastCheck: string }>({ online: null, lastCheck: '' });
  const [pinging, setPinging] = useState(false);
  const [logLevel, setLogLevel] = useState<string>('INFO');
  const [logLevelSaving, setLogLevelSaving] = useState(false);
  const [logLevelSaved, setLogLevelSaved] = useState(false);

  // ── Polymarket state ──────────────────────────────────────────────────────
  const [polyCfg, setPolyCfg] = useState({ ai_model: '', confidence_threshold: 0.72, max_bet: 3.0, use_rag_context: true });
  const [polyOnline, setPolyOnline] = useState<boolean | null>(null);
  const [polySaving, setPolySaving] = useState(false);
  const [polySaved, setPolySaved] = useState(false);

  const fetchQuantCfg = async () => {
    setQuantPinging(true);
    try {
      const res = await fetch(`${QUANT_URL}/config`);
      if (!res.ok) { setQuantOnline(false); return; }
      const d = await res.json();
      setQuantOnline(true);
      setQuantCfg({
        backend_url: d.backend_url ?? '',
        strategy_ai_url: d.strategy_ai_url ?? '',
        etl_symbols: (d.etl_symbols ?? []).join(','),
        etl_interval: d.etl_interval ?? '15m',
        decay_threshold: d.decay_threshold ?? 70,
      });
    } catch { setQuantOnline(false); }
    setQuantPinging(false);
  };

  const handleSaveQuant = async () => {
    setQuantSaving(true);
    try {
      const res = await fetch(`${QUANT_URL}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backend_url: quantCfg.backend_url,
          strategy_ai_url: quantCfg.strategy_ai_url,
          etl_symbols: quantCfg.etl_symbols.split(',').map(s => s.trim()).filter(Boolean),
          etl_interval: quantCfg.etl_interval,
          decay_threshold: Number(quantCfg.decay_threshold),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setQuantSaved(true);
      setTimeout(() => setQuantSaved(false), 2000);
      
      // Auto-save the platform config as well to ensure URLs stay in sync
      await handleSaveCrypto();
    } catch (e: any) { alert('Quant Save Error: ' + e.message); }
    setQuantSaving(false);
  };

  const applyEnvironmentPreset = (mode: 'local' | 'docker') => {
    if (mode === 'local') {
      setQuantCfg(prev => ({
        ...prev,
        backend_url: 'http://localhost:4001',
        strategy_ai_url: 'http://localhost:8000',
      }));
      setCfg(prev => ({ ...prev, strategyAiUrl: 'http://localhost:8000' }));
    } else {
      setQuantCfg(prev => ({
        ...prev,
        backend_url: 'http://backend:4001',
        strategy_ai_url: 'http://strategy-ai:8000',
      }));
      setCfg(prev => ({ ...prev, strategyAiUrl: 'http://strategy-ai:8000' }));
    }
    // Added a small notification to remind user to save
    const msg = mode === 'local' ? 'Switched to Local Dev presets' : 'Switched to Docker Cluster presets';
    console.log(msg + '. Please remember to Save Platform Configuration at the bottom.');
  };

  const fetchCryptoCfg = async () => {
    try {
      const res = await fetch(`${API}/api/config`);
      const data = await res.json();
      setCfg(prev => ({
        ...prev,
        apiKey: data.apiKey === '********' ? '' : data.apiKey,
        hasKeys: data.hasKeys || (data.apiKey === '********' && data.hasSecret),
        hasOpenRouter: data.hasOpenRouter, hasTelegram: data.hasTelegram,
        openRouterModel: data.openRouterModel || prev.openRouterModel,
        telegramChatId: data.telegramChatId || '',
        apiSecret: '', openRouterKey: '', telegramToken: '',
        strategyAiMode: data.strategyAiMode || 'off',
        strategyAiUrl: data.strategyAiUrl || 'http://strategy-ai:8000',
        strategyAiConfidenceThreshold: data.strategyAiConfidenceThreshold ?? 0.70,
        tradeValidatorEnabled: data.tradeValidatorEnabled !== false,
        liveApiKey: '', liveApiSecret: '', hasLiveKeys: data.hasLiveKeys || false,
      }));
    } catch {}
  };

  const pingStrategyAi = async () => {
    setPinging(true);
    try {
      const res = await fetch('/api/config/strategy-ai/status');
      const data = await res.json();
      setStrategyAiStatus({ online: data.online, lastCheck: data.lastCheck });
    } catch {
      // Fallback: try direct proxy
      try {
        const res = await fetch('/strategy-ai/health');
        setStrategyAiStatus({ online: res.ok, lastCheck: new Date().toISOString() });
      } catch {
        setStrategyAiStatus({ online: false, lastCheck: new Date().toISOString() });
      }
    }
    setPinging(false);
  };

    useEffect(() => {
      fetchCryptoCfg();
      pingStrategyAi();
      fetch('/api/config/my-ip').then(r => r.json()).then(d => setMyIp(d.ip)).catch(() => {});
      
      // Fetch current log level
      fetch('/api/config/strategy-ai/log-level')
        .then(r => r.json()).then(d => { if (d.level) setLogLevel(d.level); }).catch(() => {});
    }, []);

    // Fetch tab-specific configs only when activeTab or view changes
    useEffect(() => {
      if (view === 'admin') {
        fetchQuantCfg();
        fetch(`${POLY_API}/api/config`)
          .then(r => { 
            setPolyOnline(r.ok); 
            if (r.ok) return r.json();
            throw new Error('Poly offline');
          })
          .then(d => setPolyCfg(prev => ({ ...prev, ai_model: d.ai_model ?? '', confidence_threshold: d.confidence_threshold ?? 0.72, max_bet: d.max_bet ?? 3.0, use_rag_context: d.use_rag_context !== 0 })))
          .catch(() => {
            setPolyOnline(false);
            console.log('Polymarket service not detected at ' + POLY_API);
          });
      }
    }, [view, activeTab]);

  const handleSaveCrypto = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: cfg.apiKey, apiSecret: cfg.apiSecret,
          openRouterKey: tempORKey || undefined, openRouterModel: cfg.openRouterModel,
          telegramToken: tempTGToken || undefined, telegramChatId: cfg.telegramChatId,
          strategyAiMode: cfg.strategyAiMode, strategyAiUrl: cfg.strategyAiUrl,
          strategyAiConfidenceThreshold: cfg.strategyAiConfidenceThreshold,
          tradeValidatorEnabled: cfg.tradeValidatorEnabled,
          liveApiKey: cfg.liveApiKey || undefined, liveApiSecret: cfg.liveApiSecret || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchCryptoCfg();
      setTempORKey(''); setTempTGToken('');
      alert('Saved!');
    } catch (e: any) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const handleSaveLogLevel = async (level: string) => {
    setLogLevelSaving(true);
    try {
      const res = await fetch('/api/config/strategy-ai/log-level', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLogLevel(level);
      setLogLevelSaved(true);
      setTimeout(() => setLogLevelSaved(false), 2000);
    } catch (e: any) { alert('Error: ' + e.message); }
    setLogLevelSaving(false);
  };

  const handleSavePoly = async () => {
    setPolySaving(true);
    try {
      const res = await fetch(`${POLY_API}/api/config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(polyCfg),
      });
      if (!res.ok) throw new Error(await res.text());
      setPolySaved(true);
      setTimeout(() => setPolySaved(false), 2000);
    } catch (e: any) { alert('Polymarket Save Error: ' + e.message); }
    setPolySaving(false);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '1rem 2rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* View Switcher */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', display: 'flex', gap: '4px', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setView('customer')}
            style={{
              padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: view === 'customer' ? 'var(--profit-color)' : 'transparent',
              color: view === 'customer' ? '#000' : '#888',
              fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <Shield size={18} /> My Account
          </button>
          <button 
            onClick={() => setView('admin')}
            style={{
              padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: view === 'admin' ? '#a78bfa' : 'transparent',
              color: view === 'admin' ? '#000' : '#888',
              fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <Settings size={18} /> Platform Backoffice
          </button>
        </div>
      </div>

      {/* CUSTOMER VIEW */}
      {view === 'customer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Personal Credentials</h1>
            <p style={{ color: '#888', marginTop: '0.5rem' }}>Manage your private API keys and notification preferences.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

            {/* Binance Testnet */}
            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #faad14' }}>
              <h2 style={{ color: '#faad14', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={24} /> Binance Testnet
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label="API Key">
                  <input type="text" style={inputStyle} value={cfg.apiKey} onChange={e => setCfg(k => ({ ...k, apiKey: e.target.value }))}
                    placeholder={cfg.hasKeys ? '✓ API Key Saved' : 'Paste your Binance API Key'} />
                </Field>
                <Field label="Secret Key">
                  <input type="password" style={inputStyle} value={cfg.apiSecret} onChange={e => setCfg(k => ({ ...k, apiSecret: e.target.value }))}
                    placeholder={cfg.hasKeys ? '✓ Secret Key Saved' : 'Paste your Binance Secret Key'} />
                </Field>
              </div>
            </div>

            {/* Binance Live */}
            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #f6465d' }}>
              <h2 style={{ color: '#f6465d', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={24} color="#f6465d" /> Binance Real Account
              </h2>
              <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>Used for actual live trading execution.</p>
              
              {/* 🌐 Whitelist IP Info */}
              {myIp && (
                <div style={{ background: 'rgba(52, 199, 89, 0.05)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(52, 199, 89, 0.15)', marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#34c759', fontWeight: 800, marginBottom: '0.4rem', textTransform: 'uppercase' }}>🔒 Whitelist Recommended</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>{myIp}</div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(myIp);
                        setIpCopied(true);
                        setTimeout(() => setIpCopied(false), 2000);
                      }}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: ipCopied ? '#34c759' : '#888', fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {ipCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '0.6rem' }}>
                    ให้นำ IP นี้ไปใส่ในช่อง <b>"Allow access to any IP (Restricted)"</b> ในหน้า API Whitelist ของ Binance
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                <Field label="Live API Key">
                  <input type="text" style={inputStyle} value={cfg.liveApiKey} onChange={e => setCfg(k => ({ ...k, liveApiKey: e.target.value }))}
                    placeholder={cfg.hasLiveKeys ? '✓ Live API Key Saved' : 'Paste Live API Key'} />
                </Field>
                <Field label="Live Secret Key">
                  <input type="password" style={inputStyle} value={cfg.liveApiSecret} onChange={e => setCfg(k => ({ ...k, liveApiSecret: e.target.value }))}
                    placeholder={cfg.hasLiveKeys ? '✓ Live Secret Saved' : 'Paste Live Secret Key'} />
                </Field>
              </div>
            </div>

            {/* Telegram */}
            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #0088cc' }}>
              <h2 style={{ color: '#0088cc', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={24} color="#0088cc" /> Telegram Alerts
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label="Bot Token" hint="Create via @BotFather">
                  <input type="password" style={inputStyle} value={tempTGToken} onChange={e => setTempTGToken(e.target.value)}
                    placeholder={cfg.hasTelegram ? '✓ Token Saved' : '123456:ABC-DEF...'} />
                </Field>
                <Field label="Chat ID" hint="Get via @userinfobot">
                  <input type="text" style={inputStyle} value={cfg.telegramChatId} onChange={e => setCfg(k => ({ ...k, telegramChatId: e.target.value }))}
                    placeholder="e.g. 123456789" />
                </Field>
              </div>
            </div>

            {/* AI Model Preference */}
            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #a78bfa' }}>
              <h2 style={{ color: '#a78bfa', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={24} /> AI Engine Preferences
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label="OpenRouter API Key (sk-or-...)">
                  <input type="password" style={inputStyle} value={tempORKey} onChange={e => setTempORKey(e.target.value)}
                    placeholder={cfg.hasOpenRouter ? '✓ Key Saved' : 'sk-or-v1-...'} />
                </Field>
                <Field label="Preferred LLM Model">
                  <select style={selectStyle} value={cfg.openRouterModel} onChange={e => setCfg(k => ({ ...k, openRouterModel: e.target.value }))}>
                    {AI_MODELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {/* Polymarket Personal Limits */}
            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #ff6b35' }}>
              <h2 style={{ color: '#ff6b35', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={24} color="#ff6b35" /> Polymarket Risk Limits
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label={`Prediction Confidence — ${(polyCfg.confidence_threshold * 100).toFixed(0)}%`}>
                  <input type="range" min={0.5} max={0.95} step={0.01} style={{ width: '100%' }}
                    value={polyCfg.confidence_threshold} onChange={e => setPolyCfg(p => ({ ...p, confidence_threshold: parseFloat(e.target.value) }))} />
                </Field>
                <Field label="Max Bet per Prediction (USDC)">
                  <input type="number" style={inputStyle} value={polyCfg.max_bet} onChange={e => setPolyCfg(p => ({ ...p, max_bet: parseFloat(e.target.value) }))} />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                  <button onClick={() => setPolyCfg(p => ({ ...p, use_rag_context: !p.use_rag_context }))}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)',
                      background: polyCfg.use_rag_context ? '#ff6b3522' : 'transparent',
                      color: polyCfg.use_rag_context ? '#ff6b35' : '#666',
                      cursor: 'pointer', fontSize: '0.85rem'
                    }}>
                    {polyCfg.use_rag_context ? 'RAG Learning Enabled' : 'RAG Learning Disabled'}
                  </button>
                  <button onClick={handleSavePoly} disabled={polySaving}
                    style={{ marginLeft: 'auto', padding: '0.5rem 1rem', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {polySaving ? '...' : 'Save Risk'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={handleSaveCrypto} disabled={saving}
              style={{ padding: '1rem 3rem', background: 'var(--profit-color)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Updating Account...' : 'Save Account Settings'}
            </button>
          </div>
        </div>
      )}

      {/* ADMIN VIEW */}
      {view === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#a78bfa' }}>System Infrastructure</h1>
            <p style={{ color: '#888', marginTop: '0.5rem' }}>Global configuration for the quant engine and platform intelligence.</p>
          </div>

          {/* Service URLs Panel */}
          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #a78bfa' }}>
            <h2 style={{ color: '#a78bfa', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={24} /> Microservice Architecture
              </span>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button 
                    onClick={() => applyEnvironmentPreset('local')}
                    style={{ padding: '0.3rem 0.6rem', background: quantCfg.backend_url.includes('localhost') ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: quantCfg.backend_url.includes('localhost') ? '#fff' : '#666', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>
                    🏠 Local Dev
                  </button>
                  <button 
                    onClick={() => applyEnvironmentPreset('docker')}
                    style={{ padding: '0.3rem 0.6rem', background: quantCfg.backend_url.includes('backend') ? 'rgba(167, 139, 250, 0.2)' : 'transparent', border: 'none', color: quantCfg.backend_url.includes('backend') ? '#a78bfa' : '#666', borderRadius: '4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>
                    🐳 Docker Cluster
                  </button>
                </div>
                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }} />
                {quantOnline !== null && (
                  <span style={{ fontSize: '0.8rem', color: quantOnline ? '#0ecb81' : '#f6465d' }}>
                    Quant: {quantOnline ? '● Online' : '● Offline'}
                  </span>
                )}
                {strategyAiStatus.online !== null && (
                  <span style={{ fontSize: '0.8rem', color: strategyAiStatus.online ? '#0ecb81' : '#f6465d' }}>
                    AI: {strategyAiStatus.online ? '● Online' : '● Offline'}
                  </span>
                )}
              </div>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <Field label="Quant Engine URL">
                <input type="text" style={inputStyle} value={quantCfg.backend_url} onChange={e => setQuantCfg(c => ({ ...c, backend_url: e.target.value }))} />
              </Field>
              <Field label="Strategy AI URL">
                <input type="text" style={inputStyle} value={quantCfg.strategy_ai_url} onChange={e => setQuantCfg(c => ({ ...c, strategy_ai_url: e.target.value }))} />
              </Field>
              <Field label="Platform API Gateway">
                <input type="text" style={inputStyle} value={API || 'Local (Proxy)'} disabled />
              </Field>
            </div>
          </div>

          {/* Strategy AI Global Logic */}
          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #722ed1' }}>
            <h2 style={{ color: '#722ed1', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={24} /> Intelligence Filter Logic
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label="Filter Mode">
                  <select style={selectStyle} value={cfg.strategyAiMode} onChange={e => setCfg(k => ({ ...k, strategyAiMode: e.target.value }))}>
                    <option value="off">Off (Raw Execution)</option>
                    <option value="ml">ML Analysis Only</option>
                    <option value="full">Comprehensive (ML + LLM)</option>
                  </select>
                </Field>
                <Field label={`Confidence Threshold — ${(cfg.strategyAiConfidenceThreshold * 100).toFixed(0)}%`}>
                  <input type="range" min={0.5} max={0.95} step={0.01} style={{ width: '100%' }}
                    value={cfg.strategyAiConfidenceThreshold} onChange={e => setCfg(k => ({ ...k, strategyAiConfidenceThreshold: parseFloat(e.target.value) }))} />
                </Field>
              </div>
              
              {/* Log Level Management */}
              <div>
                <Field label="Hard Rules Gate">
                  <button
                    onClick={() => setCfg(k => ({ ...k, tradeValidatorEnabled: !k.tradeValidatorEnabled }))}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      border: `1px solid ${cfg.tradeValidatorEnabled ? '#0ecb81' : '#f6465d'}`,
                      background: cfg.tradeValidatorEnabled ? 'rgba(14,203,129,0.12)' : 'rgba(246,70,93,0.12)',
                      color: cfg.tradeValidatorEnabled ? '#0ecb81' : '#f6465d',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {cfg.tradeValidatorEnabled ? 'Enabled: Hard Rules ON' : 'Disabled: Hard Rules OFF'}
                  </button>
                </Field>
                <p style={{ fontSize: '0.75rem', color: '#777', margin: '0.6rem 0 1.2rem' }}>
                  Controls the global pre-trade guard in `TradeValidator.js` for all bots.
                </p>

                <Field label="Real-time Log Level (DevOps)">
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {['DEBUG', 'INFO', 'WARNING', 'ERROR'].map(lvl => (
                      <button key={lvl} onClick={() => handleSaveLogLevel(lvl)}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: '4px', cursor: 'pointer',
                          background: logLevel === lvl ? '#722ed133' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${logLevel === lvl ? '#722ed1' : 'rgba(255,255,255,0.1)'}`,
                          color: logLevel === lvl ? '#722ed1' : '#666',
                          fontSize: '0.8rem', fontWeight: 600
                        }}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* ETL & Quant Pipeline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #13c2c2' }}>
              <h2 style={{ color: '#13c2c2', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={24} /> Data ETL Pipeline
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label="Active Symbols" hint="Comma-separated">
                  <input type="text" style={inputStyle} value={quantCfg.etl_symbols} onChange={e => setQuantCfg(c => ({ ...c, etl_symbols: e.target.value }))} />
                </Field>
                <Field label="Base Timeframe">
                  <select style={selectStyle} value={quantCfg.etl_interval} onChange={e => setQuantCfg(c => ({ ...c, etl_interval: e.target.value }))}>
                    {['1m','5m','15m','1h','4h'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #f6465d' }}>
              <h2 style={{ color: '#f6465d', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={24} /> Alpha Decay Management
              </h2>
              <Field label={`Decay Threshold — ${quantCfg.decay_threshold}`} hint="Strategies exceeding this score will be retired.">
                <input type="range" min={30} max={95} step={5} style={{ width: '100%', marginTop: '1rem' }}
                  value={quantCfg.decay_threshold} onChange={e => setQuantCfg(c => ({ ...c, decay_threshold: Number(e.target.value) }))} />
              </Field>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '1rem' }}>
             <button onClick={handleSaveQuant} disabled={quantSaving}
              style={{ padding: '1rem 3rem', background: '#a78bfa', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', opacity: quantSaving ? 0.7 : 1 }}>
              {quantSaving ? 'Syncing...' : 'Deploy System Config'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
