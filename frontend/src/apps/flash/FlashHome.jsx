export default function FlashHome({ onNewDeck, onBack }) {
  return (
    <div className="fh-shell">

      {/* Header */}
      <div className="fh-header">
        <button className="fh-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="fh-header-title">Flashcards</span>
        <div style={{ width: 36 }} />
      </div>

      {/* Hero */}
      <div className="fh-hero">
        <div className="fh-hero-icon">🗂</div>
        <div className="fh-hero-headline">Quiz yourself.</div>
        <div className="fh-hero-sub">
          Paste a JSON deck · pick a part · hit start.
        </div>
      </div>

      {/* How it works */}
      <div className="fh-steps">
        <div className="fh-step">
          <span className="fh-step-num">1</span>
          <div className="fh-step-text">
            <div className="fh-step-title">Paste your deck</div>
            <div className="fh-step-desc">JSON array of {`{"q":"...","a":"..."}`} pairs</div>
          </div>
        </div>
        <div className="fh-step">
          <span className="fh-step-num">2</span>
          <div className="fh-step-text">
            <div className="fh-step-title">5-second timer</div>
            <div className="fh-step-desc">Think before the bar runs out</div>
          </div>
        </div>
        <div className="fh-step">
          <span className="fh-step-num">3</span>
          <div className="fh-step-text">
            <div className="fh-step-title">Answer revealed</div>
            <div className="fh-step-desc">Tap early or wait — your call</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="fh-cta-wrap">
        <button className="fh-cta-btn" onClick={onNewDeck}>
          Create a Deck →
        </button>
      </div>

    </div>
  );
}
