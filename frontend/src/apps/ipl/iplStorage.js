// ---------------------------------------------------------------------------
// iplStorage.js  –  Tournament persistence via localStorage (IPL edition)
// ---------------------------------------------------------------------------

const TOURNAMENT_KEY = 'ipl_tournaments';
const ACTIVE_KEY = 'ipl_active_tournament';

// ── helpers ──────────────────────────────────────────────────────────────────
function loadAll() {
  try { return JSON.parse(localStorage.getItem(TOURNAMENT_KEY) || '[]'); }
  catch { return []; }
}
function saveAll(list) {
  localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
}

function standingsComparator(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  const gdA = a.scored - a.conceded;
  const gdB = b.scored - b.conceded;
  if (gdB !== gdA) return gdB - gdA;
  if (b.scored !== a.scored) return b.scored - a.scored;
  if (b.won !== a.won) return b.won - a.won;
  const ratioA = a.conceded === 0 ? a.scored : a.scored / a.conceded;
  const ratioB = b.conceded === 0 ? b.scored : b.scored / b.conceded;
  if (ratioB !== ratioA) return ratioB - ratioA;
  return a.teamId.localeCompare(b.teamId);
}

function sortStandings(standings) {
  standings.sort(standingsComparator);
}

function allPlayed(fixtures) {
  return fixtures.length > 0 && fixtures.every((f) => f.played);
}

function knockoutSizeFor(teamCount) {
  if (teamCount >= 8) return 8;
  if (teamCount >= 4) return 4;
  return 2;
}

function winnerIdOf(fix) {
  if (!fix) return null;
  return fix.homeScore >= fix.awayScore ? fix.homeId : fix.awayId;
}

function createFixture({ id, phase, round, homeId = null, awayId = null, homeLabel = 'TBD', awayLabel = 'TBD', slot, homeFrom = null, awayFrom = null }) {
  return {
    id, homeId, awayId, homeLabel, awayLabel, homeFrom, awayFrom,
    homeScore: null, awayScore: null, winnerId: null,
    played: false, phase, round, slot,
  };
}

function createKnockoutFixtures(t) {
  if (t.fixtures.some((f) => f.phase !== 'group')) return false;

  sortStandings(t.standings);
  const knockoutSize = knockoutSizeFor(t.teamIds.length);
  const qualifiers = t.standings.slice(0, knockoutSize).map((s) => s.teamId);
  t.knockoutSize = knockoutSize;

  if (knockoutSize === 8) {
    t.fixtures.push(
      createFixture({ id: 'qf1', slot: 'qf1', phase: 'quarterfinal', round: 1, homeId: qualifiers[0], awayId: qualifiers[7], homeLabel: '1st Place', awayLabel: '8th Place' }),
      createFixture({ id: 'qf2', slot: 'qf2', phase: 'quarterfinal', round: 1, homeId: qualifiers[3], awayId: qualifiers[4], homeLabel: '4th Place', awayLabel: '5th Place' }),
      createFixture({ id: 'qf3', slot: 'qf3', phase: 'quarterfinal', round: 1, homeId: qualifiers[1], awayId: qualifiers[6], homeLabel: '2nd Place', awayLabel: '7th Place' }),
      createFixture({ id: 'qf4', slot: 'qf4', phase: 'quarterfinal', round: 1, homeId: qualifiers[2], awayId: qualifiers[5], homeLabel: '3rd Place', awayLabel: '6th Place' }),
      createFixture({ id: 'sf1', slot: 'sf1', phase: 'semifinal', round: 2, homeFrom: 'qf1', awayFrom: 'qf2', homeLabel: 'Winner QF1', awayLabel: 'Winner QF2' }),
      createFixture({ id: 'sf2', slot: 'sf2', phase: 'semifinal', round: 2, homeFrom: 'qf3', awayFrom: 'qf4', homeLabel: 'Winner QF3', awayLabel: 'Winner QF4' }),
      createFixture({ id: 'final', slot: 'final', phase: 'final', round: 3, homeFrom: 'sf1', awayFrom: 'sf2', homeLabel: 'Winner SF1', awayLabel: 'Winner SF2' })
    );
    t.phase = 'quarterfinal';
    return true;
  }

  if (knockoutSize === 4) {
    t.fixtures.push(
      createFixture({ id: 'sf1', slot: 'sf1', phase: 'semifinal', round: 1, homeId: qualifiers[0], awayId: qualifiers[3], homeLabel: '1st Place', awayLabel: '4th Place' }),
      createFixture({ id: 'sf2', slot: 'sf2', phase: 'semifinal', round: 1, homeId: qualifiers[1], awayId: qualifiers[2], homeLabel: '2nd Place', awayLabel: '3rd Place' }),
      createFixture({ id: 'final', slot: 'final', phase: 'final', round: 2, homeFrom: 'sf1', awayFrom: 'sf2', homeLabel: 'Winner SF1', awayLabel: 'Winner SF2' })
    );
    t.phase = 'semifinal';
    return true;
  }

  t.fixtures.push(
    createFixture({ id: 'final', slot: 'final', phase: 'final', round: 1, homeId: qualifiers[0], awayId: qualifiers[1], homeLabel: '1st Place', awayLabel: '2nd Place' })
  );
  t.phase = 'final';
  return true;
}

function advanceKnockout(t) {
  let changed = false;
  const bySlot = Object.fromEntries(t.fixtures.map((f) => [f.slot, f]));
  const qfs = t.fixtures.filter((f) => f.phase === 'quarterfinal');
  const sfs = t.fixtures.filter((f) => f.phase === 'semifinal');
  const final = t.fixtures.find((f) => f.phase === 'final');

  if (qfs.length && allPlayed(qfs)) {
    if (bySlot.sf1 && !bySlot.sf1.homeId) { bySlot.sf1.homeId = winnerIdOf(bySlot.qf1); changed = true; }
    if (bySlot.sf1 && !bySlot.sf1.awayId) { bySlot.sf1.awayId = winnerIdOf(bySlot.qf2); changed = true; }
    if (bySlot.sf2 && !bySlot.sf2.homeId) { bySlot.sf2.homeId = winnerIdOf(bySlot.qf3); changed = true; }
    if (bySlot.sf2 && !bySlot.sf2.awayId) { bySlot.sf2.awayId = winnerIdOf(bySlot.qf4); changed = true; }
    if (t.phase === 'quarterfinal') { t.phase = 'semifinal'; changed = true; }
  }

  if (sfs.length && allPlayed(sfs) && final) {
    if (!final.homeId) { final.homeId = winnerIdOf(bySlot.sf1); changed = true; }
    if (!final.awayId) { final.awayId = winnerIdOf(bySlot.sf2); changed = true; }
    if (t.phase !== 'final' && t.phase !== 'done') { t.phase = 'final'; changed = true; }
  }

  if (final?.played) {
    const championId = winnerIdOf(final);
    if (t.championId !== championId) { t.championId = championId; changed = true; }
    if (t.phase !== 'done') { t.phase = 'done'; changed = true; }
  }

  return changed;
}

function hydrateTournamentInPlace(t) {
  let changed = false;
  sortStandings(t.standings);
  const groupFixtures = t.fixtures.filter((f) => f.phase === 'group');
  if (groupFixtures.length && allPlayed(groupFixtures) && !t.fixtures.some((f) => f.phase !== 'group')) {
    changed = createKnockoutFixtures(t) || changed;
  }
  changed = advanceKnockout(t) || changed;
  return changed;
}

// ── Tournament CRUD ──────────────────────────────────────────────────────────

export function createTournament(name, teamIds, format = 'league') {
  const id = `ipl-tourn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const standings = teamIds.map((teamId) => ({
    teamId, played: 0, won: 0, drawn: 0, lost: 0,
    scored: 0, conceded: 0, points: 0,
  }));

  const fixtures = [];
  const n = teamIds.length;
  const teams = [...teamIds];
  if (n % 2 !== 0) teams.push(null);
  const half = teams.length / 2;
  const numRounds = teams.length - 1;
  const rotating = teams.slice(1);

  for (let round = 0; round < numRounds; round++) {
    const round_circle = [teams[0], ...rotating];
    for (let i = 0; i < half; i++) {
      const home = round_circle[i];
      const away = round_circle[teams.length - 1 - i];
      if (home !== null && away !== null) {
        fixtures.push({
          id: `fix-r${round}-${i}`,
          homeId: home, awayId: away,
          homeScore: null, awayScore: null,
          played: false, phase: 'group', round,
        });
      }
    }
    rotating.unshift(rotating.pop());
  }

  const tournament = {
    id, name, format, teamIds, standings, fixtures,
    phase: 'group', knockoutSize: null, championId: null,
    createdAt: Date.now(),
  };

  const all = loadAll();
  all.unshift(tournament);
  saveAll(all);
  localStorage.setItem(ACTIVE_KEY, id);
  return tournament;
}

export function getActiveTournament() {
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (!activeId) return null;
  return getTournament(activeId);
}

export function getTournament(id) {
  const all = loadAll();
  const t = all.find((x) => x.id === id) ?? null;
  if (!t) return null;
  if (hydrateTournamentInPlace(t)) saveAll(all);
  return t;
}

export function getAllTournaments() {
  const all = loadAll();
  let changed = false;
  for (const t of all) changed = hydrateTournamentInPlace(t) || changed;
  if (changed) saveAll(all);
  return all;
}

export function setActiveTournament(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function deleteTournament(id) {
  saveAll(loadAll().filter((t) => t.id !== id));
  if (localStorage.getItem(ACTIVE_KEY) === id) {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function recordResult(tournamentId, fixtureId, homeScore, awayScore) {
  const all = loadAll();
  const t = all.find((x) => x.id === tournamentId);
  if (!t) return null;

  const fix = t.fixtures.find((f) => f.id === fixtureId);
  if (!fix || fix.played) return t;

  fix.homeScore = homeScore;
  fix.awayScore = awayScore;
  fix.played = true;
  fix.winnerId = homeScore >= awayScore ? fix.homeId : fix.awayId;

  if (fix.phase === 'group') {
    const home = t.standings.find((s) => s.teamId === fix.homeId);
    const away = t.standings.find((s) => s.teamId === fix.awayId);

    home.played++; away.played++;
    home.scored += homeScore; home.conceded += awayScore;
    away.scored += awayScore; away.conceded += homeScore;

    if (homeScore > awayScore) {
      home.won++; home.points += 3;
      away.lost++;
    } else if (awayScore > homeScore) {
      away.won++; away.points += 3;
      home.lost++;
    } else {
      home.drawn++; home.points += 1;
      away.drawn++; away.points += 1;
    }

    sortStandings(t.standings);
  }

  hydrateTournamentInPlace(t);
  saveAll(all);
  return t;
}

export function nextFixture(tournamentId) {
  const t = getTournament(tournamentId);
  if (!t) return null;
  return t.fixtures.find((f) => !f.played && f.homeId && f.awayId) ?? null;
}
