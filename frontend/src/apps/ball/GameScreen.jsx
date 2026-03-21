import { useEffect, useRef, useState, useCallback } from 'react';
import { getTeam, uiColor, TEAMS } from './teams.js';

// ── Constants ────────────────────────────────────────────────────────────────
const MATCH_SEC = 30;
const SUDDEN_DEATH_SEC = 10;
const BALL_RADIUS = 17;
const ORB_RADIUS = 6;
const ARENA_RADIUS = 180;    // logical radius
const GRAVITY = 0;      // no gravity — straight-line marble physics
const WALL_RESTITUTION = 1.0;    // perfect elastic wall — full speed kept
const WALL_FRICTION = 1.0;    // no tangential loss on wall
const AIR_DRAG = 1.0;    // no drag
const BALL_SPEED = 3.2;    // constant launch speed (px/frame)
const RESULT_HOLD_MS = 2800;
const RECORDER_STOP_BUFFER_MS = 350;
const MATCH_START_DELAY_MS = 1600;
const RECORDING_PREROLL_MS = 300;

// ── Power-up constants ───────────────────────────────────────────────────────
const POWERUP_RADIUS = 12;     // hit-zone radius — tight, must pass close to collect
const POWERUP_DRAW_R = 8;      // visual radius (much smaller than hit zone)
const SPEED_MULT = 2.4;    // speed boost multiplier
const BIG_BALL_MULT = 2;      // big ball size multiplier
const EFFECT_TICKS = 240;    // 3 seconds at 60fps
const ORB_CLEARANCE_FROM_BALL = 84;


// ── Maths helpers ────────────────────────────────────────────────────────────
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (v) => { const m = Math.hypot(v.x, v.y) || 1; return { x: v.x / m, y: v.y / m }; };

// ── Circular arena: physically correct bounce with restitution ───────────────
function bounceArena(ball, cx, cy, R) {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const d = Math.hypot(dx, dy);
  if (d + ball.r <= R) return;

  // Push ball back onto the wall boundary
  const over = d + ball.r - R;
  const nx = dx / d, ny = dy / d;
  ball.x -= nx * over;
  ball.y -= ny * over;

  // Decompose velocity into normal and tangential components
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn <= 0) return;

  const vtx = ball.vx - vn * nx;
  const vty = ball.vy - vn * ny;

  // Reflect with perfect restitution + random angle jitter to break loops and keep bounces unpredictable
  const jitter = (Math.random() - 0.5) * 0.3; // ±0.15 rad (~±8.6°) — visibly varied angles
  const cosJ = Math.cos(jitter), sinJ = Math.sin(jitter);
  const rvx = -vn * WALL_RESTITUTION * nx + vtx * WALL_FRICTION;
  const rvy = -vn * WALL_RESTITUTION * ny + vty * WALL_FRICTION;
  ball.vx = rvx * cosJ - rvy * sinJ;
  ball.vy = rvx * sinJ + rvy * cosJ;
}

// ── Ball–ball collision: swap normal velocity components (billiard physics) ──
function resolveBallCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const minD = a.r + b.r;
  if (d >= minD || d === 0) return;

  // Push both balls apart equally along the collision axis
  const overlap = (minD - d) * 0.5 + 0.5; // extra 0.5px to prevent sticking
  const nx = dx / d, ny = dy / d;
  a.x -= nx * overlap;
  a.y -= ny * overlap;

  // Project each velocity onto the collision normal
  const aNorm = a.vx * nx + a.vy * ny;
  const bNorm = b.vx * nx + b.vy * ny;

  // Only resolve if balls are approaching each other
  if (aNorm - bNorm <= 0) return;

  // Swap the normal components — perfect billiard bounce
  a.vx += (bNorm - aNorm) * nx;
  a.vy += (bNorm - aNorm) * ny;
  b.vx += (aNorm - bNorm) * nx;
  b.vy += (aNorm - bNorm) * ny;

  // Clamp each ball's speed to [BALL_SPEED, speedCap] — no slowdown from grazes, no over-boost
  const spdA = Math.hypot(a.vx, a.vy);
  const spdB = Math.hypot(b.vx, b.vy);
  const capA = a.speedCap || BALL_SPEED;
  const capB = b.speedCap || BALL_SPEED;
  if (spdA > 0) { const tA = Math.min(Math.max(spdA, BALL_SPEED), capA); a.vx = (a.vx / spdA) * tA; a.vy = (a.vy / spdA) * tA; }
  if (spdB > 0) { const tB = Math.min(Math.max(spdB, BALL_SPEED), capB); b.vx = (b.vx / spdB) * tB; b.vy = (b.vy / spdB) * tB; }
}

// ── Random orb position at least MIN_ORB_DIST away from previous position ──
const MIN_ORB_DIST = ARENA_RADIUS * 0.55;  // must be >55% of arena radius away

function randomOrbPos(cx, cy, R, prev, avoidBalls = []) {
  let pos;
  let attempts = 0;
  do {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (R - ORB_RADIUS - 10) * 0.75;
    pos = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    attempts++;
  } while (
    attempts < 40 && (
      (prev && Math.hypot(pos.x - prev.x, pos.y - prev.y) < MIN_ORB_DIST) ||
      avoidBalls.some((ball) => Math.hypot(pos.x - ball.x, pos.y - ball.y) < ball.r + ORB_RADIUS + ORB_CLEARANCE_FROM_BALL)
    )
  );
  return pos;
}

// ── Draw helpers ─────────────────────────────────────────────────────────────
function drawArena(ctx, cx, cy, R) {
  // Outer glow ring
  const grad = ctx.createRadialGradient(cx, cy, R - 4, cx, cy, R + 10);
  grad.addColorStop(0, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, R + 10, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Arena fill
  const arenaGrad = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.1, cx, cy, R);
  arenaGrad.addColorStop(0, '#1a4a2e');
  arenaGrad.addColorStop(0.5, '#0f3320');
  arenaGrad.addColorStop(1, '#071a10');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = arenaGrad;
  ctx.fill();

  // Outline
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Centre circle
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Centre spot
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
}

function drawOrb(ctx, orb) {
  const r = ORB_RADIUS;
  const fontSize = Math.round(r * 3.8);

  // Solid white disc — makes emoji fully opaque over dark arena
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚽', orb.x, orb.y + fontSize * 0.05);
}

// ── Draw power-up on the arena border ────────────────────────────────────────
function drawPowerup(ctx, pw, cx, cy) {
  if (!pw.available) return;
  const px = cx + Math.cos(pw.angle) * ARENA_RADIUS;
  const py = cy + Math.sin(pw.angle) * ARENA_RADIUS;
  const r = POWERUP_DRAW_R;

  // Outer glow
  const glowColor = pw.type === 'speed' ? '255,200,0' : pw.type === 'triple' ? '120,80,255' : '0,200,255';
  const glow = ctx.createRadialGradient(px, py, r * 0.3, px, py, r * 2.5);
  glow.addColorStop(0, `rgba(${glowColor},0.8)`);
  glow.addColorStop(0.5, `rgba(${glowColor},0.3)`);
  glow.addColorStop(1, `rgba(${glowColor},0)`);
  ctx.beginPath();
  ctx.arc(px, py, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Filled circle
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = pw.type === 'speed' ? '#2a1800' : pw.type === 'triple' ? '#110520' : '#00141a';
  ctx.fill();
  ctx.strokeStyle = pw.type === 'speed' ? '#FFD700' : pw.type === 'triple' ? '#9b59ff' : '#00c8ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Emoji
  ctx.font = `${Math.round(r * 1.6)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pw.type === 'speed' ? '⚡' : pw.type === 'triple' ? '👥' : '🔵', px, py);
}

function drawBall(ctx, ball, tick) {
  const r = ball.r;
  const x = ball.x;
  const y = ball.y;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // Ball gradient
  const bg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  bg.addColorStop(0, lighten(ball.color, 40));
  bg.addColorStop(0.5, ball.color);
  bg.addColorStop(1, darken(ball.color, 40));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();

  // Secondary stripe
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.15);
  ctx.lineTo(x + r, y - r * 0.15);
  ctx.lineWidth = r * 0.4;
  ctx.strokeStyle = ball.secondary + '55';
  ctx.stroke();
  ctx.restore();

  // Outline
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flag emoji
  ctx.font = `${Math.round(r * 0.9)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ball.flag, x, y);
}

function lighten(hex, amt) {
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const r = Math.min(255, parseInt(c.slice(0, 2), 16) + amt);
    const g = Math.min(255, parseInt(c.slice(2, 4), 16) + amt);
    const b = Math.min(255, parseInt(c.slice(4, 6), 16) + amt);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}
function darken(hex, amt) {
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const r = Math.max(0, parseInt(c.slice(0, 2), 16) - amt);
    const g = Math.max(0, parseInt(c.slice(2, 4), 16) - amt);
    const b = Math.max(0, parseInt(c.slice(4, 6), 16) - amt);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}

// ── Score flash overlay ──────────────────────────────────────────────────────
function ScoreFlash({ flash }) {
  if (!flash) return null;
  return (
    <div className="ball-score-flash" style={{ color: flash.color }}>
      {flash.flag} +1
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GameScreen({ matchConfig, autoRecordStream, onAutoRecordStream, onMatchEnd }) {
  const { fixture, tournament, autoMode = false } = matchConfig;
  const homeTeam = getTeam(fixture.homeId);
  const awayTeam = getTeam(fixture.awayId);

  const canvasRef = useRef(null);
  const recordFrameRef = useRef(null);
  const autoStreamRef = useRef(autoRecordStream || null);
  const stateRef = useRef(null);   // mutable game state
  const rafRef = useRef(null);
  const mediaRecorderRef = useRef(null);   // screen recorder
  const recChunksRef = useRef([]);     // recorded chunks
  const pendingBlobRef = useRef(null);
  const finishTimeoutRef = useRef(null);
  const recorderStopTimeoutRef = useRef(null);
  const matchStartTimeoutRef = useRef(null);
  const pendingResultRef = useRef(null);
  const endAnimRef = useRef(null);
  const [scores, setScores] = useState({ home: 0, away: 0 });
  const [timeLeft, setTimeLeft] = useState(MATCH_SEC);
  const [phase, setPhase] = useState(autoMode && autoRecordStream ? 'countdown' : 'recording'); // recording | countdown | playing | sudden | ended
  const [scoreFlash, setScoreFlash] = useState(null);
  const [powerupFlash, setPowerupFlash] = useState(null);
  const [endOverlay, setEndOverlay] = useState(null);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewReady, setReviewReady] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    if (autoRecordStream) autoStreamRef.current = autoRecordStream;
  }, [autoRecordStream]);

  // ── Init game state ──────────────────────────────────────────────────────
  function initState(cx, cy) {
    // Launch each ball in a random direction at fixed speed
    const aH = Math.random() * Math.PI * 2;
    const aA = aH + Math.PI + (Math.random() - 0.5) * 0.8;
    const home = {
      x: cx - BALL_RADIUS * 2,
      y: cy - BALL_RADIUS * 2,
      vx: Math.cos(aH) * BALL_SPEED,
      vy: Math.sin(aH) * BALL_SPEED,
      r: BALL_RADIUS,
      targetR: BALL_RADIUS,
      speedCap: BALL_SPEED,
      ...homeTeam,
      id: 'home',
    };
    const away = {
      x: cx + BALL_RADIUS * 2,
      y: cy + BALL_RADIUS * 2,
      vx: Math.cos(aA) * BALL_SPEED,
      vy: Math.sin(aA) * BALL_SPEED,
      r: BALL_RADIUS,
      targetR: BALL_RADIUS,
      speedCap: BALL_SPEED,
      ...awayTeam,
      id: 'away',
    };
    const orb = randomOrbPos(cx, cy, ARENA_RADIUS, null, [home, away]);

    // Place three power-ups evenly spaced around the border (120° apart)
    const pAngle = Math.random() * Math.PI * 2;
    const powerups = [
      { type: 'speed', angle: pAngle, available: true, revealSec: 5 },
      { type: 'triple', angle: pAngle + (Math.PI * 2) / 3, available: true, revealSec: 10 },
      { type: 'bigball', angle: pAngle + (Math.PI * 4) / 3, available: true, revealSec: 15 },
    ];

    return {
      home, away, orb, cx, cy, tick: 0, elapsedSec: 0, finished: false,
      scores: { home: 0, away: 0 },
      powerups,
      effects: { speed: null, triple: null, bigball: null },
      ghosts: [],   // extra ghost balls from triple power-up
    };
  }

  // ── Move ball: straight line, no gravity, no drag ────────────────────────────
  function moveBall(ball) {
    ball.x += ball.vx;
    ball.y += ball.vy;
  }

  function drawWinnerFrame(result) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const homeWon = result.homeScore > result.awayScore;
    const awayWon = result.awayScore > result.homeScore;
    const winner = homeWon ? homeTeam : awayWon ? awayTeam : null;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    ctx.fillRect(0, 0, 420, 420);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '52px serif';
    ctx.fillText(winner ? '🏆' : '🤝', 210, 150);
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillStyle = winner ? uiColor(winner) : '#ffffff';
    ctx.fillText(winner ? `${winner.flag} ${winner.name}` : 'DRAW', 210, 210);
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = '#d6dee3';
    ctx.fillText(winner ? 'WINS THE MATCH' : 'MATCH ENDED LEVEL', 210, 240);
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${homeTeam.flag} ${result.homeScore}  –  ${result.awayScore} ${awayTeam.flag}`, 210, 295);
    ctx.restore();
  }

  function animateWinnerFrame(result, ms = 2200) {
    cancelAnimationFrame(endAnimRef.current);
    const started = performance.now();
    const step = (now) => {
      drawWinnerFrame(result);
      if (now - started < ms) endAnimRef.current = requestAnimationFrame(step);
    };
    endAnimRef.current = requestAnimationFrame(step);
  }

  function buildDownloadName() {
    const stage = fixture.phase === 'group'
      ? `group-r${(fixture.round ?? 0) + 1}`
      : fixture.phase;
    return `${String(stage).replace(/\s+/g, '-')}-${homeTeam.name}-vs-${awayTeam.name}.webm`;
  }

  function downloadRecording(blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildDownloadName();
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetMatchSession() {
    clearTimeout(matchStartTimeoutRef.current);
    clearTimeout(finishTimeoutRef.current);
    clearTimeout(recorderStopTimeoutRef.current);
    cancelAnimationFrame(endAnimRef.current);
    cancelAnimationFrame(rafRef.current);
    stateRef.current = null;
    pendingResultRef.current = null;
    pendingBlobRef.current = null;
    recChunksRef.current = [];
    setScores({ home: 0, away: 0 });
    setTimeLeft(MATCH_SEC);
    setScoreFlash(null);
    setPowerupFlash(null);
    setEndOverlay(null);
    setReviewResult(null);
    setReviewReady(false);
    setReviewBusy(false);
  }

  function renderFreshMatchFrame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 420, 420);
    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(0, 0, 420, 420);
    drawArena(ctx, 210, 210, ARENA_RADIUS);
  }

  async function cropStreamToGameShell(stream) {
    try {
      const frame = recordFrameRef.current;
      if (!frame || typeof CropTarget === 'undefined') return;
      const cropTarget = await CropTarget.fromElement(frame);
      const [videoTrack] = stream?.getVideoTracks?.() || [];
      if (cropTarget && videoTrack && typeof videoTrack.cropTo === 'function') {
        await videoTrack.cropTo(cropTarget);
      }
    } catch (_) {
      // Ignore crop failures and continue with the full stream.
    }
  }

  function createRecorder(stream, preserveStream = false) {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
    recChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 25_000_000 });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = recChunksRef.current.length ? new Blob(recChunksRef.current, { type: 'video/webm' }) : null;
      pendingBlobRef.current = blob;
      if (!preserveStream) stream.getTracks().forEach((t) => t.stop());
      const result = pendingResultRef.current;
      pendingResultRef.current = null;
      if (autoMode) {
        setReviewBusy(false);
        setReviewReady(true);
        if (result) setReviewResult(result);
        return;
      }
      if (blob) downloadRecording(blob);
      if (result) onMatchEnd(result);
    };
    recorder.start(200);
    return recorder;
  }

  function finishMatch(result) {
    if (stateRef.current) stateRef.current.finished = true;
    const homeWon = result.homeScore > result.awayScore;
    const awayWon = result.awayScore > result.homeScore;
    const winner = homeWon ? homeTeam : awayWon ? awayTeam : null;

    setPhase('ended');
    setTimeLeft(0);
    setEndOverlay(
      winner
        ? {
          emoji: '🏆',
          headline: `${winner.flag} ${winner.name}`,
          subline: 'WINS THE MATCH',
          color: uiColor(winner),
        }
        : {
          emoji: '🤝',
          headline: 'DRAW',
          subline: 'MATCH ENDED LEVEL',
          color: '#ffffff',
        }
    );

    clearTimeout(finishTimeoutRef.current);
    finishTimeoutRef.current = setTimeout(() => {
      pendingResultRef.current = result;
      const hasActiveRecorder = mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive';
      if (autoMode) {
        setReviewResult(result);
        setReviewBusy(Boolean(hasActiveRecorder));
        setReviewReady(!hasActiveRecorder);
      }
      if (hasActiveRecorder) {
        const recorder = mediaRecorderRef.current;
        recorder.requestData?.();
        clearTimeout(recorderStopTimeoutRef.current);
        recorderStopTimeoutRef.current = setTimeout(() => {
          if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
        }, RECORDER_STOP_BUFFER_MS);
      } else if (!autoMode) {
        onMatchEnd(result);
      }
    }, RESULT_HOLD_MS);
  }

  // ── Game loop ────────────────────────────────────────────────────────────
  const runLoop = useCallback((canvasEl, currentPhase) => {
    const ctx = canvasEl.getContext('2d');
    // Always use logical CSS size (420) — canvas.width is already scaled by dpr
    const W = 420;
    const H = 420;
    const cx = W / 2;
    const cy = H / 2;

    if (!stateRef.current) {
      stateRef.current = initState(cx, cy);
    }

    let lastSec = performance.now();
    let remaining = currentPhase === 'sudden' ? SUDDEN_DEATH_SEC : MATCH_SEC;

    function loop(now) {
      const gs = stateRef.current;
      if (!gs || gs.finished) return;
      gs.tick++;

      // ── Timer ──
      const elapsed = (now - lastSec) / 1000;
      if (elapsed >= 1) {
        remaining = Math.max(0, remaining - Math.floor(elapsed));
        lastSec = now;
        gs.remaining = remaining;
        setTimeLeft(remaining);
        if (remaining <= 0) {
          cancelAnimationFrame(rafRef.current);
          const s = gs.scores;
          if (currentPhase === 'playing' && s.home === s.away) {
            // Draw → sudden death
            stateRef.current = initState(cx, cy);
            stateRef.current.scores = { home: s.home, away: s.away };
            setPhase('sudden');
            startSuddenDeath(canvasEl);
          } else {
            finishMatch({ homeScore: s.home, awayScore: s.away });
          }
          return;
        }
      }

      // ── Physics ──
      moveBall(gs.home);
      moveBall(gs.away);
      // Smooth size transition for Big Ball effect (grow and shrink)
      gs.home.r += (gs.home.targetR - gs.home.r) * 0.12;
      gs.away.r += (gs.away.targetR - gs.away.r) * 0.12;
      bounceArena(gs.home, cx, cy, ARENA_RADIUS);
      bounceArena(gs.away, cx, cy, ARENA_RADIUS);
      resolveBallCollision(gs.home, gs.away);

      // Ghost balls (triple power-up)
      for (const g of gs.ghosts) {
        moveBall(g);
        bounceArena(g, cx, cy, ARENA_RADIUS);
      }

      // ── Expire effects ──
      if (gs.effects.speed && gs.tick >= gs.effects.speed.endTick) {
        // Restore normal speed for that ball
        const b = gs.effects.speed.side === 'home' ? gs.home : gs.away;
        const spd = Math.hypot(b.vx, b.vy);
        if (spd > 0) { b.vx = (b.vx / spd) * BALL_SPEED; b.vy = (b.vy / spd) * BALL_SPEED; }
        b.speedCap = BALL_SPEED;
        gs.effects.speed = null;
      }
      if (gs.effects.triple && gs.tick >= gs.effects.triple.endTick) {
        gs.ghosts = [];
        gs.effects.triple = null;
      }
      if (gs.effects.bigball && gs.tick >= gs.effects.bigball.endTick) {
        gs.effects.bigball.ball.targetR = BALL_RADIUS;
        gs.effects.bigball = null;
      }

      // ── Power-up pickup (each active only after its revealSec) ──
      const _matchElapsed = MATCH_SEC - (gs.remaining ?? MATCH_SEC);
      for (const pw of gs.powerups) {
        if (!pw.available || _matchElapsed < pw.revealSec) continue;
        // Detect against inner wall face — the closest point a ball center can reach
        const pwx = cx + Math.cos(pw.angle) * (ARENA_RADIUS - BALL_RADIUS);
        const pwy = cy + Math.sin(pw.angle) * (ARENA_RADIUS - BALL_RADIUS);
        let collector = null;
        if (Math.hypot(gs.home.x - pwx, gs.home.y - pwy) < gs.home.r + POWERUP_RADIUS) collector = 'home';
        else if (Math.hypot(gs.away.x - pwx, gs.away.y - pwy) < gs.away.r + POWERUP_RADIUS) collector = 'away';
        if (collector) {
          pw.available = false;
          const collBall = collector === 'home' ? gs.home : gs.away;
          const collTeam = collector === 'home' ? homeTeam : awayTeam;
          if (pw.type === 'speed') {
            // Boost velocity immediately
            const spd = Math.hypot(collBall.vx, collBall.vy);
            if (spd > 0) {
              collBall.vx = (collBall.vx / spd) * BALL_SPEED * SPEED_MULT;
              collBall.vy = (collBall.vy / spd) * BALL_SPEED * SPEED_MULT;
            }
            collBall.speedCap = BALL_SPEED * SPEED_MULT;
            gs.effects.speed = { side: collector, endTick: gs.tick + EFFECT_TICKS };
            setPowerupFlash({ emoji: '⚡', label: 'SPEED BOOST!', side: collector });
            setTimeout(() => setPowerupFlash(null), 1800);
          } else if (pw.type === 'triple') {
            // Spawn 2 ghost balls at slight angle offsets
            gs.ghosts = [-0.4, 0.4].map((offset) => ({
              x: collBall.x, y: collBall.y,
              vx: Math.cos(Math.atan2(collBall.vy, collBall.vx) + offset) * BALL_SPEED,
              vy: Math.sin(Math.atan2(collBall.vy, collBall.vx) + offset) * BALL_SPEED,
              r: BALL_RADIUS,
              ...collTeam,
              id: collector,
              ghost: true,
              speedMult: gs.effects.speed?.side === collector ? SPEED_MULT : 1,
            }));
            gs.effects.triple = { side: collector, endTick: gs.tick + EFFECT_TICKS };
            setPowerupFlash({ emoji: '👥', label: 'TRIPLE BALLS!', side: collector });
            setTimeout(() => setPowerupFlash(null), 1800);
          } else if (pw.type === 'bigball') {
            // Animate ball growing — lerp drives r toward targetR each frame
            collBall.targetR = BALL_RADIUS * BIG_BALL_MULT;
            gs.effects.bigball = { side: collector, ball: collBall, endTick: gs.tick + EFFECT_TICKS };
            setPowerupFlash({ emoji: '🔵', label: 'BIG BALL!', side: collector });
            setTimeout(() => setPowerupFlash(null), 1800);
          }
        }
      }

      // ── Orb pickup (main balls + ghosts) ──
      const allBalls = [
        { ball: gs.home, side: 'home' },
        { ball: gs.away, side: 'away' },
        ...gs.ghosts.map((g) => ({ ball: g, side: g.id })),
      ];
      let scorer = null;
      for (const { ball, side } of allBalls) {
        if (Math.hypot(ball.x - gs.orb.x, ball.y - gs.orb.y) < ball.r + ORB_RADIUS) {
          scorer = side; break;
        }
      }

      if (scorer) {
        gs.scores[scorer]++;
        setScores({ ...gs.scores });
        const team = scorer === 'home' ? homeTeam : awayTeam;
        setScoreFlash({ color: uiColor(team), flag: team.flag });
        setTimeout(() => setScoreFlash(null), 800);
        gs.orb = randomOrbPos(cx, cy, ARENA_RADIUS, gs.orb, [gs.home, gs.away]);

        // Sudden death: first score wins
        if (currentPhase === 'sudden') {
          cancelAnimationFrame(rafRef.current);
          finishMatch({ homeScore: gs.scores.home, awayScore: gs.scores.away });
          // Still render final frame below
        }
      }

      // ── Render ──
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0a0f14';
      ctx.fillRect(0, 0, W, H);

      drawArena(ctx, cx, cy, ARENA_RADIUS);

      // Power-ups on the border — each appears at its own revealSec
      const matchElapsed = MATCH_SEC - (gs.remaining ?? MATCH_SEC);
      for (const pw of gs.powerups) {
        if (matchElapsed >= pw.revealSec) drawPowerup(ctx, pw, cx, cy);
      }

      drawOrb(ctx, gs.orb);

      // Ghost balls (semi-transparent)
      ctx.save();
      ctx.globalAlpha = 0.45;
      for (const g of gs.ghosts) drawBall(ctx, g, gs.tick);
      ctx.restore();

      drawBall(ctx, gs.home, gs.tick);
      drawBall(ctx, gs.away, gs.tick);

      if (!gs.finished) rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []); // eslint-disable-line

  function startSuddenDeath(canvasEl) {
    setTimeout(() => runLoop(canvasEl, 'sudden'), 500);
  }

  // ── Canvas setup (runs once on mount, does not start game) ─────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 420 * dpr;
    canvas.height = 420 * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(0, 0, 420, 420);
    drawArena(ctx, 210, 210, ARENA_RADIUS);
    return () => {
      clearTimeout(matchStartTimeoutRef.current);
      clearTimeout(finishTimeoutRef.current);
      clearTimeout(recorderStopTimeoutRef.current);
      cancelAnimationFrame(endAnimRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line

  // ── Begin match (called after recording permission resolved) ─────────────────
  function beginMatch(prerollMs = 0) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pendingBlobRef.current = null;
    pendingResultRef.current = null;
    setEndOverlay(null);
    setReviewResult(null);
    setReviewReady(false);
    setReviewBusy(false);
    renderFreshMatchFrame();
    setPhase('countdown');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clearTimeout(matchStartTimeoutRef.current);
        matchStartTimeoutRef.current = setTimeout(() => {
          setPhase('playing');
          setTimeLeft(MATCH_SEC);
          runLoop(canvas, 'playing');
        }, MATCH_START_DELAY_MS + prerollMs);
      });
    });
  }

  function startAutoRecordingAndPlay() {
    const stream = autoStreamRef.current;
    if (!stream) return;
    // Re-crop in the background, but never block the next match from starting.
    cropStreamToGameShell(stream).catch(() => { });
    try {
      createRecorder(stream, true);
    } catch (_) {
      // If recorder setup fails, still let the tournament continue.
    }
    beginMatch(RECORDING_PREROLL_MS);
  }

  function handleAutoTryAgain() {
    if (!autoMode || reviewBusy) return;
    resetMatchSession();
    startAutoRecordingAndPlay();
  }

  function handleAutoNext() {
    if (!autoMode || reviewBusy || !reviewResult) return;
    if (pendingBlobRef.current) downloadRecording(pendingBlobRef.current);
    onMatchEnd(reviewResult);
  }

  // ── Screen recording ─────────────────────────────────────────────────────────
  async function startRecordingAndPlay() {
    if (autoMode) {
      if (autoRecordStream) {
        startAutoRecordingAndPlay();
        return;
      }

      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          preferCurrentTab: true,
          video: { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const [videoTrack] = displayStream.getVideoTracks();
        await cropStreamToGameShell(displayStream);
        videoTrack.onended = () => {
          if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
        };
        autoStreamRef.current = displayStream;
        onAutoRecordStream?.(displayStream);
        createRecorder(displayStream, true);
      } catch (_) {
        return;
      }
      beginMatch(RECORDING_PREROLL_MS);
      return;
    }
    const shell = recordFrameRef.current;
    // Hide the overlay first, wait for repaint, then start recording
    setPhase('countdown');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      let cropTarget = null;
      if (typeof CropTarget !== 'undefined' && shell) {
        cropTarget = await CropTarget.fromElement(shell);
      }
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        preferCurrentTab: true,
        video: { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      const [videoTrack] = displayStream.getVideoTracks();
      if (cropTarget && typeof videoTrack.cropTo === 'function') {
        await videoTrack.cropTo(cropTarget);
      }
      videoTrack.onended = () => {
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
      };
      createRecorder(displayStream);
    } catch (_) {
      // Permission denied or unsupported — play without recording
    }
    beginMatch(RECORDING_PREROLL_MS);
  }

  useEffect(() => {
    if (!autoMode || !autoStreamRef.current) return;
    const id = setTimeout(() => { startAutoRecordingAndPlay(); }, 120);
    return () => clearTimeout(id);
  }, [autoMode, autoRecordStream]); // eslint-disable-line

  const timeColor = timeLeft <= 10 ? '#ff4444' : timeLeft <= 20 ? '#ffaa00' : '#fff';
  const phaseLabel = fixture.phase === 'group'
    ? `Group Stage • Round ${(fixture.round ?? 0) + 1}`
    : fixture.phase === 'quarterfinal'
      ? 'Quarter Final'
      : fixture.phase === 'semifinal'
        ? 'Semi Final'
        : fixture.phase === 'final'
          ? 'Final'
          : fixture.phase;
  const displayResult = reviewResult || { homeScore: scores.home, awayScore: scores.away };

  return (
    <div className="ball-game-shell">
      <div className="ball-game-layout">
        <div className="ball-record-frame" ref={recordFrameRef}>
          {/* Scoreboard */}
          <div className="ball-scoreboard">
            <div className="ball-score-team" style={{ color: uiColor(homeTeam) }}>
              <span className="ball-score-flag">{homeTeam.flag}</span>
              <span className="ball-score-name">{homeTeam.name}</span>
            </div>
            <div className="ball-score-center">
              <div className="ball-score-numbers">
                <span className="ball-score-num" style={{ color: uiColor(homeTeam) }}>{scores.home}</span>
                <span className="ball-score-dash">–</span>
                <span className="ball-score-num" style={{ color: uiColor(awayTeam) }}>{scores.away}</span>
              </div>
              <div className="ball-score-time" style={{ color: timeColor }}>
                {phase === 'recording' || phase === 'countdown' ? '···' : phase === 'sudden' ? `⚡ ${timeLeft}s` : `${timeLeft}s`}
              </div>
              {phase === 'sudden' && <div className="ball-sudden-label">SUDDEN DEATH</div>}
            </div>
            <div className="ball-score-team ball-score-team--right" style={{ color: uiColor(awayTeam) }}>
              <span className="ball-score-flag">{awayTeam.flag}</span>
              <span className="ball-score-name">{awayTeam.name}</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="ball-canvas-wrap">
            <canvas
              ref={canvasRef}
              width={420}
              height={420}
              className="ball-canvas"
            />
            {/* Recording permission screen */}
            {phase === 'recording' && (
              <div className="ball-record-overlay">
                <div className="ball-record-icon">📹</div>
                <div className="ball-record-title">{autoMode ? 'Allow Once & Run Tournament' : 'Record This Match?'}</div>
                <div className="ball-record-match">
                  <span>{homeTeam.flag} {homeTeam.name}</span>
                  <span className="ball-record-vs">vs</span>
                  <span>{awayTeam.flag} {awayTeam.name}</span>
                </div>
                <button className="ball-record-btn" onClick={startRecordingAndPlay}>
                  {autoMode ? '🎬 Allow & Run All Matches' : '🎬 Record & Play'}
                </button>
                {!autoMode && (
                  <button className="ball-record-skip" onClick={beginMatch}>
                    Play without recording
                  </button>
                )}
              </div>
            )}
            {/* Match intro overlay */}
            {phase === 'countdown' && (
              <div className="ball-intro-overlay">
                <div className="ball-intro-team ball-intro-team--home">
                  <span className="ball-intro-flag">{homeTeam.flag}</span>
                  <span className="ball-intro-name" style={{ color: uiColor(homeTeam) }}>{homeTeam.name}</span>
                </div>
                <div className="ball-intro-vs">VS</div>
                <div className="ball-intro-team ball-intro-team--away">
                  <span className="ball-intro-flag">{awayTeam.flag}</span>
                  <span className="ball-intro-name" style={{ color: uiColor(awayTeam) }}>{awayTeam.name}</span>
                </div>
              </div>
            )}
            {/* Power-up flash */}
            {powerupFlash && (
              <div className="ball-powerup-flash">
                <span>{powerupFlash.emoji}</span> {powerupFlash.label}
              </div>
            )}
            {/* Score flash */}
            <ScoreFlash flash={scoreFlash} />
            {phase === 'ended' && endOverlay && (
              <div className="ball-end-overlay">
                <div className="ball-end-emoji">{endOverlay.emoji}</div>
                <div className="ball-end-headline" style={{ color: endOverlay.color }}>{endOverlay.headline}</div>
                <div className="ball-end-subline">{endOverlay.subline}</div>
                <div className="ball-end-scoreline">{homeTeam.flag} {displayResult.homeScore} – {displayResult.awayScore} {awayTeam.flag}</div>
              </div>
            )}
          </div>

          {fixture.phase === 'group' && tournament?.standings?.length > 0 && (
            <MiniStandings standings={tournament.standings} highlightIds={[fixture.homeId, fixture.awayId]} name={tournament.name} />
          )}
        </div>

        <aside className="ball-game-side">
          <div className="ball-side-card">
            <div className="ball-side-label">Current Match</div>
            <div className="ball-side-stage">{phaseLabel}</div>
            <div className="ball-side-fixture">{homeTeam.flag} {homeTeam.name} vs {awayTeam.flag} {awayTeam.name}</div>
            <div className="ball-side-note">The center frame is recorded, including the live standings table. This right panel stays outside the saved video.</div>
          </div>

          {autoMode && (
            <div className="ball-side-card ball-side-card--action">
              <div className="ball-side-label">Auto Tournament Control</div>
              {phase === 'ended' && reviewResult ? (
                <>
                  <div className="ball-side-note">
                    {reviewBusy
                      ? 'Finalizing the recording…'
                      : 'Choose Next to save the score and download the video, or Try Again for a rematch with no save and no download.'}
                  </div>
                  <div className="ball-side-actions">
                    <button className="ball-side-btn ball-side-btn--ghost" onClick={handleAutoTryAgain} disabled={reviewBusy}>
                      Try Again
                    </button>
                    <button className="ball-side-btn ball-side-btn--primary" onClick={handleAutoNext} disabled={reviewBusy || !reviewReady}>
                      Next Match
                    </button>
                  </div>
                </>
              ) : (
                <div className="ball-side-note">When this match ends, the tournament will pause here and wait for your Next or Try Again choice.</div>
              )}
            </div>
          )}

        </aside>
      </div>
    </div>
  );
}

// ── Mini standings table ─────────────────────────────────────────────────────
const teamMap = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

function MiniStandings({ standings, highlightIds, name }) {
  return (
    <div className="ball-game-standings">
      <div className="ball-game-standings-title">{name || 'Standings'}</div>
      <table className="ball-table ball-table--compact">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const team = teamMap[row.teamId];
            const isPlaying = highlightIds.includes(row.teamId);
            return (
              <tr key={row.teamId}
                className={[
                  i < 2 ? 'ball-table-qualify' : '',
                  isPlaying ? 'ball-table-playing' : '',
                ].join(' ').trim()}
              >
                <td>{i + 1}</td>
                <td>
                  <span className="ball-table-flag">{team?.flag}</span>
                  <span className="ball-table-name">{team?.name}</span>
                </td>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.drawn}</td>
                <td>{row.lost}</td>
                <td><strong>{row.points}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
