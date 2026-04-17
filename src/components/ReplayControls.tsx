import { useState, useRef, useEffect, useCallback } from 'react';
import type { ISeriesApi, Time } from 'lightweight-charts';

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ReplayControlsProps {
  allCandles: CandleData[];
  candleSeries: ISeriesApi<'Candlestick'> | null;
  onReplayIndexChange?: (index: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4, 8];

export default function ReplayControls({ allCandles, candleSeries, onReplayIndexChange }: ReplayControlsProps) {
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopInterval = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // Feed candles up to index
  const applyReplay = useCallback((idx: number) => {
    if (!candleSeries || allCandles.length === 0) return;
    const slice = allCandles.slice(0, idx + 1);
    candleSeries.setData(slice);
    onReplayIndexChange?.(idx);
  }, [candleSeries, allCandles, onReplayIndexChange]);

  const enterReplay = () => {
    if (allCandles.length === 0) return;
    setIsReplayMode(true);
    setIsPlaying(false);
    setReplayIndex(0);
    applyReplay(0);
  };

  const exitReplay = () => {
    stopInterval();
    setIsReplayMode(false);
    setIsPlaying(false);
    // Restore full data
    if (candleSeries && allCandles.length > 0) candleSeries.setData(allCandles);
  };

  const play = () => {
    if (replayIndex >= allCandles.length - 1) return;
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
    stopInterval();
  };

  const stepForward = () => {
    setReplayIndex(prev => {
      const next = Math.min(prev + 1, allCandles.length - 1);
      applyReplay(next);
      return next;
    });
  };

  const stepBack = () => {
    setReplayIndex(prev => {
      const next = Math.max(prev - 1, 0);
      applyReplay(next);
      return next;
    });
  };

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) { stopInterval(); return; }
    intervalRef.current = setInterval(() => {
      setReplayIndex(prev => {
        const next = prev + 1;
        if (next >= allCandles.length) {
          setIsPlaying(false);
          return prev;
        }
        applyReplay(next);
        return next;
      });
    }, Math.round(400 / speed));
    return stopInterval;
  }, [isPlaying, speed, allCandles, applyReplay]);

  const btnStyle = (active = false): React.CSSProperties => ({
    background: active ? 'var(--accent-primary)' : 'var(--bg-dark)',
    color: active ? '#fff' : 'var(--text-main)',
    border: '1px solid #444',
    padding: '0.25rem 0.55rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    cursor: 'pointer',
  });

  if (!isReplayMode) {
    return (
      <button onClick={enterReplay} style={btnStyle()} title="Enter replay mode">
        ⏮ Replay
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        {replayIndex + 1}/{allCandles.length}
      </span>
      <button onClick={stepBack} style={btnStyle()} title="Step back">◀</button>
      {isPlaying
        ? <button onClick={pause} style={btnStyle(true)} title="Pause">⏸</button>
        : <button onClick={play} disabled={replayIndex >= allCandles.length - 1} style={btnStyle()} title="Play">▶</button>
      }
      <button onClick={stepForward} style={btnStyle()} title="Step forward">▶|</button>

      {/* Speed selector */}
      <select
        value={speed}
        onChange={e => setSpeed(parseFloat(e.target.value))}
        style={{ background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid #444', borderRadius: '4px', fontSize: '0.75rem', padding: '0.2rem' }}
      >
        {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
      </select>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={allCandles.length - 1}
        value={replayIndex}
        onChange={e => {
          const idx = parseInt(e.target.value);
          setReplayIndex(idx);
          applyReplay(idx);
        }}
        style={{ width: '120px', accentColor: 'var(--accent-primary)' }}
      />

      <button onClick={exitReplay} style={{ ...btnStyle(), color: 'var(--loss-color)' }} title="Exit replay">✕ Exit</button>
    </div>
  );
}
