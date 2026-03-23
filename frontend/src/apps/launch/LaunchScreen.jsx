export default function LaunchScreen({ onChat, onFlash, onBall, onRace, onNews, onPlinko, onIpl }) {
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

        <button className="ls-app" onClick={onIpl}>
          <div className="ls-icon">🏏</div>
          <span className="ls-label">IPL Arena</span>
        </button>

        <button className="ls-app" onClick={onRace}>
          <div className="ls-icon ls-icon--race">📊</div>
          <span className="ls-label">Bar Race</span>
        </button>

        <button className="ls-app" onClick={onNews}>
          <div className="ls-icon ls-icon--news">📺</div>
          <span className="ls-label">News Reader</span>
        </button>

        <button className="ls-app" onClick={onPlinko}>
          <div className="ls-icon">🎱</div>
          <span className="ls-label">Plinko Drop</span>
        </button>

      </div>
    </div>
  );
}
