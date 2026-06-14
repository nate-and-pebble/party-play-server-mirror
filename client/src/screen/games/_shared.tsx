import { motion } from 'framer-motion';
import { TimerRing } from '../../components/ui';

/** The countdown + how-to-play card shown at the start of every game. */
export function IntroCard({
  emoji,
  name,
  tagline,
  howToPlay,
  countdown,
  accent,
  accent2,
}: {
  emoji: string;
  name: string;
  tagline: string;
  howToPlay: string[];
  countdown: number;
  accent: string;
  accent2: string;
}) {
  return (
    <div className="col grow center-all gap-lg" style={{ padding: 40 }}>
      <motion.div
        className="col center-all gap-sm t-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      >
        <div style={{ fontSize: 96 }}>{emoji}</div>
        <h1
          style={{
            fontSize: 'clamp(48px, 8vw, 96px)',
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {name}
        </h1>
        <p className="muted" style={{ fontSize: 22 }}>
          {tagline}
        </p>
      </motion.div>

      <div className="card card-pad col gap-md" style={{ maxWidth: 620, width: '100%' }}>
        <div className="tag">How to play</div>
        {howToPlay.map((line, i) => (
          <motion.div
            key={i}
            className="row gap-sm"
            style={{ alignItems: 'center' }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 * i }}
          >
            <span
              className="center"
              style={{
                width: 30,
                height: 30,
                borderRadius: 99,
                background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                fontWeight: 800,
                flex: '0 0 auto',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 18 }}>{line}</span>
          </motion.div>
        ))}
      </div>

      <div className="row gap-sm center-all">
        <TimerRing remaining={countdown} total={Math.max(countdown, 6)} size={72} />
        <span className="muted">Starting…</span>
      </div>
    </div>
  );
}

/** A consistent in-game top strip: title on the left, round + timer on the right. */
export function GameHeader({
  title,
  sub,
  remaining,
  total,
  paused,
}: {
  title: string;
  sub?: string;
  remaining?: number;
  total?: number;
  paused?: boolean;
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '18px 28px' }}>
      <div className="col">
        <h2 style={{ fontSize: 30 }}>{title}</h2>
        {sub && <span className="faint">{sub}</span>}
      </div>
      {remaining != null && total != null && (
        <TimerRing remaining={remaining} total={total} size={84} paused={paused} />
      )}
    </div>
  );
}
