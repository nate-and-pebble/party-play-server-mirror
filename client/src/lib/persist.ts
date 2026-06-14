/** Tiny localStorage layer. The ONLY thing we persist is what's needed to
 *  resume a seat on reload (RES). No accounts, no profiles (PRIV-01/04). */

interface HostSession {
  roomCode: string;
  hostToken: string;
}
interface PlayerSeat {
  playerId: string;
  token: string;
  name: string;
  avatar?: string;
}

const HOST_KEY = 'pp.host';
const playerKey = (room: string) => `pp.seat.${room.toUpperCase()}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — fine to ignore */
  }
}

export const hostStore = {
  get: () => read<HostSession>(HOST_KEY),
  set: (s: HostSession) => write(HOST_KEY, s),
  clear: () => localStorage.removeItem(HOST_KEY),
};

export const seatStore = {
  get: (room: string) => read<PlayerSeat>(playerKey(room)),
  set: (room: string, s: PlayerSeat) => write(playerKey(room), s),
  clear: (room: string) => localStorage.removeItem(playerKey(room)),
};

const MUTE_KEY = 'pp.muted';
export const muteStore = {
  get: () => read<boolean>(MUTE_KEY) ?? false,
  set: (v: boolean) => write(MUTE_KEY, v),
};
