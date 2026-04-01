import { Terminal } from 'lucide-react';

export default function Logs() {
  const logLines = [
    "[10:04:12] freqtrade.worker - INFO - Starting worker Freqtrade",
    "[10:04:12] freqtrade.configuration.configuration - INFO - Using config: config.json",
    "[10:04:13] freqtrade.exchange.exchange - INFO - Instance is running with dry_run enabled",
    "[10:04:15] freqtrade.worker - INFO - Bot heartbeat. Number of active trades: 3",
    "[10:04:25] freqtrade.strategy.interface - INFO - Buy signal found: SOL/USDT",
    "[10:04:26] freqtrade.wallets - INFO - Wallets synced.",
    "[10:04:28] freqtrade.rpc.rpc_manager - INFO - Sending rpc message: *Freqtrade Running:*",
    "[10:04:30] freqtrade.worker - INFO - Bot heartbeat. Number of active trades: 4"
  ];

  return (
    <div className="logs-container animate-fade-in">
      <div className="glass-panel" style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-between" style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="m-0" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={24} /> Live Terminal Logs
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span className="status-badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: '1px solid transparent' }}>Auto-scroll</span>
            <span className="status-badge pulse">● Listening</span>
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          background: '#050a14', 
          borderRadius: '8px', 
          padding: '1.5rem', 
          fontFamily: 'monospace', 
          overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {logLines.map((line, i) => {
            const isInfo = line.includes('INFO');
            const isBuy = line.includes('Buy');
            let color = 'var(--text-muted)';
            if (isBuy) color = 'var(--profit-color)';
            if (isInfo && !isBuy) color = '#38bdf8';
            return (
              <div key={i} style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: color, lineHeight: '1.5' }}>
                {line}
              </div>
            );
          })}
          <div className="pulse" style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>_</div>
        </div>
      </div>
    </div>
  );
}
