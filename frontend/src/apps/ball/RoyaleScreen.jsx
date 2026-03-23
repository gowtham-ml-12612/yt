import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAMS, uiColor } from './teams.js';

const MATCH_SEC = 60;
const BALL_RADIUS = 17;
const CANVAS_W = 460;
const CANVAS_H = 460;
const ARENA_PAD = 28;
const ARENA = {
  cx: CANVAS_W / 2,
  cy: CANVAS_H / 2,
  r: Math.min(CANVAS_W, CANVAS_H) / 2 - ARENA_PAD,
};
const MATCH_START_DELAY_MS = 1200;
const RECORDING_PREROLL_MS = 180;
const RESULT_HOLD_MS = 3000;
const RECORDER_STOP_BUFFER_MS = 320;
const AUTO_RETRY_DELAY_MS = 360;
const SPEED_MIN_FACTOR = 0.94;
const SPEED_MAX_FACTOR = 1.12;
const GAP_START_SIZE = 0.012;
const GAP_END_SIZE = Math.PI * 0.3;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function createBall(team) {
  const angle = Math.random() * Math.PI * 2;
  const speed = rand(2.3, 3.05);
  return {
    ...team,
    x: 0,
    y: 0,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    baseSpeed: speed,
    r: BALL_RADIUS,
    alive: true,
  };
}

function stabilizeSpeed(ball) {
  if (!ball.alive) return;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= 0.0001) {
    const angle = Math.random() * Math.PI * 2;
    ball.vx = Math.cos(angle) * ball.baseSpeed;
    ball.vy = Math.sin(angle) * ball.baseSpeed;
    return;
  }
  const minSpeed = ball.baseSpeed * SPEED_MIN_FACTOR;
  const maxSpeed = ball.baseSpeed * SPEED_MAX_FACTOR;
  const target = Math.min(maxSpeed, Math.max(minSpeed, speed));
  if (Math.abs(target - speed) < 0.001) return;
  ball.vx = (ball.vx / speed) * target;
  ball.vy = (ball.vy / speed) * target;
}

function placeBalls(balls) {
  balls.forEach((ball, idx) => {
    let placed = false;
    for (let tries = 0; tries < 200 && !placed; tries++) {
      const angle = rand(0, Math.PI * 2);
      const radius = Math.sqrt(Math.random()) * (ARENA.r - ball.r - 12);
      const x = ARENA.cx + Math.cos(angle) * radius;
      const y = ARENA.cy + Math.sin(angle) * radius;
      const overlaps = balls.slice(0, idx).some((other) => Math.hypot(x - other.x, y - other.y) < ball.r + other.r + 8);
      if (!overlaps) {
        ball.x = x;
        ball.y = y;
        placed = true;
      }
    }
    if (!placed) {
      const angle = rand(0, Math.PI * 2);
      const radius = Math.sqrt(Math.random()) * (ARENA.r - ball.r - 12);
      ball.x = ARENA.cx + Math.cos(angle) * radius;
      ball.y = ARENA.cy + Math.sin(angle) * radius;
    }
  });
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

function isAngleWithinGap(angle, start, end) {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(start);
  const e = normalizeAngle(end);
  if (s <= e) return a >= s && a <= e;
  return a >= s || a <= e;
}

function resolveBallCollision(a, b) {
  if (!a.alive || !b.alive) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const minD = a.r + b.r;
  if (d >= minD || d === 0) return;
  const nx = dx / d;
  const ny = dy / d;
  const overlap = (minD - d) * 0.5 + 0.2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal >= 0) return;
  const impulse = -velAlongNormal;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
  stabilizeSpeed(a);
  stabilizeSpeed(b);
}

function moveGap(elapsedSec) {
  const clampedElapsed = Math.max(0, Math.min(MATCH_SEC, elapsedSec));
  const growth = clampedElapsed / MATCH_SEC;
  const progress = normalizeAngle((elapsedSec / MATCH_SEC) * Math.PI * 2 * 1.08);
  const arcSize = GAP_START_SIZE + (GAP_END_SIZE - GAP_START_SIZE) * growth;
  const start = normalizeAngle(progress - arcSize / 2);
  const end = normalizeAngle(progress + arcSize / 2);
  return { start, end, size: arcSize, center: progress };
}

function handleWallOrGap(ball, gap) {
  if (!ball.alive) return false;
  const dx = ball.x - ARENA.cx;
  const dy = ball.y - ARENA.cy;
  const dist = Math.hypot(dx, dy);
  if (dist + ball.r < ARENA.r) return false;

  const angle = Math.atan2(dy, dx);
  if (isAngleWithinGap(angle, gap.start, gap.end)) {
    ball.alive = false;
    return true;
  }

  const nx = dx / (dist || 1);
  const ny = dy / (dist || 1);
  ball.x = ARENA.cx + nx * (ARENA.r - ball.r);
  ball.y = ARENA.cy + ny * (ARENA.r - ball.r);

  const vn = ball.vx * nx + ball.vy * ny;
  if (vn > 0) {
    ball.vx -= 2 * vn * nx;
    ball.vy -= 2 * vn * ny;
  }
  stabilizeSpeed(ball);
  return false;
}

function drawBall(ctx, ball) {
  if (!ball.alive) return;
  const grad = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, ball.r * 0.1, ball.x, ball.y, ball.r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, uiColor(ball));
  grad.addColorStop(1, ball.secondary || '#0c1720');
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(15,24,36,0.16)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.26)';
  ctx.shadowBlur = 4;
  ctx.font = `${Math.round(ball.r * 1.02)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ball.flag, ball.x, ball.y);
  ctx.restore();
}

function drawField(ctx, gap) {
  ctx.fillStyle = '#0a0f14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const fieldGrad = ctx.createRadialGradient(ARENA.cx, ARENA.cy, ARENA.r * 0.1, ARENA.cx, ARENA.cy, ARENA.r);
  fieldGrad.addColorStop(0, '#101d2f');
  fieldGrad.addColorStop(0.5, '#0b1724');
  fieldGrad.addColorStop(1, '#08111c');
  ctx.beginPath();
  ctx.arc(ARENA.cx, ARENA.cy, ARENA.r, 0, Math.PI * 2);
  ctx.fillStyle = fieldGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ARENA.cx, ARENA.cy, ARENA.r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 120, 80, 0.45)';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255, 110, 70, 0.7)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(ARENA.cx, ARENA.cy, ARENA.r, gap.start, gap.end, false);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 86, 86, 0.95)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(ARENA.cx, ARENA.cy, ARENA.r, gap.start, gap.end, false);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 190, 90, 0.95)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(ARENA.cx, ARENA.cy, ARENA.r, gap.start, gap.end, false);
  ctx.stroke();
}

function TeamLine({ team }) {
  return (
    <span className="ball-inline-team">
      <span className="ball-inline-team-mark">{team.flag}</span>
      <span>{team.name}</span>
    </span>
  );
}

const FIREWORKS = [
  { left: '14%', bottom: '8%', delay: '0s', duration: '2.1s', color: '#00e5ff', alt: '#7c4dff' },
  { left: '28%', bottom: '4%', delay: '0.4s', duration: '2.25s', color: '#39ff88', alt: '#f9f871' },
  { left: '50%', bottom: '7%', delay: '0.15s', duration: '2s', color: '#ff4fd8', alt: '#7afcff' },
  { left: '72%', bottom: '5%', delay: '0.62s', duration: '2.15s', color: '#ff9f1c', alt: '#ff4d6d' },
  { left: '86%', bottom: '9%', delay: '0.28s', duration: '2.3s', color: '#64ffda', alt: '#00bbf9' },
];

const FIREWORK_RAYS = [
  { angle: -92, length: 70 },
  { angle: -74, length: 88 },
  { angle: -56, length: 74 },
  { angle: -38, length: 94 },
  { angle: -20, length: 78 },
  { angle: 0, length: 90 },
  { angle: 18, length: 72 },
  { angle: 36, length: 92 },
  { angle: 54, length: 76 },
  { angle: 72, length: 88 },
  { angle: 90, length: 70 },
  { angle: 108, length: 86 },
  { angle: 126, length: 72 },
  { angle: 144, length: 92 },
  { angle: 162, length: 76 },
  { angle: 180, length: 86 },
  { angle: 198, length: 72 },
  { angle: 216, length: 90 },
  { angle: 234, length: 74 },
  { angle: 252, length: 86 },
];

export default function RoyaleScreen({ matchConfig, onMatchEnd }) {
  const canvasRef = useRef(null);
  const recordFrameRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recChunksRef = useRef([]);
  const pendingBlobRef = useRef(null);
  const pendingResultRef = useRef(null);
  const finishTimeoutRef = useRef(null);
  const recorderStopTimeoutRef = useRef(null);
  const matchStartTimeoutRef = useRef(null);
  const autoRetryTimeoutRef = useRef(null);
  const stateRef = useRef(null);
  const targetWinnerIdsRef = useRef(matchConfig?.targetWinnerIds ?? (matchConfig?.targetWinnerId ? [matchConfig.targetWinnerId] : []));

  const [phase, setPhase] = useState('recording');
  const [timeLeft, setTimeLeft] = useState(MATCH_SEC);
  const [timeProgress, setTimeProgress] = useState(1);
  const [aliveCount, setAliveCount] = useState(TEAMS.length);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [targetWinnerIds, setTargetWinnerIds] = useState(matchConfig?.targetWinnerIds ?? (matchConfig?.targetWinnerId ? [matchConfig.targetWinnerId] : []));
  const [autoRetryActive, setAutoRetryActive] = useState(false);

  const teamsById = useMemo(() => Object.fromEntries(TEAMS.map((team) => [team.id, team])), []);

  function toggleTargetWinner(id) {
    const nextIds = targetWinnerIdsRef.current.includes(id)
      ? targetWinnerIdsRef.current.filter((value) => value !== id)
      : [...targetWinnerIdsRef.current, id];
    targetWinnerIdsRef.current = nextIds;
    setTargetWinnerIds(nextIds);
  }

  function clearTargetWinners() {
    targetWinnerIdsRef.current = [];
    setTargetWinnerIds([]);
  }

  function shouldAutoRetry(result) {
    const targetIds = targetWinnerIdsRef.current;
    if (!targetIds.length) return false;
    return Boolean(result?.autoRetry || !targetIds.includes(result?.winnerId));
  }

  function buildDownloadName() {
    return `all-countries-royale-${Date.now()}.webm`;
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

  function initState() {
    const balls = TEAMS.map((team) => createBall(team));
    placeBalls(balls);
    return { balls, elapsedSec: 0, finished: false };
  }

  function resetSession() {
    clearTimeout(matchStartTimeoutRef.current);
    clearTimeout(finishTimeoutRef.current);
    clearTimeout(recorderStopTimeoutRef.current);
    clearTimeout(autoRetryTimeoutRef.current);
    cancelAnimationFrame(rafRef.current);
    stateRef.current = null;
    pendingBlobRef.current = null;
    pendingResultRef.current = null;
    recChunksRef.current = [];
    setTimeLeft(MATCH_SEC);
    setTimeProgress(1);
    setAliveCount(TEAMS.length);
    setReviewBusy(false);
    setReviewReady(false);
    setReviewResult(null);
    setAutoRetryActive(false);
  }

  function renderIdleFrame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawField(ctx, moveGap(0));
  }

  function createRecorder(stream) {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
    recChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 25_000_000 });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const result = pendingResultRef.current;
      pendingBlobRef.current = recChunksRef.current.length ? new Blob(recChunksRef.current, { type: 'video/webm' }) : null;
      if (shouldAutoRetry(result) && streamRef.current) {
        setReviewBusy(true);
        setReviewReady(false);
        setAutoRetryActive(true);
        autoRetryTimeoutRef.current = setTimeout(() => {
          if (streamRef.current) startRecordedRound();
        }, AUTO_RETRY_DELAY_MS);
        return;
      }
      setAutoRetryActive(false);
      setReviewBusy(false);
      setReviewReady(true);
      if (result) setReviewResult(result);
    };
    recorder.start(200);
  }

  async function cropStream(stream) {
    try {
      const frame = recordFrameRef.current;
      if (!frame || typeof CropTarget === 'undefined') return;
      const cropTarget = await CropTarget.fromElement(frame);
      const [videoTrack] = stream?.getVideoTracks?.() || [];
      if (cropTarget && videoTrack && typeof videoTrack.cropTo === 'function') {
        await videoTrack.cropTo(cropTarget);
      }
    } catch (_) {
      // ignore crop issues
    }
  }

  function finishMatch(result) {
    if (stateRef.current) stateRef.current.finished = true;
    setPhase('ended');
    setTimeLeft(0);
    setTimeProgress(0);
    setReviewResult(result);

    clearTimeout(finishTimeoutRef.current);
    finishTimeoutRef.current = setTimeout(() => {
      pendingResultRef.current = result;
      const hasRecorder = mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive';
      setReviewBusy(Boolean(hasRecorder));
      setReviewReady(!hasRecorder);
      if (hasRecorder) {
        const recorder = mediaRecorderRef.current;
        recorder.requestData?.();
        clearTimeout(recorderStopTimeoutRef.current);
        recorderStopTimeoutRef.current = setTimeout(() => {
          if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
        }, RECORDER_STOP_BUFFER_MS);
      }
    }, RESULT_HOLD_MS);
  }

  function restartAfterTargetElimination(result) {
    if (stateRef.current) stateRef.current.finished = true;
    pendingResultRef.current = result;
    clearTimeout(finishTimeoutRef.current);
    clearTimeout(autoRetryTimeoutRef.current);
    setReviewResult(null);
    setReviewBusy(true);
    setReviewReady(false);
    setAutoRetryActive(true);

    const recorder = mediaRecorderRef.current;
    if (recorder?.state && recorder.state !== 'inactive') {
      recorder.requestData?.();
      clearTimeout(recorderStopTimeoutRef.current);
      recorderStopTimeoutRef.current = setTimeout(() => {
        if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
      }, 120);
      return;
    }

    autoRetryTimeoutRef.current = setTimeout(() => {
      if (streamRef.current) startRecordedRound();
    }, AUTO_RETRY_DELAY_MS);
  }

  function beginMatch(prerollMs = 0) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resetSession();
    renderIdleFrame();
    setPhase('countdown');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clearTimeout(matchStartTimeoutRef.current);
        matchStartTimeoutRef.current = setTimeout(() => {
          setPhase('playing');
          runLoop(canvas);
        }, MATCH_START_DELAY_MS + prerollMs);
      });
    });
  }

  function startRecordedRound() {
    const stream = streamRef.current;
    if (!stream) return;
    clearTimeout(autoRetryTimeoutRef.current);
    cropStream(stream).catch(() => { });
    createRecorder(stream);
    beginMatch(RECORDING_PREROLL_MS);
  }

  async function startRecording() {
    if (streamRef.current) {
      startRecordedRound();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        preferCurrentTab: true,
        video: { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      const [videoTrack] = stream.getVideoTracks();
      await cropStream(stream);
      videoTrack.onended = () => {
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
      };
      streamRef.current = stream;
      createRecorder(stream);
      beginMatch(RECORDING_PREROLL_MS);
    } catch (_) {
      // ignore
    }
  }

  function handleTryAgain() {
    if (reviewBusy) return;
    startRecordedRound();
  }

  function handleSave() {
    if (!reviewReady || !reviewResult) return;
    if (pendingBlobRef.current) downloadRecording(pendingBlobRef.current);
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    onMatchEnd({ mode: 'elimination-royale', ...reviewResult });
  }

  function runLoop(canvas) {
    if (!stateRef.current) stateRef.current = initState();
    const ctx = canvas.getContext('2d');
    let last = performance.now();

    const loop = (now) => {
      const gs = stateRef.current;
      if (!gs || gs.finished) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      gs.elapsedSec += dt;
      const gap = moveGap(gs.elapsedSec);

      gs.balls.forEach((ball) => {
        if (!ball.alive) return;
        ball.x += ball.vx;
        ball.y += ball.vy;
        handleWallOrGap(ball, gap);
      });

      for (let i = 0; i < gs.balls.length; i++) {
        for (let j = i + 1; j < gs.balls.length; j++) {
          resolveBallCollision(gs.balls[i], gs.balls[j]);
        }
      }

      const alive = gs.balls.filter((ball) => ball.alive);
      const remainingSec = Math.max(0, MATCH_SEC - gs.elapsedSec);
      setAliveCount(alive.length);
      setTimeLeft(Math.ceil(remainingSec));
      setTimeProgress(remainingSec / MATCH_SEC);

      const targetIds = targetWinnerIdsRef.current;
      const aliveTargetIds = targetIds.filter((id) => alive.some((ball) => ball.id === id));
      if (targetIds.length && aliveTargetIds.length === 0) {
        restartAfterTargetElimination({ winnerId: null, survivors: alive.map((ball) => ball.id), autoRetry: true });
        return;
      }

      drawField(ctx, gap);
      alive.forEach((ball) => drawBall(ctx, ball));

      if (alive.length <= 1) {
        finishMatch({ winnerId: alive[0]?.id ?? null, survivors: alive.map((ball) => ball.id) });
        return;
      }
      if (remainingSec <= 0) {
        finishMatch({ winnerId: alive.length === 1 ? alive[0].id : null, survivors: alive.map((ball) => ball.id) });
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    renderIdleFrame();
    return () => {
      clearTimeout(matchStartTimeoutRef.current);
      clearTimeout(finishTimeoutRef.current);
      clearTimeout(recorderStopTimeoutRef.current);
      clearTimeout(autoRetryTimeoutRef.current);
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []); // eslint-disable-line

  const winnerTeam = reviewResult?.winnerId ? teamsById[reviewResult.winnerId] : null;
  const targetWinners = targetWinnerIds.map((id) => teamsById[id]).filter(Boolean);
  const survivorTeams = (reviewResult?.survivors || []).map((id) => teamsById[id]).filter(Boolean);
  const timerProgress = phase === 'recording' || phase === 'countdown' ? 100 : Math.max(0, timeProgress * 100);

  return (
    <div className="ball-game-shell">
      <div className="ball-game-layout ball-game-layout--royale">
        <div className="ball-record-frame ball-record-frame--royale" ref={recordFrameRef}>
          <div className="ball-royale-header">
            <div className="ball-royale-header-title">WORLD CUP 2026</div>
            <div className="ball-royale-timer-text">
              {phase === 'recording' || phase === 'countdown' ? '···' : `${timeLeft}s`}
            </div>
          </div>
          <div className="ball-royale-progress">
            <div className="ball-royale-timer-bar">
              <div className="ball-royale-timer-fill" style={{ width: `${timerProgress}%` }} />
            </div>
          </div>
          <div className="ball-canvas-wrap ball-canvas-wrap--royale">
            <canvas ref={canvasRef} className="ball-canvas ball-canvas--royale" width={CANVAS_W} height={CANVAS_H} />

            {phase === 'recording' && (
              <div className="ball-record-overlay">
                <div className="ball-record-icon">🌍</div>
                <div className="ball-record-title">All Countries Survival</div>
                <div className="ball-record-match">{TEAMS.length} countries enter one circular arena</div>
                <div className="ball-royale-target-picker">
                  <div className="ball-royale-target-head">
                    <label className="ball-royale-target-label">Pick winner(s) optional</label>
                    {targetWinnerIds.length > 0 && (
                      <button className="ball-royale-target-clear" onClick={clearTargetWinners} type="button">Clear</button>
                    )}
                  </div>
                  <div className="ball-royale-target-grid">
                    {TEAMS.map((team) => {
                      const selected = targetWinnerIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          className={`ball-royale-target-chip ${selected ? 'is-selected' : ''}`}
                          onClick={() => toggleTargetWinner(team.id)}
                        >
                          <span className="ball-royale-target-chip-flag">{team.flag}</span>
                          <span>{team.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="ball-royale-target-hint">
                    {targetWinners.length
                      ? `The match keeps going while any picked country is still alive, and auto retries only after all picked countries are eliminated or none of them wins.`
                      : 'Leave empty to keep the current normal mode.'}
                  </div>
                </div>
                <button className="ball-record-btn" onClick={startRecording}>{targetWinners.length ? `🎬 Record Until Picked Winner Wins` : '🎬 Record & Play'}</button>
              </div>
            )}

            {phase === 'countdown' && (
              <div className="ball-intro-overlay ball-intro-overlay--royale">
                <div className="ball-royale-title">WORLD CUP 2026</div>
              </div>
            )}

            {phase === 'ended' && reviewResult && (
              <div className="ball-end-overlay">
                {winnerTeam && (
                  <div className="ball-end-party" aria-hidden="true">
                    {FIREWORKS.map((item, idx) => (
                      <span
                        key={`${item.left}-${idx}`}
                        className="ball-end-firework"
                        style={{
                          left: item.left,
                          bottom: item.bottom,
                          animationDelay: item.delay,
                          animationDuration: item.duration,
                          '--firework': item.color,
                          '--firework-alt': item.alt,
                        }}
                      >
                        <span className="ball-end-firework-trail" />
                        <span className="ball-end-firework-burst">
                          <span className="ball-end-firework-halo" />
                          <span className="ball-end-firework-core" />
                          {FIREWORK_RAYS.map((ray, rayIdx) => (
                            <span
                              key={`${idx}-${rayIdx}`}
                              className="ball-end-firework-ray"
                              style={{
                                '--ray-angle': `${ray.angle}deg`,
                                '--ray-length': `${ray.length}px`,
                              }}
                            >
                              <span className="ball-end-firework-dot" />
                            </span>
                          ))}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="ball-end-winner-label">WINNER</div>
                <div className="ball-end-flag-badge">
                  <div className="ball-end-flag" style={{ color: winnerTeam ? uiColor(winnerTeam) : '#ffffff' }}>
                    {winnerTeam ? winnerTeam.flag : '⏱️'}
                  </div>
                </div>
                <div className="ball-end-headline" style={{ color: winnerTeam ? uiColor(winnerTeam) : '#ffffff' }}>
                  {winnerTeam ? winnerTeam.name : 'TIME UP'}
                </div>
                {!winnerTeam && survivorTeams.length > 0 && (
                  <div className="ball-end-scoreline ball-end-scoreline--teams">
                    {survivorTeams.slice(0, 5).map((team) => <TeamLine key={team.id} team={team} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="ball-game-side">
          <div className="ball-side-card">
            <div className="ball-side-label">Mode</div>
            <div className="ball-side-stage">All Countries Survival</div>
            <div className="ball-side-note">One moving border gap slowly grows. Any country that exits through that opening is eliminated.</div>
            <div className="ball-side-note ball-side-note--royale-target">
              {targetWinners.length ? `Target winners: ${targetWinners.map((team) => `${team.flag} ${team.name}`).join(', ')}` : 'Target winners: off'}
            </div>
          </div>

          <div className="ball-side-card">
            <div className="ball-side-label">Live Status</div>
            <div className="ball-royale-stat">⏱️ <strong>{timeLeft}s</strong> remaining</div>
            <div className="ball-royale-stat">🌍 <strong>{aliveCount}</strong> countries alive</div>
          </div>

          <div className="ball-side-card ball-side-card--action">
            <div className="ball-side-label">Recording</div>
            {phase === 'ended' && reviewResult ? (
              <>
                <div className="ball-side-note">
                  {reviewBusy
                    ? (autoRetryActive && targetWinners.length
                      ? `Retrying automatically until one of the picked countries wins…`
                      : 'Finalizing the recording…')
                    : 'Choose Save to download this video, or Try Again to restart the same match.'}
                </div>
                <div className="ball-side-actions">
                  <button className="ball-side-btn ball-side-btn--ghost" onClick={handleTryAgain} disabled={reviewBusy}>Try Again</button>
                  <button className="ball-side-btn ball-side-btn--primary" onClick={handleSave} disabled={reviewBusy || !reviewReady}>Save</button>
                </div>
              </>
            ) : (
              <div className="ball-side-note">
                {autoRetryActive && targetWinners.length ? 'Restarting now because all picked countries were eliminated.' : 'After the match ends, you can save the recording or restart immediately.'}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}