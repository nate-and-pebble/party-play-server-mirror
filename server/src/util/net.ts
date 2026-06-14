import { networkInterfaces } from 'node:os';

/**
 * Best-effort detection of the machine's LAN IPv4 address so the QR code can
 * point phones at the host over the local network (the QR must NOT say
 * "localhost"). Prefers private ranges; falls back to the first external IPv4.
 * Override with the PUBLIC_HOST env var when behind NAT/tunnels.
 */
export function detectLanHost(): string {
  if (process.env.PUBLIC_HOST) return process.env.PUBLIC_HOST;

  const ifaces = networkInterfaces();
  const candidates: string[] = [];
  for (const addrs of Object.values(ifaces)) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push(a.address);
    }
  }
  const isPrivate = (ip: string) =>
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

  return candidates.find(isPrivate) ?? candidates[0] ?? 'localhost';
}
