/**
 * Standalone player bots for visual/manual testing. Joins a room and auto-plays
 * whatever game the host starts, so you can watch real multiplayer flow on the
 * shared screen without wrangling several phones.
 *
 * Usage: npx tsx tests/bots.ts <ROOMCODE> [count] [serverUrl]
 */
import { io, type Socket } from 'socket.io-client';

const room = (process.argv[2] ?? '').toUpperCase();
const count = Number(process.argv[3] ?? 4);
const URL = process.argv[4] ?? 'http://localhost:3001';
if (!room) {
  console.error('usage: tsx tests/bots.ts <ROOMCODE> [count] [url]');
  process.exit(1);
}

const NAMES = ['Robo', 'Zappy', 'Bjørn', 'Pixel', 'Nova', 'Tofu', 'Mochi', 'Disco'];
const shared = { word: null as string | null };

function ack<T = any>(s: Socket, ev: string, p?: any): Promise<T> {
  return new Promise((res) => (p === undefined ? s.emit(ev, res) : s.emit(ev, p, res)));
}

interface Bot {
  sock: Socket;
  id?: string;
  answered: Set<string>;
  trivia: Set<number>;
  picked: boolean;
  guessKey: string;
}

function play(bot: Bot, env: any) {
  if (env.view.kind !== 'game') return;
  const v = env.view.view;
  if (v.gameId === 'quibble') {
    if (v.phase === 'answer') {
      const quips = ['A confused goldfish', 'Tax season', 'My uncle Greg', 'Spontaneous combustion', 'Free Wi-Fi', 'Aggressive jazz'];
      for (const p of v.prompts)
        if (!bot.answered.has(p.matchId)) {
          bot.answered.add(p.matchId);
          bot.sock.emit('player:action', { type: 'answer', matchId: p.matchId, text: quips[Math.floor(Math.random() * quips.length)] });
        }
    } else if (v.phase === 'vote' && !v.isAuthor && !v.yourVote) {
      setTimeout(() => bot.sock.emit('player:action', { type: 'vote', key: Math.random() < 0.5 ? 'A' : 'B' }), 600 + Math.random() * 2500);
    }
  } else if (v.gameId === 'trivia') {
    if (v.phase === 'question' && !v.locked && !bot.trivia.has(v.index)) {
      bot.trivia.add(v.index);
      setTimeout(() => bot.sock.emit('player:action', { type: 'answer', index: Math.floor(Math.random() * 4) }), 800 + Math.random() * 4000);
    }
  } else if (v.gameId === 'doodle') {
    if (v.phase === 'choose' && v.role === 'artist' && !bot.picked) {
      bot.picked = true;
      setTimeout(() => bot.sock.emit('player:action', { type: 'pickWord', index: Math.floor(Math.random() * 3) }), 700);
    }
    if (v.phase === 'draw' && v.role === 'artist') {
      bot.picked = false;
      shared.word = v.word;
      // doodle a wandering scribble
      let t = 0;
      const id = 'b' + Math.random().toString(36).slice(2, 7);
      const iv = setInterval(() => {
        t += 0.25;
        const pts = [0.3 + 0.2 * Math.sin(t), 0.3 + 0.2 * Math.cos(t * 1.3), 0.3 + 0.2 * Math.sin(t + 0.25), 0.3 + 0.2 * Math.cos((t + 0.25) * 1.3)];
        bot.sock.emit('player:action', { type: 'draw', strokeId: id, points: pts, color: '#7C5CFF', width: 0.02 });
        if (t > 6) clearInterval(iv);
      }, 250);
    }
    if (v.phase === 'draw' && v.role === 'guesser' && !v.solved && shared.word) {
      const key = shared.word + (env.you?.id ?? '');
      if (bot.guessKey !== key) {
        bot.guessKey = key;
        setTimeout(() => bot.sock.emit('player:action', { type: 'guess', text: shared.word }), 1500 + Math.random() * 5000);
      }
    }
  }
}

async function main() {
  const bots: Bot[] = [];
  for (let i = 0; i < count; i++) {
    const sock = io(URL, { transports: ['websocket'], reconnection: true });
    await new Promise<void>((r) => sock.on('connect', () => r()));
    const bot: Bot = { sock, answered: new Set(), trivia: new Set(), picked: false, guessKey: '' };
    const res = await ack(sock, 'player:join', { roomCode: room, name: NAMES[i % NAMES.length], avatar: undefined });
    if (res.ok) bot.id = res.data.playerId;
    else console.error('join failed:', res.error);
    sock.on('player:update', (e) => play(bot, e));
    bots.push(bot);
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`🤖 ${bots.length} bots in room ${room}. Ctrl-C to stop.`);
}
main();
