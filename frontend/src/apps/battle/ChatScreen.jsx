import { useEffect, useRef, useState } from 'react';
import ChatHeader from './ChatHeader.jsx';
import MessageBubble from './MessageBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import { createBattle, appendMessage, endBattle } from '../../battleStorage.js';

export default function ChatScreen({ config, onReset }) {
  // --- Seed resume messages ---
  const [messages, setMessages] = useState(
    (config.resumeMessages || []).map((m) => ({
      id: m.id,
      side: m.side,
      agentName: m.side === 'left' ? config.leftAgent.name : config.rightAgent.name,
      content: m.content,
      turn: m.turn,
    }))
  );
  const [thinking, setThinking] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [autoMode, setAutoMode] = useState(!!config.autoMode);
  const [ended, setEnded] = useState(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [titleCard, setTitleCard] = useState(false);
  const [infoStep, setInfoStep] = useState(0);

  const isResume = !!(config.battleId && config.resumeMessages?.length > 0);

  // Auto-start when coming from replay Continue button
  useEffect(() => {
    if (config.autoStart) handleStart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const messagesListRef = useRef(null);
  const esRef = useRef(null);
  const chatShellRef = useRef(null);
  const battleIdRef = useRef(config.battleId || null); // persisted battle id

  // --- Recording refs (video-only) ---
  const mediaRecorderRef = useRef(null);
  const recChunksRef     = useRef([]);
  const recStreamRef     = useRef(null);

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
        recStreamRef.current = displayStream;
        const [videoTrack] = displayStream.getVideoTracks();
        if (cropTarget && typeof videoTrack.cropTo === 'function') {
          await videoTrack.cropTo(cropTarget);
        }
        videoTrack.onended = () => {
          if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
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
          a.href = url; a.download = `roast-battle-${Date.now()}.webm`; a.click();
          URL.revokeObjectURL(url);
          displayStream.getTracks().forEach((t) => t.stop());
          recStreamRef.current = null;
        };
        recorder.start(200);
      } catch { resolve(); }
    });
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
  }

  // --- Kill any leftover backend conversation on mount ---
  useEffect(() => {
    fetch('/api/stop', { method: 'POST' }).catch(() => {});
  }, []);

  // --- Connect to SSE stream only after user clicks Start ---
  useEffect(() => {
    if (!started) return;

    const es = esRef.current; // already opened in handleStart — just attach listeners

    es.addEventListener('thinking_start', (e) => {
      const data = JSON.parse(e.data);
      setWaiting(false);
      setThinking({ side: data.side, agentName: data.agentName, provider: data.provider });
    });

    es.addEventListener('message_complete', (e) => {
      const data = JSON.parse(e.data);
      setThinking(null);
      setMessages((prev) => [...prev, data]);
      // Auto-save to localStorage
      appendMessage(battleIdRef.current, {
        id: data.id, side: data.side, content: data.content, turn: data.turn,
      });
    });

    es.addEventListener('waiting', (e) => {
      const data = JSON.parse(e.data);
      // In auto mode the backend resumes itself; only show Continue in manual
      if (!data.autoMode) setWaiting(true);
    });

    es.addEventListener('conversation_end', (e) => {
      const data = JSON.parse(e.data);
      setThinking(null);
      setWaiting(false);
      setEnded(data);
      endBattle(battleIdRef.current, data.reason, data.totalTurns);
      setTimeout(() => stopRecording(), 3000);
    });

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse(e.data);
        setError(data.message || 'An error occurred.');
      } catch {
        // SSE connection error (not a data error) — ignore reconnect attempts
      }
      setThinking(null);
      setWaiting(false);
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [started]);

  // --- Auto-scroll on new messages or thinking state ---
  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, waiting]);

  async function handleStart() {
    setError('');
    try {
      setLaunching(true);

      if (!config.autoStart) {
        const el = messagesListRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });

        await startRecording();

        for (const n of [3, 2, 1]) {
          setCountdown(n);
          await new Promise((r) => setTimeout(r, 500));
        }
        setCountdown(null);

        setTitleCard(true);
        await new Promise((r) => setTimeout(r, 1800));
        setTitleCard(false);
      }

      // 3. Open SSE connection NOW and wait for it to be ready
      //    before telling the backend to start — otherwise thinking_start
      //    fires before the EventSource is connected and the first event is lost.
      await new Promise((resolve) => {
        const es = new EventSource('/api/stream');
        esRef.current = es;
        es.onopen = resolve;
        // fallback: if onopen never fires (some browsers), unblock after 400ms
        setTimeout(resolve, 400);
      });
      setStarted(true);

      // 4. Stagger info messages (skip on resume — shown already)
      if (!isResume) {
        setTimeout(() => setInfoStep(1), 0);
        setTimeout(() => setInfoStep(2), 500);
        setTimeout(() => setInfoStep(3), 1000);
      } else {
        setInfoStep(3); // show all instantly
      }

      // 5. Create or reuse battle record
      if (!battleIdRef.current) {
        battleIdRef.current = createBattle(config);
      }

      // 6. Tell backend to start, sending seeded history for resume
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          history: config.resumeMessages || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start. Check your API keys in .env');
      }
    } catch {
      setError('Could not reach backend. Make sure it is running on port 3001.');
    }
  }

  async function handleToggleMode() {
    const next = !autoMode;
    setAutoMode(next);
    if (next) setWaiting(false); // hide Continue button immediately
    await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoMode: next }),
    });
  }

  async function handleContinue() {
    setWaiting(false);
    await fetch('/api/next', { method: 'POST' });
  }

  async function handleStop() {
    await fetch('/api/stop', { method: 'POST' });
    stopRecording();
  }

  return (
    <div className="chat-shell">
      {/* WhatsApp-style group header */}
      <ChatHeader config={config} onReset={onReset} />

      {/* Scrollable message area — this is what gets recorded */}
      <div className="chat-body" ref={chatShellRef}>

        {/* Messages */}
        <div className="messages-list" ref={messagesListRef}>
          {/* Start overlay — shown before battle begins */}
          {!started && !launching && !countdown && (
            <div className="start-overlay">
              <div className="start-card">
                <div className="start-fire">🔥</div>
                <div className="start-topic">{config.topic}</div>
                <div className="start-agents">
                  <span className="start-agent-name left-color">{config.leftAgent.name}</span>
                  <span className="start-vs">vs</span>
                  <span className="start-agent-name right-color">{config.rightAgent.name}</span>
                </div>
                {error && <div className="error-banner" style={{marginBottom: '12px'}}>⚠️ {error}</div>}
                <button className="btn-start-battle" onClick={handleStart}>
                  {isResume ? '▶ Continue Battle' : '▶ Start Roast Battle'}
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
                  <div className="title-card-nick red-glow">{config.leftAgent.name}</div>
                  {config.leftAgent.stance && (
                    <div className="title-card-stance red-glow-stance">{config.leftAgent.stance}</div>
                  )}
                </div>
                <div className="title-card-vs">VS</div>
                <div className="title-card-side">
                  <div className="title-card-nick blue-glow">{config.rightAgent.name}</div>
                  {config.rightAgent.stance && (
                    <div className="title-card-stance blue-glow-stance">{config.rightAgent.stance}</div>
                  )}
                </div>
                <div className="title-card-topic">{config.topic}</div>
              </div>
            </div>
          )}
          {/* WhatsApp-style system info messages — staggered */}
          {infoStep >= 1 && <div className="info-msg">Admin added {config.leftAgent.name}</div>}
          {infoStep >= 2 && <div className="info-msg">Admin added {config.rightAgent.name}</div>}
          {infoStep >= 3 && <div className="info-msg">Admin renamed this group to "{config.topic}"</div>}

          {messages.map((msg) => {
            const agent = msg.side === 'left' ? config.leftAgent : config.rightAgent;
            return (
              <MessageBubble
                key={msg.id}
                side={msg.side}
                content={msg.content}
                agentName={msg.agentName}
                turn={msg.turn}
                provider={agent.provider}
              />
            );
          })}

          {/* CTA message — shown when battle ends */}
          {ended && config.ctaMessage && (
            <div className="cta-msg">{config.ctaMessage}</div>
          )}

          {/* Typing indicator — only after all info pills have appeared */}
          {thinking && infoStep >= 3 && (
            <TypingIndicator
              side={thinking.side}
              agentName={thinking.agentName}
              provider={thinking.side === 'left' ? config.leftAgent.provider : config.rightAgent.provider}
            />
          )}



          {error && <div className="error-banner">⚠️ {error}</div>}

        </div>
      </div>

      {/* ── Bottom control bar (outside the chat, like WhatsApp input area) ── */}
      <div className="chat-controls-bar">
        {/* Center: main action */}
        {!started ? null : waiting && !ended ? (
          <button className="ctrl-btn ctrl-continue" onClick={handleContinue}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Continue
          </button>
        ) : ended ? (
          <div className="ctrl-ended-row">
            <span className="ctrl-ended-label">
              🏁 {ended.reason === 'max_turns' ? `${ended.totalTurns} turns` : 'Stopped'}
            </span>
            <button className="ctrl-btn ctrl-newchat" onClick={onReset}>🏠 Home</button>
          </div>
        ) : null}

        {/* Right: mode + stop */}
        <div className="ctrl-right">
          {started && !ended && (
            <button
              className={`ctrl-btn ctrl-mode ${autoMode ? 'mode-auto' : 'mode-manual'}`}
              onClick={handleToggleMode}
              title={autoMode ? 'Switch to Manual' : 'Switch to Auto'}
            >
              {autoMode ? '⚡' : '✋'}
            </button>
          )}
          {started && !ended && (
            <button className="ctrl-btn ctrl-stop" onClick={handleStop} title="Stop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
