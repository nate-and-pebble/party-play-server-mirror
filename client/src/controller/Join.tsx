import { useState } from 'react';
import { motion } from 'framer-motion';
import { AVATAR_POOL } from '@partyplay/shared';
import { ack } from '../lib/socket';
import { sound } from '../lib/sound';

interface Seat {
  playerId: string;
  token: string;
  name: string;
  avatar?: string;
}

export function Join({
  code,
  onJoined,
  onFatal,
}: {
  code: string;
  onJoined: (seat: Seat) => void;
  onFatal: (f: { title: string; msg: string }) => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_POOL[Math.floor(Math.random() * 12)]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (name.trim().length < 1 || busy) return;
    setBusy(true);
    setError(null);
    sound.unlock();
    const res = await ack<{ playerId: string; token: string }>('player:join', {
      roomCode: code,
      name: name.trim(),
      avatar,
    });
    setBusy(false);
    if (res.ok) {
      onJoined({ playerId: res.data.playerId, token: res.data.token, name: name.trim(), avatar });
    } else if (res.code === 'ROOM_NOT_FOUND') {
      onFatal({ title: 'Room not found', msg: "We couldn't find a game with that code." });
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="stage" style={{ padding: 20 }} onPointerDown={() => sound.unlock()}>
      <div className="col grow gap-md" style={{ justifyContent: 'center', maxWidth: 460, margin: '0 auto', width: '100%' }}>
        <div className="col center-all gap-xs t-center">
          <div className="tag">Joining room</div>
          <div className="roomcode" style={{ fontSize: 44, letterSpacing: '0.2em' }}>
            {code}
          </div>
        </div>

        <motion.div className="card card-pad col gap-md" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="col center-all gap-sm">
            <div
              className="center"
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                fontSize: 56,
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
              }}
            >
              {avatar}
            </div>
            <span className="faint" style={{ fontSize: 13 }}>
              Pick your look
            </span>
          </div>

          <div
            className="scroll"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 8,
              maxHeight: 168,
              paddingRight: 4,
            }}
          >
            {AVATAR_POOL.map((a) => (
              <button
                key={a}
                onClick={() => {
                  setAvatar(a);
                  sound.tap();
                }}
                style={{
                  fontSize: 26,
                  aspectRatio: '1',
                  borderRadius: 14,
                  border: `2px solid ${a === avatar ? 'var(--brand-2)' : 'var(--border)'}`,
                  background: a === avatar ? 'rgba(255,107,214,0.18)' : 'var(--surface)',
                }}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="col gap-sm">
            <input
              className="input"
              placeholder="Your name"
              value={name}
              maxLength={16}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            {error && (
              <div style={{ color: 'var(--bad)', fontWeight: 600, fontSize: 14 }}>{error}</div>
            )}
            <button className="btn btn-primary btn-lg btn-block" onClick={join} disabled={name.trim().length < 1 || busy}>
              {busy ? 'Joining…' : "Let's play →"}
            </button>
          </div>
        </motion.div>

        <p className="faint t-center" style={{ fontSize: 12 }}>
          No account needed. We only keep your name for this session.
        </p>
      </div>
    </div>
  );
}
