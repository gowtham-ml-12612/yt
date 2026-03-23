export default function PlinkoHome({ onLaunch, onBack }) {
  return (
    <div className="plinko-home-shell">
      {/* Header */}
      <div className="plinko-header">
        <button className="plinko-back-btn" onClick={onBack}>
          ← Back
        </button>
        <span className="plinko-header-title">🎱 Plinko Drop</span>
        <div style={{ width: 50 }} />
      </div>

      <div className="plinko-hero">
        <h2>Drop the Ball</h2>
        <p>Set up the buckets and watch the draw unfold!</p>
        <button className="plinko-start-btn" onClick={() => onLaunch({})}>
          Start Drop →
        </button>
      </div>
    </div>
  );
}
