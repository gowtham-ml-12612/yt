import { useState, useEffect, useCallback, useRef } from 'react';
import LaunchScreen from './apps/launch/LaunchScreen.jsx';
import HomeScreen from './apps/battle/HomeScreen.jsx';
import SetupScreen from './apps/battle/SetupScreen.jsx';
import ChatScreen from './apps/battle/ChatScreen.jsx';
import ReplayScreen from './apps/battle/ReplayScreen.jsx';
import FlashHome from './apps/flash/FlashHome.jsx';
import ConfigScreen from './apps/flash/ConfigScreen.jsx';
import AppScreen from './apps/flash/AppScreen.jsx';
import BallHome from './apps/ball/BallHome.jsx';
import GameScreen from './apps/ball/GameScreen.jsx';
import RoyaleScreen from './apps/ball/RoyaleScreen.jsx';
import ResultScreen from './apps/ball/ResultScreen.jsx';
import { getTournament, nextFixture, recordResult } from './apps/ball/ballStorage.js';
import IplHome from './apps/ipl/IplHome.jsx';
import IplGameScreen from './apps/ipl/GameScreen.jsx';
import IplRoyaleScreen from './apps/ipl/RoyaleScreen.jsx';
import IplResultScreen from './apps/ipl/ResultScreen.jsx';
import { getTournament as getIplTournament, nextFixture as iplNextFixture, recordResult as iplRecordResult } from './apps/ipl/iplStorage.js';
import RaceHome from './apps/race/RaceHome.jsx';
import RacePlayer from './apps/race/RacePlayer.jsx';
import NewsHome from './apps/news/NewsHome.jsx';
import NewsPlayer from './apps/news/NewsPlayer.jsx';
import PlinkoHome from './apps/plinko/PlinkoHome.jsx';
import PlinkoGame from './apps/plinko/PlinkoGame.jsx';

// Map screen → URL path
const SCREEN_TO_PATH = {
  launch: '/',
  home: '/battle',
  setup: '/battle/setup',
  chat: '/battle/chat',
  replay: '/battle/replay',
  'fc-home': '/flash',
  'ns-config': '/flash/config',
  'ns-app': '/flash/quiz',
  'ball-home': '/ball',
  'ball-game': '/ball/game',
  'ball-result': '/ball/result',
  'race-home': '/race',
  'race-player': '/race/play',
  'news-home': '/news',
  'news-player': '/news/play',
  'plinko-home': '/plinko',
  'plinko-game': '/plinko/game',
  'ipl-home': '/ipl',
  'ipl-game': '/ipl/game',
  'ipl-result': '/ipl/result',
};

// Map URL path → screen (top-level only; sub-screens need state so fall back to section root)
function pathToScreen(path) {
  if (path.startsWith('/battle')) return 'home';
  if (path.startsWith('/flash')) return 'fc-home';
  if (path.startsWith('/ball')) return 'ball-home';
  if (path.startsWith('/race')) return 'race-home';
  if (path.startsWith('/news')) return 'news-home';
  if (path.startsWith('/plinko')) return 'plinko-home';
  if (path.startsWith('/ipl')) return 'ipl-home';
  return 'launch';
}

export default function App() {
  // 'launch' | 'home' | 'setup' | 'chat' | 'replay' | 'fc-home' | 'ns-config' | 'ns-app'
  // 'ball-home' | 'ball-predict' | 'ball-game' | 'ball-result'
  const [screen, setScreen] = useState(() => pathToScreen(window.location.pathname));
  const [sessionConfig, setSessionConfig] = useState(null);
  const [replayBattle, setReplayBattle] = useState(null);

  // Ball Arena state
  const [ballMatchConfig, setBallMatchConfig] = useState(null);
  const [ballResult, setBallResult] = useState(null);
  const autoBallStreamRef = useRef(null);

  // IPL Arena state
  const [iplMatchConfig, setIplMatchConfig] = useState(null);
  const [iplResult, setIplResult] = useState(null);
  const autoIplStreamRef = useRef(null);

  // Called from SetupScreen — brand new battle
  function handleStart(config) {
    setSessionConfig({ ...config, battleId: null, resumeMessages: [] });
    setScreen('chat');
  }

  // Called from HomeScreen — resume/continue an existing battle
  function handleResume(battle) {
    setSessionConfig({
      topic: battle.topic,
      leftAgent: battle.leftAgent,
      rightAgent: battle.rightAgent,
      // If the battle is already completed, open-ended so new turns can run
      maxTurns: battle.status === 'ended' ? 0 : battle.maxTurns,
      autoMode: battle.autoMode,
      responseLines: battle.responseLines,
      brutalityLevel: battle.brutalityLevel,
      contextData: battle.contextData,
      ctaMessage: battle.ctaMessage,
      battleId: battle.id,
      resumeMessages: battle.messages,
    });
    setScreen('chat');
  }

  // Back to home (chat screen's back arrow / end of battle)
  function handleHome() {
    setSessionConfig(null);
    setReplayBattle(null);
    setScreen('home');
  }

  // Called from ReplayScreen — continue a live battle after watching replay
  function handleContinueFromReplay(battle) {
    setSessionConfig({
      topic: battle.topic,
      leftAgent: battle.leftAgent,
      rightAgent: battle.rightAgent,
      maxTurns: 0,              // unlimited — user stops manually
      autoMode: battle.autoMode,
      responseLines: battle.responseLines,
      brutalityLevel: battle.brutalityLevel,
      contextData: battle.contextData,
      ctaMessage: battle.ctaMessage,
      battleId: battle.id,
      resumeMessages: battle.messages,
      autoStart: true,  // skip start overlay, jump straight in
    });
    setScreen('chat');
  }

  // Called from HomeScreen — replay a finished battle
  function handleReplay(battle) {
    setReplayBattle(battle);
    setScreen('replay');
  }

  // Ball arena handlers
  function handleBallStartMatch({ tournament, fixture }) {
    autoBallStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    autoBallStreamRef.current = null;
    setBallMatchConfig({ fixture, tournament, autoMode: false });
    setScreen('ball-game');
  }

  function handleBallAutoTournament({ tournament, fixture }) {
    setBallResult(null);
    setBallMatchConfig({ fixture, tournament, autoMode: true });
    setScreen('ball-game');
  }

  function handleBallCustomMatch(matchConfig) {
    autoBallStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    autoBallStreamRef.current = null;
    setBallResult(null);
    setBallMatchConfig(matchConfig);
    setScreen('ball-game');
  }

  function handleBallRoyaleMode() {
    autoBallStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    autoBallStreamRef.current = null;
    setBallResult(null);
    setBallMatchConfig({ mode: 'elimination-royale', fixture: { id: `royale-${Date.now()}`, phase: 'royale' }, tournament: null, autoMode: false });
    setScreen('ball-game');
  }

  function handleBallAutoRecordStream(stream) {
    autoBallStreamRef.current = stream;
  }

  function handleBallMatchEnd({ homeScore, awayScore }) {
    if (ballMatchConfig?.mode === 'elimination-royale') {
      setBallMatchConfig(null);
      setBallResult(null);
      setScreen('ball-home');
      return;
    }

    if (ballMatchConfig?.autoMode) {
      const updated = recordResult(ballMatchConfig.tournament.id, ballMatchConfig.fixture.id, homeScore, awayScore);
      const next = nextFixture(ballMatchConfig.tournament.id);
      if (updated && next) {
        setBallMatchConfig({ fixture: next, tournament: getTournament(ballMatchConfig.tournament.id), autoMode: true });
        setScreen('ball-game');
        return;
      }

      autoBallStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      autoBallStreamRef.current = null;
      setBallMatchConfig(null);
      setBallResult(null);
      setScreen('ball-home');
      return;
    }

    setBallResult({ homeScore, awayScore });
    setScreen('ball-result');
  }

  // IPL Arena handlers
  function handleIplStartMatch({ tournament, fixture }) {
    autoIplStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    autoIplStreamRef.current = null;
    setIplMatchConfig({ fixture, tournament, autoMode: false });
    setScreen('ipl-game');
  }

  function handleIplAutoTournament({ tournament, fixture }) {
    setIplResult(null);
    setIplMatchConfig({ fixture, tournament, autoMode: true });
    setScreen('ipl-game');
  }

  function handleIplCustomMatch(matchConfig) {
    autoIplStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    autoIplStreamRef.current = null;
    setIplResult(null);
    setIplMatchConfig(matchConfig);
    setScreen('ipl-game');
  }

  function handleIplRoyaleMode() {
    autoIplStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    autoIplStreamRef.current = null;
    setIplResult(null);
    setIplMatchConfig({ mode: 'elimination-royale', fixture: { id: `ipl-royale-${Date.now()}`, phase: 'royale' }, tournament: null, autoMode: false });
    setScreen('ipl-game');
  }

  function handleIplAutoRecordStream(stream) {
    autoIplStreamRef.current = stream;
  }

  function handleIplMatchEnd({ homeScore, awayScore }) {
    if (iplMatchConfig?.mode === 'elimination-royale') {
      setIplMatchConfig(null);
      setIplResult(null);
      setScreen('ipl-home');
      return;
    }

    if (iplMatchConfig?.autoMode) {
      const updated = iplRecordResult(iplMatchConfig.tournament.id, iplMatchConfig.fixture.id, homeScore, awayScore);
      const next = iplNextFixture(iplMatchConfig.tournament.id);
      if (updated && next) {
        setIplMatchConfig({ fixture: next, tournament: getIplTournament(iplMatchConfig.tournament.id), autoMode: true });
        setScreen('ipl-game');
        return;
      }
      autoIplStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      autoIplStreamRef.current = null;
      setIplMatchConfig(null);
      setIplResult(null);
      setScreen('ipl-home');
      return;
    }

    setIplResult({ homeScore, awayScore });
    setScreen('ipl-result');
  }

  // New screens flow
  const [nsConfig, setNsConfig] = useState(null);

  // Race (bar chart race) state
  const [raceConfig, setRaceConfig] = useState(null);

  // News reader state
  const [newsConfig, setNewsConfig] = useState(null);

  // Plinko state
  const [plinkoConfig, setPlinkoConfig] = useState(null);

  // Sync URL when screen changes
  useEffect(() => {
    const path = SCREEN_TO_PATH[screen] ?? '/';
    if (window.location.pathname !== path) {
      window.history.pushState({ screen }, '', path);
    }
  }, [screen]);

  // Handle browser back/forward
  useEffect(() => {
    function onPop(e) {
      const s = e.state?.screen ?? pathToScreen(window.location.pathname);
      setScreen(s);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="app-shell">
      {screen === 'launch' && (
        <LaunchScreen
          onChat={() => setScreen('home')}
          onFlash={() => setScreen('fc-home')}
          onBall={() => setScreen('ball-home')}
          onRace={() => setScreen('race-home')}
          onNews={() => setScreen('news-home')}
          onPlinko={() => setScreen('plinko-home')}
          onIpl={() => setScreen('ipl-home')}
        />
      )}
      {screen === 'home' && (
        <HomeScreen
          onNewBattle={() => setScreen('setup')}
          onResumeBattle={handleResume}
          onReplayBattle={handleReplay}
          onBack={() => setScreen('launch')}
        />
      )}
      {screen === 'setup' && (
        <SetupScreen onStart={handleStart} onBack={() => setScreen('home')} />
      )}
      {screen === 'chat' && (
        <ChatScreen config={sessionConfig} onReset={handleHome} />
      )}
      {screen === 'replay' && (
        <ReplayScreen battle={replayBattle} onHome={handleHome} onContinue={handleContinueFromReplay} />
      )}
      {screen === 'fc-home' && (
        <FlashHome onNewDeck={() => setScreen('ns-config')} onBack={() => setScreen('launch')} />
      )}
      {screen === 'ns-config' && (
        <ConfigScreen onLaunch={(cfg) => { setNsConfig(cfg); setScreen('ns-app'); }} />
      )}
      {screen === 'ns-app' && (
        <AppScreen config={nsConfig} onBack={() => setScreen('ns-config')} />
      )}
      {screen === 'ball-home' && (
        <BallHome
          onStartMatch={handleBallStartMatch}
          onAutoTournament={handleBallAutoTournament}
          onStartCustomMatch={handleBallCustomMatch}
          onStartRoyaleMode={handleBallRoyaleMode}
          onBack={() => setScreen('launch')}
        />
      )}
      {screen === 'ball-game' && ballMatchConfig && (
        ballMatchConfig.mode === 'elimination-royale' ? (
          <RoyaleScreen
            key={ballMatchConfig.fixture.id}
            matchConfig={ballMatchConfig}
            onMatchEnd={handleBallMatchEnd}
          />
        ) : (
          <GameScreen
            key={`${ballMatchConfig.fixture.id}-${ballMatchConfig.autoMode ? 'auto' : 'manual'}`}
            matchConfig={ballMatchConfig}
            autoRecordStream={autoBallStreamRef.current}
            onAutoRecordStream={handleBallAutoRecordStream}
            onMatchEnd={handleBallMatchEnd}
          />
        )
      )}
      {screen === 'ball-result' && ballMatchConfig && ballResult && (
        <ResultScreen
          matchConfig={ballMatchConfig}
          homeScore={ballResult.homeScore}
          awayScore={ballResult.awayScore}
          onContinue={() => setScreen('ball-home')}
          onHome={() => setScreen('launch')}
        />
      )}
      {screen === 'race-home' && (
        <RaceHome
          onLaunch={(cfg) => { setRaceConfig(cfg); setScreen('race-player'); }}
          onBack={() => setScreen('launch')}
        />
      )}
      {screen === 'race-player' && raceConfig && (
        <RacePlayer config={raceConfig} onBack={() => setScreen('race-home')} />
      )}
      {screen === 'news-home' && (
        <NewsHome
          onLaunch={(cfg) => { setNewsConfig(cfg); setScreen('news-player'); }}
          onBack={() => setScreen('launch')}
        />
      )}
      {screen === 'news-player' && newsConfig && (
        <NewsPlayer config={newsConfig} onBack={() => setScreen('news-home')} />
      )}
      {screen === 'plinko-home' && (
        <PlinkoHome onLaunch={(cfg) => { setPlinkoConfig(cfg); setScreen('plinko-game'); }} onBack={() => setScreen('launch')} />
      )}
      {screen === 'plinko-game' && (
        <PlinkoGame config={plinkoConfig} onBack={() => setScreen('plinko-home')} />
      )}
      {screen === 'ipl-home' && (
        <IplHome
          onStartMatch={handleIplStartMatch}
          onAutoTournament={handleIplAutoTournament}
          onStartCustomMatch={handleIplCustomMatch}
          onStartRoyaleMode={handleIplRoyaleMode}
          onBack={() => setScreen('launch')}
        />
      )}
      {screen === 'ipl-game' && iplMatchConfig && (
        iplMatchConfig.mode === 'elimination-royale' ? (
          <IplRoyaleScreen
            key={iplMatchConfig.fixture.id}
            matchConfig={iplMatchConfig}
            onMatchEnd={handleIplMatchEnd}
          />
        ) : (
          <IplGameScreen
            key={`${iplMatchConfig.fixture.id}-${iplMatchConfig.autoMode ? 'auto' : 'manual'}`}
            matchConfig={iplMatchConfig}
            autoRecordStream={autoIplStreamRef.current}
            onAutoRecordStream={handleIplAutoRecordStream}
            onMatchEnd={handleIplMatchEnd}
          />
        )
      )}
      {screen === 'ipl-result' && iplMatchConfig && iplResult && (
        <IplResultScreen
          matchConfig={iplMatchConfig}
          homeScore={iplResult.homeScore}
          awayScore={iplResult.awayScore}
          onContinue={() => setScreen('ipl-home')}
          onHome={() => setScreen('launch')}
        />
      )}
    </div>
  );
}
