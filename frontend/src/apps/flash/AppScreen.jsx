import { useEffect, useRef, useState } from 'react';
import useFlashTheme from './useFlashTheme.js';

const TIMER_SEC = 6;
const NEXT_DELAY_SEC = 2;
const SCORECARD_SEC = 4;
const TITLE_SEC = 3;
const ENDCARD_SEC = 4;

function answerFontSize(text) {
  const len = (text || '').trim().length;
  if (len <= 4)  return '72px';
  if (len <= 10) return '52px';
  if (len <= 22) return '38px';
  if (len <= 40) return '30px';
  return '24px';
}

const SCORE_TIERS = [
  { gif: '/score-5.gif', label: '5' },
  { gif: '/score-4.gif', label: '4' },
  { gif: '/score-3.gif', label: '3' },
  { gif: '/score-2.gif', label: '2' },
  { gif: '/score-1.gif', label: '1' },
  { gif: '/score-0.gif', label: '0' },
];

export default function AppScreen({ config, onBack }) {
  const { title, part, cards } = config;
  const [index, setIndex]           = useState(0);
  const [revealed, setRevealed]     = useState(false);
  const [done, setDone]             = useState(false);
  const [ended, setEnded]           = useState(false);
  const [scorecardLeaving, setScorecardLeaving] = useState(false);
  const timerRef                    = useRef(null);
  const nextRef                     = useRef(null);

  // Recording
  const shellRef         = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recChunksRef     = useRef([]);
  const recordingStarted = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [ready, setReady]             = useState(false);
  const [started, setStarted]         = useState(false);
  const [theme, toggleTheme] = useFlashTheme();

  const card  = cards[index];
  const total = cards.length;

  // ── Auto-start recording on mount ──
  useEffect(() => {
    if (recordingStarted.current) return;
    recordingStarted.current = true;
    startRecording().then(() => setReady(true));
  }, []);

  // ── Show title card for TITLE_SEC after recording starts, then begin game ──
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setStarted(true), TITLE_SEC * 1000);
    return () => clearTimeout(t);
  }, [ready]);

  // ── Timer: auto-reveal ──
  useEffect(() => {
    if (!started || revealed || done) return;
    timerRef.current = setTimeout(() => setRevealed(true), TIMER_SEC * 1000);
    return () => clearTimeout(timerRef.current);
  }, [started, index, revealed, done]);

  // ── Auto-advance after reveal ──
  useEffect(() => {
    if (!revealed || done) return;
    nextRef.current = setTimeout(() => {
      if (index + 1 >= total) {
        setDone(true);
      } else {
        setIndex(i => i + 1);
        setRevealed(false);
      }
    }, NEXT_DELAY_SEC * 1000);
    return () => clearTimeout(nextRef.current);
  }, [revealed, done]);

  // ── Show end card after scorecard, then stop recording ──
  useEffect(() => {
    if (!done) return;
    // Start fade-out 600ms before switching so the animation completes
    const fadeOut = setTimeout(() => setScorecardLeaving(true), (SCORECARD_SEC - 0.6) * 1000);
    const swap    = setTimeout(() => setEnded(true), SCORECARD_SEC * 1000);
    return () => { clearTimeout(fadeOut); clearTimeout(swap); };
  }, [done]);

  // ── Auto-stop recording after end card is shown ──
  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => stopRecording(), ENDCARD_SEC * 1000);
    return () => clearTimeout(t);
  }, [ended]);

  function handleReveal() {
    clearTimeout(timerRef.current);
    setRevealed(true);
  }

  function handleRestart() {
    setIndex(0);
    setRevealed(false);
    setDone(false);
  }

  // ── Recording helpers ──
  async function startRecording() {
    return new Promise(async (resolve) => {
      try {
        let cropTarget = null;
        if (typeof CropTarget !== 'undefined' && shellRef.current) {
          cropTarget = await CropTarget.fromElement(shellRef.current);
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          preferCurrentTab: true, video: { frameRate: 30 }, audio: false,
        });
        const [videoTrack] = displayStream.getVideoTracks();
        if (cropTarget && typeof videoTrack.cropTo === 'function') {
          await videoTrack.cropTo(cropTarget);
        }
        videoTrack.onended = () => {
          if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
          setIsRecording(false);
        };
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9' : 'video/webm';
        recChunksRef.current = [];
        const recorder = new MediaRecorder(displayStream, { mimeType });
        mediaRecorderRef.current = recorder;
        let resolved = false;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recChunksRef.current.push(e.data);
          if (!resolved) { resolved = true; resolve(); }
        };
        recorder.onstop = () => {
          const blob = new Blob(recChunksRef.current, { type: 'video/webm' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url; a.download = `part${part}.webm`; a.click();
          URL.revokeObjectURL(url);
          displayStream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
        };
        recorder.start(200);
        setIsRecording(true);
      } catch (_) { resolve(); }
    });
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
  }

  return (
    <div className="fc-app-outer">
      {/* Top bar */}
      <div className="fc-top-bar">
        <button className="fc-back-btn" onClick={onBack}>←</button>
        <div className="fc-top-meta">
          <span className="fc-top-title">{title}</span>
          <span className="fc-top-part">Part {part}</span>
        </div>
        <button className="fc-theme-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {isRecording ? (
          <button className="fc-rec-stop" onClick={stopRecording}>
            <span className="fc-rec-dot" /> Stop
          </button>
        ) : (
          <button className="fc-rec-start" onClick={startRecording}>⏺</button>
        )}
      </div>

      {/* Card */}
      <div className="fc-stage" ref={shellRef}>
        {!ready ? null : !started ? (
          <div className="fc-title-card">
            <div className="fc-title-card-title">{title}</div>
            <div className="fc-title-card-part">Part {part}</div>
          </div>
        ) : ended ? (
          <div className="fc-endcard">
            <div className="fc-endcard-headline">Support like this keeps me going ❤️</div>
            <div className="fc-endcard-body">Subscribe if you enjoyed</div>
          </div>
        ) : done ? (
          <div className={`fc-scorecard${scorecardLeaving ? ' fc-scorecard--leaving' : ''}`}>
            <div className="fc-scorecard-title">Comment down your score 👇</div>
            <div className="fc-scorecard-grid">
                          {SCORE_TIERS.map((tier, i) => (
                <div key={i} className="fc-score-tile">
                  <img src={tier.gif} alt={tier.label} className="fc-score-tile-gif" />
                  <div className="fc-score-tile-label">{tier.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="fc-card" onClick={!revealed ? handleReveal : undefined}>
            {/* Counter */}
            <div className="fc-card-counter">{index + 1}&nbsp;/&nbsp;{total}</div>

            {/* Flip area */}
            <div key={index} className={`fc-card-flip${revealed ? ' fc-card-flip--flipped' : ''}`}>
              <div className="fc-card-face fc-card-face--front">
                <div className="fc-card-question">{card.q}</div>
              </div>
              <div className="fc-card-face fc-card-face--back">
                <div className="fc-card-answer" style={{ fontSize: answerFontSize(card.a) }}>{card.a}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="fc-progress-track">
              <div
                key={index}
                className="fc-progress-fill"
                style={revealed ? { transform: 'scaleX(0)', animation: 'none' } : { animationDuration: `${TIMER_SEC}s` }}
              />
            </div>


          </div>
        )}
      </div>
    </div>
  );
}
