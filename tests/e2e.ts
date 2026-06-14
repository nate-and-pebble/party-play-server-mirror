/**
 * End-to-end harness. Spawns the server (sped up via PP_TIME_SCALE), connects a
 * host socket plus several "bot" players that auto-play whatever game the host
 * starts, and asserts the platform requirements actually hold:
 *   join · identity · lobby · all three games to completion · scoring ·
 *   results · reconnection · privacy · room locking · name disambiguation.
 *
 * Run: npx tsx tests/e2e.ts
 */
import { spawn } from 'node:child_process';
import { io, type Socket } from 'socket.io-client';

const PORT = 3010;
const URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
function ack<T = any>(s: Socket, ev: string, payload?: any): Promise<T> {
  return new Promise((resolve) => {
    if (payload === undefined) s.emit(ev, resolve);
    else s.emit(ev, payload, resolve);
  });
}
async function waitUntil(fn: () => boolean, ms: number, label: string) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return true;
    await sleep(60);
  }
  throw new Error(`timeout waiting for: ${label}`);
}

// Shared test state the "players in the room" would know by looking at the screen.
const shared = { currentWord: null as string | null, turnKey: '' };

interface Bot {
  sock: Socket;
  id: string;
  token: string;
  name: string;
  answered: Set<string>;
  voted: boolean;
  triviaDone: Set<number>;
  pickedWord: boolean;
  guessedTurn: string;
  lastView: any;
}

function autoplay(bot: Bot, env: any) {
  bot.lastView = env;
  if (env.view.kind !== 'game') {
    bot.voted = false;
    return;
  }
  const v = env.view.view;
  if (v.gameId === 'quibble') {
    if (v.phase === 'answer') {
      for (const p of v.prompts) {
        if (!bot.answered.has(p.matchId)) {
          bot.answered.add(p.matchId);
          bot.sock.emit('player:action', { type: 'answer', matchId: p.matchId, text: `Funny thing ${Math.floor(Math.random() * 999)}` });
        }
      }
    } else if (v.phase === 'vote') {
      if (!v.isAuthor && !v.yourVote) {
        bot.sock.emit('player:action', { type: 'vote', key: Math.random() < 0.5 ? 'A' : 'B' });
      }
    }
  } else if (v.gameId === 'trivia') {
    if (v.phase === 'question' && !v.locked && !bot.triviaDone.has(v.index)) {
      bot.triviaDone.add(v.index);
      bot.sock.emit('player:action', { type: 'answer', index: Math.floor(Math.random() * 4) });
    }
  } else if (v.gameId === 'doodle') {
    if (v.phase === 'choose' && v.role === 'artist' && !bot.pickedWord) {
      bot.pickedWord = true;
      bot.sock.emit('player:action', { type: 'pickWord', index: 0 });
    }
    if (v.phase === 'draw' && v.role === 'artist') {
      bot.pickedWord = false;
      shared.currentWord = v.word;
      // draw a little so strokes exist
      bot.sock.emit('player:action', { type: 'draw', strokeId: 'k1', points: [0.2, 0.2, 0.5, 0.5, 0.8, 0.3], color: '#111111', width: 0.02 });
    }
    if (v.phase === 'draw' && v.role === 'guesser' && !v.solved && shared.currentWord) {
      const key = shared.currentWord + '|' + (env.you?.id ?? '');
      if (bot.guessedTurn !== key) {
        bot.guessedTurn = key;
        bot.sock.emit('player:action', { type: 'guess', text: shared.currentWord });
      }
    }
  }
}

async function main() {
  console.log('\n🧪 Party Play — end-to-end\n');

  // ── Host + session ────────────────────────────────────────────────────────
  const host = await connect();
  let screenEnv: any = null;
  host.on('screen:update', (e) => {
    screenEnv = e;
    if (e.view.kind === 'game' && e.view.view.gameId === 'doodle' && e.view.view.phase === 'turnReveal') {
      shared.currentWord = null;
    }
  });
  const created = await ack(host, 'host:create');
  check('host creates a session', created.ok && /^[A-Z2-9]{4}$/.test(created.data.roomCode));
  const room = created.data.roomCode;
  await waitUntil(() => screenEnv?.view.kind === 'lobby', 3000, 'lobby');

  // ── Join players ──────────────────────────────────────────────────────────
  const bots: Bot[] = [];
  const NAMES = ['Sam', 'Sam', 'Bjørn', 'Pixel', 'Nova'];
  for (const name of NAMES) {
    const sock = await connect();
    const r = await ack(sock, 'player:join', { roomCode: room, name });
    if (!r.ok) {
      check(`join ${name}`, false);
      continue;
    }
    const bot: Bot = {
      sock,
      id: r.data.playerId,
      token: r.data.token,
      name,
      answered: new Set(),
      voted: false,
      triviaDone: new Set(),
      pickedWord: false,
      guessedTurn: '',
      lastView: null,
    };
    sock.on('player:update', (e) => autoplay(bot, e));
    bots.push(bot);
  }
  check('all players joined', bots.length === NAMES.length);
  await waitUntil(() => (screenEnv?.session.players.length ?? 0) === bots.length, 3000, 'players in lobby');

  const names = screenEnv.session.players.map((p: any) => p.name);
  check('duplicate name disambiguated (Sam → "Sam 2")', names.includes('Sam') && names.includes('Sam 2'));
  const colors = new Set(screenEnv.session.players.map((p: any) => p.identity.color));
  check('every player got a distinct color', colors.size === bots.length);
  const shapes = new Set(screenEnv.session.players.map((p: any) => p.identity.shape));
  check('every player got a distinct shape (colorblind-safe)', shapes.size === bots.length);

  // ── Negative cases ────────────────────────────────────────────────────────
  const bad = await connect();
  const nf = await ack(bad, 'player:join', { roomCode: 'ZZZZ', name: 'Ghost' });
  check('join unknown room is rejected', !nf.ok && nf.code === 'ROOM_NOT_FOUND');
  const prof = await ack(bad, 'player:join', { roomCode: room, name: 'shithead' });
  check('profane name is rejected', !prof.ok && prof.code === 'NAME_INVALID');
  bad.close();

  // ── Privacy probe (controllers can't snoop on each other) ─────────────────
  // A non-host socket trying a host command must be refused (PRIV-02).
  const notHost = bots[0];
  const cmdRes = await ack(notHost.sock, 'host:command', { type: 'endSession' });
  check('non-host cannot issue host commands', !cmdRes.ok && cmdRes.code === 'NOT_HOST');

  // ── Game 1: Trivia ────────────────────────────────────────────────────────
  console.log('\n— Trivia Rush —');
  await ack(host, 'host:command', { type: 'startGame', gameId: 'trivia' });
  await waitUntil(() => screenEnv?.view.kind === 'game' && screenEnv.view.view.gameId === 'trivia', 3000, 'trivia start');
  await waitUntil(() => screenEnv?.view.kind === 'results', 40000, 'trivia results');
  check('trivia reaches results with a winner', screenEnv.view.view.winners.length >= 1);
  check('trivia standings cover all players', screenEnv.view.view.standings.length === bots.length);
  await ack(host, 'host:command', { type: 'backToLobby' });
  await waitUntil(() => screenEnv?.view.kind === 'lobby', 3000, 'back to lobby');

  // ── Game 2: Quibble ───────────────────────────────────────────────────────
  console.log('\n— Quibble —');
  bots.forEach((b) => (b.answered = new Set()));
  await ack(host, 'host:command', { type: 'startGame', gameId: 'quibble' });
  await waitUntil(() => screenEnv?.view.kind === 'game' && screenEnv.view.view.gameId === 'quibble', 3000, 'quibble start');
  // While voting, screen view must never expose authors (PRIV-03).
  let sawCleanVote = false;
  const voteWatcher = (e: any) => {
    if (e.view.kind === 'game' && e.view.view.gameId === 'quibble' && e.view.view.phase === 'vote') {
      if (e.view.view.options.every((o: any) => o.author === undefined)) sawCleanVote = true;
    }
  };
  host.on('screen:update', voteWatcher);
  await waitUntil(() => screenEnv?.view.kind === 'results', 60000, 'quibble results');
  host.off('screen:update', voteWatcher);
  check('quibble reaches results', screenEnv.view.view.standings.length === bots.length);
  check('quibble hid answer authors during voting (privacy)', sawCleanVote);
  await ack(host, 'host:command', { type: 'backToLobby' });
  await waitUntil(() => screenEnv?.view.kind === 'lobby', 3000, 'lobby');

  // ── Game 3: Doodle ────────────────────────────────────────────────────────
  console.log('\n— Doodle Dash —');
  bots.forEach((b) => ((b.pickedWord = false), (b.guessedTurn = '')));
  await ack(host, 'host:command', { type: 'startGame', gameId: 'doodle' });
  await waitUntil(() => screenEnv?.view.kind === 'game' && screenEnv.view.view.gameId === 'doodle', 3000, 'doodle start');
  await waitUntil(() => screenEnv?.view.kind === 'results', 90000, 'doodle results');
  const doodleStandings = screenEnv.view.view.standings;
  check('doodle reaches results', doodleStandings.length === bots.length);
  check('doodle awarded points (correct guesses scored)', doodleStandings.some((s: any) => s.score > 0));
  check('session tally carried across games', doodleStandings.some((s: any) => s.sessionScore > s.score));

  // ── Reconnection (RES-01/03) ──────────────────────────────────────────────
  console.log('\n— Reconnection —');
  const victim = bots[2];
  victim.sock.close();
  await sleep(400);
  await waitUntil(
    () => screenEnv?.session.players.find((p: any) => p.id === victim.id)?.connected === false,
    3000,
    'player shown disconnected'
  );
  check('dropped player marked disconnected (not removed)', !!screenEnv.session.players.find((p: any) => p.id === victim.id));
  const reSock = await connect();
  const re = await ack(reSock, 'player:reconnect', { roomCode: room, token: victim.token });
  check('player reconnects with same identity', re.ok && re.data.playerId === victim.id);
  await waitUntil(
    () => screenEnv?.session.players.find((p: any) => p.id === victim.id)?.connected === true,
    3000,
    'player back online'
  );
  check('reconnected player shown connected again', true);

  // ── Room lock (HOST-03) ───────────────────────────────────────────────────
  await ack(host, 'host:command', { type: 'lockRoom', locked: true });
  await sleep(200);
  const lateJoiner = await connect();
  const locked = await ack(lateJoiner, 'player:join', { roomCode: room, name: 'Latecomer' });
  check('locked room rejects new players', !locked.ok && locked.code === 'ROOM_LOCKED');
  lateJoiner.close();

  // ── End session (SES-04) ──────────────────────────────────────────────────
  let endedSeen = false;
  bots[0].sock.on('session:ended', () => (endedSeen = true));
  await ack(host, 'host:command', { type: 'endSession' });
  await waitUntil(() => endedSeen, 3000, 'session end broadcast');
  check('ending the session notifies players', endedSeen);

  // ── Done ──────────────────────────────────────────────────────────────────
  host.close();
  reSock.close();
  bots.forEach((b) => b.sock.close());

  console.log(`\n${failed === 0 ? '🎉' : '⚠️ '} ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

// ── Boot the server, run, tear down ──────────────────────────────────────────
const server = spawn('npx', ['tsx', 'server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT), PP_TIME_SCALE: '0.1', NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => process.stderr.write(d));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${URL}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('server did not start');
}

waitForServer()
  .then(main)
  .catch((err) => {
    console.error('\n💥 e2e error:', err.message);
    failed++;
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => server.kill('SIGKILL'), 500);
  });
