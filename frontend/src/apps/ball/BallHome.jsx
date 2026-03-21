import { useState, useEffect } from 'react';
import { TEAMS } from './teams.js';
import {
  getAllTournaments, createTournament, deleteTournament,
  setActiveTournament, getActiveTournament, nextFixture,
} from './ballStorage.js';

const PHASES = ['group', 'knockout', 'done'];

export default function BallHome({ onStartMatch, onAutoTournament, onBack }) {
  const [tournaments, setTournaments] = useState([]);
  const [active, setActive] = useState(null);
  const [creating, setCreating] = useState(false);
  const [tName, setTName] = useState('World Cup 2026');
  const [selectedTeams, setSelectedTeams] = useState(TEAMS.map((team) => team.id));
  const [confirmDelete, setConfirmDelete] = useState(null);

  function reload() {
    setTournaments(getAllTournaments());
    setActive(getActiveTournament());
  }

  useEffect(() => { reload(); }, []);

  function toggleTeam(id) {
    setSelectedTeams((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 15 ? [...prev, id] : prev
    );
  }

  function handleCreate(e) {
    e.preventDefault();
    if (selectedTeams.length < 2) return;
    createTournament(tName.trim() || 'Tournament', selectedTeams, 'league');
    setCreating(false);
    reload();
  }

  function handlePlayNext() {
    if (!active) return;
    const fix = nextFixture(active.id);
    if (!fix) return;
    onStartMatch({ tournament: active, fixture: fix });
  }

  function handleAutoTournament() {
    if (!active) return;
    const fix = nextFixture(active.id);
    if (!fix) return;
    onAutoTournament({ tournament: active, fixture: fix });
  }

  function handleDelete(e, id) {
    e.stopPropagation();
    if (confirmDelete === id) {
      deleteTournament(id);
      setConfirmDelete(null);
      reload();
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 2500);
    }
  }

  const table = active?.standings ?? [];
  const fix = active ? nextFixture(active.id) : null;
  const teamMap = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
  const knockoutFixtures = active?.fixtures?.filter((f) => f.phase !== 'group') ?? [];
  const showBracket = knockoutFixtures.length > 0;
  const qualifiedCount = active?.knockoutSize ?? 0;
  const tableRows = showBracket ? table.slice(0, qualifiedCount) : table;

  return (
    <div className="ball-home-shell">
      {/* Header */}
      <div className="ball-header">
        <button className="ball-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="ball-header-title">⚽ Ball Arena</span>
        <button className="ball-new-btn" onClick={() => setCreating(true)}>+ New</button>
      </div>

      {/* Active tournament */}
      {active && (
        <div className="ball-section">
          <div className="ball-section-label">🏆 {active.name}</div>

          {/* Standings / qualifiers */}
          <div className="ball-table-wrap">
            <table className="ball-table">
              <thead>
                <tr>
                  <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => {
                  const team = teamMap[row.teamId];
                  return (
                    <tr key={row.teamId} className={i < (showBracket ? qualifiedCount : 2) ? 'ball-table-qualify' : ''}>
                      <td>{i + 1}</td>
                      <td>
                        <span className="ball-table-flag">{team?.flag}</span>
                        <span className="ball-table-name">{team?.name}</span>
                      </td>
                      <td>{row.played}</td>
                      <td>{row.won}</td>
                      <td>{row.drawn}</td>
                      <td>{row.lost}</td>
                      <td>{row.scored}</td>
                      <td>{row.conceded}</td>
                      <td><strong>{row.points}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showBracket && (
            <>
              <div className="ball-section-label ball-section-label--sub">Knockout Bracket</div>
              <KnockoutBracket fixtures={knockoutFixtures} teamMap={teamMap} championId={active.championId} />
            </>
          )}

          {/* Next fixture */}
          {fix ? (
            <div className="ball-next-fixture">
              <div className="ball-next-label">{phaseLabel(fix.phase)}</div>
              <div className="ball-next-teams">
                <div className="ball-next-team">
                  <span className="ball-next-flag">{teamMap[fix.homeId]?.flag}</span>
                  <span>{teamMap[fix.homeId]?.name}</span>
                </div>
                <span className="ball-vs">VS</span>
                <div className="ball-next-team">
                  <span className="ball-next-flag">{teamMap[fix.awayId]?.flag}</span>
                  <span>{teamMap[fix.awayId]?.name}</span>
                </div>
              </div>
              <div className="ball-next-actions">
                <button className="ball-play-btn" onClick={handlePlayNext}>▶ Play Match</button>
                <button className="ball-play-btn ball-play-btn--auto" onClick={handleAutoTournament}>🎥 Auto Tournament</button>
              </div>
            </div>
          ) : (
            <div className="ball-all-played">
              <div className="ball-all-played-icon">{active.phase === 'done' ? '🏆' : '🏁'}</div>
              <div>{active.phase === 'done' ? 'Tournament complete!' : 'Group stage complete!'}</div>
              {table[0] && (
                <div className="ball-winner-announce">
                  {active.phase === 'done'
                    ? <>🥇 <strong>{teamMap[active.championId]?.flag} {teamMap[active.championId]?.name}</strong> are the champions</>
                    : <>🥇 <strong>{teamMap[table[0].teamId]?.flag} {teamMap[table[0].teamId]?.name}</strong> finished top of the group</>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tournaments list */}
      {tournaments.length > 0 && (
        <div className="ball-section">
          <div className="ball-section-label">All Tournaments</div>
          <div className="ball-tourn-list">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className={`ball-tourn-item ${active?.id === t.id ? 'ball-tourn-active' : ''}`}
                onClick={() => { setActiveTournament(t.id); reload(); }}
              >
                <div className="ball-tourn-info">
                  <span className="ball-tourn-name">{t.name}</span>
                  <span className="ball-tourn-meta">
                    {t.teamIds.length} teams · {t.fixtures.filter((f) => f.played).length}/{t.fixtures.length} played
                  </span>
                </div>
                <button
                  className={`ball-delete-btn ${confirmDelete === t.id ? 'ball-delete-confirm' : ''}`}
                  onClick={(e) => handleDelete(e, t.id)}
                >
                  {confirmDelete === t.id ? '×?' : '×'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tournaments.length === 0 && !creating && (
        <div className="ball-empty">
          <div className="ball-empty-icon">⚽</div>
          <div className="ball-empty-title">No tournaments yet</div>
          <div className="ball-empty-sub">Create one to start playing!</div>
          <button className="ball-play-btn" onClick={() => setCreating(true)}>Create Tournament</button>
        </div>
      )}

      {/* Create tournament modal */}
      {creating && (
        <div className="ball-modal-overlay" onClick={() => setCreating(false)}>
          <div className="ball-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ball-modal-title">New Tournament</div>
            <form onSubmit={handleCreate}>
              <label className="ball-modal-label">Name</label>
              <input
                className="ball-modal-input"
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                placeholder="World Cup 2026"
              />
              <label className="ball-modal-label">
                Select 2–15 teams <span className="ball-modal-hint">({selectedTeams.length} selected)</span>
              </label>
              <div className="ball-team-grid">
                {TEAMS.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    className={`ball-team-chip ${selectedTeams.includes(team.id) ? 'ball-team-chip--on' : ''}`}
                    style={selectedTeams.includes(team.id) ? { background: team.color, color: team.textColor, borderColor: team.color } : {}}
                    onClick={() => toggleTeam(team.id)}
                  >
                    {team.flag} {team.name}
                  </button>
                ))}
              </div>
              <div className="ball-modal-actions">
                <button type="button" className="ball-modal-cancel" onClick={() => setCreating(false)}>Cancel</button>
                <button
                  type="submit"
                  className="ball-modal-create"
                  disabled={selectedTeams.length < 2}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function phaseLabel(phase) {
  return {
    group: 'Group Match',
    quarterfinal: 'Quarter-final',
    semifinal: 'Semi-final',
    final: 'Final',
  }[phase] || 'Next Match';
}

function KnockoutBracket({ fixtures, teamMap, championId }) {
  const rounds = [
    { key: 'quarterfinal', title: 'Quarter-finals' },
    { key: 'semifinal', title: 'Semi-finals' },
    { key: 'final', title: 'Final' },
  ].filter((round) => fixtures.some((f) => f.phase === round.key));

  return (
    <div className="ball-bracket-wrap">
      <div className="ball-bracket">
        {rounds.map((round) => (
          <div key={round.key} className="ball-bracket-col">
            <div className="ball-bracket-title">{round.title}</div>
            <div className="ball-bracket-list">
              {fixtures.filter((f) => f.phase === round.key).map((fix) => (
                <BracketFixture key={fix.id} fix={fix} teamMap={teamMap} />
              ))}
            </div>
          </div>
        ))}
        {championId && (
          <div className="ball-bracket-col ball-bracket-col--champion">
            <div className="ball-bracket-title">Champion</div>
            <div className="ball-bracket-champion">
              <div className="ball-bracket-cup">🏆</div>
              <div className="ball-bracket-name">{teamMap[championId]?.flag} {teamMap[championId]?.name}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketFixture({ fix, teamMap }) {
  const home = fix.homeId ? `${teamMap[fix.homeId]?.flag} ${teamMap[fix.homeId]?.name}` : fix.homeLabel;
  const away = fix.awayId ? `${teamMap[fix.awayId]?.flag} ${teamMap[fix.awayId]?.name}` : fix.awayLabel;
  const homeWon = fix.played && fix.homeScore > fix.awayScore;
  const awayWon = fix.played && fix.awayScore > fix.homeScore;

  return (
    <div className={`ball-bracket-fixture ${fix.played ? 'ball-bracket-fixture--played' : ''}`}>
      <div className={`ball-bracket-teamline ${homeWon ? 'ball-bracket-teamline--win' : ''}`}>
        <span>{home || 'TBD'}</span>
        <strong>{fix.played ? fix.homeScore : '–'}</strong>
      </div>
      <div className={`ball-bracket-teamline ${awayWon ? 'ball-bracket-teamline--win' : ''}`}>
        <span>{away || 'TBD'}</span>
        <strong>{fix.played ? fix.awayScore : '–'}</strong>
      </div>
    </div>
  );
}
