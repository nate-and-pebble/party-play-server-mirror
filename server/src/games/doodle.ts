import type { GameAction, GameSummary, Identity, PlayerId } from '@partyplay/shared';
import { BaseGame, pickN, shuffle, type GameContext, type GameModule } from './engine.js';
import { DOODLE_WORDS } from './content.js';

const INTRO_SECONDS = 5;
const CHOOSE_SECONDS = 15;
const DRAW_SECONDS = 80;
const TURN_REVEAL_SECONDS = 7;
const GUESS_BASE = 300;
const GUESS_SPEED = 700;
const ARTIST_PER_GUESS = 250;
const MAX_POINTS_PER_MSG = 256;
const MAX_TOTAL_POINTS = 80000;
const FEED_CAP = 12;

type Phase = 'intro' | 'choose' | 'draw' | 'turnReveal' | 'done';
type Chip = { id: PlayerId; name: string; identity: Identity };

interface Stroke {
  id: string;
  color: string;
  width: number;
  points: number[]; // flat [x0,y0,x1,y1,...] normalized 0..1
}
interface FeedItem {
  chip: Chip;
  text: string;
  close: boolean;
}

const summary: GameSummary = {
  id: 'doodle',
  name: 'Doodle Dash',
  tagline: 'Draw it. Guess it. Fast.',
  description:
    'One player gets a secret word and draws it on their phone — live on the big screen. Everyone else races to guess. Fastest fingers and sharpest eyes win.',
  minPlayers: 3,
  maxPlayers: 12,
  estimatedMinutes: 10,
  pace: 'turn-based',
  teamBased: false,
  howToPlay: [
    'On your turn, pick a secret word and draw it on your phone.',
    'Everyone else watches the big screen and types guesses.',
    'Guess fast for more points — the artist scores for every correct guess.',
  ],
  tags: ['Drawing', 'Guessing', 'Turns'],
  emoji: '🎨',
  accent: '#FF8A5B',
  accent2: '#3DCCC7',
};

class DoodleDash extends BaseGame {
  private phase: Phase = 'intro';
  private order: PlayerId[] = [];
  private turnIndex = 0;
  private artistId: PlayerId | null = null;
  private wordChoices: string[] = [];
  private word: string | null = null;
  private strokes: Stroke[] = [];
  private totalPoints = 0;
  private solved = new Map<PlayerId, { at: number; points: number }>();
  private feed: FeedItem[] = [];
  private drawStart = 0;
  private artistPoints = 0;

  start(): void {
    const players = this.ctx.players();
    this.order = shuffle(players.map((p) => p.id), this.ctx.random);
    this.turnIndex = 0;
    this.phase = 'intro';
    this.setClock(INTRO_SECONDS, () => this.toChoose());
    this.ctx.update();
  }

  // ── Turn lifecycle ────────────────────────────────────────────────────────
  private toChoose() {
    // Skip past anyone who left.
    while (this.turnIndex < this.order.length && !this.ctx.player(this.order[this.turnIndex])?.connected) {
      this.turnIndex += 1;
    }
    if (this.turnIndex >= this.order.length) {
      this.phase = 'done';
      this.ctx.end();
      return;
    }
    this.artistId = this.order[this.turnIndex];
    this.word = null;
    this.strokes = [];
    this.totalPoints = 0;
    this.solved.clear();
    this.feed = [];
    this.artistPoints = 0;
    this.wordChoices = [
      ...pickN(DOODLE_WORDS.easy, 1, this.ctx.random),
      ...pickN(DOODLE_WORDS.medium, 1, this.ctx.random),
      ...pickN([...DOODLE_WORDS.medium, ...DOODLE_WORDS.hard], 1, this.ctx.random),
    ];
    this.phase = 'choose';
    this.setClock(CHOOSE_SECONDS, () => {
      if (!this.word) this.word = this.wordChoices[0];
      this.toDraw();
    });
    this.ctx.update();
  }

  private toDraw() {
    this.phase = 'draw';
    this.drawStart = this.ctx.now();
    this.ctx.streamToScreen('ink', { op: 'clear' });
    this.setClock(DRAW_SECONDS, () => this.toTurnReveal());
    this.ctx.update();
  }

  private toTurnReveal() {
    this.phase = 'turnReveal';
    if (this.solved.size > 0) this.ctx.fx({ type: 'confetti', intensity: 0.6 });
    this.setClock(TURN_REVEAL_SECONDS, () => this.nextTurn());
    this.ctx.update();
  }

  private nextTurn() {
    this.turnIndex += 1;
    if (this.turnIndex >= this.order.length) {
      this.phase = 'done';
      this.ctx.end();
      return;
    }
    this.toChoose();
  }

  private guessersRemaining(): PlayerId[] {
    return this.ctx
      .connectedPlayers()
      .filter((p) => p.id !== this.artistId && !this.solved.has(p.id))
      .map((p) => p.id);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  handleAction(playerId: PlayerId, action: GameAction): void {
    switch (action.type) {
      case 'pickWord': {
        if (this.phase !== 'choose' || playerId !== this.artistId) return;
        const i = Number(action.index);
        if (i >= 0 && i < this.wordChoices.length) {
          this.word = this.wordChoices[i];
          this.toDraw();
        }
        return;
      }
      case 'draw': {
        if (this.phase !== 'draw' || playerId !== this.artistId) return;
        const pts = Array.isArray(action.points) ? (action.points as number[]).slice(0, MAX_POINTS_PER_MSG * 2) : [];
        if (pts.length < 2 || this.totalPoints > MAX_TOTAL_POINTS) return;
        const strokeId = String(action.strokeId ?? '');
        const color = sanitizeColor(String(action.color ?? '#111111'));
        const width = clamp(Number(action.width ?? 0.01), 0.002, 0.06);
        let stroke = this.strokes.find((s) => s.id === strokeId);
        if (!stroke) {
          stroke = { id: strokeId, color, width, points: [] };
          this.strokes.push(stroke);
        }
        const clean = pts.map((n) => clamp(Number(n) || 0, 0, 1));
        stroke.points.push(...clean);
        this.totalPoints += clean.length / 2;
        // Stream only the delta to the screen; do NOT rebroadcast full state.
        this.ctx.streamToScreen('ink', { op: 'append', strokeId, color, width, points: clean });
        return;
      }
      case 'undo': {
        if (this.phase !== 'draw' || playerId !== this.artistId) return;
        this.strokes.pop();
        this.ctx.streamToScreen('ink', { op: 'undo' });
        return;
      }
      case 'clearCanvas': {
        if (this.phase !== 'draw' || playerId !== this.artistId) return;
        this.strokes = [];
        this.totalPoints = 0;
        this.ctx.streamToScreen('ink', { op: 'clear' });
        return;
      }
      case 'guess': {
        if (this.phase !== 'draw' || playerId === this.artistId) return;
        if (this.solved.has(playerId)) return;
        if (!this.ctx.player(playerId)?.connected) return;
        const raw = String(action.text ?? '').slice(0, 40).trim();
        if (!raw || !this.word) return;
        const chip = this.chip(playerId)!;
        const verdict = matchGuess(raw, this.word);
        if (verdict === 'correct') {
          const remaining = this.remainingMs() ?? 0;
          const fraction = clamp(remaining / (DRAW_SECONDS * 1000), 0, 1);
          const points = GUESS_BASE + Math.round(GUESS_SPEED * fraction);
          this.solved.set(playerId, { at: this.ctx.now(), points });
          this.ctx.addScore(playerId, points);
          this.ctx.setStreak(playerId, (this.ctx.player(playerId)?.streak ?? 0) + 1);
          if (this.artistId) {
            this.ctx.addScore(this.artistId, ARTIST_PER_GUESS);
            this.artistPoints += ARTIST_PER_GUESS;
          }
          this.ctx.toastPlayer(playerId, `Correct! +${points} 🎉`, 'success');
          this.ctx.streamToScreen('guess', { op: 'correct', chip });
          this.ctx.fx({ type: 'confetti', intensity: 0.3 });
          this.ctx.update();
          if (this.guessersRemaining().length === 0) this.expireClockNow();
        } else {
          const close = verdict === 'close';
          const item: FeedItem = { chip, text: raw, close };
          this.feed.push(item);
          if (this.feed.length > FEED_CAP) this.feed.shift();
          if (close) this.ctx.toastPlayer(playerId, 'So close! 🔥', 'warn');
          this.ctx.streamToScreen('guess', { op: 'feed', chip, text: raw, close });
          this.ctx.update();
        }
        return;
      }
    }
  }

  handleHostCommand(command: string): void {
    super.handleHostCommand(command);
    if (command === 'advance' || command === 'skip') {
      if (this.phase === 'intro') this.toChoose();
      else if (this.phase === 'choose') {
        if (!this.word) this.word = this.wordChoices[0];
        this.toDraw();
      } else if (this.phase === 'draw') this.toTurnReveal();
      else if (this.phase === 'turnReveal') this.nextTurn();
    }
  }

  onPlayerDisconnect(playerId: PlayerId): void {
    // If the artist vanishes, don't freeze the room — end the turn (RES-03).
    if (playerId === this.artistId && (this.phase === 'choose' || this.phase === 'draw')) {
      this.toTurnReveal();
    } else if (this.phase === 'draw' && this.guessersRemaining().length === 0) {
      this.expireClockNow();
    }
  }

  onPlayerJoin(player: { id: PlayerId }): void {
    // Newcomers can guess now and get a turn later.
    if (!this.order.includes(player.id)) this.order.push(player.id);
  }

  // ── Projections ─────────────────────────────────────────────────────────
  private chip(id: PlayerId): Chip | null {
    const p = this.ctx.player(id);
    return p ? { id: p.id, name: p.name, identity: p.identity } : null;
  }
  private wordHint(): string {
    if (!this.word) return '';
    return this.word
      .split(' ')
      .map((w) => '● '.repeat(w.length).trim())
      .join('   /   ');
  }

  screenView() {
    if (this.phase === 'intro') {
      return {
        gameId: summary.id,
        phase: 'intro',
        countdown: this.remainingSeconds() ?? 0,
        howToPlay: summary.howToPlay,
        order: this.order.map((id) => this.chip(id)).filter(Boolean),
      };
    }
    if (this.phase === 'choose') {
      return {
        gameId: summary.id,
        phase: 'choose',
        artist: this.chip(this.artistId!),
        remaining: this.remainingSeconds() ?? 0,
        total: CHOOSE_SECONDS,
        paused: this.paused,
        turn: this.turnIndex + 1,
        turns: this.order.length,
      };
    }
    if (this.phase === 'draw') {
      const guessers = this.ctx.connectedPlayers().filter((p) => p.id !== this.artistId);
      return {
        gameId: summary.id,
        phase: 'draw',
        artist: this.chip(this.artistId!),
        remaining: this.remainingSeconds() ?? 0,
        total: DRAW_SECONDS,
        paused: this.paused,
        turn: this.turnIndex + 1,
        turns: this.order.length,
        hint: this.wordHint(),
        letters: this.word ? this.word.replace(/\s/g, '').length : 0,
        strokes: this.strokes, // full state, for fresh/reconnecting screens
        solved: [...this.solved.keys()].map((id) => this.chip(id)).filter(Boolean),
        guessersTotal: guessers.length,
        feed: this.feed,
      };
    }
    if (this.phase === 'turnReveal') {
      const results = [...this.solved.entries()]
        .sort((a, b) => a[1].at - b[1].at)
        .map(([id, v]) => ({ chip: this.chip(id), points: v.points }));
      return {
        gameId: summary.id,
        phase: 'turnReveal',
        artist: this.chip(this.artistId!),
        word: this.word,
        results,
        artistPoints: this.artistPoints,
        anySolved: this.solved.size > 0,
        strokes: this.strokes,
        turn: this.turnIndex + 1,
        turns: this.order.length,
        isLast: this.turnIndex === this.order.length - 1,
      };
    }
    return { gameId: summary.id, phase: 'done' };
  }

  playerView(playerId: PlayerId) {
    const isArtist = playerId === this.artistId;
    if (this.phase === 'intro') {
      const pos = this.order.indexOf(playerId);
      return { gameId: summary.id, phase: 'intro', upNext: pos === 0 };
    }
    if (this.phase === 'choose') {
      if (isArtist) {
        return { gameId: summary.id, phase: 'choose', role: 'artist', choices: this.wordChoices, remaining: this.remainingSeconds() ?? 0 };
      }
      return { gameId: summary.id, phase: 'choose', role: 'guesser', artist: this.chip(this.artistId!), remaining: this.remainingSeconds() ?? 0 };
    }
    if (this.phase === 'draw') {
      if (isArtist) {
        return {
          gameId: summary.id,
          phase: 'draw',
          role: 'artist',
          word: this.word,
          remaining: this.remainingSeconds() ?? 0,
          solvedCount: this.solved.size,
          guessersTotal: this.ctx.connectedPlayers().length - 1,
        };
      }
      const solved = this.solved.has(playerId);
      return {
        gameId: summary.id,
        phase: 'draw',
        role: 'guesser',
        remaining: this.remainingSeconds() ?? 0,
        hint: this.wordHint(),
        letters: this.word ? this.word.replace(/\s/g, '').length : 0,
        solved,
        gained: this.solved.get(playerId)?.points ?? 0,
        artist: this.chip(this.artistId!),
      };
    }
    if (this.phase === 'turnReveal') {
      return {
        gameId: summary.id,
        phase: 'turnReveal',
        word: this.word,
        youWereArtist: isArtist,
        gained: isArtist ? this.artistPoints : (this.solved.get(playerId)?.points ?? 0),
        correct: this.solved.has(playerId),
      };
    }
    return { gameId: summary.id, phase: 'done' };
  }
}

// ── Guess matching ──────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function matchGuess(guess: string, word: string): 'correct' | 'close' | 'wrong' {
  const g = normalize(guess);
  const w = normalize(word);
  if (!g) return 'wrong';
  if (g === w) return 'correct';
  const d = levenshtein(g, w);
  if (w.length >= 5 && d <= 1) return 'correct';
  if (d <= 2 || (w.length >= 4 && (w.includes(g) || g.includes(w)))) return 'close';
  return 'wrong';
}
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function sanitizeColor(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#111111';
}

export const doodleModule: GameModule = {
  summary,
  create: (ctx: GameContext) => new DoodleDash(ctx),
};
