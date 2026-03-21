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
import ResultScreen from './apps/ball/ResultScreen.jsx';
import { getTournament, nextFixture, recordResult } from './apps/ball/ballStorage.js';

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
};

// Map URL path → screen (top-level only; sub-screens need state so fall back to section root)
function pathToScreen(path) {
  if (path.startsWith('/battle')) return 'home';
  if (path.startsWith('/flash')) return 'fc-home';
  if (path.startsWith('/ball')) return 'ball-home';
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

  function handleBallAutoRecordStream(stream) {
    autoBallStreamRef.current = stream;
  }

  function handleBallMatchEnd({ homeScore, awayScore }) {
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

  // New screens flow
  const [nsConfig, setNsConfig] = useState(null);

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
          onBack={() => setScreen('launch')}
        />
      )}
      {screen === 'ball-game' && ballMatchConfig && (
        <GameScreen
          key={`${ballMatchConfig.fixture.id}-${ballMatchConfig.autoMode ? 'auto' : 'manual'}`}
          matchConfig={ballMatchConfig}
          autoRecordStream={autoBallStreamRef.current}
          onAutoRecordStream={handleBallAutoRecordStream}
          onMatchEnd={handleBallMatchEnd}
        />
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
    </div>
  );
}
