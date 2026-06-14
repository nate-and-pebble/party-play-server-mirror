import { AnimatePresence, motion } from 'framer-motion';
import type { ScreenEnvelope, ShapeKey } from '@partyplay/shared';
import { Shape } from '../../components/Shape';
import { Avatar } from '../../components/ui';
import { GameHeader, IntroCard } from './_shared';

export function TriviaScreen({ view }: { view: any; env: ScreenEnvelope }) {
  if (view.phase === 'intro') {
    return (
      <IntroCard
        emoji="⚡"
        name="Trivia Rush"
        tagline={`${view.questionCount} questions · know it fast`}
        howToPlay={view.howToPlay ?? []}
        countdown={view.countdown}
        accent="#2EC4B6"
        accent2="#FFB23E"
      />
    );
  }

  const reveal = view.phase === 'reveal';
  if (view.phase !== 'question' && !reveal) return null;

  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <GameHeader
        title={view.category}
        sub={`Question ${view.index + 1} of ${view.total}`}
        remaining={reveal ? undefined : view.remaining}
        total={reveal ? undefined : view.totalTime}
        paused={view.paused}
      />

      <div className="col grow gap-md" style={{ padding: '0 28px 24px', minHeight: 0 }}>
        <motion.div
          key={view.index}
          className="card card-pad t-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 style={{ fontSize: 'clamp(26px,3.6vw,48px)' }}>{view.question}</h1>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          {view.options.map((opt: any, i: number) => {
            const isCorrect = reveal && opt.isCorrect;
            const dim = reveal && !opt.isCorrect;
            return (
              <motion.div
                key={opt.key}
                className="card card-pad row gap-md"
                style={{
                  alignItems: 'center',
                  border: isCorrect ? `3px solid var(--good)` : '1px solid var(--border-strong)',
                  background: isCorrect ? 'rgba(52,211,153,0.18)' : `${opt.color}1f`,
                  opacity: dim ? 0.4 : 1,
                  boxShadow: isCorrect ? '0 0 50px rgba(52,211,153,0.4)' : 'var(--shadow-soft)',
                  transition: 'opacity .4s, border .3s',
                  position: 'relative',
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: dim ? 0.4 : 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
              >
                <Shape shape={opt.shape as ShapeKey} color={opt.color} size={56} />
                <span style={{ fontSize: 'clamp(18px,2.2vw,30px)', fontWeight: 600, flex: 1 }}>{opt.text}</span>
                {isCorrect && <span style={{ fontSize: 34 }}>✓</span>}
                {reveal && (
                  <span className="pill mono" style={{ position: 'absolute', top: 10, right: 10 }}>
                    {opt.count}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer: progress while answering, leaderboard on reveal */}
        {reveal ? (
          <div className="card card-pad row gap-md scroll" style={{ alignItems: 'center', maxHeight: 120 }}>
            <span className="tag" style={{ flex: '0 0 auto' }}>
              Leaders
            </span>
            <AnimatePresence>
              {view.leaderboard.slice(0, 6).map((l: any) => (
                <motion.div
                  key={l.id}
                  layout
                  className="row gap-sm"
                  style={{ alignItems: 'center', flex: '0 0 auto' }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <span className="mono faint">#{l.rank}</span>
                  <Avatar identity={l.identity} size={32} />
                  <div className="col" style={{ lineHeight: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</span>
                    <span className="mono faint" style={{ fontSize: 12 }}>
                      {l.score.toLocaleString()}
                      {l.streak >= 2 ? ` · 🔥${l.streak}` : ''}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'linear-gradient(90deg,var(--brand-3),var(--warn))', borderRadius: 99 }}
                animate={{ width: `${view.playersTotal ? (view.answeredCount / view.playersTotal) * 100 : 0}%` }}
              />
            </div>
            <span className="muted mono">
              {view.answeredCount}/{view.playersTotal} answered
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
