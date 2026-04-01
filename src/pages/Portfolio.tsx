import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, LayoutGrid, Coins } from 'lucide-react';

const API = 'http://localhost:4001';

interface WalletData {
  balance: number;
  allTimePnL: number;
  allTimeTrades: number;
}

export default function Portfolio() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [goldWallet, setGoldWallet] = useState<WalletData | null>(null);
  const [resetAmount, setResetAmount] = useState(10000);
  const [goldResetAmount, setGoldResetAmount] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [goldLoading, setGoldLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchWallets = async () => {
    try {
      const res = await fetch(`${API}/api/wallet`);
      setWallet(await res.json());
      const resG = await fetch(`${API}/api/wallet/gold`);
      setGoldWallet(await resG.json());
    } catch (e) { console.error('Failed to fetch wallets'); }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const handleReset = async (isGold: boolean) => {
    const type = isGold ? 'Gold' : 'Crypto';
    const amount = isGold ? goldResetAmount : resetAmount;
    if (!window.confirm(`Are you sure you want to RESET your ${type} demo wallet to $${amount}? All history for this wallet will be cleared.`)) return;
    
    if (isGold) setGoldLoading(true); else setLoading(true);
    try {
      const endpoint = isGold ? '/api/wallet/gold/fund' : '/api/wallet/fund';
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reset: true }),
      });
      const data = await res.json();
      if (data.success) {
        if (isGold) setGoldWallet(data.wallet); else setWallet(data.wallet);
        setMessage(`${type} Wallet reset successfully!`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) { setMessage(`Error resetting ${type} wallet`); }
    if (isGold) setGoldLoading(false); else setLoading(false);
  };

  if (!wallet || !goldWallet) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading wallet data...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Header */}
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
           <h2 className="m-0" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Wallet size={24} color="var(--accent-primary)" /> Demo Portfolio Management
           </h2>
           <p style={{ color: 'var(--text-muted)', margin: 0 }}>จัดการเงินทุนจำลองและตรวจสอบภาพรวมพอร์ตส่วนตัวทั้ง Crypto และ Gold</p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>System Timezone</div>
           <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Asia/Bangkok</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Crypto Wallet Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ borderTop: '4px solid #f3ba2f' }}>
             <h3 style={{ margin: '0 0 1rem 0', color: '#f3ba2f', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Coins size={20} /> CRYPTO WALLET
             </h3>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Balance</div>
             <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                ${wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
             </div>
             <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Realized PnL:</span> <span style={{ fontWeight: 'bold', color: wallet.allTimePnL >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>{wallet.allTimePnL >= 0 ? '+' : ''}${wallet.allTimePnL.toFixed(2)}</span></div>
                <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trades:</span> <b>{wallet.allTimeTrades}</b></div>
             </div>

             <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
               <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Reset Crypto Amount ($)</label>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                 <input type="number" value={resetAmount} onChange={e => setResetAmount(parseFloat(e.target.value))} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem', borderRadius: '4px' }} />
                 <button onClick={() => handleReset(false)} disabled={loading} style={{ background: '#f3ba2f', color: '#000', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Reset</button>
               </div>
             </div>
          </div>
        </div>

        {/* Gold Wallet Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ borderTop: '4px solid #faad14' }}>
             <h3 style={{ margin: '0 0 1rem 0', color: '#faad14', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <TrendingUp size={20} /> GOLD WALLET
             </h3>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Balance</div>
             <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                ${goldWallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
             </div>
             <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Realized PnL:</span> <span style={{ fontWeight: 'bold', color: goldWallet.allTimePnL >= 0 ? 'var(--profit-color)' : 'var(--loss-color)' }}>{goldWallet.allTimePnL >= 0 ? '+' : ''}${goldWallet.allTimePnL.toFixed(2)}</span></div>
                <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trades:</span> <b>{goldWallet.allTimeTrades}</b></div>
             </div>

             <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
               <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Reset Gold Amount ($)</label>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                 <input type="number" value={goldResetAmount} onChange={e => setGoldResetAmount(parseFloat(e.target.value))} style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem', borderRadius: '4px' }} />
                 <button onClick={() => handleReset(true)} disabled={goldLoading} style={{ background: '#faad14', color: '#000', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Reset</button>
               </div>
             </div>
          </div>
        </div>

      </div>

      {message && (
        <div style={{ padding: '1rem', borderRadius: '6px', background: 'rgba(14,203,129,0.1)', color: '#0ecb81', textAlign: 'center', fontWeight: 'bold', border: '1px solid #0ecb81' }}>
          {message}
        </div>
      )}

      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <LayoutGrid size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ flex: 1 }}>
             <h4 style={{ margin: 0 }}>พร้อมลุยต่อ?</h4>
             <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>เลือกหน้ารันบอทที่คุณต้องการ ด้านซ้ายคือ Crypto ด้านขวาคือ Gold</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <a href="/forward-test" style={{ textDecoration: 'none', color: '#f3ba2f', fontWeight: 'bold' }}>Crypto →</a>
            <a href="/gold-forward" style={{ textDecoration: 'none', color: '#faad14', fontWeight: 'bold' }}>Gold →</a>
          </div>
      </div>

    </div>
  );
}
