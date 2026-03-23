import { useState, useEffect } from 'react';
import { TEAMS } from './iplTeams.js';
import {
  getAllTournaments, createTournament, deleteTournament,
  setActiveTournament, getActiveTournament, nextFixture,
} from './iplStorage.js';

export default function IplHome({ onStartMatch, onAutoTournament, onStartCustomMatch, onStartRoyaleMode, onBack }) {
  const [tournaments, setTournaments] = useState([]);
  const [active, setActive] = useState(null);
  const [creating, setCreating] = useState(false);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [tName, setTName] = useState('IPL 2026');
  const [selectedTeams, setSelectedTeams] = useState(TEAMS.map((team) => team.id));
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [customHomeName, setCustomHomeName] = useState('Team A');
  const [customAwayName, setCustomAwayName] = useState('Team B');
  const [customHomeImage, setCustomHomeImage] = useState('');
  const [customAwayImage, setCustomAwayImage] = useState('');

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
    createTournament(tName.trim() || 'IPL Tournament', selectedTeams, 'league');
    setCreating(false);
    reload();
  }

  function closeCustomModal() {
    setCreatingCustom(false);
  }

  async function handleImageChange(side, file) {
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (side === 'home') setCustomHomeImage(dataUrl);
    else setCustomAwayImage(dataUrl);
  }

  function handleCreateCustomMatch(e) {
    e.preventDefault();
    if (!customHomeImage || !customAwayImage) return;

    const matchId = `custom-${Date.now()}`;
    const home = {
      id: `${matchId}-home`,
      name: customHomeName.trim() || 'Team A',
      flag: '',
      imageSrc: customHomeImage,
      color: '#FF6B35',
      secondary: '#FFD1B3',
      textColor: '#ffffff',
      speed: 3.2, mass: 1.0, friction: 0.986, agility: 0.17,
      isCustom: true,
    };
    const away = {
      id: `${matchId}-away`,
      name: customAwayName.trim() || 'Team B',
      flag: '',
      imageSrc: customAwayImage,
      color: '#004BA0',
      secondary: '#D1E8FF',
      textColor: '#ffffff',
      speed: 3.2, mass: 1.0, friction: 0.986, agility: 0.17,
      isCustom: true,
    };

    onStartCustomMatch({
      fixture: { id: matchId, homeId: home.id, awayId: away.id, phase: 'custom', round: 0 },
      tournament: null,
      autoMode: false,
      customTeams: { home, away },
      mode: 'league-duel',
    });
    closeCustomModal();
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
        <span className="ball-header-title">🏏 IPL Arena</span>
        <div className="ball-header-actions">
          <button className="ball-new-btn ball-new-btn--ghost" onClick={onStartRoyaleMode}>🏟️ Royale</button>
          <button className="ball-new-btn ball-new-btn--ghost" onClick={() => setCreatingCustom(true)}>🖼️ Duel</button>
          <button className="ball-new-btn" onClick={() => setCreating(true)}>+ New</button>
        </div>
      </div>

      {/* Active tournament */}
      {active && (
        <div className="ball-section">
          <div className="ball-section-label">🏆 {active.name}</div>

          {/* Standings */}
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
                        <TeamChip team={team} />
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
                  <TeamLogoSmall team={teamMap[fix.homeId]} />
                  <span>{teamMap[fix.homeId]?.name}</span>
                </div>
                <span className="ball-vs">VS</span>
                <div className="ball-next-team">
                  <TeamLogoSmall team={teamMap[fix.awayId]} />
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
                    ? <>🥇 <strong>{teamMap[active.championId]?.name}</strong> are the champions</>
                    : <>🥇 <strong>{teamMap[table[0].teamId]?.name}</strong> finished top of the group</>}
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
          <div className="ball-empty-icon">🏏</div>
          <div className="ball-empty-title">No tournaments yet</div>
          <div className="ball-empty-sub">Create an IPL tournament or start a quick team battle.</div>
          <div className="ball-empty-actions">
            <button className="ball-play-btn ball-play-btn--secondary" onClick={onStartRoyaleMode}>🏟️ All Teams Royale</button>
            <button className="ball-play-btn ball-play-btn--secondary" onClick={() => setCreatingCustom(true)}>🖼️ Image Battle</button>
            <button className="ball-play-btn" onClick={() => setCreating(true)}>Create Tournament</button>
          </div>
        </div>
      )}

      {/* Create tournament modal */}
      {creating && (
        <div className="ball-modal-overlay" onClick={() => setCreating(false)}>
          <div className="ball-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ball-modal-title">New IPL Tournament</div>
            <form onSubmit={handleCreate}>
              <label className="ball-modal-label">Name</label>
              <input
                className="ball-modal-input"
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                placeholder="IPL 2026"
              />
              <label className="ball-modal-label">
                Select 2–10 teams <span className="ball-modal-hint">({selectedTeams.length} selected)</span>
              </label>
              <div className="ball-team-grid">
                {TEAMS.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    className={`ball-team-chip ipl-team-chip ${selectedTeams.includes(team.id) ? 'ball-team-chip--on' : ''}`}
                    style={selectedTeams.includes(team.id) ? { background: team.color, color: team.textColor, borderColor: team.color } : {}}
                    onClick={() => toggleTeam(team.id)}
                  >
                    <IplTeamLogo team={team} size={18} />
                    <span>{team.flag}</span>
                  </button>
                ))}
              </div>
              <div className="ball-modal-actions">
                <button type="button" className="ball-modal-cancel" onClick={() => setCreating(false)}>Cancel</button>
                <button type="submit" className="ball-modal-create" disabled={selectedTeams.length < 2}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {creatingCustom && (
        <div className="ball-modal-overlay" onClick={closeCustomModal}>
          <div className="ball-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ball-modal-title">🏏 Image Team Battle</div>
            <form onSubmit={handleCreateCustomMatch}>
              <div className="ball-upload-grid">
                <div className="ball-upload-card">
                  <label className="ball-modal-label">Left Team Name</label>
                  <input
                    className="ball-modal-input"
                    value={customHomeName}
                    onChange={(e) => setCustomHomeName(e.target.value)}
                    placeholder="Team A"
                  />
                  <label className="ball-modal-label">Left Team Image</label>
                  <label className="ball-upload-drop">
                    <input
                      type="file"
                      accept="image/*"
                      className="ball-upload-input"
                      onChange={(e) => handleImageChange('home', e.target.files?.[0])}
                    />
                    {customHomeImage ? <img src={customHomeImage} alt={customHomeName} className="ball-upload-preview" /> : <span>Upload image</span>}
                  </label>
                </div>

                <div className="ball-upload-card">
                  <label className="ball-modal-label">Right Team Name</label>
                  <input
                    className="ball-modal-input"
                    value={customAwayName}
                    onChange={(e) => setCustomAwayName(e.target.value)}
                    placeholder="Team B"
                  />
                  <label className="ball-modal-label">Right Team Image</label>
                  <label className="ball-upload-drop">
                    <input
                      type="file"
                      accept="image/*"
                      className="ball-upload-input"
                      onChange={(e) => handleImageChange('away', e.target.files?.[0])}
                    />
                    {customAwayImage ? <img src={customAwayImage} alt={customAwayName} className="ball-upload-preview" /> : <span>Upload image</span>}
                  </label>
                </div>
              </div>

              <div className="ball-modal-actions">
                <button type="button" className="ball-modal-cancel" onClick={closeCustomModal}>Cancel</button>
                <button type="submit" className="ball-modal-create" disabled={!customHomeImage || !customAwayImage}>Start Battle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IplTeamLogo({ team, size = 24 }) {
  if (!team) return null;
  return (
    <img
      src={team.imageSrc}
      alt={team.flag}
      width={size}
      height={size}
      style={{ objectFit: 'contain', borderRadius: 3, verticalAlign: 'middle' }}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

function TeamChip({ team }) {
  if (!team) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <IplTeamLogo team={team} size={20} />
      <span className="ball-table-name">{team.name}</span>
    </span>
  );
}

function TeamLogoSmall({ team }) {
  if (!team) return null;
  return (
    <span className="ball-next-flag">
      <IplTeamLogo team={team} size={24} />
    </span>
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
              <div className="ball-bracket-name">{teamMap[championId]?.name}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketFixture({ fix, teamMap }) {
  const homeTeam = fix.homeId ? teamMap[fix.homeId] : null;
  const awayTeam = fix.awayId ? teamMap[fix.awayId] : null;
  const home = homeTeam ? homeTeam.name : fix.homeLabel;
  const away = awayTeam ? awayTeam.name : fix.awayLabel;
  const homeWon = fix.played && fix.homeScore > fix.awayScore;
  const awayWon = fix.played && fix.awayScore > fix.homeScore;

  return (
    <div className={`ball-bracket-fixture ${fix.played ? 'ball-bracket-fixture--played' : ''}`}>
      <div className={`ball-bracket-teamline ${homeWon ? 'ball-bracket-teamline--win' : ''}`}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {homeTeam && <img src={homeTeam.imageSrc} alt={homeTeam.flag} width={14} height={14} style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          {home || 'TBD'}
        </span>
        <strong>{fix.played ? fix.homeScore : '–'}</strong>
      </div>
      <div className={`ball-bracket-teamline ${awayWon ? 'ball-bracket-teamline--win' : ''}`}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {awayTeam && <img src={awayTeam.imageSrc} alt={awayTeam.flag} width={14} height={14} style={{ objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          {away || 'TBD'}
        </span>
        <strong>{fix.played ? fix.awayScore : '–'}</strong>
      </div>
    </div>
  );
}
