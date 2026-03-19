const KEY = 'roast_battles';

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAll(battles) {
  localStorage.setItem(KEY, JSON.stringify(battles));
}

/** Create a new battle record and return its id */
export function createBattle(config) {
  const battles = loadAll();
  const battle = {
    id: `battle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    topic: config.topic,
    leftAgent: config.leftAgent,
    rightAgent: config.rightAgent,
    maxTurns: config.maxTurns,
    autoMode: config.autoMode,
    responseLines: config.responseLines,
    brutalityLevel: config.brutalityLevel,
    contextData: config.contextData,
    ctaMessage: config.ctaMessage,
    messages: [],
    status: 'live',   // 'live' | 'ended'
    createdAt: Date.now(),
    updatedAt: Date.now(),
    totalTurns: 0,
  };
  battles.unshift(battle);
  saveAll(battles);
  return battle.id;
}

/** Append a single message to an existing battle */
export function appendMessage(battleId, msg) {
  const battles = loadAll();
  const b = battles.find((x) => x.id === battleId);
  if (!b) return;
  b.messages.push(msg);
  b.totalTurns = msg.turn;
  b.updatedAt = Date.now();
  saveAll(battles);
}

/** Mark a battle as ended */
export function endBattle(battleId, reason, totalTurns) {
  const battles = loadAll();
  const b = battles.find((x) => x.id === battleId);
  if (!b) return;
  b.status = 'ended';
  b.endReason = reason;
  b.totalTurns = totalTurns;
  b.updatedAt = Date.now();
  saveAll(battles);
}

/** Get all battles (newest first) */
export function getAllBattles() {
  return loadAll();
}

/** Get a single battle by id */
export function getBattle(battleId) {
  return loadAll().find((x) => x.id === battleId) || null;
}

/** Delete a battle */
export function deleteBattle(battleId) {
  saveAll(loadAll().filter((x) => x.id !== battleId));
}

/** Import battles from a parsed JSON array — merges by id (no duplicates) */
export function importBattles(incoming) {
  const existing = loadAll();
  const existingIds = new Set(existing.map((b) => b.id));
  const merged = [
    ...incoming.filter((b) => !existingIds.has(b.id)),
    ...existing,
  ];
  saveAll(merged);
  return merged.length - existing.length; // returns count of newly added
}
