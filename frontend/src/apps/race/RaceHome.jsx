import { useState } from 'react';
import { SAMPLES, PALETTE } from './sampleData.js';

// ---------------------------------------------------------------------------
// Normalise any JSON shape into the canonical { title, subtitle, colors, frames } format
// ---------------------------------------------------------------------------
function normalise(raw) {
  let obj = raw;

  // If the user pasted a bare array, wrap it
  if (Array.isArray(obj)) {
    obj = { title: 'Bar Race', frames: obj };
  }

  // Format 2: entity-based  { labels, data: [{ name, values: [] }] }
  if (obj.labels && Array.isArray(obj.data)) {
    const frames = obj.labels.map((label, i) => {
      const values = {};
      obj.data.forEach((d) => {
        values[d.name] = d.values?.[i] ?? 0;
      });
      return { label: String(label), values };
    });
    return { title: obj.title || 'Bar Race', subtitle: obj.subtitle || '', colors: obj.colors || {}, frames };
  }

  // Format 1: frames-based  { frames: [{ label, values }] }
  if (Array.isArray(obj.frames) && obj.frames.length > 0) {
    return {
      title: obj.title || 'Bar Race',
      subtitle: obj.subtitle || '',
      colors: obj.colors || {},
      frames: obj.frames.map((f) => ({
        label: String(f.label ?? ''),
        values: f.values ?? {},
      })),
    };
  }

  throw new Error('Unrecognised format');
}

// ---------------------------------------------------------------------------
// RaceHome — landing screen
// ---------------------------------------------------------------------------
export default function RaceHome({ onLaunch, onBack }) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');

  function launchSample(sample) {
    onLaunch({
      title: sample.title,
      subtitle: sample.subtitle,
      colors: sample.colors || {},
      frames: sample.frames,
    });
  }

  function handlePasteStart() {
    setError('');
    if (!jsonText.trim()) { setError('Paste some JSON first.'); return; }
    try {
      const parsed = JSON.parse(jsonText);
      const config = normalise(parsed);
      if (config.frames.length < 2) { setError('Need at least 2 frames.'); return; }
      onLaunch(config);
    } catch {
      setError('Invalid JSON. See the format hint below the textarea.');
    }
  }

  return (
    <div className="race-home-shell">
      {/* Header */}
      <div className="race-header">
        <button className="race-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="race-header-title">📊 Bar Race</span>
        <div style={{ width: 36 }} />
      </div>

      {/* Hero */}
      <div className="race-hero">
        <div className="race-hero-icon">📊</div>
        <div className="race-hero-headline">Watch data race.</div>
        <div className="race-hero-sub">Pick a sample dataset or paste your own JSON.</div>
      </div>

      {/* Sample cards */}
      <div className="race-samples">
        <div className="race-section-label">Sample Datasets</div>
        {SAMPLES.map((s) => {
          const entityCount = new Set(s.frames.flatMap((f) => Object.keys(f.values))).size;
          return (
            <button key={s.id} className="race-sample-card" onClick={() => launchSample(s)}>
              <span className="race-sample-icon">{s.icon}</span>
              <div className="race-sample-info">
                <div className="race-sample-title">{s.title}</div>
                <div className="race-sample-meta">{entityCount} items · {s.frames.length} frames</div>
              </div>
              <span className="race-sample-arrow">▶</span>
            </button>
          );
        })}
      </div>

      {/* Custom JSON */}
      <div className="race-json-section">
        <div className="race-section-label">Or Paste JSON</div>
        <textarea
          className="race-json-area"
          placeholder={'[\n  { "label": "2020", "values": { "A": 10, "B": 20 } },\n  { "label": "2021", "values": { "A": 15, "B": 18 } }\n]'}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={6}
          spellCheck={false}
        />
        <div className="race-json-hint">
          Format: <code>{`[{ "label": "Year", "values": { "Name": 100 } }, …]`}</code>
        </div>
        {error && <div className="race-error">{error}</div>}
        <button className="race-start-btn" onClick={handlePasteStart}>Start →</button>
      </div>
    </div>
  );
}
