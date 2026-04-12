rest = r"""
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
"""

with open('src/pages/Config.tsx', 'a', encoding='utf-8') as f:
    f.write(rest)
print('Done')
