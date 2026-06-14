import { AnimatePresence, motion } from 'framer-motion';
import type { Identity, ScreenEnvelope } from '@partyplay/shared';
import { Avatar } from '../../components/ui';
import { GameHeader, IntroCard } from './_shared';

const ACCENT = '#7C5CFF';
const ACCENT2 = '#FF6BD6';
type Chip = { id: string; name: string; identity: Identity };

export function QuibbleScreen({ view }: { view: any; env: ScreenEnvelope }) {
  if (view.phase === 'intro') {
    return (
      <IntroCard
        emoji="✍️"
        name="Quibble"
        tagline="Write the funniest answer. Win the room."
        howToPlay={view.howToPlay ?? []}
        countdown={view.countdown}
        accent={ACCENT}
        accent2={ACCENT2}
      />
    );
  }

  if (view.phase === 'answer') {
    return (
      <div className="col grow" style={{ minHeight: 0 }}>
        <GameHeader title="Quibble" sub="Round 1 · Writing" remaining={view.remaining} total={view.total} paused={view.paused} />
        <div className="col grow center-all gap-lg" style={{ padding: 28 }}>
          <motion.h1
            style={{ fontSize: 'clamp(36px,5vw,64px)', textAlign: 'center' }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            Answer on your phones! 📱
          </motion.h1>
          <p className="muted" style={{ fontSize: 22 }}>
            {view.submitted} of {view.needed} players locked in
          </p>
          <div className="row wrap gap-lg center-all" style={{ maxWidth: 1100 }}>
            {view.players.map((p: any) => (
              <motion.div key={p.id} className="col center-all" style={{ width: 120, gap: 6 }} layout>
                <div style={{ position: 'relative' }}>
                  <Avatar identity={p.identity} size={84} dim={!p.done} />
                  {p.done && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        fontSize: 26,
                      }}
                    >
                      ✅
                    </motion.div>
                  )}
                </div>
                <span style={{ fontWeight: 700, fontSize: 16 }} className="clip full nowrap">
                  {p.name}
                </span>
                <span className="faint" style={{ fontSize: 12 }}>
                  {p.done ? 'Ready!' : 'Writing…'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view.phase === 'vote' || view.phase === 'reveal') {
    const reveal = view.phase === 'reveal';
    const maxPts = Math.max(view.options?.[0]?.points ?? 0, view.options?.[1]?.points ?? 0, 1);
    return (
      <div className="col grow" style={{ minHeight: 0 }}>
        <GameHeader
          title={reveal ? 'The votes are in…' : 'Vote for your favorite!'}
          sub={`Matchup ${view.matchIndex + 1} of ${view.matchCount}`}
          remaining={reveal ? undefined : view.remaining}
          total={reveal ? undefined : view.total}
          paused={view.paused}
        />
        <div className="col grow center-all gap-lg" style={{ padding: '0 28px 28px' }}>
          <div className="card card-pad t-center" style={{ maxWidth: 900 }}>
            <div className="tag">The prompt</div>
            <h2 style={{ fontSize: 'clamp(24px,3.4vw,40px)', marginTop: 6 }}>{view.prompt}</h2>
          </div>

          <div className="row gap-lg center-all wrap" style={{ width: '100%', maxWidth: 1100 }}>
            {view.options.map((opt: any, i: number) => {
              const winning = reveal && opt.points === maxPts && opt.points > 0;
              return (
                <motion.div
                  key={opt.key}
                  className="card card-pad col gap-md"
                  style={{
                    flex: '1 1 380px',
                    minWidth: 320,
                    border: winning ? `2px solid ${ACCENT2}` : '1px solid var(--border-strong)',
                    boxShadow: winning ? '0 0 50px rgba(255,107,214,0.35)' : 'var(--shadow-soft)',
                    position: 'relative',
                  }}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0, scale: winning ? 1.02 : 1 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      className="center"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: i === 0 ? `${ACCENT}55` : `${ACCENT2}55`,
                        fontWeight: 800,
                        fontSize: 20,
                      }}
                    >
                      {opt.key}
                    </span>
                    {reveal && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="pill mono"
                        style={{ fontSize: 18, fontWeight: 800, color: winning ? ACCENT2 : 'var(--text)' }}
                      >
                        +{opt.points}
                      </motion.span>
                    )}
                  </div>
                  <div style={{ fontSize: 'clamp(20px,2.4vw,30px)', fontWeight: 600, minHeight: 64 }}>
                    “{opt.text}”
                  </div>
                  <AnimatePresence>
                    {reveal && (
                      <motion.div
                        className="col gap-sm"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <div className="row gap-sm" style={{ alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                          {opt.author && <Avatar identity={opt.author.identity} size={36} />}
                          <span style={{ fontWeight: 700 }}>{opt.author?.name}</span>
                        </div>
                        <div className="row gap-xs wrap">
                          {opt.votes.map((v: Chip) => (
                            <div key={v.id} title={v.name}>
                              <Avatar identity={v.identity} size={26} />
                            </div>
                          ))}
                          {opt.votes.length === 0 && <span className="faint">No votes</span>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {!reveal && (
            <p className="muted" style={{ fontSize: 20 }}>
              {view.votesIn} of {view.votersTotal} votes in
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
