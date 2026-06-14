import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Identity, ScreenEnvelope } from '@partyplay/shared';
import { socket } from '../../lib/socket';
import { drawStroke, type Stroke } from '../../lib/ink';
import { Avatar } from '../../components/ui';
import { GameHeader, IntroCard } from './_shared';

type Chip = { id: string; name: string; identity: Identity };

export function DoodleScreen({ view }: { view: any; env: ScreenEnvelope }) {
  if (view.phase === 'intro') {
    return (
      <IntroCard
        emoji="🎨"
        name="Doodle Dash"
        tagline="Draw it. Guess it. Fast."
        howToPlay={view.howToPlay ?? []}
        countdown={view.countdown}
        accent="#FF8A5B"
        accent2="#3DCCC7"
      />
    );
  }

  if (view.phase === 'choose') {
    return (
      <div className="col grow" style={{ minHeight: 0 }}>
        <GameHeader title="Doodle Dash" sub={`Turn ${view.turn} of ${view.turns}`} remaining={view.remaining} total={view.total} paused={view.paused} />
        <div className="col grow center-all gap-md">
          <Avatar identity={view.artist.identity} size={120} />
          <motion.h1 style={{ fontSize: 'clamp(32px,5vw,60px)', textAlign: 'center' }} animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            {view.artist.name} is picking a word…
          </motion.h1>
          <p className="muted" style={{ fontSize: 20 }}>
            Everyone else, get ready to guess! 👀
          </p>
        </div>
      </div>
    );
  }

  if (view.phase === 'draw') {
    return (
      <div className="col grow" style={{ minHeight: 0 }}>
        <GameHeader title="Doodle Dash" sub={`${view.artist.name} is drawing · Turn ${view.turn}/${view.turns}`} remaining={view.remaining} total={view.total} paused={view.paused} />
        <div className="row gap-md grow" style={{ padding: '0 20px 20px', minHeight: 0 }}>
          {/* Canvas + hint */}
          <div className="col grow gap-sm" style={{ minHeight: 0 }}>
            <div className="row center-all gap-md">
              <span className="roomcode" style={{ fontSize: 36, letterSpacing: '0.18em' }}>
                {view.hint}
              </span>
              <span className="pill">{view.letters} letters</span>
            </div>
            <DoodleCanvas strokes={view.strokes} />
          </div>
          {/* Sidebar */}
          <div className="col gap-md" style={{ flex: '0 0 300px', minHeight: 0 }}>
            <div className="card card-pad col gap-sm">
              <div className="tag">Solved · {view.solved.length}/{view.guessersTotal}</div>
              <div className="row wrap gap-sm">
                {view.solved.map((c: Chip) => (
                  <motion.div key={c.id} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Avatar identity={c.identity} size={36} />
                  </motion.div>
                ))}
                {view.solved.length === 0 && <span className="faint">Nobody yet…</span>}
              </div>
            </div>
            <div className="card card-pad col gap-xs grow scroll" style={{ minHeight: 0 }}>
              <div className="tag">Guesses</div>
              <AnimatePresence initial={false}>
                {[...view.feed].reverse().map((f: any, i: number) => (
                  <motion.div
                    key={`${f.chip.id}-${i}-${f.text}`}
                    className="row gap-sm"
                    style={{ alignItems: 'center' }}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Avatar identity={f.chip.identity} size={22} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{f.chip.name}:</span>
                    <span style={{ color: f.close ? 'var(--warn)' : 'var(--text-dim)', fontSize: 14 }}>
                      {f.text} {f.close ? '🔥' : ''}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view.phase === 'turnReveal') {
    return (
      <div className="col grow" style={{ minHeight: 0 }}>
        <GameHeader title="Time's up!" sub={`Turn ${view.turn} of ${view.turns}`} />
        <div className="row gap-md grow" style={{ padding: '0 20px 20px', minHeight: 0 }}>
          <div className="col grow gap-sm" style={{ minHeight: 0 }}>
            <div className="card card-pad t-center">
              <div className="tag">The word was</div>
              <h1 style={{ fontSize: 'clamp(32px,5vw,60px)', textTransform: 'capitalize' }}>{view.word}</h1>
            </div>
            <DoodleCanvas strokes={view.strokes} />
          </div>
          <div className="col gap-md" style={{ flex: '0 0 300px' }}>
            <div className="card card-pad col gap-sm">
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <Avatar identity={view.artist.identity} size={40} />
                <div className="col" style={{ lineHeight: 1.1 }}>
                  <span style={{ fontWeight: 700 }}>{view.artist.name}</span>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Artist · +{view.artistPoints}
                  </span>
                </div>
              </div>
            </div>
            <div className="card card-pad col gap-sm grow scroll" style={{ minHeight: 0 }}>
              <div className="tag">Correct guesses</div>
              {view.results.map((r: any, i: number) => (
                <div key={r.chip.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="row gap-sm" style={{ alignItems: 'center' }}>
                    <span className="faint mono">{i + 1}.</span>
                    <Avatar identity={r.chip.identity} size={28} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.chip.name}</span>
                  </div>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    +{r.points}
                  </span>
                </div>
              ))}
              {view.results.length === 0 && <span className="faint">Nobody guessed it 😬</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Renders authoritative strokes and applies live ink deltas from the server. */
function DoodleCanvas({ strokes }: { strokes: Stroke[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useRef<Stroke[]>([]);
  const dims = useRef({ w: 0, h: 0 });

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { w, h } = dims.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fbfbff';
    ctx.fillRect(0, 0, w, h);
    for (const s of model.current) drawStroke(ctx, s, 0, w, h);
  };

  const resize = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    dims.current = { w, h };
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  };

  // Mount: size + resize observer + ink stream.
  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);

    const onStream = (msg: any) => {
      if (msg.channel !== 'ink') return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      const { w, h } = dims.current;
      if (msg.op === 'clear') {
        model.current = [];
        redraw();
      } else if (msg.op === 'undo') {
        model.current.pop();
        redraw();
      } else if (msg.op === 'append') {
        let s = model.current.find((x) => x.id === msg.strokeId);
        if (!s) {
          s = { id: msg.strokeId, color: msg.color, width: msg.width, points: [] };
          model.current.push(s);
        }
        const startIdx = s.points.length;
        s.points.push(...msg.points);
        drawStroke(ctx, s, Math.max(0, startIdx - 2), w, h);
      }
    };
    socket.on('gameStream', onStream);
    return () => {
      ro.disconnect();
      socket.off('gameStream', onStream);
    };
  }, []);

  // Re-sync with authoritative strokes whenever the snapshot changes.
  useEffect(() => {
    model.current = (strokes ?? []).map((s) => ({ ...s, points: [...s.points] }));
    redraw();
  }, [strokes]);

  return (
    <div
      ref={wrapRef}
      className="grow"
      style={{ minHeight: 0, borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-pop)', border: '1px solid var(--border-strong)' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}
