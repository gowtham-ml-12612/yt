import { useState, useEffect, useRef } from 'react';
import { getAllBattles, deleteBattle, importBattles } from '../../battleStorage.js';

const PROVIDER_AVATAR = {
  openai: '/gpt.gif',
  claude: '/claude.gif',
};

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HomeScreen({ onNewBattle, onResumeBattle, onReplayBattle, onBack }) {
  const [battles, setBattles] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { setBattles(getAllBattles()); }, []);

  function handleExport() {
    const data = JSON.stringify(getAllBattles(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `roast-battles-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSingle(e, battle) {
    e.stopPropagation();
    const slug = battle.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const data = JSON.stringify(battle, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `battle-${slug}-${battle.id.slice(-6)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error('Not an array');
        const added = importBattles(parsed);
        setBattles(getAllBattles());
        setImportMsg(`✅ Imported ${added} new battle${added !== 1 ? 's' : ''}`);
      } catch {
        setImportMsg('❌ Invalid file — expected a battles JSON array');
      }
      setTimeout(() => setImportMsg(''), 3500);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleDelete(e, id) {
    e.stopPropagation();
    if (confirmDelete === id) {
      deleteBattle(id);
      setBattles(getAllBattles());
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 2500);
    }
  }

  return (
    <div className="home-shell">
      {/* Header */}
      <div className="home-header">
        <div className="home-header-title">
          <span className="home-fire">🔥</span> Roast Battles
        </div>
        <div className="home-header-actions">
          <button className="btn-icon-header" onClick={handleImportClick} title="Import battles JSON">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
          {battles.length > 0 && (
            <button className="btn-icon-header" onClick={handleExport} title="Export all battles">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          )}
          <button className="btn-new-battle" onClick={onNewBattle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
          <button className="btn-icon-header" onClick={onBack} title="Home">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Import feedback toast */}
      {importMsg && (
        <div className="import-toast">{importMsg}</div>
      )}

      {/* Content */}
      <div className="home-body">
        {battles.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">⚔️</div>
            <div className="home-empty-title">No battles yet</div>
            <div className="home-empty-sub">Start a roast battle to see it here</div>
            <button className="btn-new-battle" onClick={onNewBattle} style={{ marginTop: 24 }}>
              + New Battle
            </button>
          </div>
        ) : (
          <div className="battles-list">
            {battles.map((b) => (
              <div
                key={b.id}
                className="battle-row"
                onClick={() => onResumeBattle(b)}
              >
                {/* Stacked avatars */}
                <div className="row-avatars">
                  <img src={PROVIDER_AVATAR[b.leftAgent.provider]}  className="row-avatar row-avatar-top"    alt={b.leftAgent.name} />
                  <img src={PROVIDER_AVATAR[b.rightAgent.provider]} className="row-avatar row-avatar-bottom" alt={b.rightAgent.name} />
                </div>

                {/* Info */}
                <div className="row-info">
                  <div className="row-topic">{b.topic}</div>
                  <div className="row-agents">
                    <span className="left-color">{b.leftAgent.name}</span>
                    <span className="row-sep"> vs </span>
                    <span className="right-color">{b.rightAgent.name}</span>
                  </div>
                </div>

                {/* Right meta */}
                <div className="row-meta">
                  <div className="row-time">{timeAgo(b.updatedAt)}</div>
                  <div className={`row-status ${b.status === 'ended' ? 'status-ended' : 'status-live'}`}>
                    {b.status === 'ended' ? '✅ Done' : '▶ Live'}
                  </div>
                  <div className="row-turns">{b.totalTurns} turns</div>
                </div>

                {/* Replay */}
                {b.messages?.length > 0 && (
                  <button
                    className="row-replay"
                    onClick={(e) => { e.stopPropagation(); onReplayBattle(b); }}
                    title="Replay"
                  >
                    🔁
                  </button>
                )}

                {/* Export single */}
                <button
                  className="row-export"
                  onClick={(e) => exportSingle(e, b)}
                  title="Export this battle"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>

                {/* Delete */}
                <button
                  className={`row-delete ${confirmDelete === b.id ? 'confirming' : ''}`}
                  onClick={(e) => handleDelete(e, b.id)}
                  title="Delete"
                >
                  {confirmDelete === b.id ? '✓' : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
