import { useState, useEffect, useCallback } from 'react';
import { 
  Brain, Activity, TrendingUp, TrendingDown, AlertTriangle, 
  RefreshCw, Zap, Clock, GitBranch, Play,
  Plus, Trash2, Globe, Database, Rss, Shield, Check, X, ExternalLink, Search,
  Eye, List, Settings, Save, ChevronRight, Info, Layers, Cloud, Link as LinkIcon,
  Calendar, Sparkles, Cpu
} from 'lucide-react';
import { AI_MODELS } from '../constants/aiModels';

const QUANT_URL = '/api/quant';

interface AgentStatus {
  name: string;
  state: 'idle' | 'running' | 'error' | 'timeout';
  last_run?: string;
  last_error?: string;
}

interface ResearchSource {
  id: number;
  name: string;
  type: 'scraper' | 'api' | 'rss';
  url: string;
  enabled: boolean;
  last_scanned: string | null;
  config: any;
}

interface ScoutFinding {
  title: string;
  link: string;
  description: string;
  timestamp?: string;
  ai_summary?: string;
  alpha_potential?: string;
  is_from_db?: boolean;
}

const STATE_COLOR: Record<string, string> = {
  idle: 'var(--text-muted)',
  running: '#faad14',
  error: 'var(--loss-color)',
  timeout: '#ff7875',
};

const TYPE_COLORS = {
  scraper: { bg: 'rgba(0, 209, 255, 0.12)', text: '#00d1ff', icon: Globe },
  api: { bg: 'rgba(187, 107, 217, 0.12)', text: '#d683ed', icon: Database },
  rss: { bg: 'rgba(255, 122, 0, 0.12)', text: '#ff9c45', icon: Rss },
};

function AgentCard({ name, status, QUANT_URL, onRefresh }: { name: string; status: AgentStatus | undefined; QUANT_URL: string; onRefresh: () => void }) {
  const [isTriggering, setIsTriggering] = useState(false);
  const triggerAgent = async () => {
    setIsTriggering(true);
    try {
      const slug = name.toLowerCase().replace(' ', '_');
      await fetch(`${QUANT_URL}/loop/agents/${slug}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setTimeout(onRefresh, 1000);
    } catch (err) { console.error(err); } finally { setIsTriggering(false); }
  };
  const state = status?.state ?? 'idle';
  const color = STATE_COLOR[state] ?? 'var(--text-muted)';
  const lastRun = status?.last_run ? new Date(status.last_run).toLocaleTimeString() : '—';
  const canTrigger = ['scout_agent', 'sentiment_agent', 'data_agent'].includes(name.toLowerCase().replace(' ', '_'));

  return (
    <div className="glass-panel" style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: state === 'running' ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>{name.replace('_', ' ')}</span>
        <span style={{ fontSize: '0.75rem', color, fontWeight: 600, textTransform: 'uppercase' }}>● {state}</span>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Last run: {lastRun}</div>
      {canTrigger && (
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
          <button className="btn-outline" onClick={(e) => { e.stopPropagation(); triggerAgent(); }} disabled={isTriggering || state === 'running'} style={{ flex: 1, fontSize: '0.65rem' }}>
            {isTriggering ? '...' : <><Play size={10} /> Trigger</>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuantEngine() {
  const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'scout'>('overview');
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [inspectMode, setInspectMode] = useState<'config' | 'preview'>('config');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [editUrl, setEditUrl] = useState('');
  const [editConfig, setEditConfig] = useState<any>({});
  const [scrapedFindings, setScrapedFindings] = useState<ScoutFinding[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isCycleTriggering, setIsCycleTriggering] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', type: 'scraper', url: '' });

  // Agent Settings (LLM)
  const [agentModel, setAgentModel] = useState<string>('anthropic/claude-3-haiku');

  // AI Summary States
  const [itemSummaries, setItemSummaries] = useState<Record<string, string>>({});
  const [isSummarizing, setIsSummarizing] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [archivedLinks, setArchivedLinks] = useState<Set<string>>(new Set());
  const [previewFinding, setPreviewFinding] = useState<ScoutFinding | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const healthRes = await fetch(`${QUANT_URL}/health`);
      setIsOnline(healthRes.ok);
      if (!healthRes.ok) return;
      const [statusRes, sourcesRes, settingsRes] = await Promise.all([
        fetch(`${QUANT_URL}/status`),
        fetch(`${QUANT_URL}/loop/research-sources`),
        fetch(`${QUANT_URL}/loop/agents/scout_agent/settings`),
      ]);
      if (statusRes.ok) setAgentStatuses((await statusRes.json()).agents ?? {});
      if (sourcesRes.ok) setResearchSources(await sourcesRes.json());
      if (settingsRes.ok) setAgentModel((await settingsRes.json()).model);
    } catch { setIsOnline(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const updateAgentModel = async (model: string) => {
    setAgentModel(model);
    try {
      await fetch(`${QUANT_URL}/loop/agents/scout_agent/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: model }),
      });
    } catch (err) { console.error(err); }
  };

  const handleInspect = (id: number, mode: 'config' | 'preview') => {
    const source = researchSources.find(s => s.id === id);
    if (!source) return;
    setSelectedSourceId(id);
    setInspectMode(mode);
    setEditUrl(source.url);
    setEditConfig(source.config || {});
    setShowAddForm(false);
    if (mode === 'preview') {
      triggerPreview(id);
      setPreviewFinding(null); // Reset preview when switching sources
    }
  };

  const triggerPreview = async (id: number) => {
    setIsActionLoading(true);
    setScrapedFindings([]);
    try {
      const res = await fetch(`${QUANT_URL}/loop/agents/scout_agent_scrape/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: id }),
      });
      if (res.ok) {
          const data = await res.json();
          setScrapedFindings(data.findings || []);
          // Sync summaries from DB findings
          const dbSummaries: Record<string, string> = {};
          data.findings.forEach((f: ScoutFinding) => {
            if (f.ai_summary) dbSummaries[f.link] = f.ai_summary;
          });
          setItemSummaries(prev => ({ ...prev, ...dbSummaries }));
      }
    } finally { setIsActionLoading(false); }
  };

  const summarizeFinding = async (item: ScoutFinding, force: boolean = false) => {
    if (isSummarizing) return;
    setIsSummarizing(item.link);
    try {
      const res = await fetch(`${QUANT_URL}/loop/research/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: item.link, force }),
      });
      if (res.ok) {
        const data = await res.json();
        setItemSummaries(prev => ({ ...prev, [item.link]: data.summary }));
        if (force) {
          setArchivedLinks(prev => {
            const next = new Set(prev);
            next.delete(item.link);
            return next;
          });
        }
      }
    } finally { setIsSummarizing(null); }
  };

  const archiveToBrain = async (item: ScoutFinding) => {
    if (isArchiving) return;
    setIsArchiving(item.link);
    try {
      const res = await fetch(`${QUANT_URL}/loop/research/save-to-brain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: item.link }),
      });
      if (res.ok) {
        setArchivedLinks(prev => {
          const next = new Set(prev);
          next.add(item.link);
          return next;
        });
      }
    } catch (err) { console.error(err); } finally { setIsArchiving(null); }
  };

  const saveSourceConfig = async () => {
    if (!selectedSourceId) return;
    setIsActionLoading(true);
    try {
      await fetch(`${QUANT_URL}/loop/research-sources/${selectedSourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editUrl, config: editConfig }),
      });
      await fetchAll();
      alert('Updated');
    } finally { setIsActionLoading(false); }
  };

  const toggleSource = async (id: number, current: boolean) => {
    await fetch(`${QUANT_URL}/loop/research-sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !current }),
    });
    fetchAll();
  };

  const addNewSource = async () => {
    if (!newSource.name || !newSource.url) return;
    await fetch(`${QUANT_URL}/loop/research-sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSource, config: {} }),
    });
    setNewSource({ name: '', type: 'scraper', url: '' });
    setShowAddForm(false);
    fetchAll();
  };

  const deleteSource = async (id: number) => {
    if (confirm('Delete?')) {
      await fetch(`${QUANT_URL}/loop/research-sources/${id}`, { method: 'DELETE' });
      setSelectedSourceId(null);
      fetchAll();
    }
  };

  const triggerCycle = async () => {
    setIsCycleTriggering(true);
    try {
      await fetch(`${QUANT_URL}/loop/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'auto' }),
      });
      setTimeout(fetchAll, 2000);
    } finally { setIsCycleTriggering(false); }
  };

  const formatTs = (ts?: string) => {
    if (!ts) return '';
    try {
       const d = new Date(ts);
       return d.toLocaleString('th-TH', { 
         day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
         timeZone: 'Asia/Bangkok'
       });
    } catch { return ts; }
  };

  const inputStyle: React.CSSProperties = {
    textAlign: 'left', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#ffffff', padding: '0.75rem', borderRadius: '10px', width: '100%', outline: 'none', fontSize: '0.9rem'
  };

  const selectedSource = researchSources.find(s => s.id === selectedSourceId);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#f0f0f0', minHeight: '85vh' }}>
      
      {/* 🔵 HEADER */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Brain size={24} color="var(--accent-primary)" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Quant Intelligence Hub</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: isOnline ? '#22c55e' : '#ef4444' }}>
              ● {isOnline ? 'System Online' : 'System Offline'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
           <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
             {['overview', 'strategies', 'scout'].map(t => (
               <button key={t} onClick={() => setActiveTab(t as any)} 
                 style={{ 
                   background: activeTab === t ? 'rgba(0,122,255,0.2)' : 'transparent',
                   border: 'none', color: activeTab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                   padding: '0.5rem 1.2rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                   fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase'
                 }}>{t}</button>
             ))}
           </div>
           <button className="btn-primary" onClick={triggerCycle} disabled={isCycleTriggering}>
            <Zap size={14} /> {isCycleTriggering ? 'Running...' : 'Cycle'}
          </button>
        </div>
      </div>

      {activeTab === 'scout' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
           
           <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Cpu size={18} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>RESEARCH LLM:</span>
                  <select 
                    value={agentModel} 
                    onChange={e => updateAgentModel(e.target.value)}
                    style={{ 
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', borderRadius: '8px', padding: '0.4rem 1rem', fontSize: '0.8rem', outline: 'none'
                     }}>
                     {AI_MODELS.map(m => (
                       <option key={m.value} value={m.value} style={{ background: '#1a1a1a' }}>{m.label}</option>
                     ))}
                  </select>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                 Select the brain for scout intelligence and synthesis
              </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                   <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{researchSources.length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Pipelines</div>
                   </div>
                   <div className="glass-panel" style={{ padding: '1rem', color: '#22c55e', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{researchSources.filter(s=>s.enabled).length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Active</div>
                   </div>
                   <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{scrapedFindings.length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Current Findings</div>
                   </div>
                   <button className="btn-primary" onClick={() => { setShowAddForm(true); setSelectedSourceId(null); setPreviewFinding(null); }} style={{ height: '100%', borderRadius: '16px' }}>
                      <Plus size={18} /> Provision Source
                   </button>
                </div>

                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                   {researchSources.map(s => {
                     const Config = TYPE_COLORS[s.type as keyof typeof TYPE_COLORS] || TYPE_COLORS.scraper;
                     const Icon = Config.icon;
                     const isActive = selectedSourceId === s.id;
                     return (
                       <div key={s.id} onClick={() => { handleInspect(s.id, 'preview'); setInspectMode('preview'); setPreviewFinding(null); }}
                         className="glass-panel"
                         style={{ 
                           display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem',
                           background: isActive ? 'rgba(0,122,255,0.1)' : 'rgba(255,255,255,0.02)',
                           borderRadius: '12px', border: isActive ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)',
                           cursor: 'pointer', minWidth: '240px', transition: 'all 0.2s'
                         }}>
                         <div style={{ width: '32px', height: '32px', background: Config.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: Config.text }}>
                            <Icon size={16} />
                         </div>
                         <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.type}</div>
                         </div>
                         <div onClick={e => { e.stopPropagation(); handleInspect(s.id, 'config'); setInspectMode('config'); setPreviewFinding(null); }} style={{ opacity: 0.4, cursor: 'pointer' }}>
                            <Settings size={14} />
                         </div>
                       </div>
                     );
                   })}
                </div>
              </div>

              <div className="glass-panel" style={{ 
                flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', 
                minHeight: '500px', position: 'relative', overflow: 'hidden' 
              }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                       <List size={20} color="var(--accent-primary)" />
                       <h3 style={{ margin: 0 }}>Scout Discovery Feed</h3>
                    </div>
                    {selectedSource && (
                       <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button className="btn-outline" onClick={() => triggerPreview(selectedSource.id)} disabled={isActionLoading}>
                             <RefreshCw size={14} className={isActionLoading ? 'spin' : ''} /> Refresh {selectedSource.name}
                          </button>
                          <button className="btn-outline" onClick={() => setSelectedSourceId(null)}><X size={14} /> Clear</button>
                       </div>
                    )}
                 </div>

                 {showAddForm ? (
                    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                       <h4>Provision New Pipeline</h4>
                       <input type="text" placeholder="Category Name" value={newSource.name} onChange={e=>setNewSource({...newSource, name: e.target.value})} style={inputStyle} />
                       <select value={newSource.type} onChange={e=>setNewSource({...newSource, type: e.target.value as any})} style={{ ...inputStyle, cursor: 'pointer' }}>
                          <option value="scraper" style={{ background: '#1a1a1a' }}>Scraper Engine</option>
                          <option value="api" style={{ background: '#1a1a1a' }}>API / AI Search</option>
                          <option value="rss" style={{ background: '#1a1a1a' }}>RSS / Atom</option>
                       </select>
                       <input type="text" placeholder="Endpoint URL" value={newSource.url} onChange={e=>setNewSource({...newSource, url: e.target.value})} style={inputStyle} />
                       <button className="btn-primary" onClick={addNewSource} style={{ padding: '0.8rem', borderRadius: '12px' }}>Initialize Pipeline</button>
                       <button className="btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
                    </div>
                 ) : selectedSource && inspectMode === 'config' ? (
                    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                       <h4>Pipe Configuration: {selectedSource.name}</h4>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Target URL</label>
                          <input type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)} style={inputStyle} />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Object Limit</label>
                          <input type="number" value={editConfig.limit || editConfig.max_results || 10} onChange={e => setEditConfig({...editConfig, limit: parseInt(e.target.value), max_results: parseInt(e.target.value)})} style={inputStyle} />
                       </div>
                       <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                          <button className="btn-outline" onClick={() => toggleSource(selectedSource.id, selectedSource.enabled)} style={{ flex: 1 }}>
                             {selectedSource.enabled ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn-primary" onClick={saveSourceConfig} disabled={isActionLoading} style={{ flex: 2 }}>Apply Config</button>
                       </div>
                       <button className="btn-text" onClick={() => deleteSource(selectedSource.id)} style={{ color: '#ef4444', marginTop: '2rem' }}>Terminate Pipeline</button>
                    </div>
                 ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', width: '100%' }}>
                       {isActionLoading ? (
                          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem' }}>
                             <RefreshCw className="spin" size={32} color="var(--accent-primary)" />
                             <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Scanning latest alpha ideas...</p>
                          </div>
                       ) : scrapedFindings.length > 0 ? (
                          scrapedFindings.map((f, i) => (
                             <div key={i} className="glass-panel" 
                                style={{ 
                                  padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', 
                                  display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)',
                                }}
                                onClick={() => setPreviewFinding(f)}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{f.title}</div>
                                      {f.is_from_db && (
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ color: 'var(--accent-secondary)', background: 'rgba(14,203,129,0.1)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600 }}>DATABASE</span>
                                            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>{formatTs(f.timestamp)}</span>
                                         </div>
                                      )}
                                   </div>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                   {f.description}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                   <div style={{ display: 'flex', gap: '0.4rem' }}>
                                      {itemSummaries[f.link] && <span style={{ color: 'var(--accent-secondary)', background: 'rgba(14,203,129,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem' }}><Sparkles size={10} /> Analyzed</span>}
                                   </div>
                                   <div style={{ color: 'var(--accent-primary)', fontSize: '0.7rem', fontWeight: 600 }}>Preview <ChevronRight size={12} /></div>
                                </div>
                             </div>
                          ))
                       ) : (
                          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '10rem 2rem', opacity: 0.3 }}>
                             <Globe size={48} style={{ marginBottom: '1.5rem' }} />
                             <h3>No data pipelines active</h3>
                             <p>Select a source to begin scouting</p>
                          </div>
                       )}
                    </div>
                 )}

                 {/* 🔮 LOCALIZED POPUP (Absolute within Feed) */}
                 {previewFinding && (
                    <div className="animate-fade-in" style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(8px)',
                      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '1.5rem'
                    }} onClick={() => setPreviewFinding(null)}>
                       <div className="glass-panel animate-slide-up" style={{
                          width: '100%', maxWidth: '780px', maxHeight: '100%', 
                          display: 'flex', flexDirection: 'column', background: '#0d1117', 
                          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', 
                          overflow: 'hidden', pointerEvents: 'auto', boxShadow: '0 0 30px rgba(0,0,0,0.5)'
                       }} onClick={e => e.stopPropagation()}>
                          {/* Local Header */}
                          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '32px', height: '32px', background: 'rgba(0,209,255,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d1ff' }}>
                                  <Search size={18} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>Finding Insight</h3>
                             </div>
                             <button onClick={() => setPreviewFinding(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '0.35rem', borderRadius: '50%', cursor: 'pointer' }}>
                                <X size={16} />
                             </button>
                          </div>
                          {/* Body */}
                          <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#fff' }}>{previewFinding.title}</h2>
                                <div style={{ display: 'flex', gap: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                                   <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={12} /> {formatTs(previewFinding.timestamp)}</span>
                                   <a href={previewFinding.link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Source <ExternalLink size={10} /></a>
                                </div>
                             </div>
                             <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                {previewFinding.description}
                             </div>
                             {itemSummaries[previewFinding.link] ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <h4 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                         <Sparkles size={16} /> AI Quantitative Insight
                                      </h4>
                                      <button className="btn-text" onClick={() => summarizeFinding(previewFinding!, true)} disabled={isSummarizing === previewFinding.link} style={{ padding: 0, fontSize: '0.65rem' }}>
                                         <RefreshCw size={10} className={isSummarizing === previewFinding.link ? 'spin' : ''} /> {isSummarizing === previewFinding.link ? 'ANALYZING...' : 'RE-ANALYZE'}
                                      </button>
                                   </div>

                                   {/* 📊 SCORES DASHBOARD */}
                                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                       {(() => {
                                          const text = itemSummaries[previewFinding.link];
                                          const featMatch = text.match(/Implementation Feasibility.*?(\d+)/i);
                                          const alphaMatch = text.match(/Alpha Potential.*?(\d+)/i);
                                          const featScore = featMatch ? parseInt(featMatch[1]) : 0;
                                          const alphaScore = alphaMatch ? parseInt(alphaMatch[1]) : 0;
                                          
                                          const getScoreColor = (s: number) => s > 75 ? '#0ecb81' : s > 45 ? '#f0b90b' : '#f6465d';
                                          
                                          return (
                                             <>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>IMPLEMENTATION</span>
                                                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: getScoreColor(featScore) }}>{featScore}/100</span>
                                                   </div>
                                                   <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                      <div style={{ width: `${featScore}%`, height: '100%', background: getScoreColor(featScore), transition: 'width 1s ease-out' }}></div>
                                                   </div>
                                                </div>
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>ALPHA POTENTIAL</span>
                                                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: getScoreColor(alphaScore) }}>{alphaScore}/100</span>
                                                   </div>
                                                   <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                      <div style={{ width: `${alphaScore}%`, height: '100%', background: getScoreColor(alphaScore), transition: 'width 1s ease-out' }}></div>
                                                   </div>
                                                </div>
                                             </>
                                          );
                                       })()}
                                   </div>

                                   <div style={{ 
                                      padding: '1.25rem', background: 'rgba(0,122,255,0.04)', borderRadius: '16px', 
                                      border: '1px solid rgba(0,122,255,0.1)', fontSize: '0.95rem', lineHeight: '1.6', 
                                      color: '#e0e0e0', whiteSpace: 'pre-wrap' 
                                   }}>
                                      {itemSummaries[previewFinding.link]}
                                   </div>
                                </div>
                             ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                                   <Brain size={32} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                   <button className="btn-primary" onClick={() => summarizeFinding(previewFinding!)} disabled={isSummarizing === previewFinding.link} style={{ padding: '0.75rem 2rem', fontSize: '0.85rem' }}>
                                      {isSummarizing === previewFinding.link ? 'Analyzing...' : 'Start AI Analysis'}
                                   </button>
                                </div>
                             )}
                          </div>
                          {/* Footer */}
                          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                             <button className="btn-primary" onClick={() => archiveToBrain(previewFinding!)} 
                                disabled={isArchiving === previewFinding.link || archivedLinks.has(previewFinding.link) || !itemSummaries[previewFinding.link]}
                                style={{ 
                                  padding: '0.5rem 1.5rem', fontSize: '0.85rem',
                                  background: archivedLinks.has(previewFinding.link) ? '#22c55e' : 'var(--accent-primary)',
                                  borderColor: archivedLinks.has(previewFinding.link) ? '#22c55e' : 'var(--accent-primary)'
                                }}
                             >
                                {archivedLinks.has(previewFinding.link) ? 'Saved to Brain' : 'Archive Result'}
                             </button>
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }}>
           {['scout_agent', 'alpha_agent', 'backtest_agent', 'strategy_manager', 'sentiment_agent', 'data_agent'].map(name => (
             <AgentCard key={name} name={name} status={agentStatuses[name]} QUANT_URL={QUANT_URL} onRefresh={fetchAll} />
           ))}
        </div>
      )}
    </div>
  );
}
