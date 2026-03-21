import { useState } from 'react';
import { getTeam } from './teams.js';

export default function PredictScreen({ fixture, tournament, onStart, onBack }) {
  const [prediction, setPrediction] = useState(null); // 'home' | 'away' | 'draw'

  const home = getTeam(fixture.homeId);
  const away = getTeam(fixture.awayId);

  function handleStart() {
    onStart({ fixture, tournament, prediction });
  }

  return (
    <div className="ball-predict-shell">
      {/* Header */}
      <div className="ball-header">
        <button className="ball-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="ball-header-title">⚽ Match Preview</span>
        <div style={{ width: 44 }} />
      </div>

      <div className="ball-predict-inner">
        {/* Tournament name */}
        <div className="ball-predict-meta">{tournament?.name ?? 'Exhibition Match'}</div>

        {/* VS card */}
        <div className="ball-matchup-card">
          <TeamCard team={home} side="left" />
          <div className="ball-matchup-vs">VS</div>
          <TeamCard team={away} side="right" />
        </div>

        {/* Stats comparison */}
        <div className="ball-stats-grid">
          <StatRow label="Speed" left={home.speed} right={away.speed} max={4} />
          <StatRow label="Mass" left={home.mass} right={away.mass} max={1.5} invert />
          <StatRow label="Agility" left={home.agility} right={away.agility} max={0.25} />
        </div>

        {/* Prediction */}
        <div className="ball-predict-section">
          <div className="ball-predict-title">🤔 Predict the winner</div>
          <div className="ball-predict-buttons">
            <button
              className={`ball-pred-btn ${prediction === 'home' ? 'ball-pred-btn--active' : ''}`}
              style={prediction === 'home' ? { background: home.color, color: home.textColor, borderColor: home.color } : {}}
              onClick={() => setPrediction('home')}
            >
              {home.flag} {home.name}
            </button>
            <button
              className={`ball-pred-btn ball-pred-btn--draw ${prediction === 'draw' ? 'ball-pred-btn--active ball-pred-btn--draw-active' : ''}`}
              onClick={() => setPrediction('draw')}
            >
              Draw
            </button>
            <button
              className={`ball-pred-btn ${prediction === 'away' ? 'ball-pred-btn--active' : ''}`}
              style={prediction === 'away' ? { background: away.color, color: away.textColor, borderColor: away.color } : {}}
              onClick={() => setPrediction('away')}
            >
              {away.flag} {away.name}
            </button>
          </div>
        </div>

        {/* Start button */}
        <button
          className={`ball-start-match-btn ${prediction ? 'ball-start-match-btn--ready' : ''}`}
          onClick={handleStart}
        >
          {prediction ? '▶ Kick Off!' : '▶ Start without prediction'}
        </button>

        {/* Flavour */}
        <div className="ball-predict-footer">
          30 sec match · physics-based · no player control
        </div>
      </div>
    </div>
  );
}

function TeamCard({ team, side }) {
  return (
    <div className={`ball-team-card ball-team-card--${side}`}>
      <div className="ball-team-flag-large">{team.flag}</div>
      <div className="ball-team-name-large">{team.name}</div>
      <div
        className="ball-team-color-dot"
        style={{ background: team.color, border: `2px solid ${team.secondary}` }}
      />
    </div>
  );
}

function StatRow({ label, left, right, max, invert = false }) {
  const pctL = Math.min((left / max) * 100, 100);
  const pctR = Math.min((right / max) * 100, 100);
  const winL = invert ? left < right : left > right;
  const winR = invert ? right < left : right > left;
  return (
    <div className="ball-stat-row">
      <span className={`ball-stat-val ${winL ? 'ball-stat-win' : ''}`}>{left.toFixed(2)}</span>
      <div className="ball-stat-bars">
        <div className="ball-stat-bar ball-stat-bar--left">
          <div className="ball-stat-fill ball-stat-fill--left" style={{ width: `${pctL}%` }} />
        </div>
        <span className="ball-stat-label">{label}</span>
        <div className="ball-stat-bar ball-stat-bar--right">
          <div className="ball-stat-fill ball-stat-fill--right" style={{ width: `${pctR}%` }} />
        </div>
      </div>
      <span className={`ball-stat-val ${winR ? 'ball-stat-win' : ''}`}>{right.toFixed(2)}</span>
    </div>
  );
}
