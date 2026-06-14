import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sound } from './lib/sound';
import { MuteButton } from './components/MuteButton';

export function Home() {
  const nav = useNavigate();
  const [code, setCode] = useState('');

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length >= 3) {
      sound.unlock();
      nav(`/j/${c}`);
    }
  };

  return (
    <div className="stage center" style={{ padding: 24 }}>
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 5 }}>
        <MuteButton />
      </div>

      <motion.div
        className="col center-all gap-lg"
        style={{ maxWidth: 920, width: '100%' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="col center-all gap-sm t-center">
          <div className="pill" style={{ marginBottom: 8 }}>
            🎉 No app · No login · Just play
          </div>
          <h1 style={{ fontSize: 'clamp(48px, 9vw, 104px)', lineHeight: 0.95 }}>
            Party{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, var(--brand), var(--brand-2))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Play
            </span>
          </h1>
          <p className="muted" style={{ fontSize: 'clamp(16px, 2.4vw, 22px)', maxWidth: 560 }}>
            The big screen is the game. Your phone is the controller. Get everyone playing in under a minute.
          </p>
        </div>

        <div className="row wrap gap-md center-all" style={{ width: '100%' }}>
          {/* Host */}
          <motion.button
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.98 }}
            className="card card-pad col gap-sm"
            onClick={() => {
              sound.unlock();
              nav('/screen');
            }}
            style={{
              flex: '1 1 320px',
              minHeight: 260,
              textAlign: 'left',
              cursor: 'pointer',
              border: '1px solid var(--border-strong)',
              background: 'linear-gradient(160deg, rgba(124,92,255,0.22), rgba(255,107,214,0.08))',
            }}
          >
            <div style={{ fontSize: 52 }}>📺</div>
            <h2 style={{ fontSize: 30 }}>Host a party</h2>
            <p className="muted" style={{ flex: 1 }}>
              Open this on the TV or a laptop. A room code and QR appear instantly — players join with their phones.
            </p>
            <span className="btn btn-primary btn-lg btn-block">Start a session →</span>
          </motion.button>

          {/* Join */}
          <div
            className="card card-pad col gap-sm"
            style={{ flex: '1 1 320px', minHeight: 260, textAlign: 'left' }}
          >
            <div style={{ fontSize: 52 }}>📱</div>
            <h2 style={{ fontSize: 30 }}>Join a game</h2>
            <p className="muted" style={{ flex: 1 }}>
              Already see a room code on a screen? Punch it in here, or just scan the QR with your camera.
            </p>
            <div className="row gap-sm">
              <input
                className="input"
                placeholder="CODE"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && join()}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700, textAlign: 'center' }}
              />
              <button className="btn btn-lg" onClick={join} disabled={code.trim().length < 3}>
                Go
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
