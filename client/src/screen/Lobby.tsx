import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import type { GameSummary, PlayerPublic, ScreenEnvelope } from '@partyplay/shared';
import { Avatar } from '../components/ui';
import { MuteButton } from '../components/MuteButton';
import { sound } from '../lib/sound';
import type { HostFn } from './Screen';

export function LobbyScreen({ env, host }: { env: ScreenEnvelope; host: HostFn }) {
  const { session } = env;
  const players = session.players;
  const prevCount = useRef(players.length);

  useEffect(() => {
    if (players.length > prevCount.current) sound.join();
    prevCount.current = players.length;
  }, [players.length]);

  return (
    <div className="col grow" style={{ minHeight: 0, padding: 'clamp(16px, 2.5vw, 36px)' }}>
      {/* Top bar */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 30 }}>🎉</span>
          <h2 style={{ fontSize: 26 }}>Party Play</h2>
        </div>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <span className="pill">👥 {players.length} joined</span>
          {session.gamesPlayed > 0 && <span className="pill">🎮 {session.gamesPlayed} played</span>}
          <button
            className="btn btn-ghost"
            style={{ padding: '8px 14px' }}
            onClick={() => host({ type: 'lockRoom', locked: !session.locked })}
          >
            {session.locked ? '🔒 Locked' : '🔓 Open'}
          </button>
          <MuteButton />
        </div>
      </div>

      <div className="row gap-lg grow wrap" style={{ minHeight: 0 }}>
        {/* JOIN panel */}
        <motion.div
          className="card card-pad col center-all gap-md"
          style={{ flex: '1 1 360px', maxWidth: 460, justifyContent: 'center' }}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="tag">Scan to join · no app needed</div>
          <div style={{ background: '#fff', padding: 16, borderRadius: 20, boxShadow: 'var(--shadow-pop)' }}>
            <QRCodeSVG value={session.joinUrl} size={216} level="M" bgColor="#ffffff" fgColor="#0b0b1a" />
          </div>
          <div className="col center-all" style={{ gap: 2 }}>
            <div className="faint" style={{ fontSize: 14 }}>
              or go to <b style={{ color: 'var(--text-dim)' }}>{session.joinHost}</b> and enter
            </div>
            <div className="roomcode" style={{ fontSize: 'clamp(56px, 8vw, 92px)' }}>
              {session.roomCode}
            </div>
          </div>
        </motion.div>

        {/* Players + Library */}
        <div className="col grow gap-md" style={{ flex: '2 1 520px', minHeight: 0 }}>
          {/* Players */}
          <div className="card card-pad" style={{ flex: '0 0 auto' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h3 style={{ fontSize: 20 }}>Players</h3>
              {players.length === 0 && <span className="faint">Waiting for the squad…</span>}
            </div>
            <div className="row wrap gap-md">
              <AnimatePresence>
                {players.map((p) => (
                  <PlayerCard key={p.id} player={p} onKick={() => host({ type: 'kick', playerId: p.id })} />
                ))}
              </AnimatePresence>
              {players.length === 0 && <EmptySeats />}
            </div>
          </div>

          {/* Library */}
          <div className="card card-pad col grow scroll" style={{ minHeight: 0 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h3 style={{ fontSize: 20 }}>Pick a game</h3>
              <span className="faint" style={{ fontSize: 13 }}>
                Host taps to start
              </span>
            </div>
            <div className="row wrap gap-md">
              {session.library.map((g) => (
                <GameCard key={g.id} game={g} playerCount={players.length} onStart={() => host({ type: 'startGame', gameId: g.id })} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ player, onKick }: { player: PlayerPublic; onKick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      layout
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="col center-all"
      style={{ width: 96, position: 'relative', gap: 6 }}
    >
      <Avatar identity={player.identity} size={68} dim={!player.connected} />
      <span style={{ fontWeight: 700, fontSize: 14, textAlign: 'center' }} className="clip full nowrap">
        {player.name}
      </span>
      {hover && (
        <button
          onClick={onKick}
          title="Remove player"
          style={{
            position: 'absolute',
            top: -6,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: 99,
            border: 'none',
            background: 'var(--bad)',
            color: '#fff',
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </motion.div>
  );
}

function EmptySeats() {
  return (
    <div className="row gap-md">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="center"
          style={{
            width: 68,
            height: 68,
            borderRadius: 99,
            border: '2px dashed var(--border-strong)',
            opacity: 0.4 - i * 0.08,
            fontSize: 28,
          }}
        >
          👤
        </div>
      ))}
    </div>
  );
}

function GameCard({
  game,
  playerCount,
  onStart,
}: {
  game: GameSummary;
  playerCount: number;
  onStart: () => void;
}) {
  const enough = playerCount >= game.minPlayers;
  return (
    <motion.button
      whileHover={enough ? { y: -5 } : {}}
      whileTap={enough ? { scale: 0.98 } : {}}
      onClick={() => enough && onStart()}
      disabled={!enough}
      className="card-pad col gap-sm"
      style={{
        flex: '1 1 240px',
        minWidth: 240,
        textAlign: 'left',
        borderRadius: 'var(--r-lg)',
        border: `1px solid ${enough ? 'var(--border-strong)' : 'var(--border)'}`,
        background: `linear-gradient(160deg, ${game.accent}33, ${game.accent2}1a)`,
        opacity: enough ? 1 : 0.55,
        cursor: enough ? 'pointer' : 'not-allowed',
        color: 'var(--text)',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 40 }}>{game.emoji}</span>
        <span className="pill" style={{ fontSize: 12, padding: '4px 10px' }}>
          {game.minPlayers}–{game.maxPlayers} · {game.estimatedMinutes}m
        </span>
      </div>
      <div>
        <h3 style={{ fontSize: 22 }}>{game.name}</h3>
        <div className="muted" style={{ fontSize: 14 }}>
          {game.tagline}
        </div>
      </div>
      <div className="row gap-xs wrap">
        {game.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <div
        className="row center-all"
        style={{
          marginTop: 4,
          fontWeight: 700,
          fontSize: 15,
          color: enough ? 'var(--text)' : 'var(--text-faint)',
        }}
      >
        {enough ? '▶ Start' : `Need ${game.minPlayers - playerCount} more`}
      </div>
    </motion.button>
  );
}
