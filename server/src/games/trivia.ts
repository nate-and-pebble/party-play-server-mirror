import type { GameAction, GameSummary, PlayerId } from '@partyplay/shared';
import { BaseGame, pickN, type GameContext, type GameModule } from './engine.js';
import { TRIVIA_QUESTIONS, type TriviaQuestion } from './content.js';

const INTRO_SECONDS = 5;
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 6;
const BASE_POINTS = 1000;
const MAX_SPEED_BONUS = 1000;
const STREAK_STEP = 100;
const MAX_STREAK_BONUS_STEPS = 5;
const DEFAULT_QUESTION_COUNT = 8;

// Fixed, colorblind-safe styling per answer slot (shape is the real signal).
const OPTION_STYLES = [
  { shape: 'triangle', color: '#FF6B6B' },
  { shape: 'diamond', color: '#54A0FF' },
  { shape: 'circle', color: '#FECA57' },
  { shape: 'square', color: '#1DD1A1' },
] as const;

type Phase = 'intro' | 'question' | 'reveal' | 'done';

interface Answer {
  index: number;
  at: number;
}

const summary: GameSummary = {
  id: 'trivia',
  name: 'Trivia Rush',
  tagline: 'Know it fast. Score big.',
  description:
    'Rapid-fire multiple choice. Everyone answers at once — the faster you lock in the right answer, the more points you bank. Build a streak for bonuses.',
  minPlayers: 1,
  maxPlayers: 16,
  estimatedMinutes: 6,
  pace: 'simultaneous',
  teamBased: false,
  howToPlay: [
    'A question appears on the big screen with four answers.',
    'Tap the matching shape on your phone — quickly!',
    'Correct + fast = more points. Chain correct answers for streak bonuses.',
  ],
  tags: ['Quiz', 'Speed', 'Knowledge'],
  emoji: '⚡',
  accent: '#2EC4B6',
  accent2: '#FFB23E',
};

class TriviaRush extends BaseGame {
  private phase: Phase = 'intro';
  private questions: TriviaQuestion[] = [];
  private qIndex = 0;
  private answers = new Map<PlayerId, Answer>();
  private questionStart = 0;
  private lastGain = new Map<PlayerId, number>();

  start(): void {
    const count = Number(this.ctx.settings.questionCount ?? DEFAULT_QUESTION_COUNT);
    this.questions = pickN(TRIVIA_QUESTIONS, Math.max(3, Math.min(count, TRIVIA_QUESTIONS.length)), this.ctx.random);
    this.phase = 'intro';
    this.setClock(INTRO_SECONDS, () => this.toQuestion());
    this.ctx.update();
  }

  private toQuestion() {
    this.answers.clear();
    this.lastGain.clear();
    this.questionStart = this.ctx.now();
    this.phase = 'question';
    this.setClock(QUESTION_SECONDS, () => this.toReveal());
    this.ctx.update();
  }

  private toReveal() {
    const q = this.questions[this.qIndex];
    for (const p of this.ctx.players()) {
      const ans = this.answers.get(p.id);
      if (!ans) {
        this.ctx.setStreak(p.id, 0);
        this.lastGain.set(p.id, 0);
        continue;
      }
      const correct = ans.index === q.correctIndex;
      if (!correct) {
        this.ctx.setStreak(p.id, 0);
        this.lastGain.set(p.id, 0);
        continue;
      }
      const elapsed = ans.at - this.questionStart;
      const fraction = Math.max(0, Math.min(1, 1 - elapsed / (QUESTION_SECONDS * 1000)));
      const speed = Math.round(MAX_SPEED_BONUS * fraction);
      const newStreak = (p.streak ?? 0) + 1;
      const streakBonus = Math.min(newStreak - 1, MAX_STREAK_BONUS_STEPS) * STREAK_STEP;
      const gain = BASE_POINTS + speed + streakBonus;
      this.ctx.setStreak(p.id, newStreak);
      this.ctx.addScore(p.id, gain);
      this.lastGain.set(p.id, gain);
    }
    this.phase = 'reveal';
    this.ctx.fx({ type: 'flash' });
    this.setClock(REVEAL_SECONDS, () => this.nextQuestion());
    this.ctx.update();
  }

  private nextQuestion() {
    this.qIndex += 1;
    if (this.qIndex >= this.questions.length) {
      this.phase = 'done';
      this.ctx.end();
      return;
    }
    this.toQuestion();
  }

  handleAction(playerId: PlayerId, action: GameAction): void {
    if (action.type !== 'answer' || this.phase !== 'question') return;
    if (this.answers.has(playerId)) return; // lock first answer (fairness)
    const index = Number(action.index);
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    this.answers.set(playerId, { index, at: this.ctx.now() });
    this.ctx.update();
    const live = this.ctx.connectedPlayers();
    if (live.length > 0 && live.every((p) => this.answers.has(p.id))) this.expireClockNow();
  }

  handleHostCommand(command: string): void {
    super.handleHostCommand(command);
    if (command === 'advance' || command === 'skip') {
      if (this.phase === 'intro') this.toQuestion();
      else if (this.phase === 'question') this.toReveal();
      else if (this.phase === 'reveal') this.nextQuestion();
    }
  }

  private leaderboard() {
    return this.ctx
      .players()
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, identity: p.identity, score: p.score, streak: p.streak }));
  }

  screenView() {
    const q = this.questions[this.qIndex];
    if (this.phase === 'intro') {
      return {
        gameId: summary.id,
        phase: 'intro',
        countdown: this.remainingSeconds() ?? 0,
        questionCount: this.questions.length,
        howToPlay: summary.howToPlay,
      };
    }
    if (this.phase === 'question') {
      return {
        gameId: summary.id,
        phase: 'question',
        index: this.qIndex,
        total: this.questions.length,
        category: q.category,
        question: q.question,
        options: q.options.map((text, i) => ({ key: i, text, ...OPTION_STYLES[i] })),
        remaining: this.remainingSeconds() ?? 0,
        totalTime: QUESTION_SECONDS,
        paused: this.paused,
        answeredCount: this.answers.size,
        playersTotal: this.ctx.connectedPlayers().length,
      };
    }
    if (this.phase === 'reveal') {
      const counts = [0, 0, 0, 0];
      for (const a of this.answers.values()) counts[a.index]++;
      const results = this.ctx
        .players()
        .map((p) => {
          const a = this.answers.get(p.id);
          return {
            id: p.id,
            name: p.name,
            identity: p.identity,
            answered: !!a,
            correct: !!a && a.index === q.correctIndex,
            gained: this.lastGain.get(p.id) ?? 0,
          };
        })
        .sort((x, y) => y.gained - x.gained);
      return {
        gameId: summary.id,
        phase: 'reveal',
        index: this.qIndex,
        total: this.questions.length,
        question: q.question,
        category: q.category,
        correctIndex: q.correctIndex,
        options: q.options.map((text, i) => ({
          key: i,
          text,
          ...OPTION_STYLES[i],
          count: counts[i],
          isCorrect: i === q.correctIndex,
        })),
        results,
        leaderboard: this.leaderboard(),
        isLast: this.qIndex === this.questions.length - 1,
      };
    }
    return { gameId: summary.id, phase: 'done' };
  }

  playerView(playerId: PlayerId) {
    const q = this.questions[this.qIndex];
    if (this.phase === 'intro') return { gameId: summary.id, phase: 'intro' };
    if (this.phase === 'question') {
      const mine = this.answers.get(playerId);
      return {
        gameId: summary.id,
        phase: 'question',
        index: this.qIndex,
        total: this.questions.length,
        options: q.options.map((_text, i) => ({ key: i, ...OPTION_STYLES[i] })),
        yourAnswer: mine ? mine.index : null,
        locked: !!mine,
        remaining: this.remainingSeconds() ?? 0,
      };
    }
    if (this.phase === 'reveal') {
      const mine = this.answers.get(playerId);
      const correct = mine ? mine.index === q.correctIndex : null;
      return {
        gameId: summary.id,
        phase: 'reveal',
        yourAnswer: mine ? mine.index : null,
        correctKey: q.correctIndex,
        correct,
        gained: this.lastGain.get(playerId) ?? 0,
        streak: this.ctx.player(playerId)?.streak ?? 0,
      };
    }
    return { gameId: summary.id, phase: 'done' };
  }
}

export const triviaModule: GameModule = {
  summary,
  create: (ctx: GameContext) => new TriviaRush(ctx),
};
