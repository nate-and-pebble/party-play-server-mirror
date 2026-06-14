import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { PlayerEnvelope } from '@partyplay/shared';
import { ack, socket, useConnection } from '../lib/socket';
import { seatStore } from '../lib/persist';
import { sound } from '../lib/sound';
import { Spinner } from '../components/ui';
import { Join } from './Join';
import { ControllerLobby } from './Lobby';
import { ControllerResults } from './Results';
import { GameController } from './GameController';

type Step = 'connecting' | 'join' | 'playing';

export function Controller() {
  const params = useParams();
  const nav = useNavigate();
  const code = (params.code ?? '').toUpperCase();
  const { connected } = useConnection();

  const [step, setStep] = useState<Step>('connecting');
  const [env, setEnv] = useState<PlayerEnvelope | null>(null);
  const [fatal, setFatal] = useState<{ title: string; msg: string } | null>(null);
  const joinedRef = useRef(false);

  // No code? Send them to a quick entry.
  useEffect(() => {
    if (!code) nav('/', { replace: true });
  }, [code, nav]);

  // Try to reconnect to an existing seat; re-run on every (re)connect.
  useEffect(() => {
    if (!code) return;
    async function ensure() {
      const seat = seatStore.get(code);
      if (seat) {
        const res = await ack<{ playerId: string }>('player:reconnect', { roomCode: code, token: seat.token });
        if (res.ok) {
          joinedRef.current = true;
          setStep('playing');
          return;
        }
        if (res.code === 'ROOM_NOT_FOUND') {
          setFatal({ title: 'Room not found', msg: 'That game has ended or the code is wrong.' });
          return;
        }
        seatStore.clear(code); // stale token — re-join fresh
      }
      if (!joinedRef.current) setStep('join');
    }
    if (socket.connected) ensure();
    socket.on('connect', ensure);
    return () => {
      socket.off('connect', ensure);
    };
  }, [code]);

  // Live state + lifecycle events.
  useEffect(() => {
    const onUpdate = (e: PlayerEnvelope) => setEnv(e);
    const onKicked = (p: { reason: string }) => {
      seatStore.clear(code);
      setFatal({ title: 'Removed', msg: p.reason });
    };
    const onEnded = (p: { reason: string }) => {
      seatStore.clear(code);
      setFatal({ title: 'Session ended', msg: p.reason });
    };
    socket.on('player:update', onUpdate);
    socket.on('kicked', onKicked);
    socket.on('session:ended', onEnded);
    return () => {
      socket.off('player:update', onUpdate);
      socket.off('kicked', onKicked);
      socket.off('session:ended', onEnded);
    };
  }, [code]);

  if (fatal) {
    return (
      <div className="stage center" style={{ padding: 24 }}>
        <div className="card card-pad col center-all gap-md t-center" style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 56 }}>🫥</div>
          <h1 style={{ fontSize: 30 }}>{fatal.title}</h1>
          <p className="muted">{fatal.msg}</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => nav('/')}>
            Back home
          </button>
        </div>
      </div>
    );
  }

  if (step === 'connecting') {
    return (
      <div className="stage center">
        <Spinner label="Connecting…" />
      </div>
    );
  }

  if (step === 'join') {
    return (
      <Join
        code={code}
        onJoined={(seat) => {
          seatStore.set(code, seat);
          joinedRef.current = true;
          sound.join();
          setStep('playing');
        }}
        onFatal={setFatal}
      />
    );
  }

  // Playing
  return (
    <div className="stage" onPointerDown={() => sound.unlock()}>
      {!env ? (
        <div className="grow center">
          <Spinner label="Joining…" />
        </div>
      ) : (
        <ControllerBody env={env} />
      )}
      {!connected && <div className="conn-banner">Reconnecting…</div>}
    </div>
  );
}

function ControllerBody({ env }: { env: PlayerEnvelope }) {
  return (
    <motion.div className="grow" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {env.view.kind === 'lobby' && <ControllerLobby env={env} />}
      {env.view.kind === 'game' && <GameController env={env} />}
      {env.view.kind === 'results' && <ControllerResults env={env} />}
    </motion.div>
  );
}
