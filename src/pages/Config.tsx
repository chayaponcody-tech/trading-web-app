import { useState, useEffect } from 'react';
import { Settings, Shield, Cpu, Key, Brain, TrendingUp, Activity } from 'lucide-react';

const API = '';
const POLY_API = 'http://localhost:8080';

const POLY_MODELS = [
  { value: '', label: 'Default (config.py)' },
  { value: 'google/gemini-3-flash-preview', label: '🔮 Gemini 3 Flash Preview' },
  { value: 'google/gemini-flash-1.5', label: '⚡ Gemini Flash 1.5 (Fast)' },
  { value: 'google/gemini-pro-1.5', label: '♊ Gemini Pro 1.5' },
  { value: 'anthropic/claude-3.5-sonnet', label: '🎭 Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-haiku', label: '🪶 Claude 3 Haiku (Fast)' },
  { value: 'deepseek/deepseek-chat', label: '🤖 DeepSeek V3' },
  { value: 'meta-llama/llama-3.1-405b', label: '🦙 Llama 3.1 405B' },
];

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
  const [tab, setTab] = useState<'crypto' | 'polymarket'>('crypto');

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
        {([['crypto', '🟡 Crypto / Binance'], ['polymarket', '🟠 Polymarket']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
            background: tab === t ? (t === 'crypto' ? 'rgba(250,173,20,0.2)' : 'rgba(255,107,53,0.2)') : 'transparent',
            color: tab === t ? (t === 'crypto' ? '#faad14' : '#ff6b35') : '#666',
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
                    <option value="qwen/qwen3.5-flash-02-23">Qwen 3.5 Flash</option>
                    <option value="minimax/minimax-m2.5">MiniMax M2.5</option>
                    <option value="google/gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                    <option value="deepseek/deepseek-v3.2">DeepSeek V3.2</option>
                    <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
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
                  {POLY_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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
    </div>
  );
}
