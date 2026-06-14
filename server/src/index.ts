import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import type { GameAction, HostCommand } from '@partyplay/shared';
import { SessionManager } from './sessionManager.js';
import { detectLanHost } from './util/net.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';

const PORT = Number(process.env.PORT ?? 3001);
const LAN_HOST = detectLanHost();
// In dev, phones reach the Vite dev server (which proxies the socket to us).
// In prod, everything is served from this single Node port.
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT ?? (isDev ? 5173 : PORT));
// When the client is hosted on a different origin than the server (e.g. Vercel
// client + Render server) PUBLIC_BASE_URL is the absolute origin baked into the
// QR/join URL phones scan ("https://opus-party-games.itsmenate.com").
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
const buildJoinUrl = (code: string) => {
  if (PUBLIC_BASE_URL) {
    const host = PUBLIC_BASE_URL.replace(/^https?:\/\//, '');
    return { url: `${PUBLIC_BASE_URL}/j/${code}`, host };
  }
  const host = `${LAN_HOST}:${PUBLIC_PORT}`;
  return { url: `http://${host}/j/${code}`, host };
};

// CORS_ORIGINS is a comma-separated allowlist of origins permitted to open a
// Socket.IO connection. If unset, fall back to permissive (dev/LAN use).
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigin: boolean | string[] = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true;

const app = express();
app.disable('x-powered-by');
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: corsOrigin },
  // Keep brief drops invisible; the client re-attaches with its token on reconnect.
  pingInterval: 20000,
  pingTimeout: 25000,
});

const manager = new SessionManager(io, buildJoinUrl);

// ── HTTP API ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, sessions: manager.count, uptime: process.uptime() });
});

// Server-rendered QR (kept available for screens that prefer an <img>).
app.get('/api/qr', async (req, res) => {
  const data = String(req.query.data ?? '');
  if (!data) return res.status(400).send('missing data');
  try {
    const svg = await QRCode.toString(data, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.type('image/svg+xml').send(svg);
  } catch {
    res.status(500).send('qr error');
  }
});

// ── Static client (production) ───────────────────────────────────────────────
const clientDist = resolve(__dirname, '../../client/dist');
if (!isDev && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback so /screen, /j/:code, etc. all load the app.
  app.get('*', (_req, res) => res.sendFile(resolve(clientDist, 'index.html')));
}

// ── Realtime ─────────────────────────────────────────────────────────────────

// Light per-socket rate limit so a misbehaving client can't flood a room.
const buckets = new WeakMap<object, { tokens: number; ts: number }>();
function allow(socket: object, cost = 1, rate = 80, burst = 120): boolean {
  const now = Date.now();
  const b = buckets.get(socket) ?? { tokens: burst, ts: now };
  b.tokens = Math.min(burst, b.tokens + ((now - b.ts) / 1000) * rate);
  b.ts = now;
  if (b.tokens < cost) {
    buckets.set(socket, b);
    return false;
  }
  b.tokens -= cost;
  buckets.set(socket, b);
  return true;
}

io.on('connection', (socket) => {
  socket.on('host:create', (cb) => {
    const session = manager.create();
    session.attachScreen(socket, session.hostToken);
    cb?.({ ok: true, data: { roomCode: session.roomCode, hostToken: session.hostToken } });
  });

  socket.on('screen:attach', (p, cb) => {
    const found = manager.require(p?.roomCode);
    if (!found.ok) return cb?.(found);
    cb?.(found.data.attachScreen(socket, p?.hostToken));
  });

  socket.on('player:join', (p, cb) => {
    const found = manager.require(p?.roomCode);
    if (!found.ok) return cb?.(found);
    cb?.(found.data.addPlayer(socket, p?.name ?? '', p?.avatar));
  });

  socket.on('player:reconnect', (p, cb) => {
    const found = manager.require(p?.roomCode);
    if (!found.ok) return cb?.(found);
    cb?.(found.data.reconnectPlayer(socket, p?.token ?? ''));
  });

  socket.on('player:action', (action: GameAction, cb) => {
    if (!allow(socket)) return cb?.({ ok: false, error: 'Slow down!', code: 'RATE_LIMITED' });
    const code = socket.data.roomCode;
    const id = socket.data.playerId;
    const session = code ? manager.get(code) : undefined;
    if (!session || !id) return cb?.({ ok: false, error: 'Not in a room.', code: 'BAD_STATE' });
    session.handlePlayerAction(id, action);
    cb?.({ ok: true, data: null });
  });

  socket.on('player:setIdentity', (p, cb) => {
    const code = socket.data.roomCode;
    const id = socket.data.playerId;
    const session = code ? manager.get(code) : undefined;
    if (session && id) session.setIdentity(id, { avatar: p?.avatar, cycleColor: p?.cycleColor });
    cb?.({ ok: true, data: null });
  });

  socket.on('host:command', (cmd: HostCommand, cb) => {
    const code = socket.data.roomCode;
    const session = code ? manager.get(code) : undefined;
    if (!session) return cb?.({ ok: false, error: 'Room not found.', code: 'ROOM_NOT_FOUND' });
    if (!socket.data.isHost) return cb?.({ ok: false, error: 'Only the host can do that.', code: 'NOT_HOST' });
    cb?.(session.handleHostCommand(cmd));
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const session = code ? manager.get(code) : undefined;
    session?.detachSocket(socket);
  });
});

http.listen(PORT, '0.0.0.0', () => {
  const mode = isDev ? 'dev' : 'prod';
  console.log(`\n  🎉 Party Play server [${mode}] on http://localhost:${PORT}`);
  console.log(`     Shared screen:  http://${LAN_HOST}:${PUBLIC_PORT}/`);
  console.log(`     Players join:   http://${LAN_HOST}:${PUBLIC_PORT}/j/<CODE>\n`);
});
