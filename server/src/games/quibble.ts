import type { GameAction, GameSummary, Identity, PlayerId } from '@partyplay/shared';
import { BaseGame, pickN, shuffle, type GameContext, type GameModule } from './engine.js';
import { QUIBBLE_PROMPTS } from './content.js';

const ANSWER_SECONDS = 75;
const VOTE_SECONDS = 22;
const REVEAL_SECONDS = 8;
const INTRO_SECONDS = 6;
const POINTS_PER_VOTE = 100;
const SWEEP_BONUS = 300;
const MAX_ANSWER_LEN = 120;
const SAFETY = '(no answer — chickened out 🐔)';

type Phase = 'intro' | 'answer' | 'vote' | 'reveal' | 'done';

interface Slot {
  playerId: PlayerId;
  answer: string | null;
}
interface Matchup {
  id: string;
  prompt: string;
  a: Slot;
  b: Slot;
  votes: Map<PlayerId, 'A' | 'B'>;
  pointsA: number;
  pointsB: number;
}

const summary: GameSummary = {
  id: 'quibble',
  name: 'Quibble',
  tagline: 'Write the funniest answer. Win the room.',
  description:
    'Everyone gets oddball prompts. Write your wittiest answer, then the whole room votes head-to-head. The funniest pen wins.',
  minPlayers: 3,
  maxPlayers: 16,
  estimatedMinutes: 8,
  pace: 'simultaneous',
  teamBased: false,
  howToPlay: [
    'You’ll get two prompts. Type a funny answer to each.',
    'Then vote between two players’ answers — but not on your own.',
    'Earn 100 points per vote. Sweep a matchup for a bonus!',
  ],
  tags: ['Writing', 'Comedy', 'Voting'],
  emoji: '✍️',
  accent: '#7C5CFF',
  accent2: '#FF6BD6',
};

class Quibble extends BaseGame {
  private phase: Phase = 'intro';
  private matchups: Matchup[] = [];
  private matchIndex = 0;

  start(): void {
    const players = this.ctx.players();
    const order = shuffle(players.map((p) => p.id), this.ctx.random);
    const prompts = pickN(QUIBBLE_PROMPTS, order.length, this.ctx.random);
    this.matchups = order.map((pid, i) => ({
      id: `m${i}`,
      prompt: prompts[i % prompts.length],
      a: { playerId: pid, answer: null },
      b: { playerId: order[(i + 1) % order.length], answer: null },
      votes: new Map(),
      pointsA: 0,
      pointsB: 0,
    }));
    this.phase = 'intro';
    this.setClock(INTRO_SECONDS, () => this.toAnswer());
    this.ctx.update();
  }

  // ── Phase transitions ────────────────────────────────────────────────────
  private toAnswer() {
    this.phase = 'answer';
    this.setClock(ANSWER_SECONDS, () => this.toVote());
    this.ctx.update();
  }

  private toVote() {
    // Fill any missing answers so every matchup is votable.
    for (const m of this.matchups) {
      if (!m.a.answer) m.a.answer = SAFETY;
      if (!m.b.answer) m.b.answer = SAFETY;
    }
    this.matchIndex = 0;
    this.phase = 'vote';
    this.startVote();
  }

  private startVote() {
    this.matchups[this.matchIndex].votes.clear();
    this.setClock(VOTE_SECONDS, () => this.toReveal());
    this.ctx.update();
  }

  private toReveal() {
    const m = this.matchups[this.matchIndex];
    let countA = 0;
    let countB = 0;
    for (const v of m.votes.values()) v === 'A' ? countA++ : countB++;
    m.pointsA = countA * POINTS_PER_VOTE;
    m.pointsB = countB * POINTS_PER_VOTE;
    const total = countA + countB;
    if (total >= 2 && countA > 0 && countB === 0) {
      m.pointsA += SWEEP_BONUS;
      this.ctx.toastPlayer(m.a.playerId, 'SWEEP! +' + SWEEP_BONUS, 'success');
    }
    if (total >= 2 && countB > 0 && countA === 0) {
      m.pointsB += SWEEP_BONUS;
      this.ctx.toastPlayer(m.b.playerId, 'SWEEP! +' + SWEEP_BONUS, 'success');
    }
    this.ctx.addScore(m.a.playerId, m.pointsA);
    this.ctx.addScore(m.b.playerId, m.pointsB);
    this.phase = 'reveal';
    if (m.pointsA > 0 || m.pointsB > 0) this.ctx.fx({ type: 'confetti', intensity: 0.4 });
    this.setClock(REVEAL_SECONDS, () => this.nextMatch());
    this.ctx.update();
  }

  private nextMatch() {
    this.matchIndex += 1;
    if (this.matchIndex >= this.matchups.length) {
      this.phase = 'done';
      this.ctx.end();
      return;
    }
    this.phase = 'vote';
    this.startVote();
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  handleAction(playerId: PlayerId, action: GameAction): void {
    if (action.type === 'answer' && this.phase === 'answer') {
      const m = this.matchups.find((x) => x.id === action.matchId);
      if (!m) return;
      const text = String(action.text ?? '').slice(0, MAX_ANSWER_LEN).trim();
      if (!text) return;
      if (m.a.playerId === playerId) m.a.answer = text;
      else if (m.b.playerId === playerId) m.b.answer = text;
      else return;
      this.ctx.update();
      if (this.everyoneAnswered()) this.expireClockNow();
      return;
    }
    if (action.type === 'vote' && this.phase === 'vote') {
      const m = this.matchups[this.matchIndex];
      const key = action.key === 'A' ? 'A' : action.key === 'B' ? 'B' : null;
      if (!key) return;
      if (m.a.playerId === playerId || m.b.playerId === playerId) return; // can't vote own
      if (!this.ctx.player(playerId)?.connected) return;
      m.votes.set(playerId, key);
      this.ctx.update();
      if (this.everyoneVoted()) this.expireClockNow();
    }
  }

  handleHostCommand(command: string): void {
    super.handleHostCommand(command);
    if (command === 'advance' || command === 'skip') {
      if (this.phase === 'intro') this.toAnswer();
      else if (this.phase === 'answer') this.toVote();
      else if (this.phase === 'vote') this.toReveal();
      else if (this.phase === 'reveal') this.nextMatch();
    }
  }

  // ── Completion checks ───────────────────────────────────────────────────
  private connectedIds(): Set<PlayerId> {
    return new Set(this.ctx.connectedPlayers().map((p) => p.id));
  }

  private everyoneAnswered(): boolean {
    const live = this.connectedIds();
    for (const m of this.matchups) {
      if (live.has(m.a.playerId) && !m.a.answer) return false;
      if (live.has(m.b.playerId) && !m.b.answer) return false;
    }
    return true;
  }

  private everyoneVoted(): boolean {
    const m = this.matchups[this.matchIndex];
    const voters = [...this.connectedIds()].filter((id) => id !== m.a.playerId && id !== m.b.playerId);
    if (voters.length === 0) return false;
    return voters.every((id) => m.votes.has(id));
  }

  // ── Projections ─────────────────────────────────────────────────────────
  private chip(playerId: PlayerId): { id: PlayerId; name: string; identity: Identity } | null {
    const p = this.ctx.player(playerId);
    return p ? { id: p.id, name: p.name, identity: p.identity } : null;
  }

  screenView() {
    if (this.phase === 'intro') {
      return { gameId: summary.id, phase: 'intro', countdown: this.remainingSeconds() ?? 0, howToPlay: summary.howToPlay };
    }
    if (this.phase === 'answer') {
      const live = this.connectedIds();
      const need = new Set<PlayerId>();
      for (const m of this.matchups) {
        if (live.has(m.a.playerId)) need.add(m.a.playerId);
        if (live.has(m.b.playerId)) need.add(m.b.playerId);
      }
      const players = [...need].map((id) => {
        const done = this.matchups
          .filter((m) => m.a.playerId === id || m.b.playerId === id)
          .every((m) => (m.a.playerId === id ? m.a.answer : m.b.answer));
        return { ...this.chip(id)!, done };
      });
      const submitted = players.filter((p) => p.done).length;
      return {
        gameId: summary.id,
        phase: 'answer',
        remaining: this.remainingSeconds() ?? 0,
        total: ANSWER_SECONDS,
        paused: this.paused,
        submitted,
        needed: players.length,
        players,
      };
    }
    if (this.phase === 'vote') {
      const m = this.matchups[this.matchIndex];
      const voters = [...this.connectedIds()].filter((id) => id !== m.a.playerId && id !== m.b.playerId);
      return {
        gameId: summary.id,
        phase: 'vote',
        matchIndex: this.matchIndex,
        matchCount: this.matchups.length,
        prompt: m.prompt,
        options: [
          { key: 'A', text: m.a.answer ?? '' },
          { key: 'B', text: m.b.answer ?? '' },
        ],
        remaining: this.remainingSeconds() ?? 0,
        total: VOTE_SECONDS,
        paused: this.paused,
        votesIn: m.votes.size,
        votersTotal: voters.length,
      };
    }
    if (this.phase === 'reveal') {
      const m = this.matchups[this.matchIndex];
      const votersFor = (k: 'A' | 'B') =>
        [...m.votes.entries()].filter(([, v]) => v === k).map(([id]) => this.chip(id)).filter(Boolean);
      return {
        gameId: summary.id,
        phase: 'reveal',
        matchIndex: this.matchIndex,
        matchCount: this.matchups.length,
        prompt: m.prompt,
        options: [
          { key: 'A', text: m.a.answer ?? '', author: this.chip(m.a.playerId), votes: votersFor('A'), points: m.pointsA },
          { key: 'B', text: m.b.answer ?? '', author: this.chip(m.b.playerId), votes: votersFor('B'), points: m.pointsB },
        ],
      };
    }
    return { gameId: summary.id, phase: 'done' };
  }

  playerView(playerId: PlayerId) {
    if (this.phase === 'intro') return { gameId: summary.id, phase: 'intro' };
    if (this.phase === 'answer') {
      const prompts = this.matchups
        .filter((m) => m.a.playerId === playerId || m.b.playerId === playerId)
        .map((m) => {
          const mine = m.a.playerId === playerId ? m.a : m.b;
          return { matchId: m.id, prompt: m.prompt, answer: mine.answer ?? '', submitted: !!mine.answer };
        });
      return { gameId: summary.id, phase: 'answer', remaining: this.remainingSeconds() ?? 0, prompts };
    }
    if (this.phase === 'vote') {
      const m = this.matchups[this.matchIndex];
      const isAuthor = m.a.playerId === playerId || m.b.playerId === playerId;
      return {
        gameId: summary.id,
        phase: 'vote',
        isAuthor,
        prompt: m.prompt,
        matchIndex: this.matchIndex,
        matchCount: this.matchups.length,
        remaining: this.remainingSeconds() ?? 0,
        options: isAuthor
          ? []
          : [
              { key: 'A', text: m.a.answer ?? '' },
              { key: 'B', text: m.b.answer ?? '' },
            ],
        yourVote: m.votes.get(playerId) ?? null,
      };
    }
    if (this.phase === 'reveal') {
      const m = this.matchups[this.matchIndex];
      const gained = m.a.playerId === playerId ? m.pointsA : m.b.playerId === playerId ? m.pointsB : 0;
      const wasAuthor = m.a.playerId === playerId || m.b.playerId === playerId;
      return { gameId: summary.id, phase: 'reveal', wasAuthor, gained };
    }
    return { gameId: summary.id, phase: 'done' };
  }
}

export const quibbleModule: GameModule = {
  summary,
  create: (ctx: GameContext) => new Quibble(ctx),
};
