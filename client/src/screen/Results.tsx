import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ResultsView, ScoreLine, ScreenEnvelope } from '@partyplay/shared';
import { Avatar } from '../components/ui';
import { fx } from '../lib/fx';
import { sound } from '../lib/sound';
import type { HostFn } from './Screen';

export function ResultsScreen({ env, host }: { env: ScreenEnvelope; host: HostFn }) {
  const view = env.view.kind === 'results' ? env.view.view : null;
  useEffect(() => {
    fx.fireworks();
    sound.win();
  }, []);
  if (!view) return null;

  const top3 = view.standings.slice(0, 3);
  const rest = view.standings.slice(3);
  const order = [1, 0, 2]; // podium visual order: 2nd, 1st, 3rd

  return (
    <div className="col grow center-all gap-lg" style={{ padding: 'clamp(16px,3vw,40px)', minHeight: 0 }}>
      <motion.div
        className="col center-all gap-xs t-center"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <div className="tag">{view.gameName} · Final results</div>
        <h1 style={{ fontSize: 'clamp(40px, 7vw, 84px)' }}>{view.headline}</h1>
      </motion.div>

      {/* Podium */}
      <div className="row gap-md center-all" style={{ alignItems: 'flex-end' }}>
        {order
          .map((i) => top3[i])
          .filter(Boolean)
          .map((line) => (
            <Podium key={line.playerId} line={line} />
          ))}
      </div>

      {/* Runners-up */}
      {rest.length > 0 && (
        <div className="card card-pad col gap-sm scroll" style={{ maxWidth: 640, width: '100%', maxHeight: '26vh' }}>
          {rest.map((line) => (
            <div key={line.playerId} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <span className="mono faint" style={{ width: 28 }}>
                  #{line.rank}
                </span>
                <Avatar identity={line.identity} size={34} />
                <span style={{ fontWeight: 600 }}>{line.name}</span>
              </div>
              <span className="mono" style={{ fontWeight: 700 }}>
                {line.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Host controls */}
      <div className="row gap-sm wrap center-all">
        <button className="btn btn-primary btn-lg" onClick={() => host({ type: 'playAgain' })}>
          🔄 Play again
        </button>
        <button className="btn btn-lg" onClick={() => host({ type: 'backToLobby' })}>
          🎮 Pick another game
        </button>
        <button className="btn btn-ghost btn-danger" onClick={() => host({ type: 'endSession' })}>
          End session
        </button>
      </div>
    </div>
  );
}

function Podium({ line }: { line: ScoreLine }) {
  const heights: Record<number, number> = { 1: 168, 2: 116, 3: 88 };
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const h = heights[line.rank] ?? 80;
  return (
    <motion.div
      className="col center-all gap-sm"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.15 * line.rank }}
      style={{ width: 150 }}
    >
      <div style={{ fontSize: 32 }}>{medals[line.rank] ?? ''}</div>
      <Avatar identity={line.identity} size={line.rank === 1 ? 88 : 64} />
      <div style={{ fontWeight: 800, fontSize: line.rank === 1 ? 22 : 18, textAlign: 'center' }} className="clip full">
        {line.name}
      </div>
      <div className="mono" style={{ fontWeight: 700, color: 'var(--brand-2)' }}>
        {line.score.toLocaleString()}
      </div>
      <div
        style={{
          width: '100%',
          height: h,
          borderRadius: '14px 14px 0 0',
          background: `linear-gradient(180deg, ${line.identity.color}cc, ${line.identity.color}44)`,
          border: '1px solid var(--border-strong)',
          borderBottom: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 10,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 28,
        }}
      >
        #{line.rank}
      </div>
    </motion.div>
  );
}
