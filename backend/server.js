import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from the project root (one level above /backend)
dotenv.config({ path: resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { startConversation, stopConversation, nextTurn, setMode } from './conversationEngine.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// --- SSE client registry ---
// Only one active conversation at a time; keep one SSE client ref
let sseClient = null;

function emit(event, data) {
  if (sseClient) {
    sseClient.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

// --- SSE Stream endpoint ---
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClient = res;

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClient = null;
  });
});

// --- Start conversation ---
app.post('/api/start', async (req, res) => {
  const { topic, leftAgent, rightAgent, maxTurns, autoMode, history,
          responseLines, brutalityLevel, contextData } = req.body;

  if (!topic || !leftAgent || !rightAgent) {
    return res.status(400).json({ error: 'topic, leftAgent, and rightAgent are required.' });
  }
  if (!leftAgent.stance)  leftAgent.stance  = '';
  if (!rightAgent.stance) rightAgent.stance = '';

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set in .env' });
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === '') {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in .env' });
  }

  res.json({ ok: true });

  startConversation(
    {
      topic,
      leftAgent,
      rightAgent,
      maxTurns: maxTurns ?? 10,
      autoMode: !!autoMode,
      history: history || [],   // ← seeded messages for resume
      responseLines: responseLines || 2,
      brutalityLevel: brutalityLevel || 2,
      contextData: contextData || '',
    },
    emit
  );
});

// --- Switch mode mid-conversation ---
app.post('/api/mode', (req, res) => {
  const { autoMode } = req.body;
  setMode(!!autoMode);
  res.json({ ok: true });
});

// --- Next turn (manual step) ---
app.post('/api/next', (_req, res) => {
  nextTurn();
  res.json({ ok: true });
});

// --- Stop conversation ---
app.post('/api/stop', (_req, res) => {
  stopConversation();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
