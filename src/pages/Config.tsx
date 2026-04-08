import { useState, useEffect } from 'react';
import { Settings, Shield, Cpu, Key } from 'lucide-react';

const API = '';

export default function ConfigPage() {
  const [binanceKeys, setBinanceKeys] = useState({ 
    apiKey: '', 
    apiSecret: '', 
    openRouterKey: '', 
    openRouterModel: 'meta-llama/llama-3.1-8b-instruct',
    telegramToken: '',
    telegramChatId: '',
    hasKeys: false, 
    hasOpenRouter: false,
    hasTelegram: false
  });
  const [tempORKey, setTempORKey] = useState('');
  const [tempTGToken, setTempTGToken] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchBinanceConfig = async () => {
    try {
      const res = await fetch(`${API}/api/config`);
      const data = await res.json();
      setBinanceKeys(prev => ({ 
          ...prev, 
          apiKey: data.apiKey === '********' ? '' : data.apiKey, 
          hasKeys: data.hasKeys || (data.apiKey === '********' && data.hasSecret),
          hasOpenRouter: data.hasOpenRouter,
          hasTelegram: data.hasTelegram,
          openRouterModel: data.openRouterModel || prev.openRouterModel,
          telegramChatId: data.telegramChatId || '',
          apiSecret: '', 
          openRouterKey: '',
          telegramToken: ''
      }));
    } catch {}
  };

  useEffect(() => {
    fetchBinanceConfig();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
        const res = await fetch(`${API}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                apiKey: binanceKeys.apiKey, 
                apiSecret: binanceKeys.apiSecret,
                openRouterKey: tempORKey || undefined,
                openRouterModel: binanceKeys.openRouterModel,
                telegramToken: tempTGToken || undefined,
                telegramChatId: binanceKeys.telegramChatId
            })
        });
        if (!res.ok) throw new Error(await res.text());
        await fetchBinanceConfig();
        setTempORKey('');
        setTempTGToken('');
        alert('Global Configuration Saved Successfully!');
    } catch (e: any) {
        alert('Save Error: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <Settings size={32} color="#faad14" />
          Global System Configuration
        </h1>
        <p style={{ color: '#888', marginTop: '0.5rem' }}>Manage your API connections and AI model preferences for the entire platform.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
         {/* Binance Section */}
         <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #faad14' }}>
            <h2 style={{ color: '#faad14', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={24} /> Binance API Credentials
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa' }}>Binance Testnet API Key</label>
                    <input 
                        type="text" 
                        value={binanceKeys.apiKey} 
                        onChange={e => setBinanceKeys(k => ({ ...k, apiKey: e.target.value }))} 
                        placeholder={binanceKeys.hasKeys ? "✓ API Key Saved (Encrypted)" : "Paste your Binance API Key"} 
                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: binanceKeys.hasKeys && !binanceKeys.apiKey ? '1px solid #0ecb8144' : '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }} 
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa' }}>Binance Testnet Secret Key</label>
                    <input 
                        type="password" 
                        value={binanceKeys.apiSecret} 
                        onChange={e => setBinanceKeys(k => ({ ...k, apiSecret: e.target.value }))} 
                        placeholder={binanceKeys.hasKeys ? "✓ Secret Key Saved (Encrypted)" : "Paste your Binance Secret Key"} 
                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: binanceKeys.hasKeys && !binanceKeys.apiSecret ? '1px solid #0ecb8144' : '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }} 
                    />
                </div>
                
                <div style={{ padding: '1rem', background: 'rgba(250, 173, 20, 0.05)', borderRadius: '4px', border: '1px solid rgba(250, 173, 20, 0.1)', fontSize: '0.8rem', color: '#ccc' }}>
                    <Shield size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} color="#faad14" />
                    Credentials are stored securely on the local server in <code>binance-config.json</code>.
                </div>
            </div>
         </div>

         {/* AI Section */}
         <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #faad14' }}>
            <h2 style={{ color: '#faad14', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={24} /> Deep AI Strategy Settings
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa' }}>OpenRouter API Key</label>
                    <input 
                        type="password" 
                        value={tempORKey} 
                        onChange={e => setTempORKey(e.target.value)} 
                        placeholder={binanceKeys.hasOpenRouter ? "✓ Key Saved (Encrypted)" : "sk-or-v1-..."} 
                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }} 
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa' }}>Preferred AI Analysis Model</label>
                        <select 
                            value={binanceKeys.openRouterModel} 
                            onChange={e => setBinanceKeys(k => ({ ...k, openRouterModel: e.target.value }))}
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }}>
                            <option value="qwen/qwen3.5-flash-02-23">Qwen 3.5 Flash (02-23)</option>
                            <option value="minimax/minimax-m2.5">MiniMax M2.5</option>
                            <option value="google/gemini-3-flash-preview">Google Gemini 3 Flash Preview</option>
                            <option value="deepseek/deepseek-v3.2">DeepSeek V3.2 (Powerful Reasoner)</option>
                            <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B (Stable Fallback)</option>
                        </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: binanceKeys.hasOpenRouter ? '#0ecb81' : '#f6465d', fontSize: '0.85rem', padding: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: binanceKeys.hasOpenRouter ? '#0ecb81' : '#f6465d' }}></div>
                    {binanceKeys.hasOpenRouter ? 'AI Engine Ready for Analysis' : 'AI Strategic Key Missing'}
                </div>
            </div>
         </div>

         {/* NEW: Telegram Section */}
         <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #0088cc', gridColumn: 'span 2' }}>
            <h2 style={{ color: '#0088cc', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={24} color="#0088cc" /> Telegram Bot Notifications
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa' }}>Telegram Bot Token</label>
                        <input 
                            type="password" 
                            value={tempTGToken} 
                            onChange={e => setTempTGToken(e.target.value)} 
                            placeholder={binanceKeys.hasTelegram ? "✓ Token Saved (Encrypted)" : "123456:ABC-DEF..."} 
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }} 
                        />
                        <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>Create a bot via @BotFather</p>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#aaa' }}>Telegram Chat ID</label>
                        <input 
                            type="text" 
                            value={binanceKeys.telegramChatId} 
                            onChange={e => setBinanceKeys(k => ({ ...k, telegramChatId: e.target.value }))} 
                            placeholder="e.g. 123456789" 
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }} 
                        />
                        <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>Get your ID via @userinfobot</p>
                    </div>
                </div>
            </div>
            {binanceKeys.hasTelegram && (
                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0ecb81', fontSize: '0.85rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ecb81' }}></div>
                    Telegram Notifications Active
                </div>
            )}
         </div>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            disabled={loading}
            onClick={handleSave}
            style={{ 
                padding: '1rem 3rem', background: '#faad14', color: '#000', border: 'none', 
                borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem',
                opacity: loading ? 0.7 : 1, transition: '0.2s'
            }}>
            {loading ? 'Saving Settings...' : '💾 Save All Configurations'}
          </button>
      </div>
    </div>
  );
}
