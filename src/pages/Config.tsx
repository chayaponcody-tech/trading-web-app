import { useState, useEffect } from 'react';
import { AI_MODELS } from '../constants/aiModels';
import { Settings, Shield, Cpu, Key, Brain, TrendingUp, Activity, Zap, RefreshCw } from 'lucide-react';

const API = '';
const POLY_API = 'http://localhost:8080';
const QUANT_URL = 'http://localhost:8002';

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
  const [tab, setTab] = useState<'crypto' | 'polymarket' | 'quant'>('crypto');

  // ── Quant Engine state ────────────────────────────────────────────────────
  const [quantCfg, setQuantCfg] = useState({
    backend_url: 'http://localhost:4001',
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
    } catch (e: any) { alert('Quant Save Error: ' + e.message); }
    setQuantSaving(false);
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
        liveApiKey: '', liveApiSecret: '', hasLiveKeys: data.hasLiveKeys || false,
      }));
    } catch {}
  };

  const pingStrategyAi = async () => {
    setPinging(true);
    try {
      const res = await fetch(`${API}/api/config/strategy-ai/status`);
      const data = await res.json();
      setStrategyAiStatus({ online: data.online, lastCheck: data.lastCheck });
    } catch {
      setStrategyAiStatus({ online: false, lastCheck: new Date().toISOString() });
    }
    setPinging(false);
  };

  useEffect(() => {
    fetchCryptoCfg();
    pingStrategyAi();
    fetchQuantCfg();
    fetch('/api/config/my-ip').then(r => r.json()).then(d => setMyIp(d.ip)).catch(() => {});
    fetch(`${POLY_API}/api/config`)
      .then(r => { setPolyOnline(r.ok); return r.json(); })
      .then(d => setPolyCfg({ ai_model: d.ai_model ?? '', confidence_threshold: d.confidence_threshold ?? 0.72, max_bet: d.max_bet ?? 3.0, use_rag_context: d.use_rag_context !== 0 }))
      .catch(() => setPolyOnline(false));
    // Fetch current log level
    fetch('/api/config/strategy-ai/log-level')
      .then(r => r.json()).then(d => { if (d.level) setLogLevel(d.level); }).catch(() => {});
  }, []);

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
    <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <Settings size={32} color="#faad14" /> Global System Configuration
        </h1>
        <p style={{ color: '#888', marginTop: '0.5rem' }}>Manage API connections and AI model preferences for the entire platform.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', width: 'fit-content', marginBottom: '2rem' }}>
        {([['crypto', '🟡 Crypto / Binance'], ['polymarket', '🟠 Polymarket'], ['quant', '🧬 Quant Engine']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
            background: tab === t ? (t === 'crypto' ? 'rgba(250,173,20,0.2)' : t === 'polymarket' ? 'rgba(255,107,53,0.2)' : 'rgba(163,139,250,0.2)') : 'transparent',
            color: tab === t ? (t === 'crypto' ? '#faad14' : t === 'polymarket' ? '#ff6b35' : '#a78bfa') : '#666',
            transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* CRYPTO TAB */}
      {tab === 'crypto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #faad14' }}>
              <h2 style={{ color: '#faad14', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={24} /> Binance Testnet API
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
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(250,173,20,0.05)', borderRadius: '4px', border: '1px solid rgba(250,173,20,0.1)', fontSize: '0.8rem', color: '#ccc' }}>
                  <Shield size={14} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} color="#faad14" />
                  Stored securely in <code>binance-config.json</code>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #f6465d' }}>
              <h2 style={{ color: '#f6465d', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={24} color="#f6465d" /> Binance Live API (เงินจริง)
              </h2>
              <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>ใช้สำหรับหน้า Binance (Live) เท่านั้น</p>
              <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.3)', borderRadius: '6px', fontSize: '0.78rem', color: '#f6465d', marginBottom: '1.2rem' }}>
                API Key นี้จะส่ง order จริงด้วยเงินจริง
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label="Live API Key">
                  <input type="text" style={inputStyle} value={cfg.liveApiKey} onChange={e => setCfg(k => ({ ...k, liveApiKey: e.target.value }))}
                    placeholder={cfg.hasLiveKeys ? '✓ Live API Key Saved' : 'Paste Live API Key'} />
                </Field>
                <Field label="Live Secret Key">
                  <input type="password" style={inputStyle} value={cfg.liveApiSecret} onChange={e => setCfg(k => ({ ...k, liveApiSecret: e.target.value }))}
                    placeholder={cfg.hasLiveKeys ? '✓ Live Secret Saved' : 'Paste Live Secret Key'} />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: cfg.hasLiveKeys ? '#0ecb81' : '#888', fontSize: '0.85rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.hasLiveKeys ? '#0ecb81' : '#555' }} />
                  {cfg.hasLiveKeys ? 'Live Keys Configured' : 'ยังไม่ได้ตั้งค่า'}
                </div>
                {myIp && (
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '0.4rem' }}>Server Public IP</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <code style={{ fontSize: '1rem', fontWeight: 'bold', color: '#faad14' }}>{myIp}</code>
                      <button onClick={() => { navigator.clipboard.writeText(myIp); setIpCopied(true); setTimeout(() => setIpCopied(false), 2000); }}
                        style={{ padding: '0.3rem 0.75rem', background: ipCopied ? '#0ecb8122' : 'rgba(255,255,255,0.06)', border: `1px solid ${ipCopied ? '#0ecb81' : 'rgba(255,255,255,0.15)'}`, color: ipCopied ? '#0ecb81' : '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                        {ipCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #faad14' }}>
              <h2 style={{ color: '#faad14', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={24} /> AI Strategy Settings
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <Field label="OpenRouter API Key">
                  <input type="password" style={inputStyle} value={tempORKey} onChange={e => setTempORKey(e.target.value)}
                    placeholder={cfg.hasOpenRouter ? '✓ Key Saved (Encrypted)' : 'sk-or-v1-...'} />
                </Field>
                <Field label="Preferred AI Model">
                  <select style={selectStyle} value={cfg.openRouterModel} onChange={e => setCfg(k => ({ ...k, openRouterModel: e.target.value }))}>
                    <option value="">Default Model</option>
                    {AI_MODELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: cfg.hasOpenRouter ? '#0ecb81' : '#f6465d', fontSize: '0.85rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.hasOpenRouter ? '#0ecb81' : '#f6465d' }} />
                  {cfg.hasOpenRouter ? 'AI Engine Ready' : 'AI Key Missing'}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #0088cc' }}>
              <h2 style={{ color: '#0088cc', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={24} color="#0088cc" /> Telegram Notifications
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
                {cfg.hasTelegram && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0ecb81', fontSize: '0.85rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ecb81' }} /> Telegram Active
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #722ed1' }}>
            <h2 style={{ color: '#722ed1', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={24} color="#722ed1" /> Strategy AI Filter (Python)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {strategyAiStatus.online === null ? <span style={{ fontSize: '0.8rem', color: '#888' }}>Checking...</span>
                  : strategyAiStatus.online ? <span style={{ fontSize: '0.8rem', color: '#0ecb81' }}>● Online</span>
                  : <span style={{ fontSize: '0.8rem', color: '#f6465d' }}>● Offline</span>}
                <button onClick={pingStrategyAi} disabled={pinging}
                  style={{ padding: '0.3rem 0.8rem', background: 'rgba(114,46,209,0.2)', border: '1px solid #722ed1', color: '#722ed1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', opacity: pinging ? 0.6 : 1 }}>
                  {pinging ? '...' : 'Ping'}
                </button>
              </span>
            </h2>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
              Python container วิเคราะห์ signal ก่อน execute
              {strategyAiStatus.lastCheck && <span style={{ marginLeft: '0.5rem', color: '#555' }}>· checked {new Date(strategyAiStatus.lastCheck).toLocaleTimeString()}</span>}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <Field label="AI Filter Mode">
                <select style={selectStyle} value={cfg.strategyAiMode} onChange={e => setCfg(k => ({ ...k, strategyAiMode: e.target.value }))}>
                  <option value="off">Off</option>
                  <option value="ml">ML Only</option>
                  <option value="full">ML + LLM</option>
                </select>
              </Field>
              <Field label="Confidence Threshold" hint="แนะนำ 0.65-0.75">
                <input type="number" style={inputStyle} min={0.5} max={0.95} step={0.05}
                  value={cfg.strategyAiConfidenceThreshold} onChange={e => setCfg(k => ({ ...k, strategyAiConfidenceThreshold: parseFloat(e.target.value) }))} />
              </Field>
              <Field label="Strategy AI URL">
                <input type="text" style={inputStyle} value={cfg.strategyAiUrl} onChange={e => setCfg(k => ({ ...k, strategyAiUrl: e.target.value }))} />
              </Field>
            </div>
          </div>

          {/* Log Level Panel */}
          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #13c2c2' }}>
            <h2 style={{ color: '#13c2c2', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={24} color="#13c2c2" /> Strategy AI — Log Level
            </h2>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
              ปรับ verbosity ของ Python service แบบ real-time ไม่ต้อง restart container
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const).map(lvl => {
                const colors: Record<string, string> = {
                  DEBUG: '#595959', INFO: '#13c2c2', WARNING: '#faad14', ERROR: '#f6465d', CRITICAL: '#722ed1',
                };
                const isActive = logLevel === lvl;
                return (
                  <button key={lvl} onClick={() => handleSaveLogLevel(lvl)} disabled={logLevelSaving || strategyAiStatus.online === false}
                    style={{
                      padding: '0.5rem 1.25rem', borderRadius: '6px', border: `1px solid ${isActive ? colors[lvl] : 'rgba(255,255,255,0.1)'}`,
                      background: isActive ? `${colors[lvl]}22` : 'transparent',
                      color: isActive ? colors[lvl] : '#666',
                      fontWeight: isActive ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
                      transition: 'all 0.15s', opacity: logLevelSaving ? 0.6 : 1,
                    }}>
                    {lvl}
                  </button>
                );
              })}
              <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: logLevelSaved ? '#0ecb81' : '#555', transition: 'color 0.3s' }}>
                {logLevelSaved ? '✓ Applied' : strategyAiStatus.online === false ? '⚠ Service offline' : `Current: ${logLevel}`}
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              {[
                { lvl: 'DEBUG',    desc: 'ทุก event รวม indicator values' },
                { lvl: 'INFO',     desc: 'signal, confidence, latency' },
                { lvl: 'WARNING',  desc: 'microstructure block, fallback' },
                { lvl: 'ERROR',    desc: 'exception เท่านั้น' },
                { lvl: 'CRITICAL', desc: 'crash-level เท่านั้น' },
              ].map(({ lvl, desc }) => (
                <div key={lvl} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '0.72rem', color: '#555' }}>
                  <div style={{ fontWeight: 600, color: '#888', marginBottom: '0.2rem' }}>{lvl}</div>
                  {desc}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveCrypto} disabled={saving}
              style={{ padding: '1rem 3rem', background: '#faad14', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Save All Configurations'}
            </button>
          </div>
        </div>
      )}

      {/* POLYMARKET TAB */}
      {tab === 'polymarket' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #ff6b35' }}>
            <h2 style={{ color: '#ff6b35', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={24} color="#ff6b35" /> Polymarket Agent
              </span>
              {polyOnline === null ? <span style={{ fontSize: '0.8rem', color: '#888' }}>Checking...</span>
                : polyOnline ? <span style={{ fontSize: '0.8rem', color: '#0ecb81' }}>● Service Online</span>
                : <span style={{ fontSize: '0.8rem', color: '#f6465d' }}>● Service Offline</span>}
            </h2>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
              ตั้งค่า AI model และ risk parameters สำหรับ BTC 5-minute prediction markets
              {!polyOnline && <span style={{ color: '#f6465d', marginLeft: '0.5rem' }}>— uvicorn api_server:app --port 8080</span>}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <Field label="AI Model" hint="Model ที่ใช้วิเคราะห์ market direction">
                <select style={selectStyle} value={polyCfg.ai_model} onChange={e => setPolyCfg(p => ({ ...p, ai_model: e.target.value }))} disabled={!polyOnline}>
                  <option value="">Default (config.py)</option>
                  {AI_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Max Bet per Trade (USDC)" hint="Kelly fraction คำนวณ size จริงจากค่านี้">
                <input type="number" style={inputStyle} min={0.25} max={100} step={0.25}
                  value={polyCfg.max_bet} onChange={e => setPolyCfg(p => ({ ...p, max_bet: parseFloat(e.target.value) }))} disabled={!polyOnline} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
              <Field label={`Confidence Threshold — ${(polyCfg.confidence_threshold * 100).toFixed(0)}%`} hint="AI ต้องมั่นใจอย่างน้อยเท่านี้ถึงจะเปิด position">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input type="range" min={0.5} max={0.95} step={0.01} style={{ flex: 1 }}
                    value={polyCfg.confidence_threshold} onChange={e => setPolyCfg(p => ({ ...p, confidence_threshold: parseFloat(e.target.value) }))} disabled={!polyOnline} />
                  <span style={{ minWidth: '42px', textAlign: 'right', fontWeight: 'bold',
                    color: polyCfg.confidence_threshold >= 0.8 ? '#0ecb81' : polyCfg.confidence_threshold >= 0.65 ? '#faad14' : '#f6465d' }}>
                    {(polyCfg.confidence_threshold * 100).toFixed(0)}%
                  </span>
                </div>
              </Field>
              <Field label="RAG Context (Learning)">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: polyOnline ? 'pointer' : 'not-allowed', marginTop: '0.5rem' }}>
                  <div onClick={() => polyOnline && setPolyCfg(p => ({ ...p, use_rag_context: !p.use_rag_context }))}
                    style={{ width: '40px', height: '22px', borderRadius: '11px', position: 'relative', cursor: 'pointer', flexShrink: 0,
                      background: polyCfg.use_rag_context ? '#ff6b35' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: '3px', left: polyCfg.use_rag_context ? '21px' : '3px',
                      width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{polyCfg.use_rag_context ? 'Enabled' : 'Disabled'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#555' }}>{polyCfg.use_rag_context ? 'AI เรียนรู้จาก trade ที่ผ่านมา' : 'ปิดเพื่อประหยัด token'}</div>
                  </div>
                </label>
              </Field>
            </div>
            <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(255,107,53,0.06)', borderRadius: '4px', border: '1px solid rgba(255,107,53,0.2)', fontSize: '0.8rem', color: '#ccc' }}>
              <strong style={{ color: '#ff6b35' }}>Flow:</strong> Scan BTC 5m → Rule-based → AI predict (conf {'>'}= {(polyCfg.confidence_threshold * 100).toFixed(0)}%) → Execute on Polymarket CLOB
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSavePoly} disabled={polySaving || !polyOnline}
              style={{ padding: '1rem 3rem', background: polySaved ? '#0ecb81' : '#ff6b35', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: polyOnline ? 'pointer' : 'not-allowed', opacity: !polyOnline ? 0.5 : 1, fontSize: '1rem', transition: '0.2s' }}>
              {polySaved ? 'Saved' : polySaving ? 'Saving...' : 'Save Polymarket Config'}
            </button>
          </div>
        </div>
      )}

      {/* QUANT ENGINE TAB */}
      {tab === 'quant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Status bar */}
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '4px solid #a78bfa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Zap size={20} color="#a78bfa" />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Quant Engine</span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: quantOnline ? '#0ecb81' : '#f6465d' }}>
                  {quantOnline === null ? '● Checking...' : quantOnline ? '● Online — localhost:8002' : '● Offline — localhost:8002'}
                </span>
              </div>
            </div>
            <button onClick={fetchQuantCfg} disabled={quantPinging}
              style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', opacity: quantPinging ? 0.6 : 1 }}>
              <RefreshCw size={13} /> {quantPinging ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          {!quantOnline && (
            <div style={{ padding: '0.9rem 1.2rem', background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.3)', borderRadius: '6px', fontSize: '0.85rem', color: '#f6465d' }}>
              Quant Engine is not running. Start it with: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>cd packages/quant-engine && uvicorn main:app --port 8002 --reload</code>
            </div>
          )}

          {/* Service URLs */}
          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #a78bfa' }}>
            <h2 style={{ color: '#a78bfa', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={22} color="#a78bfa" /> Service Connections
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <Field label="Backend URL" hint="Node.js backend สำหรับ deploy/stop bots">
                <input type="text" style={inputStyle} value={quantCfg.backend_url}
                  onChange={e => setQuantCfg(c => ({ ...c, backend_url: e.target.value }))}
                  disabled={!quantOnline} placeholder="http://localhost:4001" />
              </Field>
              <Field label="Strategy AI URL" hint="Python strategy-ai สำหรับ backtest และ register">
                <input type="text" style={inputStyle} value={quantCfg.strategy_ai_url}
                  onChange={e => setQuantCfg(c => ({ ...c, strategy_ai_url: e.target.value }))}
                  disabled={!quantOnline} placeholder="http://localhost:8000" />
              </Field>
            </div>
          </div>

          {/* ETL Settings */}
          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #13c2c2' }}>
            <h2 style={{ color: '#13c2c2', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={22} color="#13c2c2" /> ETL Pipeline
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <Field label="ETL Symbols" hint="คั่นด้วย comma เช่น BTCUSDT,ETHUSDT,SOLUSDT">
                <input type="text" style={inputStyle} value={quantCfg.etl_symbols}
                  onChange={e => setQuantCfg(c => ({ ...c, etl_symbols: e.target.value }))}
                  disabled={!quantOnline} placeholder="BTCUSDT,ETHUSDT" />
              </Field>
              <Field label="ETL Interval" hint="Kline interval สำหรับ OHLCV data">
                <select style={selectStyle} value={quantCfg.etl_interval}
                  onChange={e => setQuantCfg(c => ({ ...c, etl_interval: e.target.value }))}
                  disabled={!quantOnline}>
                  {['1m','3m','5m','15m','30m','1h','2h','4h','1d'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Decay Settings */}
          <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #f6465d' }}>
            <h2 style={{ color: '#f6465d', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={22} color="#f6465d" /> Alpha Decay Threshold
            </h2>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
              Strategy ที่มี decay score เกินค่านี้จะถูก retire และส่งไป mutate อัตโนมัติ
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <input type="range" min={30} max={95} step={5} style={{ flex: 1 }}
                value={quantCfg.decay_threshold}
                onChange={e => setQuantCfg(c => ({ ...c, decay_threshold: Number(e.target.value) }))}
                disabled={!quantOnline} />
              <span style={{ fontSize: '1.5rem', fontWeight: 700, minWidth: '55px', textAlign: 'center',
                color: quantCfg.decay_threshold >= 80 ? '#0ecb81' : quantCfg.decay_threshold >= 60 ? '#faad14' : '#f6465d' }}>
                {quantCfg.decay_threshold}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#888', minWidth: '80px' }}>
                {quantCfg.decay_threshold >= 80 ? 'Conservative' : quantCfg.decay_threshold >= 60 ? 'Balanced' : 'Aggressive'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
              {[{ label: 'Conservative', value: 80, desc: 'retire เฉพาะ strategy ที่แย่มาก' },
                { label: 'Balanced', value: 70, desc: 'default — สมดุลระหว่าง stability และ evolution' },
                { label: 'Aggressive', value: 50, desc: 'retire เร็ว mutate บ่อย' }].map(p => (
                <button key={p.value} onClick={() => setQuantCfg(c => ({ ...c, decay_threshold: p.value }))}
                  disabled={!quantOnline}
                  style={{ padding: '0.6rem', background: quantCfg.decay_threshold === p.value ? 'rgba(163,139,250,0.15)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${quantCfg.decay_threshold === p.value ? '#a78bfa' : 'var(--border-color)'}`,
                    borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: quantCfg.decay_threshold === p.value ? '#a78bfa' : 'var(--text-main)', marginBottom: '0.2rem' }}>
                    {p.label} ({p.value})
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#666' }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveQuant} disabled={quantSaving || !quantOnline}
              style={{ padding: '1rem 3rem', background: quantSaved ? '#0ecb81' : '#a78bfa', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: quantOnline ? 'pointer' : 'not-allowed', opacity: !quantOnline ? 0.5 : 1, fontSize: '1rem', transition: '0.2s' }}>
              {quantSaved ? '✓ Saved' : quantSaving ? 'Saving...' : 'Save Quant Config'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
