import { useEffect, useRef, useState, useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const ITEM_DURATION_MS = 5000;
const INTRO_DURATION_MS = 1600;
const RESULT_HOLD_MS = 2200;
const RECORDING_PREROLL_MS = 200;
const RECORDER_STOP_BUFFER_MS = 400;
const DEFAULT_ACCENT = '#2a7bff';

// ── Helpers ──────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0'); }
function liveTime() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function liveDate() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase();
}
function liveDateShort() {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  }); // e.g. "22 Mar"
}

// Parse **bold** → <strong> spans
function parseBold(text, accentColor) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: '#fff', fontWeight: 500 }}>{p}</strong>
      : <span key={i}>{p}</span>
  );
}

// Split headline on \n and wrap emphasis word in accent colour
function HeadlineBlock({ rawHeadline, emphasis, accent }) {
  const lines = rawHeadline.split('\\n').flatMap((l) => l.split('\n'));
  return (
    <>
      {lines.map((line, li) => {
        if (emphasis && line.includes(emphasis)) {
          const idx = line.indexOf(emphasis);
          return (
            <div key={li} className="nws-hl-line">
              {line.slice(0, idx)}
              <em style={{ color: accent }}>{emphasis}</em>
              {line.slice(idx + emphasis.length)}
            </div>
          );
        }
        return <div key={li} className="nws-hl-line">{line}</div>;
      })}
    </>
  );
}

// ── Image News Card ──────────────────────────────────────────────────────────
function ImageNewsCard({ story, channel, accent, dateStr, clock, visible, imageUrl }) {
  return (
    <div className={`nws-content nws-img-card ${visible ? 'nws-content--in' : 'nws-content--out'}`}>
      {/* Image area */}
      <div className="nws-img-area">
        <img src={imageUrl} alt="" className="nws-img-photo" />
        {/* Category overlay on image */}
        <div className="nws-img-cat-overlay">
          <span className="nws-img-cat-badge" style={{ background: accent }}>
            {story.category.toUpperCase()}
          </span>
          <span className="nws-img-date">{dateStr}</span>
        </div>
      </div>

      {/* Text area */}
      <div className="nws-img-body">
        {/* Channel + date */}
        <div className="nws-top-meta" style={{ marginBottom: 8 }}>
          <div className="nws-ch-id">{channel}</div>
          <div className="nws-img-topdate">
            <span>{dateStr}</span>
            <span className="nws-topdate-time">{clock}</span>
          </div>
        </div>

        {/* Headline — respects \n breaks */}
        <div className="nws-img-headline" style={{ borderLeftColor: accent }}>
          {(() => {
            const lines = story.headline.split(/\\n|\n/);
            const em = story.headlineEmphasis;
            return lines.map((line, li) => {
              const trimmed = line.trim();
              if (em && trimmed.includes(em)) {
                const idx = trimmed.indexOf(em);
                return <span key={li} style={{ display: 'block' }}>
                  {trimmed.slice(0, idx)}
                  <em style={{ color: accent, fontStyle: 'normal' }}>{em}</em>
                  {trimmed.slice(idx + em.length)}
                </span>;
              }
              return <span key={li} style={{ display: 'block' }}>{trimmed}</span>;
            });
          })()}
        </div>
        {/* Sub */}
        {story.sub && <div className="nws-img-sub">{story.sub}</div>}

        {/* Body bullets */}
        {story.body?.length > 0 && (
          <div className="nws-body-pts" style={{ marginTop: 10 }}>
            {story.body.map((pt, i) => (
              <div key={i} className="nws-bp">
                <span className="nws-bp-dot" style={{ background: accent }} />
                <span className="nws-bp-text">{parseBold(pt, accent)}</span>
              </div>
            ))}
          </div>
        )}

        {/* NOTE */}
        {story.facts?.length > 0 && (
          <div className="nws-facts" style={{ marginTop: 10 }}>
            <div className="nws-fact">
              <span className="nws-fnote" style={{ color: accent, borderColor: `${accent}55` }}>NOTE</span>
              <span className="nws-ft">{parseBold(story.facts[0], accent)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gold / Silver rates card ─────────────────────────────────────────────────
const GOLD_ACCENT = '#d4a017';
const SILVER_ACCENT = '#a8b8c8';

function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function GoldSilverCard({ story, channel, accent, dateStr, clock, visible }) {
  const g24 = story.gold24k || 0;
  const g22 = story.gold22k || Math.round(g24 * 22 / 24);
  const g1g = Math.round(g24 / 10);
  const s1kg = story.silver1kg || 0;
  const s1g = Math.round(s1kg / 1000);
  const trend = story.trend || 'flat';
  const hist = Array.isArray(story.history) ? story.history : [];

  const trendGold = story.trendGold || trend;
  const trendSilver = story.trendSilver || trend;

  const refGold = hist.length > 0 ? Math.round((hist[0].gold || hist[0].gold24k || 0) / 10) : 0;
  const refSilver = hist.length > 0 ? (hist[0].silver || hist[0].silver1kg || 0) : 0;
  const pctGold = refGold > 0 ? ((g1g - refGold) / refGold) * 100 : null;
  const pctSilver = refSilver > 0 ? ((s1kg - refSilver) / refSilver) * 100 : null;

  const todayShort = liveDateShort();
  const tableRows = [
    { date: todayShort, gold: g24, silver: s1kg, isToday: true },
    ...hist.slice(0, 4),
  ];

  function Badge({ pct, metalTrend }) {
    if (pct === null) return null;
    const isFlat = metalTrend === 'flat' || Math.abs(pct).toFixed(2) === '0.00';
    const neg = !isFlat && (metalTrend === 'down' || (metalTrend !== 'up' && pct < 0));
    if (isFlat) return (
      <div className="nws-gs-badge nws-gs-badge--flat">
        <div className="nws-gs-tri-flat" />
        <span>0.00%</span>
      </div>
    );
    return (
      <div className={`nws-gs-badge${neg ? ' nws-gs-badge--dn' : ' nws-gs-badge--up'}`}>
        <div className={neg ? 'nws-gs-tri-dn' : 'nws-gs-tri-up'} />
        <span>{neg ? '−' : '+'}{Math.abs(pct).toFixed(2)}%</span>
      </div>
    );
  }

  return (
    <div className={`nws-content nws-gs-card ${visible ? 'nws-content--in' : 'nws-content--out'}`}>

      {/* Header */}
      <div className="nws-gs-hrow">
        <div className="nws-gs-hleft">
          <div className="nws-gs-coins">
            <div className="nws-gs-coin nws-gs-coin--au">Au</div>
            <div className="nws-gs-coin nws-gs-coin--ag">Ag</div>
          </div>
          <div className="nws-gs-tmain">Gold &amp; Silver</div>
        </div>
        <div className="nws-gs-hright">
          <div className="nws-gs-tdate">{dateStr}</div>
          <div className="nws-gs-ttime">{clock}</div>
        </div>
      </div>

      {/* Gold block */}
      <div className="nws-gs-block nws-gs-block--gold">
        <div className="nws-gs-mlabel nws-gs-mlabel--g">
          <div className="nws-gs-mdot nws-gs-mdot--g" />Gold · 24K · Per gram
        </div>
        <div className="nws-gs-prow">
          <div className="nws-gs-bigprice nws-gs-bigprice--g">
            <span className="nws-gs-sym nws-gs-sym--g">₹</span>{g1g.toLocaleString('en-IN')}
          </div>
          <Badge pct={pctGold} metalTrend={trendGold} />
        </div>
        <div className="nws-gs-subrow">
          <span className="nws-gs-subp nws-gs-subp--g">22K/10g <b>₹{g22.toLocaleString('en-IN')}</b></span>
          <span className="nws-gs-subp nws-gs-subp--g">24K/10g <b>₹{g24.toLocaleString('en-IN')}</b></span>
        </div>
      </div>

      {/* Silver block */}
      <div className="nws-gs-block nws-gs-block--silver">
        <div className="nws-gs-mlabel nws-gs-mlabel--s">
          <div className="nws-gs-mdot nws-gs-mdot--s" />Silver · Per gram
        </div>
        <div className="nws-gs-prow">
          <div className="nws-gs-bigprice nws-gs-bigprice--s">
            <span className="nws-gs-sym nws-gs-sym--s">₹</span>{s1g.toLocaleString('en-IN')}
          </div>
          <Badge pct={pctSilver} metalTrend={trendSilver} />
        </div>
        <div className="nws-gs-subrow">
          <span className="nws-gs-subp nws-gs-subp--s">1 kg <b>₹{s1kg.toLocaleString('en-IN')}</b></span>
        </div>
      </div>

      {/* Trend */}
      <div className="nws-gs-trend-section">
        <div className="nws-gs-trend-head">
          <span className="nws-gs-tlabel">5-Day Trend</span>
          <span className="nws-gs-tsource">Source: IBJA · Indicative</span>
        </div>
        <table className="nws-gs-ttable">
          <thead>
            <tr>
              <th className="nws-gs-th-d">Date</th>
              <th className="nws-gs-th-g">Gold / g</th>
              <th className="nws-gs-th-s">Silver / kg</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((h, i) => (
              <tr key={i} className={h.isToday ? 'nws-gs-tr0' : ''}>
                <td className="nws-gs-td-d">{h.date}</td>
                <td className="nws-gs-td-g">₹{Math.round((h.gold || h.gold24k || 0) / 10).toLocaleString('en-IN')}</td>
                <td className="nws-gs-td-s">₹{(h.silver || h.silver1kg || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="nws-gs-footer">
        <span className="nws-gs-chname">{channel}</span>
        <span className="nws-gs-chdate">{liveDate()} · {liveTime()}</span>
      </div>
    </div>
  );
}

// ── The phone card (record frame content) ──────────────────────────────────
function NewsCard({ story, config, clock, progress, visible, isIdle, isIntroing, isEnded, storyIdx, total }) {
  const { channel, handle, categoryColors, stories } = config;
  const accent = categoryColors[story?.category] || DEFAULT_ACCENT;
  const dateStr = liveDate();

  return (
    <div className="nws-phone">
      {/* Grid background — hidden for gold card */}
      {!(story?.rates || story?.gold24k) && <div className="nws-grid-bg" />}
      {/* Glow */}
      <div className="nws-glow" style={{ background: `radial-gradient(circle, ${accent}18 0%, transparent 72%)` }} />

      {/* ── Content safe zone ── */}
      <div className="nws-safe">
        {/* Story progress bars */}
        {!isIdle && (
          <div className="nws-story-bar-row">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className="nws-story-bar-track">
                <div
                  className="nws-story-bar-fill"
                  style={{
                    width: i < storyIdx ? '100%' : i === storyIdx ? `${progress * 100}%` : '0%',
                    background: accent,
                    transition: i === storyIdx ? 'width 0.12s linear' : 'none',
                  }}
                />
              </div>
            ))}
            <div className="nws-story-counter" style={{ color: accent }}>
              {storyIdx + 1}&thinsp;/&thinsp;{total}
            </div>
          </div>
        )}

        {story && !isIdle && (() => {
          const imageUrl = config.images?.[String(storyIdx + 1)];
          if (story.rates || story.gold24k) return (
            <GoldSilverCard
              story={story} channel={channel} accent={accent}
              dateStr={dateStr} clock={clock} visible={visible}
            />
          );
          if (imageUrl) return (
            <ImageNewsCard
              story={story} channel={channel} accent={accent}
              dateStr={dateStr} clock={clock} visible={visible} imageUrl={imageUrl}
            />
          );
          return (
            <div className={`nws-content ${visible ? 'nws-content--in' : 'nws-content--out'}`}>
              {/* Channel */}
              <div className="nws-top-meta">
                <div className="nws-ch-id">{channel}</div>
              </div>

              {/* Category + date */}
              <div className="nws-cat-row">
                <div className="nws-cat" style={{ color: accent, borderColor: `${accent}50`, background: `${accent}18` }}>
                  {story.category.toUpperCase()}
                </div>
                <div className="nws-catline" style={{ background: `${accent}30` }} />
                <div className="nws-catdate">
                  <span>{dateStr}</span>
                  <span className="nws-catdate-time">{clock}</span>
                </div>
              </div>

              {/* Big headline */}
              <div className="nws-headline">
                <HeadlineBlock rawHeadline={story.headline} emphasis={story.headlineEmphasis} accent={accent} />
              </div>

              {/* Subheadline */}
              {story.sub && <div className="nws-sub">{story.sub}</div>}

              {/* Rule */}
              <div className="nws-rule" style={{ background: `${accent}35` }} />

              {/* Body bullets */}
              {story.body?.length > 0 && (
                <div className="nws-body-pts">
                  {story.body.map((pt, i) => (
                    <div key={i} className="nws-bp">
                      <span className="nws-bp-dot" style={{ background: accent }} />
                      <span className="nws-bp-text">{parseBold(pt, accent)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* NOTE */}
              {story.facts.length > 0 && (
                <div className="nws-facts">
                  <div className="nws-fact">
                    <span className="nws-fnote" style={{ color: accent, borderColor: `${accent}55` }}>NOTE</span>
                    <span className="nws-ft">{parseBold(story.facts[0], accent)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

    </div>
  );
}

// ── NewsPlayer ───────────────────────────────────────────────────────────────
export default function NewsPlayer({ config, onBack }) {
  const { stories } = config;
  const total = stories.length;

  // ── Refs ──
  const recordFrameRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recChunksRef = useRef([]);
  const pendingBlobRef = useRef(null);
  const recorderStopTimeoutRef = useRef(null);
  const finishTimeoutRef = useRef(null);
  const autoTimerRef = useRef(null);
  const elapsedRef = useRef(0);
  const storyIdxRef = useRef(0);
  // BGM
  const bgmRef = useRef(null);
  const audioCtxRef = useRef(null);
  const bgmSrcNodeRef = useRef(null);
  const bgmDestRef = useRef(null);
  const phaseRef = useRef('idle');

  // ── State ──
  const [phase, setPhase] = useState('idle');
  const [storyIdx, setStoryIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [clock, setClock] = useState(liveTime);
  const [elapsed, setElapsed] = useState(0);
  const [reviewReady, setReviewReady] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setClock(liveTime()), 15_000);
    return () => clearInterval(id);
  }, []);

  const progress = Math.min(elapsed / ITEM_DURATION_MS, 1);

  // ── Story timer ──
  const startStoryTimer = useCallback((idx) => {
    clearInterval(autoTimerRef.current);
    elapsedRef.current = 0;
    setElapsed(0);
    const start = performance.now();
    autoTimerRef.current = setInterval(() => {
      const delta = performance.now() - start;
      elapsedRef.current = delta;
      setElapsed(delta);
      if (delta >= ITEM_DURATION_MS) {
        clearInterval(autoTimerRef.current);
        const next = idx + 1;
        if (next < total) {
          advanceTo(next);
        } else {
          handleEnd();
        }
      }
    }, 40);
  }, [total]); // eslint-disable-line

  function advanceTo(idx) {
    clearInterval(autoTimerRef.current);
    storyIdxRef.current = idx;
    setVisible(false);
    setTimeout(() => {
      setStoryIdx(idx);
      setVisible(true);
      if (phaseRef.current === 'playing') startStoryTimer(idx);
    }, 300);
  }

  function handleEnd() {
    clearInterval(autoTimerRef.current);
    phaseRef.current = 'idle';
    setPhase('idle');
    clearTimeout(finishTimeoutRef.current);
    const rec = mediaRecorderRef.current;
    if (rec?.state && rec.state !== 'inactive') {
      setReviewBusy(true);
      rec.requestData?.();
      recorderStopTimeoutRef.current = setTimeout(() => {
        if (rec?.state !== 'inactive') rec.stop();
      }, RECORDER_STOP_BUFFER_MS);
    } else {
      setReviewReady(true);
    }
  }

  function startPlayback() {
    storyIdxRef.current = 0;
    phaseRef.current = 'playing';
    setStoryIdx(0);
    setVisible(true);
    setPhase('playing');
    startStoryTimer(0);
  }

  function handleBegin() {
    clearTimeout(finishTimeoutRef.current);
    startPlayback();
  }

  function handlePause() {
    if (phase === 'playing') {
      clearInterval(autoTimerRef.current);
      phaseRef.current = 'paused';
      setPhase('paused');
    } else if (phase === 'paused') {
      phaseRef.current = 'playing';
      setPhase('playing');
      const frozen = elapsedRef.current;
      const start = performance.now();
      autoTimerRef.current = setInterval(() => {
        const newElapsed = frozen + (performance.now() - start);
        elapsedRef.current = newElapsed;
        setElapsed(newElapsed);
        if (newElapsed >= ITEM_DURATION_MS) {
          clearInterval(autoTimerRef.current);
          const next = storyIdxRef.current + 1;
          if (next < total) advanceTo(next);
          else handleEnd();
        }
      }, 40);
    }
  }

  function handlePrev() {
    if (storyIdx === 0 || phase === 'idle' || phase === 'intro') return;
    advanceTo(storyIdx - 1);
    if (phase !== 'playing') { phaseRef.current = 'playing'; setPhase('playing'); }
  }

  function handleNext() {
    if (storyIdx + 1 >= total || phase === 'idle' || phase === 'intro') return;
    advanceTo(storyIdx + 1);
    if (phase !== 'playing') { phaseRef.current = 'playing'; setPhase('playing'); }
  }

  function handleRestart() {
    clearInterval(autoTimerRef.current);
    clearTimeout(finishTimeoutRef.current);
    phaseRef.current = 'idle';
    storyIdxRef.current = 0;
    elapsedRef.current = 0;
    setReviewReady(false);
    setReviewBusy(false);
    setPhase('idle');
    setStoryIdx(0);
    setElapsed(0);
    setVisible(true);
  }

  // ── BGM audio track for recorder ──
  function getBgmAudioTrack() {
    try {
      if (!bgmRef.current) return null;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      if (!bgmSrcNodeRef.current) {
        bgmSrcNodeRef.current = ctx.createMediaElementSource(bgmRef.current);
        bgmDestRef.current = ctx.createMediaStreamDestination();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.5;
        bgmSrcNodeRef.current.connect(gainNode);
        gainNode.connect(bgmDestRef.current);
        gainNode.connect(ctx.destination);
      }
      return bgmDestRef.current.stream.getAudioTracks()[0] || null;
    } catch (_) { return null; }
  }

  // ── Recording ──
  async function cropStream(stream) {
    try {
      const frame = recordFrameRef.current;
      if (!frame || typeof CropTarget === 'undefined') return;
      const ct = await CropTarget.fromElement(frame);
      const [vt] = stream?.getVideoTracks?.() || [];
      if (ct && vt && typeof vt.cropTo === 'function') await vt.cropTo(ct);
    } catch (_) { }
  }

  function createRecorder(stream, audioTrack) {
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
    recChunksRef.current = [];
    const tracks = [...stream.getVideoTracks()];
    if (audioTrack) tracks.push(audioTrack);
    const combined = new MediaStream(tracks);
    const rec = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 18_000_000 });
    mediaRecorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
    rec.onstop = () => {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current.currentTime = 0; }
      pendingBlobRef.current = recChunksRef.current.length
        ? new Blob(recChunksRef.current, { type: 'video/webm' }) : null;
      setReviewBusy(false);
      setReviewReady(true);
    };
    rec.start(200);
  }

  async function handleRecord() {
    if (streamRef.current) {
      cropStream(streamRef.current).catch(() => { });
      const audioTrack = getBgmAudioTrack();
      createRecorder(streamRef.current, audioTrack);
      if (bgmRef.current) { bgmRef.current.volume = 0.7; bgmRef.current.currentTime = 0; bgmRef.current.play().catch(() => { }); }
      handleRestart();
      setTimeout(handleBegin, RECORDING_PREROLL_MS);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        preferCurrentTab: true,
        video: { frameRate: { ideal: 60, max: 60 } },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current.currentTime = 0; }
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      };
      await cropStream(stream);
      const audioTrack = getBgmAudioTrack();
      createRecorder(stream, audioTrack);
      if (bgmRef.current) { bgmRef.current.volume = 0.7; bgmRef.current.currentTime = 0; bgmRef.current.play().catch(() => { }); }
      handleRestart();
      setTimeout(handleBegin, RECORDING_PREROLL_MS);
    } catch (_) { }
  }

  function handleSave() {
    if (!reviewReady) return;
    if (pendingBlobRef.current) {
      const url = URL.createObjectURL(pendingBlobRef.current);
      const a = document.createElement('a');
      a.href = url;
      a.download = `news-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    }
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    setReviewReady(false);
  }

  useEffect(() => () => {
    clearInterval(autoTimerRef.current);
    clearTimeout(finishTimeoutRef.current);
    clearTimeout(recorderStopTimeoutRef.current);
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
  }, []);

  const isPlaying = phase === 'playing';
  const isIdle = phase === 'idle';
  const isIntroing = phase === 'intro';
  const isEnded = phase === 'ended';
  const story = (isPlaying || phase === 'paused') ? stories[storyIdx] : null;

  return (
    <div className="news-player-shell">
      {/* Hidden BGM */}
      <audio ref={bgmRef} src="/news/newsbgm.mp3" loop preload="auto" style={{ display: 'none' }} crossOrigin="anonymous" />

      {/* Back nav */}
      <div className="news-nav-bar">
        <button className="news-back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="news-nav-title">📺 {config.channel}</span>
        <div style={{ width: 36 }} />
      </div>

      {/* ── Record frame ── */}
      <div className="nws-frame-wrap" ref={recordFrameRef}>
        <NewsCard
          story={story || stories[storyIdx]}
          config={config}
          clock={clock}
          progress={progress}
          visible={visible}
          isIdle={isIdle}
          isIntroing={isIntroing}
          isEnded={isEnded}
          storyIdx={storyIdx}
          total={total}
        />
      </div>

      {/* ── Controls ── */}
      <div className="news-controls">
        {/* Story dots */}
        <div className="news-dots">
          {stories.map((_, i) => {
            const accent = config.categoryColors[stories[i].category] || DEFAULT_ACCENT;
            return (
              <span
                key={i}
                className={`news-dot ${i === storyIdx && !isIdle ? 'news-dot--active' : i < storyIdx ? 'news-dot--done' : ''}`}
                style={i === storyIdx && !isIdle ? { background: accent } : i < storyIdx ? { background: accent, opacity: 0.4 } : {}}
              />
            );
          })}
        </div>

        {/* Transport */}
        <div className="news-ctrl-row">
          <button className="news-ctrl-btn" onClick={handlePrev} disabled={storyIdx === 0 || isIdle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19,5 9,12 19,19" /><rect x="5" y="5" width="3" height="14" rx="1" />
            </svg>
          </button>

          {isIdle ? (
            <button className="news-ctrl-play" onClick={handleBegin}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>
            </button>
          ) : (
            <button className={`news-ctrl-play ${isPlaying ? 'news-ctrl-play--pause' : ''}`} onClick={handlePause}>
              {isPlaying
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>
              }
            </button>
          )}

          <button className="news-ctrl-btn" onClick={handleNext} disabled={storyIdx >= total - 1 || isIdle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,5 15,12 5,19" /><rect x="16" y="5" width="3" height="14" rx="1" />
            </svg>
          </button>

          <button className="news-ctrl-btn" onClick={handleRestart} title="Restart">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        </div>

        {/* Recording */}
        <div className="news-rec-row">
          {!reviewReady ? (
            <button className={`news-rec-btn ${streamRef.current ? 'news-rec-btn--active' : ''}`} onClick={handleRecord} disabled={reviewBusy}>
              {reviewBusy ? '⏳ Finalising…' : streamRef.current ? '🔴 Re-record' : '🎬 Record Broadcast'}
            </button>
          ) : (
            <div className="news-save-row">
              <span className="news-save-ready">Recording ready ✓</span>
              <button className="news-save-btn" onClick={handleSave}>⬇ Save .webm</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
