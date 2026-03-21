export default function LaunchScreen({ onChat, onFlash, onBall }) {
  return (
    <div className="ls-shell">
      <div className="ls-grid">

        <button className="ls-app" onClick={onChat}>
          <div className="ls-icon ls-icon--fire">🔥</div>
          <span className="ls-label">Roast Battles</span>
        </button>

        <button className="ls-app" onClick={onFlash}>
          <div className="ls-icon ls-icon--cards">🗂</div>
          <span className="ls-label">Flashcards</span>
        </button>

        <button className="ls-app" onClick={onBall}>
          <div className="ls-icon ls-icon--ball">⚽</div>
          <span className="ls-label">Ball Arena</span>
        </button>

      </div>
    </div>
  );
}
