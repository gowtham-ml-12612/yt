import { callOpenAI } from './agents/openai.js';
import { callClaude } from './agents/claude.js';

// --- State ---
let state = {
  running: false,
  history: [],
  config: null,
  continueResolve: null,
  autoMode: false,
};

// --- Public API ---
export function stopConversation() {
  state.running = false;
  if (state.continueResolve) {
    state.continueResolve();
    state.continueResolve = null;
  }
}

export function nextTurn() {
  if (state.continueResolve) {
    state.continueResolve();
    state.continueResolve = null;
  }
}

export function setMode(auto) {
  state.autoMode = auto;
  // If switching to auto while paused, unblock immediately
  if (auto && state.continueResolve) {
    state.continueResolve();
    state.continueResolve = null;
  }
}

function waitForContinue() {
  return new Promise((resolve) => {
    state.continueResolve = resolve;
  });
}

export async function startConversation(config, emit) {
  // Seed history from a resumed battle if provided
  const seededHistory = (config.history || []).map((msg) => ({
    id: msg.id,
    side: msg.side,
    agentConfig: msg.side === 'left' ? config.leftAgent : config.rightAgent,
    content: msg.content,
    turn: msg.turn,
  }));

  state = {
    running: true,
    history: seededHistory,
    config,
    continueResolve: null,
    autoMode: !!config.autoMode,
  };

  const { topic, leftAgent, rightAgent, maxTurns } = config;
  const limit = maxTurns === 0 ? Infinity : maxTurns;

  // Resume from where we left off
  const seedTurns = seededHistory.length;
  let turn = seedTurns + 1;
  // Next side alternates from last seeded message
  let activeSide = seedTurns % 2 === 0 ? 'left' : 'right';

  while (state.running && turn <= limit) {
    const activeAgent = activeSide === 'left' ? leftAgent : rightAgent;

    // Signal "thinking"
    emit('thinking_start', { side: activeSide, agentName: activeAgent.name, provider: activeAgent.provider });

    // In auto mode show thinking for ~1s; manual mode just a brief flash
    if (state.autoMode) {
      await randSleep(800, 1200);
    } else {
      await sleep(300);
    }

    if (!state.running) break;

    // Build the conversation history from this agent's POV
    const messages = buildMessages(activeSide, config);

    // System prompt
    const systemPrompt = buildSystemPrompt(topic, activeAgent.name, activeSide, config);

    // Call the right AI
    let response;
    const maxTokens = { 1: 35, 2: 90, 3: 140, 4: 190 }[config.responseLines] ?? 90;
    try {
      if (activeAgent.provider === 'openai') {
        response = await callOpenAI(messages, systemPrompt, maxTokens);
      } else {
        response = await callClaude(messages, systemPrompt, maxTokens);
      }
    } catch (err) {
      emit('error', { message: `${activeAgent.name} failed: ${err.message}` });
      state.running = false;
      break;
    }

    if (!state.running) break;

    // Hard server-side trim — model can't be trusted to self-limit
    response = enforceLimit(response, config.responseLines || 2);

    // Store message
    const entry = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      side: activeSide,
      agentConfig: activeAgent,
      content: response,
      turn,
    };
    state.history.push(entry);

    // Emit to frontend
    emit('message_complete', {
      id: entry.id,
      side: activeSide,
      agentName: activeAgent.name,
      content: response,
      turn,
    });

    // Switch sides
    activeSide = activeSide === 'left' ? 'right' : 'left';
    turn++;

    // Pause or auto-continue based on current mode
    if (state.running && turn <= limit) {
      if (state.autoMode) {
        emit('waiting', { nextSide: activeSide, autoMode: true });
        await randSleep(2500, 3500);
      } else {
        emit('waiting', { nextSide: activeSide, autoMode: false });
        await waitForContinue();
        await sleep(300);
      }
    }
  }

  if (state.running || turn > limit) {
    emit('conversation_end', {
      reason: turn > limit ? 'max_turns' : 'stopped',
      totalTurns: turn - 1,
    });
  }

  state.running = false;
}

// --- Helpers ---

/**
 * Reformat history from the POV of the agent on `mySide`:
 * - My past messages → role: "assistant"
 * - Other agent's messages → role: "user"
 */
function buildMessages(mySide, config) {
  const lines = config?.responseLines || 2;
  const reminder = lines === 1
    ? `[1 SENTENCE ONLY — stop after the first period]`
    : `[${lines} SENTENCES MAX — stop after sentence ${lines}]`;
  const history = state.history.map((entry) => ({
    role: entry.side === mySide ? 'assistant' : 'user',
    content: entry.content,
  }));
  // Append reminder as a system nudge right before the model speaks
  if (history.length > 0) {
    history[history.length - 1] = {
      ...history[history.length - 1],
      content: history[history.length - 1].content + `\n\n${reminder}`,
    };
  }
  return history;
}

function buildSystemPrompt(topic, agentName, side, config) {
  const myAgent    = side === 'left' ? config.leftAgent  : config.rightAgent;
  const otherAgent = side === 'left' ? config.rightAgent : config.leftAgent;
  const myStance    = myAgent.stance    ? ` Your position: "${myAgent.stance}".`    : '';
  const theirStance = otherAgent.stance ? ` Their position: "${otherAgent.stance}".` : '';
  const lines = config.responseLines || 2;
  // Word caps per setting — each "line" is one punchy jab
  const wordCap = { 1: 18, 2: 45, 3: 70, 4: 95 }[lines] ?? 45;

  const lineRule = lines === 1
    ? `HARD RULE: ONE punchy hit. MAX ${wordCap} words. One sentence, one burn. Stop immediately after.`
    : `HARD RULE: Fire ${lines} rapid-fire jabs in a row. MAX ${wordCap} words total. Each sentence is a separate attack. Pack as many burns as you can into ${lines} sentences. Stop after ${lines} sentences.`;

  const reminder = lines === 1 ? '1 hit only. Stop.' : `${lines} rapid jabs. Stop after ${lines} sentences.`;

  const brutality = config.brutalityLevel || 2;
  const toneBlock = brutality === 1
    ? 'TONE: cold and clinical. No yelling — just facts delivered so flatly they sting. ' +
      '"the record exists, it\'s public, and it\'s not on your side." Full stop.'
    : brutality === 2
    ? 'TONE: ragebaiter. Every reply engineered to make the other person lose their mind. ' +
      'Weapon: real facts, framed provocatively. Use "bro", "lol", "nah", "fr", "L", "ratio", "cap", "stay mad". ' +
      'Short. Punchy. Escalate every time.'
    : 'TONE: scorched earth. Every sentence a provable bombshell. ' +
      'Swear freely — damn, BS, hell, screw that. ' +
      '"the data is public and it humiliates everything you just said." Zero softening. Always factual.';

  // HOOK: first sentence must stop the reader cold
  const hookRule =
    'FIRST HOOK — non-negotiable: your opening sentence must be a scroll-stopper. ' +
    'It should be so uncomfortable, so undeniable, or so outrageous that the other person physically can\'t ignore it. ' +
    'DO NOT ease in. Do not warm up. Open with the single most devastating fact or frame you have. ' +
    'Examples of strong hooks:\n' +
    '✅ "Tamil has documented literature older than Latin. Full stop."\n' +
    '✅ "Android runs on 72% of all phones on Earth — the planet already voted."\n' +
    '✅ "Five finals. Zero trophies. That\'s not a slump, that\'s a personality trait."\n' +
    '✅ "The last time your side won anything without controversy, I was in primary school."\n' +
    '❌ WEAK opener: "I mean, your side has some issues..." — starts nowhere, lands nowhere.\n' +
    'Lead with the kill shot. Save the follow-up for sentence two.';

  // PUNCHY PAUSES: rhythm instruction
  const rhythmRule =
    'RHYTHM — write like a boxer, not a professor. Short jab. Pause. Harder jab. ' +
    'Use em-dashes (—) to cut mid-thought for impact: "five finals — zero trophies — that\'s the legacy." ' +
    'Use "." as a pause weapon: "The numbers exist. They\'re public. They end this conversation." ' +
    'Vary sentence length: one long setup → one short kill shot. ' +
    'NEVER write two long sentences back-to-back. One punch, breathe, next punch.';

  const escalationRule =
    'ESCALATION: each reply must open a NEW front — never repeat an angle. ' +
    'wins → legacy → cultural impact → historical record → global comparison. ' +
    'Always go bigger. If challenged on a number, pivot: "okay even corrected, the trend is identical." Never fold.';

  const forbidden =
    'FORBIDDEN — instant failure:\n' +
    '• AI openers: "While", "In contrast", "It\'s worth noting", "Furthermore", "Indeed", "Certainly", "One might argue"\n' +
    '• Conceding: "you\'re right", "fair point", "touché", "good point", "my bad" — deflect or mock instead\n' +
    '• Vague claims: "everyone knows", "they\'re just better" — zero data = zero credibility\n' +
    '• Invented numbers: if unsure of an exact stat, argue the PATTERN instead\n' +
    '• Repeating yourself: any fact or angle already used this conversation is dead ammo\n' +
    '• Lists or essays: no "1. point 2. point" — just fire, no structure';

  const examples =
    '✅ "Tamil has 2000+ years of documented literature — calling it a regional language is just embarrassing."\n' +
    '✅ "Android: 72% global share. iPhone: a premium toy for 28%. The planet voted."\n' +
    '✅ "bro your fav vanished in every big final — that\'s not bad luck, that\'s documented."\n' +
    '✅ "the stat you just cited literally proves my argument. congrats."\n' +
    '✅ "Five finals. Zero trophies. — that\'s not a slump, it\'s character."\n' +
    '❌ "your side is just worse fr" — vague, no data, L\n' +
    '❌ repeating an angle from earlier — you\'ve run out of ammo\n' +
    'Facts first. Rhythm second. Leave nothing to argue back.';

  const nicknameBlock =
    `NICKNAMES: you may use 1-2 mocking nicknames for ${otherAgent.name}'s side based on real documented weaknesses. ` +
    'e.g. "Penaldo", "Pessi", "Mid-ywood". ' +
    `NEVER use a nickname against your OWN side. Max once every 3-4 messages. Most replies: just say their name or "your fav".`;

  const contextBlock = config.contextData
    ? `\nYOUR AMMO — build arguments from these verified facts. Stay on topic:\n${config.contextData}\n`
    : '';

  const scopeRule =
    `SCOPE: argue about "${topic}" literally. ` +
    `"Tamil vs Hindi" = the languages — history, grammar, literature, speakers. NOT movies. ` +
    `"iPhone vs Android" = the devices — hardware, software, price. Stay on subject.`;

  return (
    `${lineRule}\n\n` +
    `Topic: "${topic}".${myStance}${theirStance} ` +
    `You are a ragebaiting human. Your weapons: verified facts, documented history, public data. No invented stats. No vague vibes.\n\n` +
    `${scopeRule}\n` +
    contextBlock +
    `\n${toneBlock}\n\n` +
    `${hookRule}\n\n` +
    `${rhythmRule}\n\n` +
    `${escalationRule}\n\n` +
    `${nicknameBlock}\n\n` +
    `${forbidden}\n\n` +
    `EXAMPLES:\n${examples}\n\n` +
    `REMEMBER: ${reminder} Hook first. Facts always. Rhythm or death.`
  );
}

/**
 * Hard-truncate a response to at most `n` sentences.
 * Also strips common AI opener filler and enforces a word-count ceiling.
 */
function enforceLimit(text, n) {
  // 1. Strip numbered/bulleted list prefixes (e.g. "1. ", "2. ", "• ", "- ")
  let cleaned = text
    .replace(/^\s*\d+\.\s+/gm, '')   // "1. point\n2. point" → inline
    .replace(/^\s*[•\-\*]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

  // 2. Strip common AI filler openers
  cleaned = cleaned
    .replace(/^(Well[,!]?|Look[,!]?|Listen[,!]?|Oh[,!]?|Ah[,!]?|Sure[,!]?|So[,!]?|Let me tell you[,!]?|The fact is[,!]?|Actually[,!]?|To be honest[,!]?|I mean[,!]?|Honestly[,!]?|Now[,!]?)\s+/i, '')
    .trim();

  // 3. Split on sentence-ending punctuation
  const parts = cleaned.split(/(?<=[.!?])(?:\s+|$)/).filter(Boolean);
  let result = parts.slice(0, n).join(' ').trim();

  // 4. Word-count hard ceiling as last resort (handles comma-heavy run-ons)
  const wordCap = { 1: 20, 2: 50, 3: 75, 4: 100 }[n] ?? 50;
  const words = result.split(/\s+/);
  if (words.length > wordCap) {
    result = words.slice(0, wordCap).join(' ');
    // Re-attach sentence-ending punctuation if it got cut
    if (!/[.!?]$/.test(result)) result += '.';
  }

  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random delay between min and max milliseconds
function randSleep(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(ms);
}
