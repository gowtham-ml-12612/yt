// src/apps/plinko/PlinkoGame.jsx
import { useEffect, useRef, useState } from 'react';

const DROP_DELAY = 1000;
const CANVAS_W = 400;
const CANVAS_H = 700;

export default function PlinkoGame({ config, onBack }) {
  const canvasRef = useRef(null);

  // (We will build out the 2D physics loop here)

  useEffect(() => {
    // Initializing Canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw some placeholder pegs
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(
        100 + Math.random() * 200,
        100 + Math.random() * 500,
        4, 0, 2 * Math.PI
      );
      ctx.fill();
    }
  }, []);

  return (
    <div className="plinko-game-shell">
      <div className="plinko-header">
        <button className="plinko-back-btn" onClick={onBack}>← Back</button>
        <span className="plinko-header-title">The Draw</span>
        <div style={{ width: 50 }} />
      </div>

      <div className="plinko-canvas-container">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
      </div>
    </div>
  );
}
