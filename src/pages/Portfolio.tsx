import { useState, useEffect } from 'react';
import {
  Wallet, TrendingUp, ShieldAlert, Cpu, Activity, Settings,
  Layers, Trash2, BrainCircuit, X, Plus, Play, Square,
  ChevronRight, AlertTriangle, Clock, Zap, Bot, RefreshCw
} from 'lucide-react';

const API = '';

const RISK_MODES = [
  { value: 'confident', label: '✨ AI Precision', desc: 'EMA_RSI 15m — Trend following, high winrate' },
  { value: 'scout',     label: '🏹 Trend Scout',  desc: 'AI_SCOUTER 5m — Aggressive scalping' },
  { value: 'grid',      label: '📈 AI Grid Pro',  desc: 'AI_GRID 1h — Range trading, balanced' },
];

const AI_MODELS = [
  { value: '',                                    label: 'Default (System Managed)' },
  { value: 'deepseek/deepseek-chat',              label: '🤖 DeepSeek V3' },
  { value: 'google/gemini-pro-1.5',               label: '♊ Gemini 1.5 Pro' },
  { value: 'anthropic/claude-3.5-sonnet',         label: '🎭 Claude 3.5 Sonnet' },
  { value: 'meta-llama/llama-3.1-405b',           label: '🦙 Llama 3.1 405B' },
];

const RETHINK_INTERVALS = [
  { value: 15,  label: 'Every 15 min (5m candle)' },
  { value: 30,  label: 'Every 30 min (15m candle)' },
  { value: 60,  label: 'Every 1 hour (1h candle)' },
  { value: 240, label: 'Every 4 hours (4h candle)' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = '#fff' }: any) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}

function BotCard({ bot, fleets, onDelete }: any) {
  const pnl = bot.netPnl || 0;
  const isProfit = pnl >= 0;
  const fleetName = fleets.find((f: any) => f.id === bot.managedBy)?.name;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '1rem',
      border: `1px solid ${isProfit ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)'}`,
      display: 'flex', flexDirection: 'column', gap: '0.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 'bold' }}>{bot.symbol}</span>
            {fleetName && (
              <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,209,255,0.15)', color: '#00d1ff', border: '1px solid rgba(0,209,255,0.2)' }}>
                {fleetName}
              </span>
            )}
            {bot.consecutiveLosses >= 2 && (
              <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,77,79,0.15)', color: '#ff4d4f', border: '1px solid rgba(255,77,79,0.2)' }}>
                ⚠️ {bot.consecutiveLosses} SL
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>{bot.strategy} · {bot.interval}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 'bold', color: isProfit ? '#0ecb81' : '#f6465d' }}>
            {isProfit ? '+' : ''}{pnl.toFixed(2)} USDT
          </span>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 0 }} className="hover-loss">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {bot.aiReason && (
        <div style={{ fontSize: '0.72rem', color: '#00d1ff', opacity: 0.7, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
          {bot.aiReason}
        </div>
      )}
    </div>
  );
}

// ─── Create Fleet Modal ───────────────────────────────────────────────────────

function CreateFleetModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => Promise<void> }) {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState(1000);
  const [maxLoss, setMaxLoss] = useState(5);
  const [botCount, setBotCount] = useState(3);
  const [riskMode, setRiskMode] = useState('confident');
  const [aiModel, setAiModel] = useState('');
  const [rethinkInterval, setRethinkInterval] = useState(60);
  const [slLimit, setSlLimit] = useState(3);
  const [reviewHours, setReviewHours] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onCreate({ name: name.trim(), budget, maxLoss, botCount, riskMode, aiModel, rethinkInterval, slLimit, reviewHours });
    setLoading(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1117', border: '1px solid rgba(0,209,255,0.2)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(0,209,255,0.1)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
              <Plus size={20} color="#00d1ff" />
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Create New Fleet</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>ตั้งค่า AI Fleet ใหม่</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}>
            <X size={18} color="#888" />
          </button>
        </div>

        {/* Fleet Name */}
        <Field label="Fleet Name">
          <input autoFocus className="styled-input" style={{ width: '100%' }} placeholder="e.g. Scalp Squad, Grid Masters..." value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Budget (USDT)">
            <input type="number" className="styled-input" style={{ width: '100%' }} value={budget} onChange={e => setBudget(+e.target.value)} />
          </Field>
          <Field label="Max Daily Drawdown (%)">
            <input type="number" className="styled-input" style={{ width: '100%' }} value={maxLoss} onChange={e => setMaxLoss(+e.target.value)} />
          </Field>
          <Field label="Target Bot Count">
            <input type="number" className="styled-input" style={{ width: '100%' }} value={botCount} onChange={e => setBotCount(+e.target.value)} />
          </Field>
          <Field label="Fleet Review Interval">
            <select className="styled-input" style={{ width: '100%' }} value={reviewHours} onChange={e => setReviewHours(+e.target.value)}>
              <option value={1}>Every 1 hour</option>
              <option value={2}>Every 2 hours</option>
              <option value={4}>Every 4 hours</option>
              <option value={6}>Every 6 hours</option>
            </select>
          </Field>
        </div>

        <Field label="AI Scanning Mode">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {RISK_MODES.map(m => (
              <label key={m.value} onClick={() => setRiskMode(m.value)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${riskMode === m.value ? 'rgba(0,209,255,0.4)' : 'rgba(255,255,255,0.06)'}`, background: riskMode === m.value ? 'rgba(0,209,255,0.05)' : 'transparent', transition: 'all 0.15s' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${riskMode === m.value ? '#00d1ff' : '#444'}`, background: riskMode === m.value ? '#00d1ff' : 'transparent', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: riskMode === m.value ? 'bold' : 'normal' }}>{m.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#666' }}>{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="AI Brain (Model)">
            <select className="styled-input" style={{ width: '100%' }} value={aiModel} onChange={e => setAiModel(e.target.value)}>
              {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="AI Re-think Interval">
            <select className="styled-input" style={{ width: '100%' }} value={rethinkInterval} onChange={e => setRethinkInterval(+e.target.value)}>
              {RETHINK_INTERVALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label={`Bot Replacement Threshold (consecutive SL hits)`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input type="range" min={1} max={10} value={slLimit} onChange={e => setSlLimit(+e.target.value)} style={{ flex: 1 }} />
            <span style={{ minWidth: '60px', textAlign: 'center', fontWeight: 'bold', color: slLimit <= 3 ? '#f6465d' : slLimit <= 5 ? '#faad14' : '#0ecb81' }}>
              {slLimit} SL hits
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '0.25rem' }}>Bot จะถูกแทนที่เมื่อ SL ติดกัน {slLimit} ครั้ง</div>
        </Field>

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <button onClick={onClose} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSubmit} className="btn-primary" style={{ flex: 2 }} disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : '🚀 Create Fleet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.78rem', color: '#888' }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Fleet Settings Panel ─────────────────────────────────────────────────────

function FleetSettingsPanel({ fleet, onSave, onClose }: any) {
  const cfg = fleet.config || {};
  const [budget, setBudget] = useState(cfg.totalBudget ?? 1000);
  const [maxLoss, setMaxLoss] = useState(cfg.maxDailyLossPct ?? 5);
  const [botCount, setBotCount] = useState(cfg.targetBotCount ?? 3);
  const [riskMode, setRiskMode] = useState(cfg.riskMode ?? 'confident');
  const [aiModel, setAiModel] = useState(cfg.aiModel ?? '');
  const [rethinkInterval, setRethinkInterval] = useState(cfg.aiRethinkInterval ?? 60);
  const [slLimit, setSlLimit] = useState(cfg.consecutiveSLLimit ?? 3);
  const [reviewHours, setReviewHours] = useState(cfg.reviewIntervalHours ?? 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ totalBudget: budget, maxDailyLossPct: maxLoss, targetBotCount: botCount, riskMode, aiModel, aiRethinkInterval: rethinkInterval, consecutiveSLLimit: slLimit, reviewIntervalHours: reviewHours });
    setSaving(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings size={20} color="var(--accent-primary)" />
            <div>
              <div style={{ fontWeight: 'bold' }}>Fleet Settings</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{fleet.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}>
            <X size={18} color="#888" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Budget (USDT)"><input type="number" className="styled-input" style={{ width: '100%' }} value={budget} onChange={e => setBudget(+e.target.value)} /></Field>
          <Field label="Max Daily Drawdown (%)"><input type="number" className="styled-input" style={{ width: '100%' }} value={maxLoss} onChange={e => setMaxLoss(+e.target.value)} /></Field>
          <Field label="Target Bot Count"><input type="number" className="styled-input" style={{ width: '100%' }} value={botCount} onChange={e => setBotCount(+e.target.value)} /></Field>
          <Field label="Fleet Review Interval">
            <select className="styled-input" style={{ width: '100%' }} value={reviewHours} onChange={e => setReviewHours(+e.target.value)}>
              <option value={1}>Every 1 hour</option>
              <option value={2}>Every 2 hours</option>
              <option value={4}>Every 4 hours</option>
              <option value={6}>Every 6 hours</option>
            </select>
          </Field>
        </div>

        <Field label="AI Scanning Mode">
          <select className="styled-input" style={{ width: '100%' }} value={riskMode} onChange={e => setRiskMode(e.target.value)}>
            {RISK_MODES.map(m => <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>)}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="AI Brain (Model)">
            <select className="styled-input" style={{ width: '100%' }} value={aiModel} onChange={e => setAiModel(e.target.value)}>
              {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="AI Re-think Interval">
            <select className="styled-input" style={{ width: '100%' }} value={rethinkInterval} onChange={e => setRethinkInterval(+e.target.value)}>
              {RETHINK_INTERVALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label={`Bot Replacement Threshold`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input type="range" min={1} max={10} value={slLimit} onChange={e => setSlLimit(+e.target.value)} style={{ flex: 1 }} />
            <span style={{ minWidth: '60px', textAlign: 'center', fontWeight: 'bold', color: slLimit <= 3 ? '#f6465d' : slLimit <= 5 ? '#faad14' : '#0ecb81' }}>{slLimit} SL hits</span>
          </div>
        </Field>

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <button onClick={onClose} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const [fleets, setFleets] = useState<any[]>([]);
  const [bots, setBots] = useState<any[]>([]);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsFor, setShowSettingsFor] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'bots' | 'logs' | 'memory'>('bots');
  const [reviewingFleet, setReviewingFleet] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [resFleets, resBots, resMistakes] = await Promise.all([
        fetch(`${API}/api/portfolio/fleets`),
        fetch(`${API}/api/bots/summary`),
        fetch(`${API}/api/binance/mistakes`),
      ]);
      const fleetsData = await resFleets.json();
      const botsData = await resBots.json();
      const mistakesData = await resMistakes.json();

      // Enrich selected fleet with logs
      let enriched = [...fleetsData];
      if (selectedFleetId) {
        try {
          const res = await fetch(`${API}/api/portfolio/fleets/${selectedFleetId}/status`);
          const status = await res.json();
          enriched = fleetsData.map((f: any) => f.id === selectedFleetId ? { ...f, ...status } : f);
        } catch {}
      }

      setFleets(enriched);
      setBots(botsData.filter((b: any) => b.isRunning));
      setMistakes(mistakesData);

      if (!selectedFleetId && enriched.length > 0) setSelectedFleetId(enriched[0].id);
    } catch (e) {
      console.error('fetchData error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [selectedFleetId]);

  const handleCreateFleet = async ({ name, budget, maxLoss, botCount, riskMode, aiModel, rethinkInterval, slLimit, reviewHours }: any) => {
    const res = await fetch(`${API}/api/portfolio/fleets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        config: {
          totalBudget: budget, maxDailyLossPct: maxLoss, targetBotCount: botCount,
          riskMode, aiModel, aiRethinkInterval: rethinkInterval,
          consecutiveSLLimit: slLimit, reviewIntervalHours: reviewHours,
        },
      }),
    });
    const data = await res.json();
    setShowCreateModal(false);
    await fetchData();
    if (data.fleet?.id) setSelectedFleetId(data.fleet.id);
  };

  const handleSaveSettings = async (fleetId: string, config: any) => {
    await fetch(`${API}/api/portfolio/fleets/${fleetId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    await fetchData();
  };

  const handleToggle = async (fleetId: string, active: boolean) => {
    await fetch(`${API}/api/portfolio/fleets/${fleetId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAutonomous: active }),
    });
    await fetch(`${API}/api/portfolio/fleets/${fleetId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    fetchData();
  };

  const handleForceReview = async (fleetId: string) => {
    setReviewingFleet(fleetId);
    try {
      const res = await fetch(`${API}/api/portfolio/fleets/${fleetId}/review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      await fetchData();
    } catch (e: any) {
      alert('Force Review Error: ' + e.message);
    } finally {
      setReviewingFleet(null);
    }
  };

  const handleDeleteFleet = async (id: string, name: string) => {
    if (!window.confirm(`Delete fleet "${name}"? All associated bots will stop.`)) return;
    await fetch(`${API}/api/portfolio/fleets/${id}`, { method: 'DELETE' });
    if (selectedFleetId === id) setSelectedFleetId(null);
    fetchData();
  };

  const handleDeleteBot = async (botId: string) => {
    await fetch(`${API}/api/bots/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    fetchData();
  };

  if (loading) return <div className="p-8 text-muted animate-pulse">Initializing AI Portfolio Command...</div>;

  const currentFleet = fleets.find(f => f.id === selectedFleetId) || fleets[0] || null;
  const fleetBots = bots.filter(b =>
    currentFleet && (
      b.managedBy === currentFleet.id ||
      (currentFleet.id === 'portfolio1' && (!b.managedBy || b.managedBy === 'auto-pilot' || b.managedBy === 'portfolio1'))
    )
  );
  const manualBots = bots.filter(b => !fleets.some(f => f.id === b.managedBy) && b.managedBy !== 'auto-pilot' && b.managedBy !== 'portfolio1');
  const fleetPnl = fleetBots.reduce((s, b) => s + (b.netPnl || 0), 0);
  const fleetBudget = currentFleet?.config?.totalBudget || 1000;
  const pnlPct = (fleetPnl / fleetBudget) * 100;
  const isAuto = currentFleet?.config?.isAutonomous;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Modals */}
      {showCreateModal && <CreateFleetModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateFleet} />}
      {showSettingsFor && (
        <FleetSettingsPanel
          fleet={showSettingsFor}
          onSave={(cfg: any) => handleSaveSettings(showSettingsFor.id, cfg)}
          onClose={() => setShowSettingsFor(null)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>AI Portfolio Command</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#555' }}>Manage autonomous trading fleets</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> New Fleet
        </button>
      </div>

      {/* ── Fleet Tabs ──────────────────────────────────────────────────────── */}
      {fleets.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Cpu size={48} color="#333" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: '#555' }}>No Fleets Yet</h3>
          <p style={{ color: '#444' }}>Create your first AI fleet to start autonomous trading</p>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>Create First Fleet</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {fleets.map(f => {
              const fBots = bots.filter(b => b.managedBy === f.id || (f.id === 'portfolio1' && (!b.managedBy || b.managedBy === 'auto-pilot')));
              const fPnl = fBots.reduce((s, b) => s + (b.netPnl || 0), 0);
              const fBudget = f.config?.totalBudget || 1000;
              const fPnlPct = (fPnl / fBudget) * 100;
              const fEquity = fBudget + fPnl;
              const fTotalTrades = fBots.reduce((s, b) => s + (b.totalTrades || 0), 0);
              const fWins = fBots.reduce((s, b) => s + (b.winCount || 0), 0);
              const fWinRate = fTotalTrades > 0 ? (fWins / fTotalTrades) * 100 : 0;
              const isSelected = selectedFleetId === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFleetId(f.id)}
                  style={{
                    flexShrink: 0, minWidth: '220px', padding: '1rem', borderRadius: '12px', cursor: 'pointer',
                    border: `1px solid ${isSelected ? 'rgba(0,209,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    background: isSelected ? 'rgba(0,209,255,0.05)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f.config?.isAutonomous ? '#0ecb81' : '#444', flexShrink: 0 }} />
                      <span style={{ fontWeight: isSelected ? 'bold' : 'normal', fontSize: '0.9rem' }}>{f.name}</span>
                    </div>
                    {f.id !== 'portfolio1' && (
                      <button onClick={e => { e.stopPropagation(); handleDeleteFleet(f.id, f.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.3, padding: 0 }} className="hover-loss">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>{fBots.length} bots · {f.config?.riskMode || 'confident'}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: fPnl >= 0 ? '#0ecb81' : '#f6465d', marginTop: '0.25rem' }}>
                    {fPnl >= 0 ? '+' : ''}{fPnl.toFixed(2)} USDT
                    <span style={{ fontSize: '0.72rem', marginLeft: '0.3rem', opacity: 0.8 }}>({fPnlPct >= 0 ? '+' : ''}{fPnlPct.toFixed(2)}%)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '0.6rem', color: '#555' }}>EQUITY</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#fff' }}>${fEquity.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6rem', color: '#555' }}>WIN RATE</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: fWinRate >= 50 ? '#0ecb81' : '#f6465d' }}>
                        {fTotalTrades > 0 ? `${fWinRate.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Fleet Detail ──────────────────────────────────────────────── */}
          {currentFleet && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>

              {/* Left: Main content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Fleet Header Card */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h3 style={{ margin: 0 }}>{currentFleet.name}</h3>
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: isAuto ? 'rgba(14,203,129,0.15)' : 'rgba(255,255,255,0.05)', color: isAuto ? '#0ecb81' : '#666', border: `1px solid ${isAuto ? 'rgba(14,203,129,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                          {isAuto ? '● AUTO-PILOT' : '○ MANUAL'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '0.25rem' }}>
                        {RISK_MODES.find(m => m.value === currentFleet.config?.riskMode)?.label || 'AI Precision'} · Review every {currentFleet.config?.reviewIntervalHours || 1}h · Replace after {currentFleet.config?.consecutiveSLLimit || 3} SL
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setShowSettingsFor(currentFleet)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        <Settings size={14} /> Settings
                      </button>
                      {isAuto && (
                        <button
                          onClick={() => handleForceReview(currentFleet.id)}
                          disabled={reviewingFleet === currentFleet.id}
                          className="btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderColor: 'rgba(250,173,20,0.4)', color: '#faad14', opacity: reviewingFleet === currentFleet.id ? 0.5 : 1 }}
                        >
                          <RefreshCw size={14} style={{ animation: reviewingFleet === currentFleet.id ? 'spin 1s linear infinite' : 'none' }} />
                          {reviewingFleet === currentFleet.id ? 'Reviewing...' : 'Force Review'}
                        </button>
                      )}
                      <button
                        onClick={() => handleToggle(currentFleet.id, !isAuto)}
                        className={isAuto ? 'btn-danger' : 'btn-primary'}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                      >
                        {isAuto ? <><Square size={14} /> Stop</> : <><Play size={14} /> Start Auto-Pilot</>}
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <StatCard label="Fleet PnL" value={`${fleetPnl >= 0 ? '+' : ''}${fleetPnl.toFixed(2)}`} sub="USDT" color={fleetPnl >= 0 ? '#0ecb81' : '#f6465d'} />
                    <StatCard label="Return" value={`${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`} sub={`of $${fleetBudget}`} color={pnlPct >= 0 ? '#0ecb81' : '#f6465d'} />
                    <StatCard label="Active Bots" value={`${fleetBots.length} / ${currentFleet.config?.targetBotCount || 3}`} sub="running" />
                    <StatCard label="Status" value={currentFleet.isRunning ? 'Active' : 'Idle'} sub={currentFleet.currentAction || '—'} color={currentFleet.isRunning ? '#00d1ff' : '#555'} />
                  </div>
                </div>

                {/* Tabs */}
                <div>
                  <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem' }}>
                    {(['bots', 'logs', 'memory'] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#00d1ff' : 'transparent'}`, color: activeTab === tab ? '#00d1ff' : '#555', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem', textTransform: 'capitalize', transition: 'all 0.15s', marginBottom: '-1px' }}>
                        {tab === 'bots' ? `Fleet Bots (${fleetBots.length})` : tab === 'logs' ? 'Activity Log' : 'AI Memory'}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'bots' && (
                    <div>
                      {fleetBots.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#444', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                          <Bot size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
                          <div>No bots assigned to this fleet yet.</div>
                          {isAuto && <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#555' }}>Auto-Pilot will recruit bots shortly...</div>}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                          {fleetBots.map(bot => (
                            <BotCard key={bot.id} bot={bot} fleets={fleets} onDelete={() => handleDeleteBot(bot.id)} />
                          ))}
                        </div>
                      )}

                      {manualBots.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={13} /> Manual / Unassigned Bots
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                            {manualBots.map(bot => (
                              <BotCard key={bot.id} bot={bot} fleets={fleets} onDelete={() => handleDeleteBot(bot.id)} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'logs' && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', maxHeight: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(currentFleet.logs || []).length === 0 ? (
                        <div style={{ color: '#444', fontStyle: 'italic' }}>No activity recorded yet.</div>
                      ) : (currentFleet.logs || []).map((log: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.3rem' }}>
                          <span style={{ color: '#00d1ff', opacity: 0.6, minWidth: '140px', fontSize: '0.72rem' }}>{log.timestamp}</span>
                          <span style={{ color: log.type === 'warn' ? '#faad14' : log.type === 'error' ? '#f6465d' : '#aaa', wordBreak: 'break-word' }}>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'memory' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                      {mistakes.length === 0 ? (
                        <div style={{ color: '#444', fontStyle: 'italic', padding: '2rem' }}>No AI lessons recorded yet.</div>
                      ) : mistakes.map((m: any, i: number) => (
                        <div key={i} style={{ background: 'rgba(250,173,20,0.03)', border: '1px solid rgba(250,173,20,0.1)', borderRadius: '10px', padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold', color: '#faad14' }}>{m.symbol}</span>
                            <span style={{ fontSize: '0.75rem', color: '#f6465d' }}>PnL: ${m.pnl?.toFixed(2)}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.4rem' }}>{m.strategy} · {m.recordedAt?.slice(0, 10)}</div>
                          <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{m.aiLesson || 'Analyzing...'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Config Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '1rem' }}>Fleet Configuration</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { icon: <Wallet size={14} />, label: 'Budget', value: `$${currentFleet.config?.totalBudget?.toLocaleString() || 0} USDT` },
                      { icon: <ShieldAlert size={14} />, label: 'Max Drawdown', value: `${currentFleet.config?.maxDailyLossPct || 5}%` },
                      { icon: <Layers size={14} />, label: 'Target Bots', value: `${currentFleet.config?.targetBotCount || 3}` },
                      { icon: <Zap size={14} />, label: 'AI Mode', value: RISK_MODES.find(m => m.value === currentFleet.config?.riskMode)?.label || '—' },
                      { icon: <BrainCircuit size={14} />, label: 'AI Brain', value: AI_MODELS.find(m => m.value === (currentFleet.config?.aiModel || ''))?.label || 'Default' },
                      { icon: <RefreshCw size={14} />, label: 'Re-think', value: RETHINK_INTERVALS.find(r => r.value === currentFleet.config?.aiRethinkInterval)?.label || 'Every 1 hour' },
                      { icon: <Clock size={14} />, label: 'Review Every', value: `${currentFleet.config?.reviewIntervalHours || 1}h` },
                      { icon: <AlertTriangle size={14} />, label: 'Replace After', value: `${currentFleet.config?.consecutiveSLLimit || 3} SL hits` },
                    ].map(({ icon, label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#666' }}>{icon} {label}</span>
                        <span style={{ color: '#ccc', fontWeight: '500' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowSettingsFor(currentFleet)} className="btn-outline" style={{ width: '100%', marginTop: '1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <Settings size={13} /> Edit Settings
                  </button>
                </div>

                {isAuto && (
                  <div style={{ background: 'rgba(14,203,129,0.05)', border: '1px solid rgba(14,203,129,0.15)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0ecb81', fontSize: '0.82rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      <Activity size={14} /> Auto-Pilot Active
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#555' }}>
                      {currentFleet.currentAction || 'Monitoring fleet...'}
                    </div>
                  </div>
                )}

                {!isAuto && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                    <ChevronRight size={20} color="#333" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.8rem', color: '#444' }}>Start Auto-Pilot to let AI manage this fleet autonomously</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
