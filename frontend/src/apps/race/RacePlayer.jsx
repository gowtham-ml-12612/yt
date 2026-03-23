import { useState, useEffect, useMemo, useRef } from 'react';
import { PALETTE } from './sampleData.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROW_HEIGHT = 44;        // px per bar row (bar + gap)
const BAR_HEIGHT = 34;        // visible bar height
const DEFAULT_MAX_BARS = 10;
const BASE_FPS = 0.35;        // frames-per-second at 1× speed

function formatValue(v) {
  return Math.round(v).toLocaleString();
}

// ---------------------------------------------------------------------------
// RacePlayer — the animated bar race chart
// ---------------------------------------------------------------------------
export default function RacePlayer({ config, onBack }) {
  const { title, subtitle, frames, colors: userColors = {} } = config;
  const totalFrames = frames.length;
  const maxIdx = Math.max(0, totalFrames - 1);

  // ── State ──
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [maxBars] = useState(config.maxBars || DEFAULT_MAX_BARS);
  const [showSettings, setShowSettings] = useState(false);

  // ── Refs ──
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // ── All unique entity names ──
  const allEntities = useMemo(() => {
    const set = new Set();
    frames.forEach((f) => Object.keys(f.values).forEach((k) => set.add(k)));
    return [...set];
  }, [frames]);

  // ── Colour map (user-supplied + palette fallback) ──
  const colorMap = useMemo(() => {
    const map = {};
    let idx = 0;
    allEntities.forEach((name) => {
      if (userColors[name]) {
        map[name] = userColors[name];
      } else {
        map[name] = PALETTE[idx % PALETTE.length];
        idx++;
      }
    });
    return map;
  }, [allEntities, userColors]);

  // ── Animation loop ──
  useEffect(() => {
    if (!playing) return;
    let lastTime = null;
    let animId;

    function tick(now) {
      if (!playingRef.current) return;
      if (lastTime === null) lastTime = now;
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const next = Math.min(progressRef.current + dt * speedRef.current * BASE_FPS, maxIdx);
      progressRef.current = next;
      setProgress(next);

      if (next >= maxIdx) {
        playingRef.current = false;
        setPlaying(false);
        return;
      }
      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [playing, maxIdx]);

  // ── Interpolated bar data ──
  const safeIdx = totalFrames <= 1 ? 0 : Math.min(Math.floor(progress), totalFrames - 2);
  const t = totalFrames <= 1 ? 0 : progress - safeIdx;
  const currFrame = frames[safeIdx];
  const nextFrame = frames[Math.min(safeIdx + 1, totalFrames - 1)];

  const bars = allEntities
    .map((name) => {
      const v0 = currFrame.values[name] || 0;
      const v1 = nextFrame.values[name] || 0;
      return { name, value: v0 + (v1 - v0) * t };
    })
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, maxBars);

  const maxValue = bars[0]?.value || 1;

  // ── Frame label ──
  const numCurr = parseFloat(currFrame.label);
  const numNext = parseFloat(nextFrame.label);
  const displayLabel =
    !isNaN(numCurr) && !isNaN(numNext)
      ? String(Math.floor(numCurr + (numNext - numCurr) * t))
      : currFrame.label;

  // ── Controls ──
  function handlePlayPause() {
    if (progress >= maxIdx) {
      progressRef.current = 0;
      setProgress(0);
    }
    setPlaying((p) => !p);
  }

  function handleRestart() {
    setPlaying(false);
    progressRef.current = 0;
    setProgress(0);
  }

  function handleScrub(e) {
    const val = parseFloat(e.target.value);
    progressRef.current = val;
    setProgress(val);
  }

  const speeds = [0.5, 1, 2, 3];

  // ── Render ──
  return (
    <div className="race-player-shell">
      {/* Header */}
      <div className="race-header">
        <button className="race-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="race-header-title">{title}</div>
        <div style={{ width: 36 }} />
      </div>

      {subtitle && <div className="race-player-subtitle">{subtitle}</div>}

      {/* Bars area */}
      <div className="race-bars-area" style={{ height: maxBars * ROW_HEIGHT + 16 }}>
        {/* Watermark counter */}
        <div className="race-counter">{displayLabel}</div>

        {bars.map((bar, rank) => {
          const pct = (bar.value / maxValue) * 100;
          return (
            <div
              key={bar.name}
              className="race-bar-row"
              style={{
                transform: `translateY(${rank * ROW_HEIGHT}px)`,
                height: BAR_HEIGHT,
              }}
            >
              <div className="race-bar-label">{bar.name}</div>
              <div className="race-bar-track">
                <div
                  className="race-bar-fill"
                  style={{
                    width: `${Math.max(pct, 0.6)}%`,
                    backgroundColor: colorMap[bar.name],
                  }}
                />
              </div>
              <div className="race-bar-val">{formatValue(bar.value)}</div>
            </div>
          );
        })}
      </div>

      {/* Frame label strip */}
      <div className="race-frame-label">{displayLabel}</div>

      {/* Controls */}
      <div className="race-controls">
        <input
          className="race-progress"
          type="range"
          min="0"
          max={maxIdx}
          step="0.001"
          value={progress}
          onChange={handleScrub}
          onPointerDown={() => setPlaying(false)}
        />

        <div className="race-ctrl-row">
          <button className="race-ctrl-btn" onClick={handleRestart} title="Restart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          <button className="race-ctrl-btn race-ctrl-play" onClick={handlePlayPause}>
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            )}
          </button>

          <div className="race-speed-group">
            {speeds.map((s) => (
              <button
                key={s}
                className={`race-speed-btn ${speed === s ? 'race-speed-active' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
