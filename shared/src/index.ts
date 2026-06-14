/**
 * Party Play — shared protocol.
 *
 * This is the single source of truth for the contract between the server,
 * the shared screen, and the phone controllers. Both `server` and `client`
 * import from here so the wire format can never drift between them.
 *
 * Mental model:
 *   - The SERVER is authoritative. It owns all state.
 *   - The SCREEN (TV/laptop) renders a PUBLIC projection: `ScreenEnvelope`.
 *   - Each PHONE renders a PRIVATE, per-player projection: `PlayerEnvelope`.
 *   - Secrets (a player's prompt, hand, vote, secret word) only ever appear
 *     in that player's own PlayerEnvelope — never in the ScreenEnvelope or
 *     in another player's envelope. Privacy is enforced by what we send.
 */

// ─────────────────────────────────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────────────────────────────────

export type RoomCode = string;
export type PlayerId = string;

/** A colorblind-safe identity: color + name + emoji + a distinct shape. */
export interface Identity {
  color: string; // hex, e.g. "#ff5d5d"
  colorName: string; // human label, e.g. "Coral"
  avatar: string; // emoji, e.g. "🦊"
  shape: ShapeKey; // redundant, non-color distinguisher (A11Y-02)
}

export type ShapeKey =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'star'
  | 'heart'
  | 'shield'
  | 'cross'
  | 'bolt'
  | 'moon'
  | 'flower';

/** What everyone is allowed to know about a player. */
export interface PlayerPublic {
  id: PlayerId;
  name: string;
  identity: Identity;
  connected: boolean;
  isHostPlayer: boolean; // this player also created the session
  score: number; // score within the current game
  sessionScore: number; // cumulative across all games this session
  streak: number; // generic per-game streak counter (games may use it)
  joinedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Game library metadata
// ─────────────────────────────────────────────────────────────────────────

export type GamePace = 'simultaneous' | 'turn-based' | 'real-time';

export interface GameSummary {
  id: string;
  name: string;
  tagline: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: number;
  pace: GamePace;
  teamBased: boolean;
  howToPlay: string[];
  tags: string[];
  emoji: string;
  accent: string; // theme color for the game's card / controller
  accent2: string; // secondary theme color
}

// ─────────────────────────────────────────────────────────────────────────
// Session shell (always present, regardless of game)
// ─────────────────────────────────────────────────────────────────────────

export type SessionPhase = 'lobby' | 'game' | 'results';

export interface SessionSnapshot {
  roomCode: RoomCode;
  joinUrl: string; // absolute URL encoded into the QR
  joinHost: string; // pretty host:port for typing manually
  phase: SessionPhase;
  locked: boolean; // host locked the room (HOST-03)
  hostConnected: boolean;
  players: PlayerPublic[];
  currentGameId: string | null;
  gamesPlayed: number;
  library: GameSummary[];
}

// ─────────────────────────────────────────────────────────────────────────
// View envelopes — what the server pushes to each surface
// ─────────────────────────────────────────────────────────────────────────

/** Generic, game-defined payloads. Each game ships matching renderers. */
export type ScreenGameView = { gameId: string; phase: string; [k: string]: unknown };
export type PlayerGameView = { gameId: string; phase: string; [k: string]: unknown };

export type ScreenView =
  | { kind: 'lobby' }
  | { kind: 'game'; view: ScreenGameView }
  | { kind: 'results'; view: ResultsView };

export type PlayerView =
  | { kind: 'lobby' }
  | { kind: 'game'; view: PlayerGameView }
  | { kind: 'results'; view: PlayerResultsView };

export interface ScoreLine {
  playerId: PlayerId;
  name: string;
  identity: Identity;
  score: number; // score in the game that just finished
  sessionScore: number; // cumulative
  rank: number; // 1-based, ties share a rank
}

export interface ResultsView {
  gameId: string;
  gameName: string;
  standings: ScoreLine[];
  winners: PlayerId[]; // may be >1 on a tie
  headline: string; // e.g. "Coral Fox wins!"
  canPlayAgain: boolean;
}

export interface PlayerResultsView {
  gameId: string;
  yourRank: number;
  yourScore: number;
  isWinner: boolean;
  flavor: string; // a personal line for the player's phone
}

/** The two events the server emits. Session is included in both for context. */
export interface ScreenEnvelope {
  session: SessionSnapshot;
  view: ScreenView;
}
export interface PlayerEnvelope {
  session: SessionSnapshot;
  you: PlayerPublic;
  view: PlayerView;
}

// ─────────────────────────────────────────────────────────────────────────
// Client → Server messages (Socket.IO event names + payloads)
// ─────────────────────────────────────────────────────────────────────────

export interface ClientToServer {
  // Host / screen
  'host:create': (
    cb: (res: Result<{ roomCode: RoomCode; hostToken: string }>) => void
  ) => void;
  'screen:attach': (
    p: { roomCode: RoomCode; hostToken?: string },
    cb: (res: Result<{ isHost: boolean }>) => void
  ) => void;
  'host:command': (p: HostCommand, cb?: (res: Result<unknown>) => void) => void;

  // Player
  'player:join': (
    p: { roomCode: RoomCode; name: string; avatar?: string },
    cb: (res: Result<{ playerId: PlayerId; token: string }>) => void
  ) => void;
  'player:reconnect': (
    p: { roomCode: RoomCode; token: string },
    cb: (res: Result<{ playerId: PlayerId }>) => void
  ) => void;
  'player:action': (p: GameAction, cb?: (res: Result<unknown>) => void) => void;
  'player:setIdentity': (
    p: { avatar?: string; colorIndex?: number },
    cb?: (res: Result<unknown>) => void
  ) => void;
}

export interface ServerToClient {
  'screen:update': (e: ScreenEnvelope) => void;
  'player:update': (e: PlayerEnvelope) => void;
  'toast': (t: Toast) => void;
  'kicked': (p: { reason: string }) => void;
  'session:ended': (p: { reason: string }) => void;
  'fx': (f: ScreenFx) => void; // transient screen effects (confetti, etc.)
  // High-frequency, low-overhead stream to the shared screen (e.g. live ink in
  // a drawing game). Kept off the snapshot/view path so it never bloats state.
  'gameStream': (p: GameStream) => void;
}

export interface GameStream {
  gameId: string;
  channel: string;
  [k: string]: unknown;
}

export type HostCommand =
  | { type: 'startGame'; gameId: string; settings?: Record<string, unknown> }
  | { type: 'advance' } // next stage / next question / etc.
  | { type: 'skip' } // skip current stage
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'endGame' } // end current game -> results
  | { type: 'playAgain' }
  | { type: 'backToLobby' }
  | { type: 'lockRoom'; locked: boolean }
  | { type: 'kick'; playerId: PlayerId }
  | { type: 'endSession' };

/** A game action from a phone. `type` is game-defined; payload is freeform. */
export interface GameAction {
  type: string;
  [k: string]: unknown;
}

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export type ScreenFx =
  | { type: 'confetti'; intensity?: number }
  | { type: 'shake' }
  | { type: 'flash'; color?: string };

// ─────────────────────────────────────────────────────────────────────────
// Result helper
// ─────────────────────────────────────────────────────────────────────────

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ErrorCode };

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_LOCKED'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'NAME_INVALID'
  | 'BAD_TOKEN'
  | 'NOT_HOST'
  | 'GAME_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'BAD_STATE'
  | 'RATE_LIMITED';

export const PROTOCOL_VERSION = 1;

/** The pool of avatars a player can choose on their phone (shared so the
 *  server can validate exactly what the client offers). */
export const AVATAR_POOL: string[] = [
  '🦊', '🐯', '🐥', '🐸', '🐬', '🦋', '🦄', '🐙', '🦩', '🐷', '🐢', '🐺',
  '🐼', '🐨', '🦁', '🐵', '🦉', '🦖', '🐳', '🦔', '🐝', '🦀', '🦑', '🦕',
  '👽', '🤖', '👻', '🎃', '🐲', '🌟', '🔥', '🍕', '🌮', '🎸', '🚀', '👾',
];
