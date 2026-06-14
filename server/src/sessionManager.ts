import type { Server } from 'socket.io';
import type { Result, RoomCode } from '@partyplay/shared';
import { Session } from './session.js';
import { makeRoomCode } from './util/ids.js';

const INACTIVITY_MS = 1000 * 60 * 45; // 45 min idle → reap (SES-05)
const EMPTY_GRACE_MS = 1000 * 60 * 3; // 3 min fully-empty → reap
const SWEEP_INTERVAL_MS = 1000 * 30;

/**
 * Owns all live sessions. Sessions are fully isolated from one another
 * (SES-02): nothing is shared across rooms but the io instance. Abandoned
 * rooms are swept so they don't linger (SES-05).
 */
export class SessionManager {
  private sessions = new Map<RoomCode, Session>();
  private emptySince = new Map<RoomCode, number>();

  constructor(
    private io: Server,
    private buildJoinUrl: (code: RoomCode) => { url: string; host: string }
  ) {
    setInterval(() => this.sweep(), SWEEP_INTERVAL_MS).unref?.();
  }

  create(): Session {
    let code = makeRoomCode();
    while (this.sessions.has(code)) code = makeRoomCode();
    const { url, host } = this.buildJoinUrl(code);
    const session = new Session(this.io, code, url, host);
    this.sessions.set(code, session);
    return session;
  }

  get(code: RoomCode): Session | undefined {
    const s = this.sessions.get((code ?? '').toUpperCase());
    return s && !s.isDestroyed ? s : undefined;
  }

  require(code: RoomCode): Result<Session> {
    const s = this.get(code);
    if (!s) return { ok: false, error: 'That room no longer exists.', code: 'ROOM_NOT_FOUND' };
    return { ok: true, data: s };
  }

  remove(code: RoomCode) {
    const s = this.sessions.get(code);
    s?.destroy();
    this.sessions.delete(code);
    this.emptySince.delete(code);
  }

  get count() {
    return this.sessions.size;
  }

  private sweep() {
    const now = Date.now();
    for (const [code, session] of this.sessions) {
      if (session.isDestroyed) {
        this.sessions.delete(code);
        this.emptySince.delete(code);
        continue;
      }
      if (session.isEmpty) {
        const since = this.emptySince.get(code) ?? now;
        this.emptySince.set(code, since);
        if (now - since > EMPTY_GRACE_MS) {
          session.destroy();
          this.sessions.delete(code);
          this.emptySince.delete(code);
        }
      } else {
        this.emptySince.delete(code);
      }
      if (session.idleMs > INACTIVITY_MS) {
        session.endSession('This room was inactive for too long.');
        this.sessions.delete(code);
        this.emptySince.delete(code);
      }
    }
  }
}
