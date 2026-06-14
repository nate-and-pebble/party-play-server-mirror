import type { Server, Socket } from 'socket.io';
import type {
  GameAction,
  HostCommand,
  Identity,
  PlayerEnvelope,
  PlayerId,
  PlayerPublic,
  PlayerView,
  Result,
  ResultsView,
  ScoreLine,
  ScreenEnvelope,
  ScreenFx,
  ScreenView,
  SessionSnapshot,
} from '@partyplay/shared';
import { assignIdentity, AVATAR_POOL, nextColor, PALETTE } from './util/identity.js';
import { makeId, makeToken } from './util/ids.js';
import { disambiguateName, validateName } from './util/names.js';
import { getGame, getLibrary } from './games/registry.js';
import type { GameContext, GameRuntime } from './games/engine.js';

const MAX_PLAYERS = 16; // SCALE-01: design toward 16+
const RESULTS_FLAVORS_WIN = ['Champion! 👑', 'You crushed it!', 'Top of the pile!'];
const RESULTS_FLAVORS_MID = ['Solid run!', 'Nicely played.', 'Respectable!'];
const RESULTS_FLAVORS_LOW = ['There’s always next round.', 'Shake it off!', 'You’ll get ’em next time.'];

interface PlayerRecord {
  id: PlayerId;
  token: string;
  name: string;
  identity: Identity;
  connected: boolean;
  sockets: Set<string>;
  isHostPlayer: boolean;
  score: number; // within current game
  sessionScore: number; // across the session
  streak: number;
  joinedAt: number;
}

export class Session {
  readonly roomCode: string;
  readonly hostToken: string;
  readonly joinUrl: string;
  readonly joinHost: string;
  readonly createdAt = Date.now();

  private players = new Map<PlayerId, PlayerRecord>();
  private phase: 'lobby' | 'game' | 'results' = 'lobby';
  private locked = false;
  private currentGameId: string | null = null;
  private runtime: GameRuntime | null = null;
  private lastResults: ResultsView | null = null;
  private perPlayerResults = new Map<PlayerId, { rank: number; score: number; isWinner: boolean; flavor: string }>();
  private gamesPlayed = 0;
  private lastActivity = Date.now();
  private destroyed = false;

  constructor(
    private io: Server,
    roomCode: string,
    joinUrl: string,
    joinHost: string
  ) {
    this.roomCode = roomCode;
    this.hostToken = makeToken();
    this.joinUrl = joinUrl;
    this.joinHost = joinHost;
  }

  // ── Room names ───────────────────────────────────────────────────────────
  private screenRoom() {
    return `s:${this.roomCode}:screen`;
  }
  private playerRoom(id: PlayerId) {
    return `s:${this.roomCode}:p:${id}`;
  }

  // ── Lifecycle bookkeeping ────────────────────────────────────────────────
  touch() {
    this.lastActivity = Date.now();
  }
  get idleMs() {
    return Date.now() - this.lastActivity;
  }
  get isEmpty() {
    return [...this.players.values()].every((p) => !p.connected) && this.screenSocketCount() === 0;
  }
  private screenSocketCount() {
    return this.io.sockets.adapter.rooms.get(this.screenRoom())?.size ?? 0;
  }

  // ── Screen / host attach ─────────────────────────────────────────────────
  attachScreen(socket: Socket, hostToken?: string): Result<{ isHost: boolean }> {
    this.touch();
    const isHost = hostToken === this.hostToken;
    socket.join(this.screenRoom());
    socket.data.role = 'screen';
    socket.data.roomCode = this.roomCode;
    socket.data.isHost = isHost;
    // Send current state immediately to the new screen.
    socket.emit('screen:update', this.screenEnvelope());
    this.broadcastSnapshotOnly();
    return { ok: true, data: { isHost } };
  }

  // ── Player join ──────────────────────────────────────────────────────────
  addPlayer(socket: Socket, rawName: string, avatar?: string): Result<{ playerId: PlayerId; token: string }> {
    this.touch();
    if (this.locked) return { ok: false, error: 'This room is locked.', code: 'ROOM_LOCKED' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'This room is full.', code: 'ROOM_FULL' };

    const check = validateName(rawName);
    if (!check.ok) return { ok: false, error: check.error ?? 'Invalid name.', code: 'NAME_INVALID' };

    const takenNames = new Set([...this.players.values()].map((p) => p.name));
    const name = disambiguateName(check.value, takenNames);

    const usedColors = new Set([...this.players.values()].map((p) => p.identity.color));
    const identity = assignIdentity(usedColors);
    if (avatar && AVATAR_POOL.includes(avatar)) identity.avatar = avatar;

    const id = makeId('p_');
    const record: PlayerRecord = {
      id,
      token: makeToken(),
      name,
      identity,
      connected: true,
      sockets: new Set([socket.id]),
      isHostPlayer: false,
      score: 0,
      sessionScore: 0,
      streak: 0,
      joinedAt: Date.now(),
    };
    this.players.set(id, record);

    socket.join(this.playerRoom(id));
    socket.data.role = 'player';
    socket.data.roomCode = this.roomCode;
    socket.data.playerId = id;

    // If a game is running, give it a chance to fold the newcomer in (JOIN-05).
    if (this.phase === 'game' && this.runtime?.onPlayerJoin) {
      this.runtime.onPlayerJoin(this.toPublic(record));
    }

    this.broadcast();
    socket.emit('player:update', this.playerEnvelope(id));
    return { ok: true, data: { playerId: id, token: record.token } };
  }

  // ── Player reconnect (RES-01/03) ─────────────────────────────────────────
  reconnectPlayer(socket: Socket, token: string): Result<{ playerId: PlayerId }> {
    this.touch();
    const record = [...this.players.values()].find((p) => p.token === token);
    if (!record) return { ok: false, error: 'We could not restore your seat.', code: 'BAD_TOKEN' };

    record.sockets.add(socket.id);
    const wasDisconnected = !record.connected;
    record.connected = true;

    socket.join(this.playerRoom(record.id));
    socket.data.role = 'player';
    socket.data.roomCode = this.roomCode;
    socket.data.playerId = record.id;

    if (wasDisconnected && this.phase === 'game') this.runtime?.onPlayerReconnect?.(record.id);

    this.broadcast();
    socket.emit('player:update', this.playerEnvelope(record.id));
    return { ok: true, data: { playerId: record.id } };
  }

  // ── Socket teardown ──────────────────────────────────────────────────────
  detachSocket(socket: Socket) {
    this.touch();
    if (socket.data.role === 'player' && socket.data.playerId) {
      const record = this.players.get(socket.data.playerId);
      if (record) {
        record.sockets.delete(socket.id);
        if (record.sockets.size === 0) {
          record.connected = false;
          if (this.phase === 'game') this.runtime?.onPlayerDisconnect?.(record.id);
        }
      }
    }
    // Screens leave their room automatically on disconnect.
    this.broadcast();
  }

  // ── Identity tweaks from the phone ───────────────────────────────────────
  setIdentity(playerId: PlayerId, opts: { avatar?: string; cycleColor?: boolean }) {
    this.touch();
    const record = this.players.get(playerId);
    if (!record) return;
    if (opts.avatar && AVATAR_POOL.includes(opts.avatar)) record.identity.avatar = opts.avatar;
    if (opts.cycleColor) {
      const used = new Set([...this.players.values()].filter((p) => p.id !== playerId).map((p) => p.identity.color));
      record.identity = nextColor(record.identity.color, used);
    }
    this.broadcast();
  }

  // ── Host commands (HOST-01..04) ──────────────────────────────────────────
  handleHostCommand(cmd: HostCommand): Result<unknown> {
    this.touch();
    switch (cmd.type) {
      case 'startGame':
        return this.startGame(cmd.gameId, cmd.settings ?? {});
      case 'advance':
        this.runtime?.handleHostCommand('advance');
        return { ok: true, data: null };
      case 'skip':
        this.runtime?.handleHostCommand('skip');
        return { ok: true, data: null };
      case 'pause':
        this.runtime?.handleHostCommand('pause');
        return { ok: true, data: null };
      case 'resume':
        this.runtime?.handleHostCommand('resume');
        return { ok: true, data: null };
      case 'endGame':
        if (this.phase === 'game') this.endGame();
        return { ok: true, data: null };
      case 'playAgain':
        if (this.currentGameId) return this.startGame(this.currentGameId, {});
        return { ok: false, error: 'No game to replay.', code: 'BAD_STATE' };
      case 'backToLobby':
        this.toLobby();
        return { ok: true, data: null };
      case 'lockRoom':
        this.locked = cmd.locked;
        this.broadcast();
        return { ok: true, data: null };
      case 'kick':
        this.kick(cmd.playerId);
        return { ok: true, data: null };
      case 'endSession':
        this.endSession('The host ended the session.');
        return { ok: true, data: null };
      default:
        return { ok: false, error: 'Unknown command.', code: 'BAD_STATE' };
    }
  }

  handlePlayerAction(playerId: PlayerId, action: GameAction) {
    this.touch();
    if (this.phase !== 'game' || !this.runtime) return;
    this.runtime.handleAction(playerId, action);
  }

  // ── Game start / end ─────────────────────────────────────────────────────
  private startGame(gameId: string, settings: Record<string, unknown>): Result<unknown> {
    const game = getGame(gameId);
    if (!game) return { ok: false, error: 'That game is unavailable.', code: 'GAME_NOT_FOUND' };

    const eligible = [...this.players.values()];
    if (eligible.length < game.summary.minPlayers) {
      return {
        ok: false,
        error: `${game.summary.name} needs at least ${game.summary.minPlayers} players.`,
        code: 'NOT_ENOUGH_PLAYERS',
      };
    }

    // Reset per-game scoring (session tally is preserved).
    for (const p of this.players.values()) {
      p.score = 0;
      p.streak = 0;
    }

    this.runtime?.destroy();
    this.currentGameId = gameId;
    this.phase = 'game';
    this.lastResults = null;
    this.perPlayerResults.clear();
    this.runtime = game.create(this.makeContext(settings));
    this.runtime.start();
    this.broadcast();
    return { ok: true, data: null };
  }

  private endGame() {
    this.gamesPlayed += 1;
    const standings = this.computeStandings();

    // Roll per-game scores into the running session tally (RScore-03).
    for (const p of this.players.values()) p.sessionScore += p.score;

    const topScore = standings.length ? standings[0].score : 0;
    const winners = standings.filter((s) => s.score === topScore && standings.length > 0).map((s) => s.playerId);
    const game = this.currentGameId ? getGame(this.currentGameId) : null;
    const winnerNames = winners
      .map((id) => this.players.get(id)?.name)
      .filter(Boolean) as string[];
    const headline =
      winnerNames.length === 0
        ? 'Game over!'
        : winnerNames.length === 1
          ? `${winnerNames[0]} wins!`
          : winnerNames.length === standings.length
            ? "It's a draw!"
            : `${winnerNames.slice(0, -1).join(', ')} & ${winnerNames.at(-1)} tie!`;

    this.lastResults = {
      gameId: this.currentGameId ?? '',
      gameName: game?.summary.name ?? 'Game',
      standings,
      winners,
      headline,
      canPlayAgain: true,
    };

    // Per-player personal result lines.
    this.perPlayerResults.clear();
    for (const line of standings) {
      const isWinner = winners.includes(line.playerId);
      const flavor = isWinner
        ? pick(RESULTS_FLAVORS_WIN)
        : line.rank <= Math.ceil(standings.length / 2)
          ? pick(RESULTS_FLAVORS_MID)
          : pick(RESULTS_FLAVORS_LOW);
      this.perPlayerResults.set(line.playerId, { rank: line.rank, score: line.score, isWinner, flavor });
    }

    this.runtime?.destroy();
    this.runtime = null;
    this.phase = 'results';
    this.fx({ type: 'confetti', intensity: 1 });
    this.broadcast();
  }

  private toLobby() {
    this.runtime?.destroy();
    this.runtime = null;
    this.phase = 'lobby';
    this.lastResults = null;
    this.perPlayerResults.clear();
    this.broadcast();
  }

  private computeStandings(): ScoreLine[] {
    const lines = [...this.players.values()]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        identity: p.identity,
        score: p.score,
        sessionScore: p.sessionScore + p.score, // include the round being finalized
        rank: 0,
      }))
      .sort((a, b) => b.score - a.score);
    let lastScore = Number.NaN;
    let lastRank = 0;
    lines.forEach((line, i) => {
      if (line.score !== lastScore) {
        lastRank = i + 1;
        lastScore = line.score;
      }
      line.rank = lastRank;
    });
    return lines;
  }

  private kick(playerId: PlayerId) {
    const record = this.players.get(playerId);
    if (!record) return;
    for (const sid of record.sockets) {
      this.io.to(sid).emit('kicked', { reason: 'The host removed you from the room.' });
    }
    this.io.in(this.playerRoom(playerId)).socketsLeave(this.playerRoom(playerId));
    this.players.delete(playerId);
    if (this.phase === 'game') this.runtime?.onPlayerRemove?.(playerId);
    this.broadcast();
  }

  endSession(reason: string) {
    if (this.destroyed) return;
    this.io.to(this.roomKey()).emit('session:ended', { reason });
    // Notify both screens and players.
    this.io.to(this.screenRoom()).emit('session:ended', { reason });
    for (const id of this.players.keys()) {
      this.io.to(this.playerRoom(id)).emit('session:ended', { reason });
    }
    this.destroy();
  }
  private roomKey() {
    return `s:${this.roomCode}`;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.runtime?.destroy();
    this.runtime = null;
    this.players.clear();
  }
  get isDestroyed() {
    return this.destroyed;
  }

  // ── Snapshot + view projection ───────────────────────────────────────────
  private toPublic(p: PlayerRecord): PlayerPublic {
    return {
      id: p.id,
      name: p.name,
      identity: p.identity,
      connected: p.connected,
      isHostPlayer: p.isHostPlayer,
      score: p.score,
      sessionScore: p.sessionScore,
      streak: p.streak,
      joinedAt: p.joinedAt,
    };
  }

  snapshot(): SessionSnapshot {
    return {
      roomCode: this.roomCode,
      joinUrl: this.joinUrl,
      joinHost: this.joinHost,
      phase: this.phase,
      locked: this.locked,
      hostConnected: this.screenSocketCount() > 0,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => this.toPublic(p)),
      currentGameId: this.currentGameId,
      gamesPlayed: this.gamesPlayed,
      library: getLibrary(),
    };
  }

  private screenView(): ScreenView {
    if (this.phase === 'lobby') return { kind: 'lobby' };
    if (this.phase === 'results' && this.lastResults) return { kind: 'results', view: this.lastResults };
    if (this.phase === 'game' && this.runtime) return { kind: 'game', view: this.runtime.screenView() };
    return { kind: 'lobby' };
  }

  private playerView(id: PlayerId): PlayerView {
    if (this.phase === 'lobby') return { kind: 'lobby' };
    if (this.phase === 'results') {
      const r = this.perPlayerResults.get(id);
      return {
        kind: 'results',
        view: {
          gameId: this.lastResults?.gameId ?? '',
          yourRank: r?.rank ?? 0,
          yourScore: r?.score ?? 0,
          isWinner: r?.isWinner ?? false,
          flavor: r?.flavor ?? 'Thanks for playing!',
        },
      };
    }
    if (this.phase === 'game' && this.runtime) return { kind: 'game', view: this.runtime.playerView(id) };
    return { kind: 'lobby' };
  }

  private screenEnvelope(): ScreenEnvelope {
    return { session: this.snapshot(), view: this.screenView() };
  }
  private playerEnvelope(id: PlayerId): PlayerEnvelope {
    const record = this.players.get(id)!;
    return { session: this.snapshot(), you: this.toPublic(record), view: this.playerView(id) };
  }

  // ── Broadcasting ─────────────────────────────────────────────────────────
  broadcast() {
    if (this.destroyed) return;
    this.io.to(this.screenRoom()).emit('screen:update', this.screenEnvelope());
    for (const id of this.players.keys()) {
      this.io.to(this.playerRoom(id)).emit('player:update', this.playerEnvelope(id));
    }
  }
  private broadcastSnapshotOnly() {
    // Used when only meta changed and we already sent the screen its view.
    for (const id of this.players.keys()) {
      this.io.to(this.playerRoom(id)).emit('player:update', this.playerEnvelope(id));
    }
  }

  private fx(effect: ScreenFx) {
    this.io.to(this.screenRoom()).emit('fx', effect);
  }

  // ── GameContext factory ──────────────────────────────────────────────────
  private makeContext(settings: Record<string, unknown>): GameContext {
    const self = this;
    return {
      players: () => [...self.players.values()].map((p) => self.toPublic(p)),
      connectedPlayers: () => [...self.players.values()].filter((p) => p.connected).map((p) => self.toPublic(p)),
      player: (id) => {
        const r = self.players.get(id);
        return r ? self.toPublic(r) : undefined;
      },
      settings,
      random: Math.random,
      now: Date.now,
      update: () => self.broadcast(),
      addScore: (id, delta) => {
        const r = self.players.get(id);
        if (r) r.score += delta;
      },
      setScore: (id, value) => {
        const r = self.players.get(id);
        if (r) r.score = value;
      },
      setStreak: (id, value) => {
        const r = self.players.get(id);
        if (r) r.streak = value;
      },
      fx: (effect) => self.fx(effect),
      streamToScreen: (channel, payload) => {
        self.io.to(self.screenRoom()).emit('gameStream', { gameId: self.currentGameId ?? '', channel, ...payload });
      },
      toastPlayer: (id, message, kind = 'info') => {
        self.io.to(self.playerRoom(id)).emit('toast', { id: makeId('t_'), kind, message });
      },
      end: () => {
        if (self.phase === 'game') self.endGame();
      },
    };
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export { PALETTE, MAX_PLAYERS };
