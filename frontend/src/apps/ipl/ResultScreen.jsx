import { useEffect, useState } from 'react';
import { getTeam, uiColor } from './iplTeams.js';
import { recordResult } from './iplStorage.js';

export default function ResultScreen({ matchConfig, homeScore, awayScore, onContinue, onHome }) {
  const { fixture, tournament, customTeams = null } = matchConfig;
  const homeTeam = customTeams?.home || getTeam(fixture.homeId);
  const awayTeam = customTeams?.away || getTeam(fixture.awayId);

  const [saved, setSaved] = useState(false);

  // Determine result
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const isDraw = homeScore === awayScore;
  const winner = homeWon ? homeTeam : awayWon ? awayTeam : null;
  const isGroup = fixture.phase === 'group';
  const isCustom = fixture.phase === 'custom';
  const stageText = {
    quarterfinal: 'advances to the semi-finals',
    semifinal: 'advances to the final',
    final: 'become champions',
  };

  useEffect(() => {
    if (saved || !tournament) return;
    recordResult(tournament.id, fixture.id, homeScore, awayScore);
    setSaved(true);
  }, []); // eslint-disable-line

  return (
    <div className="ball-result-shell">
      {/* Result header */}
      <div className="ball-result-header">
        {isDraw ? (
          <div className="ball-result-draw">
            <div className="ball-result-trophy">🤝</div>
            <div className="ball-result-headline">Draw!</div>
          </div>
        ) : (
          <div className="ball-result-winner">
            <div className="ball-result-trophy">🏆</div>
            <div className="ball-result-headline">
              <span style={{ color: uiColor(winner) }}>{winner.name}</span>
              <br />
              <span className="ball-result-subline">wins!</span>
            </div>
          </div>
        )}
      </div>

      {/* Scoreline */}
      <div className="ball-result-scoreline">
        <div className="ball-result-team" style={{ opacity: awayWon ? 0.55 : 1 }}>
          <ResultTeamAvatar team={homeTeam} />
          <div className="ball-result-team-name">{homeTeam.name}</div>
        </div>
        <div className="ball-result-score-box">
          <span className="ball-result-s" style={{ color: homeWon ? uiColor(homeTeam) : '#8696a0' }}>{homeScore}</span>
          <span className="ball-result-sep">–</span>
          <span className="ball-result-s" style={{ color: awayWon ? uiColor(awayTeam) : '#8696a0' }}>{awayScore}</span>
        </div>
        <div className="ball-result-team" style={{ opacity: homeWon ? 0.55 : 1 }}>
          <ResultTeamAvatar team={awayTeam} />
          <div className="ball-result-team-name">{awayTeam.name}</div>
        </div>
      </div>

      {/* Summary */}
      {isCustom ? (
        <div className="ball-result-stage-note">Quick league image battle completed.</div>
      ) : isGroup ? (
        <div className="ball-result-pts-row">
          <PointsBadge team={homeTeam} pts={homeWon ? 3 : isDraw ? 1 : 0} />
          <PointsBadge team={awayTeam} pts={awayWon ? 3 : isDraw ? 1 : 0} />
        </div>
      ) : (
        <div className="ball-result-stage-note">
          {winner ? (
            <>
              <span style={{ color: uiColor(winner) }}>{winner.name}</span> {stageText[fixture.phase] || 'advance'}.
            </>
          ) : 'Knockout matches cannot end in a draw.'}
        </div>
      )}

      {/* Actions */}
      <div className="ball-result-actions">
        {tournament && (
          <button className="ball-result-btn ball-result-btn--primary" onClick={onContinue}>
            {isGroup ? '🏆 View Tournament' : '🧭 Continue Tournament'}
          </button>
        )}
        <button className="ball-result-btn ball-result-btn--secondary" onClick={onHome}>
          🏠 Home
        </button>
      </div>
    </div>
  );
}

function ResultTeamAvatar({ team }) {
  if (team.imageSrc) {
    return <img src={team.imageSrc} alt={team.name} className="ball-result-flag ball-team-image" />;
  }
  return <div className="ball-result-flag">{team.flag}</div>;
}

function PointsBadge({ team, pts }) {
  const labels = { 3: 'Win', 1: 'Draw', 0: 'Loss' };
  return (
    <div className="ball-pts-badge" style={{ borderColor: uiColor(team) }}>
      <span className="ball-pts-flag">
        {team.imageSrc
          ? <img src={team.imageSrc} alt={team.name} style={{ width: 28, height: 28, objectFit: 'contain', verticalAlign: 'middle' }} />
          : team.flag}
      </span>
      <span className="ball-pts-val" style={{ color: uiColor(team) }}>{pts > 0 ? `+${pts}` : pts}</span>
      <span className="ball-pts-label">{labels[pts]}</span>
    </div>
  );
}
