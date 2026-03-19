export default function TypingIndicator({ side, agentName, provider }) {
  const isLeft = side === 'left';
  const avatar = provider === 'openai' ? '/gpt.gif' : '/claude.gif';

  return (
    <div className={`bubble-row ${isLeft ? 'bubble-row-left' : 'bubble-row-right'}`}>
      {isLeft && <img src={avatar} className="bubble-avatar" alt={agentName} />}
      <div className={`bubble-wrapper typing-wrapper ${isLeft ? 'slide-in-left' : 'slide-in-right'}`}>
        <div className="bubble-meta">
          <span className="bubble-agent-name">{agentName}</span>
          <span className="thinking-label">thinking…</span>
        </div>
        <div className={`bubble bubble-typing ${isLeft ? 'bubble-left' : 'bubble-right'}`}>
          <div className="typing-dots">
            <span className="dot" style={{ animationDelay: '0ms' }} />
            <span className="dot" style={{ animationDelay: '160ms' }} />
            <span className="dot" style={{ animationDelay: '320ms' }} />
          </div>
        </div>
      </div>
      {!isLeft && <img src={avatar} className="bubble-avatar" alt={agentName} />}
    </div>
  );
}
