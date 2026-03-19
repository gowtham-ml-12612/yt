import { useEffect, useRef, useState } from 'react';
import ChatHeader from './ChatHeader.jsx';
import MessageBubble from './MessageBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';

function randDelay(min = 2000, max = 4500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function ReplayScreen({ battle, onHome, onContinue }) {
  // 'ask' | 'countdown' | 'playing'
  const [phase, setPhase]         = useState('ask');
  const [countdown, setCountdown] = useState(null);
  const [titleCard, setTitleCard] = useState(false);
  const [displayed, setDisplayed] = useState([]);
  const [thinking, setThinking]   = useState(null);
  const [done, setDone]           = useState(false);
  const [paused, setPaused]       = useState(false);
  const [speed, setSpeed]         = useState(1);
  const [replayKey, setReplayKey]     = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const messagesListRef  = useRef(null);
  const chatShellRef     = useRef(null);
  const pauseRef         = useRef(false);
  const speedRef         = useRef(1);
  const mediaRecorderRef = useRef(null);
  const recChunksRef     = useRef([]);
  const recordingRef     = useRef(false);

  useEffect(() => { pauseRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speed;  }, [speed]);

  // auto-scroll
  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [displayed, thinking]);

  async function startRecording() {
    return new Promise(async (resolve) => {
      try {
        let cropTarget = null;
        if (typeof CropTarget !== 'undefined' && chatShellRef.current) {
          cropTarget = await CropTarget.fromElement(chatShellRef.current);
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
          recordingRef.current = false;
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
          a.href = url; a.download = `replay-${Date.now()}.webm`; a.click();
          URL.revokeObjectURL(url);
          displayStream.getTracks().forEach((t) => t.stop());
          recordingRef.current = false;
          setIsRecording(false);
        };
        recorder.start(200);
      } catch { resolve(); }
    });
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
  }

  // ── Start replay ──
  async function beginReplay(record) {
    recordingRef.current = record;
    setIsRecording(record);
    setPhase('countdown');

    const el = messagesListRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });

    if (record) await startRecording();

    for (const n of [3, 2, 1]) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 500));
    }
    setCountdown(null);

    setTitleCard(true);
    await new Promise((r) => setTimeout(r, 1800));
    setTitleCard(false);

    setPhase('playing');
  }

  // ── Replay loop ──
  useEffect(() => {
    if (phase !== 'playing') return;
    let cancelled = false;
    const messages = battle.messages || [];

    async function waitResumable(ms) {
      const adjusted = Math.round(ms / speedRef.current);
      const step = 100;
      let elapsed = 0;
      while (elapsed < adjusted) {
        if (cancelled) return false;
        if (!pauseRef.current) elapsed += step;
        await new Promise((r) => setTimeout(r, step));
      }
      return !cancelled;
    }

    async function run() {
      for (let i = 0; i < messages.length; i++) {
        if (cancelled) return;
        const msg       = messages[i];
        const agentName = msg.side === 'left' ? battle.leftAgent.name     : battle.rightAgent.name;
        const provider  = msg.side === 'left' ? battle.leftAgent.provider : battle.rightAgent.provider;

        setThinking({ side: msg.side, agentName, provider });
        if (!await waitResumable(randDelay(2000, 4500))) return;

        setThinking(null);
        setDisplayed((prev) => [...prev, { ...msg, agentName, provider }]);

        if (i < messages.length - 1) {
          if (!await waitResumable(randDelay(500, 1200))) return;
        }
      }
      if (!cancelled) {
        setThinking(null);
        setDone(true);
        // recording continues — user must press stop manually
      }
    }

    run();
    return () => { cancelled = true; };
  }, [phase, battle, replayKey]);

  function handleReplayAgain() {
    setDisplayed([]);
    setThinking(null);
    setDone(false);
    setPaused(false);
    setPhase('ask');
  }

  const config = {
    topic:      battle.topic,
    leftAgent:  battle.leftAgent,
    rightAgent: battle.rightAgent,
  };

  return (
    <div className="chat-shell" ref={chatShellRef}>
      <ChatHeader config={config} onReset={onHome} />

      <div className="chat-body">
        <div className="messages-list" ref={messagesListRef}>

          {/* ── Pre-replay dialog ── */}
          {phase === 'ask' && (
            <div className="start-overlay">
              <div className="start-card">
                <div className="start-fire">🔁</div>
                <div className="start-topic">{battle.topic}</div>
                <div className="start-agents">
                  <span className="start-agent-name left-color">{battle.leftAgent.name}</span>
                  <span className="start-vs">vs</span>
                  <span className="start-agent-name right-color">{battle.rightAgent.name}</span>
                </div>
                <div style={{ fontSize: 13, color: '#8696a0', margin: '4px 0 16px' }}>
                  {battle.totalTurns} turns · replay
                </div>
                <button className="btn-start-battle" onClick={() => beginReplay(true)}>
                  ⏺ Record &amp; Replay
                </button>
                <button
                  className="btn-start-battle"
                  style={{ marginTop: 10, background: 'rgba(255,255,255,0.06)', color: '#e9edef', boxShadow: 'none' }}
                  onClick={() => beginReplay(false)}
                >
                  ▶ Just Replay
                </button>
              </div>
            </div>
          )}

          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="countdown-overlay">
              <div
                className="countdown-number"
                key={countdown}
                data-glow={countdown % 2 === 0 ? 'blue' : 'red'}
              >{countdown}</div>
            </div>
          )}

          {/* Battle title card */}
          {titleCard && (
            <div className="countdown-overlay title-card-overlay">
              <div className="title-card">
                <div className="title-card-side">
                  <div className="title-card-nick red-glow">{battle.leftAgent?.name}</div>
                  {battle.leftAgent?.stance && (
                    <div className="title-card-stance red-glow-stance">{battle.leftAgent.stance}</div>
                  )}
                </div>
                <div className="title-card-vs">VS</div>
                <div className="title-card-side">
                  <div className="title-card-nick blue-glow">{battle.rightAgent?.name}</div>
                  {battle.rightAgent?.stance && (
                    <div className="title-card-stance blue-glow-stance">{battle.rightAgent.stance}</div>
                  )}
                </div>
                <div className="title-card-topic">{battle.topic}</div>
              </div>
            </div>
          )}

          {displayed.map((msg) => (
            <MessageBubble
              key={msg.id}
              side={msg.side}
              content={msg.content}
              agentName={msg.agentName}
              turn={msg.turn}
              provider={msg.provider}
            />
          ))}

          {thinking && (
            <TypingIndicator
              side={thinking.side}
              agentName={thinking.agentName}
              provider={thinking.provider}
            />
          )}


        </div>
      </div>

      {/* Controls bar — only shown while playing */}
      {phase === 'playing' && (
        <div className="chat-controls-bar">
          {!done ? (
            <>
              <button
                className={`ctrl-btn ctrl-mode ${paused ? 'mode-manual' : 'mode-auto'}`}
                onClick={() => setPaused((p) => !p)}
                title={paused ? 'Resume' : 'Pause'}
              >
                {paused ? '▶' : '⏸'}
              </button>
              <button
                className="ctrl-btn ctrl-mode"
                style={{ width: 'auto', borderRadius: 20, padding: '0 14px', fontSize: 12, fontWeight: 700 }}
                onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
                title="Toggle speed"
              >
                {speed}×
              </button>
            </>
          ) : (
            <span className="replay-done-label">🏁 {battle.totalTurns} turns · done</span>
          )}
          <div className="ctrl-right">
            {isRecording && (
              <button className="ctrl-btn ctrl-stop" onClick={stopRecording} title="Stop recording">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
            )}
            {done && (
              <button className="ctrl-btn ctrl-continue" style={{ minWidth: 110 }} onClick={handleReplayAgain}>
                🔁 Replay Again
              </button>
            )}
            {done && onContinue && (
              <button className="ctrl-btn ctrl-newchat" onClick={() => onContinue(battle)}>
                ▶ Continue
              </button>
            )}
            <button className="ctrl-btn ctrl-newchat" onClick={onHome}>🏠 Home</button>
          </div>
        </div>
      )}
    </div>
  );
}

