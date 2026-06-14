import { motion } from 'framer-motion';
import type { Identity, PlayerPublic } from '@partyplay/shared';
import { Shape } from './Shape';

/** Avatar = identity shape (color + redundant geometry) with the emoji on top. */
export function Avatar({
  identity,
  size = 56,
  dim = false,
}: {
  identity: Identity;
  size?: number;
  dim?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        opacity: dim ? 0.4 : 1,
        filter: dim ? 'grayscale(0.6)' : 'none',
        transition: 'opacity .3s, filter .3s',
      }}
    >
      <Shape shape={identity.shape} color={identity.color} size={size} />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.46,
          lineHeight: 1,
          textShadow: '0 1px 3px rgba(0,0,0,0.45)',
          userSelect: 'none',
        }}
      >
        {identity.avatar}
      </span>
    </div>
  );
}

export function PlayerChip({
  player,
  size = 40,
  showScore = false,
}: {
  player: PlayerPublic;
  size?: number;
  showScore?: boolean;
}) {
  return (
    <div className="row center-all gap-sm" style={{ alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <Avatar identity={player.identity} size={size} dim={!player.connected} />
        {!player.connected && (
          <span
            title="reconnecting"
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 12,
              height: 12,
              borderRadius: 99,
              background: 'var(--warn)',
              border: '2px solid var(--bg-1)',
            }}
          />
        )}
      </div>
      <div className="col" style={{ lineHeight: 1.1 }}>
        <span style={{ fontWeight: 700, fontSize: size * 0.4 }} className="clip">
          {player.name}
        </span>
        {showScore && (
          <span className="mono faint" style={{ fontSize: size * 0.32 }}>
            {player.sessionScore + player.score} pts
          </span>
        )}
      </div>
    </div>
  );
}

/** Circular countdown. */
export function TimerRing({
  remaining,
  total,
  size = 92,
  paused = false,
}: {
  remaining: number;
  total: number;
  size?: number;
  paused?: boolean;
}) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const danger = remaining <= 5;
  const color = paused ? 'var(--text-faint)' : danger ? 'var(--bad)' : 'var(--brand-2)';
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={7} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.4s linear, stroke 0.3s' }}
        />
      </svg>
      <div
        className="center mono"
        style={{
          position: 'absolute',
          inset: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.34,
          color: danger && !paused ? 'var(--bad)' : 'var(--text)',
        }}
      >
        {paused ? '⏸' : remaining}
      </div>
    </div>
  );
}

/** Linear countdown bar. */
export function TimerBar({ remaining, total, paused = false }: { remaining: number; total: number; paused?: boolean }) {
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const danger = remaining <= 5;
  return (
    <div style={{ height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', width: '100%' }}>
      <div
        style={{
          height: '100%',
          width: `${frac * 100}%`,
          borderRadius: 99,
          background: paused
            ? 'var(--text-faint)'
            : danger
              ? 'linear-gradient(90deg, #fb7185, #f43f5e)'
              : 'linear-gradient(90deg, var(--brand), var(--brand-2))',
          transition: 'width 0.4s linear, background 0.3s',
        }}
      />
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="col center-all gap-md">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 99,
          border: '4px solid rgba(255,255,255,0.15)',
          borderTopColor: 'var(--brand-2)',
        }}
      />
      {label && <div className="muted">{label}</div>}
    </div>
  );
}

/** A waiting affordance: 3 bouncing dots. */
export function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
          style={{ width: 7, height: 7, borderRadius: 99, background: 'currentColor', display: 'inline-block' }}
        />
      ))}
    </span>
  );
}
