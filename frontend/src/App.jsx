import { useState, useEffect, useCallback } from 'react';
import LaunchScreen from './apps/launch/LaunchScreen.jsx';
import HomeScreen from './apps/battle/HomeScreen.jsx';
import SetupScreen from './apps/battle/SetupScreen.jsx';
import ChatScreen from './apps/battle/ChatScreen.jsx';
import ReplayScreen from './apps/battle/ReplayScreen.jsx';
import FlashHome from './apps/flash/FlashHome.jsx';
import ConfigScreen from './apps/flash/ConfigScreen.jsx';
import AppScreen from './apps/flash/AppScreen.jsx';

// Map screen → URL path
const SCREEN_TO_PATH = {
  launch:     '/',
  home:       '/battle',
  setup:      '/battle/setup',
  chat:       '/battle/chat',
  replay:     '/battle/replay',
  'fc-home':  '/flash',
  'ns-config':'/flash/config',
  'ns-app':   '/flash/quiz',
};

// Map URL path → screen (top-level only; sub-screens need state so fall back to section root)
function pathToScreen(path) {
  if (path.startsWith('/battle')) return 'home';
  if (path.startsWith('/flash'))  return 'fc-home';
  return 'launch';
}

export default function App() {
  // 'launch' | 'home' | 'setup' | 'chat' | 'replay' | 'fc-home' | 'ns-config' | 'ns-app'
  const [screen, setScreen] = useState(() => pathToScreen(window.location.pathname));
  const [sessionConfig, setSessionConfig] = useState(null);
  const [replayBattle, setReplayBattle] = useState(null);

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
    </div>
  );
}
