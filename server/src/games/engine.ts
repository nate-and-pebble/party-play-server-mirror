import type {
  GameAction,
  GameSummary,
  PlayerId,
  PlayerPublic,
  ScreenFx,
  ScreenGameView,
  PlayerGameView,
} from '@partyplay/shared';

/**
 * The platform ↔ game contract.
 *
 * A game is pure-ish logic over state, plus two projections:
 *   - screenView():        the PUBLIC view rendered on the shared screen
 *   - playerView(id):      the PRIVATE view rendered on one phone
 *
 * The game never touches sockets, sessions, or identity. The platform core
 * gives it a `GameContext` for the few things it needs (scoring, timers,
 * effects, broadcasting). This is what makes adding a game cheap (LIB-03):
 * a new game is a single module implementing `GameRuntime`.
 */
export interface GameContext {
  /** Live list of players currently in the session (connected or not). */
  players(): PlayerPublic[];
  /** Convenience: only players whose phones are currently connected. */
  connectedPlayers(): PlayerPublic[];
  player(id: PlayerId): PlayerPublic | undefined;

  /** Host-chosen settings for this game instance (round count, timers, …). */
  settings: Record<string, unknown>;

  random(): number;
  now(): number;

  /** Recompute and broadcast all views. Call after ANY state change. */
  update(): void;

  /** Scoring. Per-game score; the session accumulates the session tally. */
  addScore(id: PlayerId, delta: number): void;
  setScore(id: PlayerId, value: number): void;
  setStreak(id: PlayerId, value: number): void;

  /** Fire a transient screen effect (confetti, flash, shake). */
  fx(effect: ScreenFx): void;
  /** Push a high-frequency payload to the shared screen, bypassing the view
   *  snapshot (e.g. live drawing ink). `channel` namespaces the stream. */
  streamToScreen(channel: string, payload: Record<string, unknown>): void;
  /** Send a one-off toast to one player's phone(s). */
  toastPlayer(id: PlayerId, message: string, kind?: 'info' | 'success' | 'warn' | 'error'): void;

  /** End the game now; the session transitions to the results screen. */
  end(): void;
}

export interface GameRuntime {
  /** Called once when the host starts the game. */
  start(): void;

  /** A phone sent a game action. Validate server-side; never trust the client. */
  handleAction(playerId: PlayerId, action: GameAction): void;

  /** Host pressed advance/skip/pause/resume etc. (BaseGame handles pause). */
  handleHostCommand(command: string, payload?: unknown): void;

  onPlayerDisconnect?(playerId: PlayerId): void;
  onPlayerReconnect?(playerId: PlayerId): void;
  /** A new player joined mid-game (JOIN-05). */
  onPlayerJoin?(player: PlayerPublic): void;
  /** A player was permanently removed (kick / hard leave). */
  onPlayerRemove?(playerId: PlayerId): void;

  /** Public projection for the shared screen. Never include secrets. */
  screenView(): ScreenGameView;
  /** Private projection for one phone. The ONLY place that player's secrets go. */
  playerView(playerId: PlayerId): PlayerGameView;

  /** Tear down timers/intervals. */
  destroy(): void;
}

export interface GameModule {
  summary: GameSummary;
  create(ctx: GameContext): GameRuntime;
}

/**
 * BaseGame provides a single pause-aware countdown clock shared by all three
 * launch games (each game phase has at most one timer). Games extend this and
 * use setClock/clearClock/remainingSeconds; pause & resume are handled for free.
 */
export abstract class BaseGame implements GameRuntime {
  protected paused = false;

  private interval: ReturnType<typeof setInterval> | null = null;
  private deadlineAt: number | null = null;
  private durationSec: number | null = null;
  private onExpire: (() => void) | null = null;
  private frozenRemaining: number | null = null;
  private lastWholeSecond = -1;

  constructor(protected ctx: GameContext) {}

  abstract start(): void;
  abstract handleAction(playerId: PlayerId, action: GameAction): void;
  abstract screenView(): ScreenGameView;
  abstract playerView(playerId: PlayerId): PlayerGameView;

  handleHostCommand(command: string): void {
    if (command === 'pause') this.pause();
    else if (command === 'resume') this.resume();
  }

  // ── Clock ──────────────────────────────────────────────────────────────
  protected setClock(seconds: number, onExpire: () => void): void {
    this.clearClock();
    const scaled = Math.max(1, Math.round(seconds * TIME_SCALE));
    this.durationSec = scaled;
    this.onExpire = onExpire;
    this.deadlineAt = this.ctx.now() + scaled * 1000;
    this.lastWholeSecond = -1;
    this.interval = setInterval(() => this.tick(), 200);
  }

  protected clearClock(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.deadlineAt = null;
    this.onExpire = null;
    this.durationSec = null;
    this.frozenRemaining = null;
  }

  /** Cut the current clock short so it expires on the next tick. */
  protected expireClockNow(): void {
    if (this.deadlineAt != null) this.deadlineAt = this.ctx.now();
  }

  protected remainingMs(): number | null {
    if (this.paused && this.frozenRemaining != null) return this.frozenRemaining;
    if (this.deadlineAt == null) return null;
    return Math.max(0, this.deadlineAt - this.ctx.now());
  }

  protected remainingSeconds(): number | null {
    const ms = this.remainingMs();
    return ms == null ? null : Math.ceil(ms / 1000);
  }

  protected clockTotalSeconds(): number | null {
    return this.durationSec;
  }

  private tick(): void {
    if (this.paused) return;
    const ms = this.remainingMs();
    if (ms == null) return;
    const whole = Math.ceil(ms / 1000);
    if (whole !== this.lastWholeSecond) {
      this.lastWholeSecond = whole;
      this.ctx.update();
    }
    if (ms <= 0) {
      const fn = this.onExpire;
      this.clearClock();
      if (fn) fn();
    }
  }

  // ── Pause / resume ─────────────────────────────────────────────────────
  protected pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.frozenRemaining = this.remainingMs();
    this.ctx.update();
  }

  protected resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.frozenRemaining != null) {
      this.deadlineAt = this.ctx.now() + this.frozenRemaining;
    }
    this.frozenRemaining = null;
    this.ctx.update();
  }

  destroy(): void {
    this.clearClock();
  }
}

/** Global time scale for all game clocks. 1 = normal. Set PP_TIME_SCALE < 1
 *  to speed games up (fast automated tests; snappier demos). */
const TIME_SCALE = (() => {
  const v = Number(process.env.PP_TIME_SCALE);
  return Number.isFinite(v) && v > 0 ? v : 1;
})();

// ── Small shared helpers used by multiple games ───────────────────────────

export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickN<T>(arr: readonly T[], n: number, rng: () => number = Math.random): T[] {
  return shuffle(arr, rng).slice(0, Math.min(n, arr.length));
}
