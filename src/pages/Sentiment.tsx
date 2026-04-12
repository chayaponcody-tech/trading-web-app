import { Brain } from 'lucide-react';

export default function Sentiment() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
      <Brain size={48} strokeWidth={1.2} color="var(--accent-primary)" />
      <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Sentiment Analysis</h2>
      <p style={{ margin: 0, fontSize: '0.95rem' }}>Coming soon — Fear & Greed, Reddit, RSS News</p>
    </div>
  );
}
