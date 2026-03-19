import { useState } from 'react';
import useFlashTheme from './useFlashTheme.js';

const DUMMY_TITLE = 'Ronaldo Stats Quiz';
const DUMMY_PART  = '1';
const DUMMY_JSON  = JSON.stringify([
  { q: 'How many Ballon d\'Or awards has Ronaldo won?', a: '5' },
  { q: 'Which club did Ronaldo join from Sporting CP?', a: 'Manchester United' },
  { q: 'In which year did Ronaldo win his first Champions League?', a: '2008' },
  { q: 'What is Ronaldo\'s international goal record as of 2024?', a: 'Over 130 goals for Portugal' },
  { q: 'Which squad number does Ronaldo wear for Portugal?', a: '7' },
], null, 2);

export default function ConfigScreen({ onLaunch }) {
  const [title, setTitle]   = useState('');
  const [part, setPart]     = useState('1');
  const [json, setJson]     = useState('');
  const [error, setError]   = useState('');
  const [theme, toggleTheme] = useFlashTheme();

  function fillDummy() {
    setTitle(DUMMY_TITLE);
    setPart(DUMMY_PART);
    setJson(DUMMY_JSON);
    setError('');
  }

  function handleStart() {
    setError('');
    if (!title.trim()) { setError('Add a title.'); return; }
    let cards;
    try {
      const parsed = JSON.parse(json);
      cards = Array.isArray(parsed) ? parsed : parsed.cards;
      if (!Array.isArray(cards) || cards.length === 0) throw new Error();
      // normalise — accept {q,a} or {question,answer}
      cards = cards.map((c, i) => ({
        q: c.q ?? c.question ?? `Card ${i + 1}`,
        a: c.a ?? c.answer   ?? '',
      }));
    } catch {
      setError('Invalid JSON. Expected [{"q":"...","a":"..."}, …]');
      return;
    }
    onLaunch({ title: title.trim(), part, cards });
  }

  return (
    <div className="fc-config-outer">
      <div className="fc-config-card">
        {/* Dev mode toggle */}
        <button className="fc-dev-btn" onClick={fillDummy} title="Fill dummy data">DEV</button>
        <button className="fc-theme-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div className="fc-config-logo">🗂</div>
        <h1 className="fc-config-heading">Flashcard Setup</h1>

        {/* Title */}
        <label className="fc-label">Title</label>
        <input
          className="fc-input"
          placeholder="e.g. Ronaldo Stats Quiz"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Part selector */}
        <label className="fc-label">Part</label>
        <input
          className="fc-input"
          type="number"
          min="1"
          value={part}
          onChange={(e) => setPart(e.target.value)}
        />

        {/* JSON paste */}
        <label className="fc-label">Paste JSON&nbsp;<span className="fc-label-hint">{`[{"q":"…","a":"…"}]`}</span></label>
        <textarea
          className="fc-textarea"
          placeholder={'[\n  {"q": "Question?", "a": "Answer"},\n  {"q": "Question?", "a": "Answer"}\n]'}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={8}
          spellCheck={false}
        />

        {error && <div className="fc-error">{error}</div>}

        <button className="fc-start-btn" onClick={handleStart}>Start →</button>
      </div>
    </div>
  );
}
