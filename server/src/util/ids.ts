import { randomBytes, randomInt } from 'node:crypto';

/** Human-friendly room-code alphabet: no 0/O/1/I/L to avoid mis-reads. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A short, shoutable room code. Not enumerable enough to crash others' games
 *  in practice (~30^4 ≈ 810k), and collisions are checked by the manager. */
export function makeRoomCode(length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** An unguessable bearer token used to prove identity across reconnects. */
export function makeToken(): string {
  return randomBytes(24).toString('hex');
}

/** A short opaque id for players, rounds, prompts, etc. */
export function makeId(prefix = ''): string {
  return prefix + randomBytes(6).toString('hex');
}
