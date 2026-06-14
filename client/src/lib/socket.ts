import { io, type Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import type { Result } from '@partyplay/shared';

/**
 * One socket connection per tab. Socket.IO auto-reconnects transparently; on
 * each (re)connect the surface components re-assert their role using stored
 * tokens, which is what makes RES-01/03/04 feel seamless.
 */
export const socket: Socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 400,
  reconnectionDelayMax: 2500,
});

/** Promise wrapper around an acked emit. */
export function ack<T = unknown>(event: string, payload?: unknown): Promise<Result<T>> {
  return new Promise((resolve) => {
    const cb = (res: Result<T>) => resolve(res);
    if (payload === undefined) socket.emit(event, cb);
    else socket.emit(event, payload, cb);
  });
}

/** Fire-and-forget emit. */
export function send(event: string, payload?: unknown): void {
  socket.emit(event, payload);
}

/** React hook: live connection status for the "reconnecting…" UX (RES-05). */
export function useConnection(): { connected: boolean } {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    return () => {
      socket.off('connect', on);
      socket.off('disconnect', off);
    };
  }, []);
  return { connected };
}
