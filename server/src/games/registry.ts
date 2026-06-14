import type { GameSummary } from '@partyplay/shared';
import type { GameModule } from './engine.js';
import { quibbleModule } from './quibble.js';
import { triviaModule } from './trivia.js';
import { doodleModule } from './doodle.js';

/**
 * The game library. Adding a game is a one-line registration here plus one
 * server module and one client renderer — the join/lobby/identity/scoring
 * machinery is untouched (LIB-03).
 */
const MODULES: GameModule[] = [quibbleModule, triviaModule, doodleModule];

const BY_ID = new Map<string, GameModule>(MODULES.map((m) => [m.summary.id, m]));

export function getGame(id: string): GameModule | undefined {
  return BY_ID.get(id);
}

export function getLibrary(): GameSummary[] {
  return MODULES.map((m) => m.summary);
}
