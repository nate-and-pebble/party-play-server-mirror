import { useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerEnvelope } from '@partyplay/shared';
import { send } from '../../lib/socket';
import { sound } from '../../lib/sound';
import { TimerBar } from '../../components/ui';

export function QuibbleController({ view }: { view: any; env: PlayerEnvelope }) {
  if (view.phase === 'intro') return <Waiting emoji="✍️" title="Quibble" sub="Prompts incoming…" />;
  if (view.phase === 'answer') return <AnswerPhase view={view} />;
  if (view.phase === 'vote') return <VotePhase view={view} />;
  if (view.phase === 'reveal') return <RevealPhase view={view} />;
  return <Waiting emoji="✍️" title="Quibble" sub="…" />;
}

function AnswerPhase({ view }: { view: any }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const submit = (matchId: string, text: string) => {
    if (!text.trim()) return;
    send('player:action', { type: 'answer', matchId, text: text.trim() });
    sound.pop();
  };
  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <div style={{ padding: '10px 16px 0' }}>
        <TimerBar remaining={view.remaining} total={75} />
      </div>
      <div className="col grow scroll gap-md" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 22 }}>Your prompts</h2>
        {view.prompts.length === 0 && (
          <div className="card card-pad t-center muted">You joined mid-round — sit tight for the vote! 🍿</div>
        )}
        {view.prompts.map((p: any) => {
          const value = drafts[p.matchId] ?? p.answer ?? '';
          return (
            <motion.div key={p.matchId} className="card card-pad col gap-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="tag">Prompt</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{p.prompt}</div>
              <textarea
                className="input"
                rows={2}
                maxLength={120}
                placeholder="Be funny…"
                value={value}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.matchId]: e.target.value }))}
                style={{ resize: 'none' }}
              />
              <button
                className={`btn btn-block ${p.submitted ? '' : 'btn-primary'}`}
                onClick={() => submit(p.matchId, value)}
                disabled={!value.trim()}
              >
                {p.submitted ? '✅ Submitted · tap to update' : 'Submit answer'}
              </button>
            </motion.div>
          );
        })}
        {view.prompts.length > 0 && view.prompts.every((p: any) => p.submitted) && (
          <div className="card card-pad t-center" style={{ background: 'rgba(52,211,153,0.14)' }}>
            <b>All locked in!</b> Waiting for the others… 👀
          </div>
        )}
      </div>
    </div>
  );
}

function VotePhase({ view }: { view: any }) {
  const vote = (key: string) => {
    send('player:action', { type: 'vote', key });
    sound.tap();
  };
  if (view.isAuthor) {
    return (
      <div className="col grow center-all gap-md" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}>😎</div>
        <h2 style={{ fontSize: 26 }}>This matchup is yours!</h2>
        <p className="muted">Sit back — you can’t vote on your own answer.</p>
        <div className="card card-pad" style={{ width: '100%' }}>
          <div className="tag">Prompt</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{view.prompt}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <div style={{ padding: '10px 16px 0' }}>
        <TimerBar remaining={view.remaining} total={22} />
      </div>
      <div className="col grow gap-md" style={{ padding: 16 }}>
        <div className="card card-pad">
          <div className="tag">Vote for the funniest · {view.matchIndex + 1}/{view.matchCount}</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{view.prompt}</div>
        </div>
        <div className="col grow gap-md">
          {view.options.map((opt: any, i: number) => {
            const chosen = view.yourVote === opt.key;
            return (
              <motion.button
                key={opt.key}
                whileTap={{ scale: 0.97 }}
                onClick={() => vote(opt.key)}
                className="card card-pad col"
                style={{
                  flex: 1,
                  textAlign: 'left',
                  border: chosen ? '3px solid var(--brand-2)' : '1px solid var(--border-strong)',
                  background: chosen ? 'rgba(255,107,214,0.18)' : i === 0 ? 'rgba(124,92,255,0.12)' : 'rgba(255,107,214,0.08)',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span className="tag">{chosen ? '★ Your pick' : `Option ${opt.key}`}</span>
                <span style={{ fontSize: 20, fontWeight: 600 }}>“{opt.text}”</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RevealPhase({ view }: { view: any }) {
  return (
    <div className="col grow center-all gap-md" style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>{view.gained > 0 ? '🎉' : '👀'}</div>
      <h2 style={{ fontSize: 28 }}>{view.gained > 0 ? `+${view.gained} points!` : 'Results on the big screen'}</h2>
      <p className="muted">{view.wasAuthor ? 'How did your answer do?' : 'Look up! 👆'}</p>
    </div>
  );
}

function Waiting({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="col grow center-all gap-sm" style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>{emoji}</div>
      <h2 style={{ fontSize: 26 }}>{title}</h2>
      <p className="muted">{sub}</p>
    </div>
  );
}
