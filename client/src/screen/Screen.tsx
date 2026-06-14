import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { HostCommand, ScreenEnvelope, ScreenFx } from '@partyplay/shared';
import { ack, socket, useConnection } from '../lib/socket';
import { hostStore } from '../lib/persist';
import { fx as confettiFx } from '../lib/fx';
import { sound } from '../lib/sound';
import { Spinner } from '../components/ui';
import { LobbyScreen } from './Lobby';
import { GameScreen } from './GameScreen';
import { ResultsScreen } from './Results';

export type HostFn = (cmd: HostCommand) => void;

export function Screen() {
  const nav = useNavigate();
  const { connected } = useConnection();
  const [env, setEnv] = useState<ScreenEnvelope | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(false);
  const prevPhase = useRef<string>('');

  const host: HostFn = (cmd) => {
    ack('host:command', cmd);
  };

  // Ensure we own a session; re-assert on every (re)connect (RES-04).
  useEffect(() => {
    let cancelled = false;
    async function ensure() {
      const stored = hostStore.get();
      if (stored) {
        const res = await ack<{ isHost: boolean }>('screen:attach', {
          roomCode: stored.roomCode,
          hostToken: stored.hostToken,
        });
        if (res.ok) return;
        hostStore.clear();
      }
      const res = await ack<{ roomCode: string; hostToken: string }>('host:create');
      if (res.ok && !cancelled) hostStore.set({ roomCode: res.data.roomCode, hostToken: res.data.hostToken });
    }
    if (socket.connected) ensure();
    socket.on('connect', ensure);
    return () => {
      cancelled = true;
      socket.off('connect', ensure);
    };
  }, []);

  // State + effects from the server.
  useEffect(() => {
    const onUpdate = (e: ScreenEnvelope) => setEnv(e);
    const onFx = (f: ScreenFx) => {
      if (f.type === 'confetti') confettiFx.burst(f.intensity ?? 1);
      else if (f.type === 'flash') {
        setFlash(true);
        setTimeout(() => setFlash(false), 220);
      } else if (f.type === 'shake') {
        setShake(true);
        setTimeout(() => setShake(false), 420);
      }
    };
    const onEnded = (p: { reason: string }) => {
      hostStore.clear();
      setEnded(p.reason);
    };
    socket.on('screen:update', onUpdate);
    socket.on('fx', onFx);
    socket.on('session:ended', onEnded);
    return () => {
      socket.off('screen:update', onUpdate);
      socket.off('fx', onFx);
      socket.off('session:ended', onEnded);
    };
  }, []);

  // Sound cues on phase changes.
  useEffect(() => {
    if (!env) return;
    const phase = env.view.kind === 'game' ? `game:${(env.view.view as any).phase}` : env.view.kind;
    if (phase !== prevPhase.current) {
      if (env.view.kind === 'results') sound.win();
      else if (prevPhase.current.startsWith('lobby') && env.view.kind === 'game') sound.start();
      prevPhase.current = phase;
    }
  }, [env]);

  // Host keyboard shortcuts (it's a laptop/desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!env) return;
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.key === 'n') {
        e.preventDefault();
        host({ type: 'advance' });
      } else if (e.key === 'p') host({ type: 'pause' });
      else if (e.key === 'r') host({ type: 'resume' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [env]);

  if (ended) {
    return (
      <div className="stage center">
        <div className="card card-pad col center-all gap-md t-center" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 64 }}>👋</div>
          <h1 style={{ fontSize: 36 }}>Session ended</h1>
          <p className="muted">{ended}</p>
          <button className="btn btn-primary btn-lg" onClick={() => nav('/')}>
            Back home
          </button>
        </div>
      </div>
    );
  }

  if (!env) {
    return (
      <div className="stage center">
        <Spinner label="Setting up your room…" />
      </div>
    );
  }

  return (
    <motion.div
      className="stage"
      animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.42 }}
    >
      {flash && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.5)', zIndex: 80, pointerEvents: 'none' }}
        />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={env.view.kind}
          className="grow"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.3 }}
        >
          {env.view.kind === 'lobby' && <LobbyScreen env={env} host={host} />}
          {env.view.kind === 'game' && <GameScreen env={env} host={host} />}
          {env.view.kind === 'results' && <ResultsScreen env={env} host={host} />}
        </motion.div>
      </AnimatePresence>

      {!connected && <div className="conn-banner">Reconnecting…</div>}
    </motion.div>
  );
}
