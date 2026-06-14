import { motion } from 'framer-motion';
import type { PlayerEnvelope, ShapeKey } from '@partyplay/shared';
import { send } from '../../lib/socket';
import { sound } from '../../lib/sound';
import { Shape } from '../../components/Shape';
import { TimerBar } from '../../components/ui';

export function TriviaController({ view }: { view: any; env: PlayerEnvelope }) {
  if (view.phase === 'intro') {
    return (
      <div className="col grow center-all gap-sm" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}>⚡</div>
        <h2 style={{ fontSize: 26 }}>Trivia Rush</h2>
        <p className="muted">Watch the screen. Tap fast!</p>
      </div>
    );
  }

  if (view.phase === 'question') {
    const answer = (index: number) => {
      if (view.locked) return;
      send('player:action', { type: 'answer', index });
      sound.tap();
    };
    return (
      <div className="col grow" style={{ minHeight: 0 }}>
        <div className="col gap-xs" style={{ padding: '10px 16px 0' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="faint">
              Q{view.index + 1}/{view.total}
            </span>
            <span className="faint">{view.locked ? 'Locked 🔒' : 'Pick a shape'}</span>
          </div>
          <TimerBar remaining={view.remaining} total={20} />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            padding: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          {view.options.map((opt: any) => {
            const chosen = view.yourAnswer === opt.key;
            const faded = view.locked && !chosen;
            return (
              <motion.button
                key={opt.key}
                whileTap={{ scale: 0.94 }}
                onClick={() => answer(opt.key)}
                disabled={view.locked}
                className="card center"
                style={{
                  border: chosen ? '4px solid #fff' : '1px solid var(--border-strong)',
                  background: `${opt.color}30`,
                  opacity: faded ? 0.35 : 1,
                  transition: 'opacity .3s',
                  flexDirection: 'column',
                }}
              >
                <Shape shape={opt.shape as ShapeKey} color={opt.color} size={72} />
              </motion.button>
            );
          })}
        </div>
        {view.locked && (
          <div className="t-center muted" style={{ paddingBottom: 16 }}>
            Answer locked — waiting for the reveal…
          </div>
        )}
      </div>
    );
  }

  if (view.phase === 'reveal') {
    const correct = view.correct;
    const bg = correct === null ? 'var(--surface)' : correct ? 'rgba(52,211,153,0.22)' : 'rgba(251,113,133,0.18)';
    return (
      <motion.div
        key="reveal"
        className="col grow center-all gap-md"
        style={{ padding: 24, textAlign: 'center', background: bg }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 84 }}>
          {correct === null ? '⌛' : correct ? '✅' : '❌'}
        </motion.div>
        <h1 style={{ fontSize: 34 }}>
          {correct === null ? 'No answer' : correct ? 'Correct!' : 'Not quite'}
        </h1>
        {view.gained > 0 && (
          <motion.div className="pill mono" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ fontSize: 20 }}>
            +{view.gained.toLocaleString()} pts
          </motion.div>
        )}
        {view.streak >= 2 && <div style={{ fontSize: 18 }}>🔥 {view.streak} in a row!</div>}
      </motion.div>
    );
  }

  return null;
}
