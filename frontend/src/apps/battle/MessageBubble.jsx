export default function MessageBubble({ side, content, agentName, turn, provider }) {
  const isLeft = side === 'left';
  const avatar = provider === 'openai' ? '/gpt.gif' : '/claude.gif';

  return (
    <div className={`bubble-row ${isLeft ? 'bubble-row-left' : 'bubble-row-right'}`}>
      {isLeft && <img src={avatar} className="bubble-avatar" alt={agentName} />}
      <div className={`bubble-wrapper ${isLeft ? 'slide-in-left' : 'slide-in-right'}`}>
        <div className="bubble-meta">
          <span className="bubble-agent-name">{agentName}</span>
          <span className="bubble-turn">#{turn}</span>
        </div>
        <div className={`bubble ${isLeft ? 'bubble-left' : 'bubble-right'}`}>
          <p className="bubble-text">{content}</p>
        </div>
      </div>
      {!isLeft && <img src={avatar} className="bubble-avatar" alt={agentName} />}
    </div>
  );
}
