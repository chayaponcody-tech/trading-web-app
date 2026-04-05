
import { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';

const API = 'http://localhost:4001';

interface TelegramLog {
  id: number;
  direction: 'IN' | 'OUT';
  chatId: string;
  message: string;
  recordedAt: string;
}

export default function TelegramLogs() {
  const [logs, setLogs] = useState<TelegramLog[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API}/api/binance/telegram-logs`);
      const data = await res.json();
      // Reverse because backend returns newest first (DESC), but for terminal style we want oldest at top, newest at bottom.
      setLogs([...data].reverse()); 
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // 5 sec update
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom whenever logs update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="logs-container animate-fade-in p-4 sm:p-6">
      <div className="glass-panel" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
        
        <div className="flex-between" style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="m-0" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem' }}>
            <MessageSquare size={24} className="text-secondary" /> 
            <span>Telegram Channel Interaction History</span>
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span className="status-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid transparent' }}>GMT+7 Local Time</span>
            <span className="status-badge pulse">● Listening Bot API</span>
          </div>
        </div>

        {/* Terminal Console */}
        <div 
          ref={scrollRef}
          style={{ 
            flex: 1, 
            background: '#050a14', 
            borderRadius: '12px', 
            padding: '1.5rem', 
            fontFamily: '"JetBrains Mono", "Courier New", monospace', 
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.05)',
            fontSize: '0.9rem',
            lineHeight: '1.6',
          }}
          className="custom-scrollbar"
        >
          {loading && logs.length === 0 ? (
            <div className="text-muted italic opacity-50">Connecting to Telegram RPC link...</div>
          ) : logs.length === 0 ? (
            <div className="text-muted italic opacity-50">No interaction history recorded. Waiting for incoming signals...</div>
          ) : (
            logs.map((log) => {
              // Convert to Asia/Bangkok
              const timeStr = new Date(log.recordedAt).toLocaleTimeString('th-TH', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Bangkok'
              });
              
              const isOut = log.direction === 'OUT';
              const dirColor = isOut ? '#38bdf8' : '#22c55e'; // Blue for Bot, Green for User
              const prefix = isOut ? '🤖 [BOT_OUT]' : '👤 [USER_IN] ';

              return (
                <div key={log.id} style={{ marginBottom: '0.6rem', display: 'flex', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }}>
                    [{timeStr}]
                  </span>
                  <span style={{ color: dirColor, fontWeight: 'bold', flexShrink: 0, letterSpacing: '0.5px' }}>
                    {prefix}
                  </span>
                  
                  <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                     <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>CID:{log.chatId}</span>
                     <span style={{ color: isOut ? '#f1f5f9' : '#ffffff', marginLeft: '0.75rem' }}>
                        {log.message.replace(/\*\*/g, '')}
                     </span>
                  </div>
                </div>
              );
            })
          )}
          
          <div className="pulse italic" style={{ marginTop: '0.8rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            &gt; STREAMS_READY: Monitoring Binance signals & Telegram hooks...
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </div>
  );
}
