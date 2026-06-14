import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { PlayerEnvelope } from '@partyplay/shared';
import { Avatar } from '../components/ui';
import { fx } from '../lib/fx';
import { sound } from '../lib/sound';
import { YouBar } from './YouBar';

export function ControllerResults({ env }: { env: PlayerEnvelope }) {
  const view = env.view.kind === 'results' ? env.view.view : null;
  useEffect(() => {
    if (view?.isWinner) {
      fx.burst(1);
      sound.win();
    }
  }, [view?.isWinner]);
  if (!view) return null;

  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <YouBar you={env.you} accent={env.you.identity.color} />
      <div className="col grow center-all gap-md" style={{ padding: 24, textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 16 }}
          className="col center-all gap-sm"
        >
          <Avatar identity={env.you.identity} size={104} />
          <div style={{ fontSize: 64 }}>{view.isWinner ? '👑' : medalFor(view.yourRank)}</div>
          <h1 style={{ fontSize: 34 }}>{view.flavor}</h1>
          <div className="row gap-sm">
            <span className="pill">Rank #{view.yourRank}</span>
            <span className="pill mono">{view.yourScore.toLocaleString()} pts</span>
          </div>
        </motion.div>
        <p className="faint">Results are on the big screen 👆</p>
      </div>
    </div>
  );
}

function medalFor(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '🎯';
}
