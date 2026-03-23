import { useState, useRef } from 'react';

// ---------------------------------------------------------------------------
// Constants — channel / handle / category colours are fixed
// ---------------------------------------------------------------------------
const CHANNEL = 'Swen Reports';
const HANDLE = '@swenreports';
const CAT_COLORS = {
  Technology: '#2a7bff',
  Politics: '#e63946',
  Sports: '#39d353',
  Business: '#ff9f43',
  Science: '#a855f7',
  Health: '#06b6d4',
  World: '#f59e0b',
  'Gold & Silver': '#d4a017',
  Movies: '#e040fb',
  India: '#ff6b00',
};

// ---------------------------------------------------------------------------
// Sample stories (one per box)
// ---------------------------------------------------------------------------
const SAMPLE_STORIES = [
  {
    category: 'Technology',
    headline: 'Global\nTech\nSummit',
    headlineEmphasis: 'Tech',
    sub: "Singapore hosts history's largest gathering",
    body: [
      '**180 nations** represented at Marina Bay Sands',
      'Joint **AI governance framework** signed on day one',
      'Summit runs through **28 March 2026**',
    ],
    facts: ['**$2.4 trillion** in tech investment pledged on day one'],
  },
  {
    category: 'Business',
    headline: 'Markets\nHit\nRecord',
    headlineEmphasis: 'Record',
    sub: 'S&P 500 crosses 6,800 for the first time',
    body: [
      'S&P 500 up **3.2%** — largest single-day gain this year',
      'NVIDIA added **$180B** to market cap in one session',
      '**AI index** funds saw record $9B inflows',
    ],
    facts: ['**Tech stocks** led the rally on Singapore summit optimism'],
  },
  {
    category: 'Politics',
    headline: 'AI\nBill\nPasses',
    headlineEmphasis: 'Passes',
    sub: 'Historic legislation signed into law',
    body: [
      'Ratified by **94 member states** — first binding AI law',
      'Models above **10²⁶ FLOPs** require mandatory safety audits',
      'Framework takes effect **1 January 2027**',
    ],
    facts: ['Independent oversight body funded at **$4B annually**'],
  },
  {
    category: 'Science',
    headline: 'Moon\nBase\nAlpha',
    headlineEmphasis: 'Alpha',
    sub: 'First permanent lunar habitat confirmed',
    body: [
      'NASA & ESA joint project — construction starts **2028**',
      'Powered by **solar + nuclear** hybrid grid',
      'First crew launch scheduled **March 2028**',
    ],
    facts: ['Habitat designed to house **12 researchers** permanently'],
  },
  {
    category: 'Gold & Silver',
    gold24k: 86950,
    silver1kg: 95800,
    trendGold: 'up',
    trendSilver: 'down',
    history: [
      { date: '21 Mar', gold: 86500, silver: 96200 },
      { date: '20 Mar', gold: 86200, silver: 96800 },
      { date: '19 Mar', gold: 85900, silver: 97200 },
      { date: '18 Mar', gold: 85600, silver: 97600 },
      { date: '17 Mar', gold: 85300, silver: 98100 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Normalise story object
// ---------------------------------------------------------------------------
function normaliseStory(s) {
  return {
    category: s.category || 'News',
    headline: s.headline || 'Breaking News',
    headlineEmphasis: s.headlineEmphasis || '',
    sub: s.sub || '',
    body: Array.isArray(s.body) ? s.body : s.body ? [s.body] : [],
    facts: Array.isArray(s.facts) ? s.facts : [],
    ...(Array.isArray(s.rates) ? { rates: s.rates } : {}),
    ...(s.gold24k != null ? { gold24k: s.gold24k } : {}),
    ...(s.gold22k != null ? { gold22k: s.gold22k } : {}),
    ...(s.silver1kg != null ? { silver1kg: s.silver1kg } : {}),
    ...(s.trend != null ? { trend: s.trend } : {}),
    ...(s.trendGold != null ? { trendGold: s.trendGold } : {}),
    ...(s.trendSilver != null ? { trendSilver: s.trendSilver } : {}),
    ...(Array.isArray(s.history) ? { history: s.history } : {}),
  };
}

function buildConfig(storyTexts) {
  const stories = storyTexts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => {
      try { return normaliseStory(JSON.parse(t)); }
      catch (e) { throw new Error(`Story ${i + 1}: ${e.message}`); }
    })
    .sort((a, b) => {
      const isGold = (s) => s.gold24k != null || s.rates != null;
      return isGold(a) ? 1 : isGold(b) ? -1 : 0;
    });
  if (stories.length === 0) throw new Error('Add at least one story.');
  return { channel: CHANNEL, handle: HANDLE, categoryColors: { ...CAT_COLORS }, stories };
}

// ---------------------------------------------------------------------------
// NewsHome
// ---------------------------------------------------------------------------
export default function NewsHome({ onLaunch, onBack }) {
  const [storyInputs, setStoryInputs] = useState(['']);
  const [error, setError] = useState('');
  const [images, setImages] = useState({});
  const fileInputRef = useRef(null);
  const [pendingSlot, setPendingSlot] = useState('');
  const [slotInput, setSlotInput] = useState('');

  // Story box helpers
  function updateStory(idx, val) {
    setStoryInputs((prev) => prev.map((s, i) => i === idx ? val : s));
  }
  function addStory() {
    setStoryInputs((prev) => [...prev, '']);
  }
  function removeStory(idx) {
    setStoryInputs((prev) => prev.filter((_, i) => i !== idx));
  }

  // Image helpers
  function handleImagePick(slot) {
    setPendingSlot(slot);
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !pendingSlot) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImages((prev) => ({ ...prev, [pendingSlot]: ev.target.result }));
    reader.readAsDataURL(file);
  }
  function handleAddSlot() {
    const s = slotInput.trim();
    if (!s || isNaN(Number(s))) return;
    setPendingSlot(s); setSlotInput('');
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }
  function handleRemoveImage(slot) {
    setImages((prev) => { const n = { ...prev }; delete n[slot]; return n; });
  }

  function handleStart() {
    setError('');
    try {
      const config = buildConfig(storyInputs);
      config.images = images;
      onLaunch(config);
    } catch (e) {
      setError(e.message || 'Invalid JSON');
    }
  }

  function loadSample() {
    setStoryInputs(SAMPLE_STORIES.map((s) => JSON.stringify(s, null, 2)));
    setError('');
  }

  const storyCount = storyInputs.filter((s) => s.trim()).length;

  return (
    <div className="news-home-shell">
      <div className="news-header">
        <button className="news-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="news-header-title">📺 News Reader</span>
        <div style={{ width: 36 }} />
      </div>

      <div className="news-hero">
        <div className="news-hero-icon">📺</div>
        <div className="news-hero-headline">Broadcast-ready.</div>
        <div className="news-hero-sub">YouTube Shorts-style news cards · per-category colours · record-ready.</div>
      </div>

      {/* Channel info banner */}
      <div className="news-channel-banner">
        <div className="news-channel-pill">
          <span className="news-channel-dot" />
          <span className="news-channel-name">{CHANNEL}</span>
          <span className="news-channel-handle">{HANDLE}</span>
        </div>
        <div className="news-cat-dots">
          {Object.entries(CAT_COLORS).map(([cat, hex]) => (
            <span key={cat} className="news-cat-dot" style={{ background: hex }} title={cat} />
          ))}
        </div>
      </div>

      {/* Story inputs */}
      <div className="news-section">
        <div className="news-section-header">
          <div className="news-section-label">Stories</div>
          <div className="news-section-meta">{storyCount} story{storyCount !== 1 ? 's' : ''}</div>
        </div>

        <div className="news-story-list">
          {storyInputs.map((val, idx) => (
            <div key={idx} className="news-story-box">
              <div className="news-story-box-header">
                <span className="news-story-num">#{idx + 1}</span>
                {storyInputs.length > 1 && (
                  <button className="news-story-remove" onClick={() => removeStory(idx)}>✕</button>
                )}
              </div>
              <textarea
                className="news-json-area news-json-area--story"
                placeholder={'{\n  "category": "Technology",\n  "headline": "Big\\nHeadline",\n  "headlineEmphasis": "Big",\n  "sub": "One sharp subtitle sentence.",\n  "body": ["First bullet", "Second **bold** bullet"],\n  "facts": ["**Key stat** — most important number"]\n}'}
                value={val}
                onChange={(e) => updateStory(idx, e.target.value)}
                rows={7}
                spellCheck={false}
              />
            </div>
          ))}
        </div>

        <button className="news-add-story-btn" onClick={addStory}>
          <span>+</span> Add Story
        </button>
      </div>

      {error && <div className="news-error" style={{ margin: '0 16px 12px' }}>⚠ {error}</div>}

      <div className="news-btn-row" style={{ padding: '0 16px 12px' }}>
        <button className="news-btn-ghost" onClick={loadSample}>Fill Sample</button>
        <button className="news-btn-primary" onClick={handleStart}>Launch →</button>
      </div>

      {/* Image upload */}
      <div className="news-section">
        <div className="news-section-label">Story Images (optional)</div>
        <div className="news-img-hint">Assign an image to a story number — that story uses the image-card layout.</div>
        {Object.keys(images).length > 0 && (
          <div className="news-img-list">
            {Object.entries(images).sort((a, b) => Number(a[0]) - Number(b[0])).map(([slot, url]) => (
              <div key={slot} className="news-img-chip">
                <img src={url} className="news-img-thumb" alt="" />
                <span className="news-img-label">Story {slot}</span>
                <button className="news-img-remove" onClick={() => handleRemoveImage(slot)}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="news-img-add-row">
          <input type="number" min="1" className="news-img-slot-input" placeholder="Story #"
            value={slotInput} onChange={(e) => setSlotInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSlot()} />
          <button className="news-btn-ghost" onClick={handleAddSlot}>+ Add Image</button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
    </div>
  );
}

