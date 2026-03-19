import { useState } from 'react';

const AGENT_OPTIONS = [
  { label: 'GPT-4o (OpenAI)', provider: 'openai', name: 'GPT-4o' },
  { label: 'Claude Haiku 4.5 (Anthropic)', provider: 'claude', name: 'Claude Haiku 4.5' },
];

const TURN_OPTIONS = [
  { label: '10 turns', value: 10 },
  { label: '20 turns', value: 20 },
  { label: '50 turns', value: 50 },
  { label: 'Unlimited', value: 0 },
];

const LINE_OPTIONS = [
  { label: '1 line',  value: 1 },
  { label: '2 lines', value: 2 },
  { label: '3 lines', value: 3 },
  { label: '4 lines', value: 4 },
];

const BRUTALITY_OPTIONS = [
  { label: '😄 Playful',  value: 1, hint: 'Witty, fun, no hard feelings' },
  { label: '🔥 Savage',   value: 2, hint: 'Sharp burns, internet-fight energy' },
  { label: '💀 Nuclear',  value: 3, hint: 'Dark, vulgar, absolutely no mercy' },
];

export default function SetupScreen({ onStart, onBack }) {
  const [topic, setTopic] = useState('');
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(1);
  const [leftStance, setLeftStance] = useState('');
  const [rightStance, setRightStance] = useState('');
  const [leftNick, setLeftNick]   = useState('');
  const [rightNick, setRightNick] = useState('');
  const [maxTurns, setMaxTurns] = useState(10);
  const [responseLines, setResponseLines] = useState(2);
  const [autoMode, setAutoMode] = useState(false);
  const [contextData, setContextData] = useState('');
  const [brutalityLevel, setBrutalityLevel] = useState(2);
  const [ctaMessage, setCtaMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    const config = {
      topic: topic.trim(),
      leftAgent:  { ...AGENT_OPTIONS[leftIdx],  stance: leftStance.trim(),  name: leftNick.trim()  || AGENT_OPTIONS[leftIdx].name  },
      rightAgent: { ...AGENT_OPTIONS[rightIdx], stance: rightStance.trim(), name: rightNick.trim() || AGENT_OPTIONS[rightIdx].name },
      maxTurns,
      responseLines,
      autoMode,
      contextData: contextData.trim(),
      brutalityLevel,
      ctaMessage: ctaMessage.trim(),
    };

    // Just navigate — the chat screen has its own Start button
    onStart(config);
  }

  return (
    <div className="setup-outer">
      <div className="setup-card">
        {/* Logo / Title */}
        <div className="setup-logo">
          {onBack && (
            <button type="button" className="setup-back" onClick={onBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div className="setup-logo-icon">
            <span>🔥</span>
          </div>
          <h1 className="setup-title">Roast Battle</h1>
          <p className="setup-subtitle">Two AIs. One topic. No mercy.</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">

          {/* ── Section 1: Debate ── */}
          <div className="setup-section">
            <div className="setup-section-label">🔥 The Debate</div>
            <div className="form-group">
              <label className="form-label">Debate Title</label>
              <input
                className="form-input"
                placeholder="e.g. Pineapple belongs on pizza"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              />
            </div>
          </div>

          {/* ── Section 1b: Additional Context ── */}
          <div className="setup-section">
            <div className="setup-section-label">📎 Additional Context <span className="context-optional">(optional)</span></div>
            <div className="form-group">
              <textarea
                className="form-input context-textarea"
                placeholder={`Paste any stats, facts, or recent info here.\nAI will use this as reference data — the debate topic stays the same.\n\ne.g. "As of today, Messi has 850 career goals. Ronaldo has 900."`}
                value={contextData}
                onChange={(e) => setContextData(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          {/* ── Section 1c: End Card CTA ── */}
          <div className="setup-section">
            <div className="setup-section-label">📣 End Card Message <span className="context-optional">(optional)</span></div>
            <div className="form-group">
              <input
                className="form-input"
                placeholder="e.g. Drop 100 likes and I'll continue this battle!"
                value={ctaMessage}
                onChange={(e) => setCtaMessage(e.target.value)}
              />
            </div>
          </div>

          {/* ── Section 2: Choose Sides ── */}
          <div className="setup-section">
            <div className="setup-section-label">⚔️ Choose Sides</div>

            <div className="sides-grid">
              {/* Left side */}
              <div className="side-card left-side-card">
                <div className="side-card-header">
                  <span className="side-dot left-dot" /> Left Corner
                </div>
                <select
                  className="form-select"
                  value={leftIdx}
                  onChange={(e) => { setLeftIdx(Number(e.target.value)); setLeftNick(''); }}
                >
                  {AGENT_OPTIONS.map((a, i) => (
                    <option key={i} value={i}>{a.label}</option>
                  ))}
                </select>
                <input
                  className="form-input stance-input"
                  placeholder={`Nickname (default: ${AGENT_OPTIONS[leftIdx].name})`}
                  value={leftNick}
                  onChange={(e) => setLeftNick(e.target.value)}
                />
                <input
                  className="form-input stance-input"
                  placeholder="Their stance (optional)"
                  value={leftStance}
                  onChange={(e) => setLeftStance(e.target.value)}
                />
              </div>

              <div className="vs-divider">VS</div>

              {/* Right side */}
              <div className="side-card right-side-card">
                <div className="side-card-header">
                  <span className="side-dot right-dot" /> Right Corner
                </div>
                <select
                  className="form-select"
                  value={rightIdx}
                  onChange={(e) => { setRightIdx(Number(e.target.value)); setRightNick(''); }}
                >
                  {AGENT_OPTIONS.map((a, i) => (
                    <option key={i} value={i}>{a.label}</option>
                  ))}
                </select>
                <input
                  className="form-input stance-input"
                  placeholder={`Nickname (default: ${AGENT_OPTIONS[rightIdx].name})`}
                  value={rightNick}
                  onChange={(e) => setRightNick(e.target.value)}
                />
                <input
                  className="form-input stance-input"
                  placeholder="Their stance (optional)"
                  value={rightStance}
                  onChange={(e) => setRightStance(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Brutality Level */}
          <div className="form-group">
            <label className="form-label">Brutality Level</label>
            <div className="brutality-pills">
              {BRUTALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`brutality-pill bru-${opt.value} ${brutalityLevel === opt.value ? 'active' : ''}`}
                  onClick={() => setBrutalityLevel(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="mode-hint">{BRUTALITY_OPTIONS.find(o => o.value === brutalityLevel)?.hint}</span>
          </div>

          {/* Response Length */}
          <div className="form-group">
            <label className="form-label">Response Length</label>
            <div className="turn-pills">
              {LINE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`turn-pill ${responseLines === opt.value ? 'active' : ''}`}
                  onClick={() => setResponseLines(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Turns */}
          <div className="form-group">
            <label className="form-label">Max Turns</label>
            <div className="turn-pills">
              {TURN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`turn-pill ${maxTurns === opt.value ? 'active' : ''}`}
                  onClick={() => setMaxTurns(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode toggle */}
          <div className="form-group">
            <label className="form-label">Mode</label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-pill ${!autoMode ? 'active' : ''}`}
                onClick={() => setAutoMode(false)}
              >
                ✋ Manual
              </button>
              <button
                type="button"
                className={`mode-pill ${autoMode ? 'active' : ''}`}
                onClick={() => setAutoMode(true)}
              >
                ⚡ Auto
              </button>
            </div>
            <span className="mode-hint">
              {autoMode
                ? 'Agents fire back automatically one after another'
                : 'You press Continue after each message'}
            </span>
          </div>

          <button
            type="submit"
            className="btn-start"
            disabled={!topic.trim()}
          >
            Next →
          </button>
        </form>
      </div>
    </div>
  );
}
