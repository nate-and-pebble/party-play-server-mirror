import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerEnvelope } from '@partyplay/shared';
import { send } from '../../lib/socket';
import { sound } from '../../lib/sound';
import { drawStroke, INK_COLORS, INK_WIDTHS, type Stroke } from '../../lib/ink';
import { Avatar, TimerBar } from '../../components/ui';

export function DoodleController({ view, env }: { view: any; env: PlayerEnvelope }) {
  if (view.phase === 'intro') {
    return (
      <div className="col grow center-all gap-sm" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}>🎨</div>
        <h2 style={{ fontSize: 26 }}>Doodle Dash</h2>
        <p className="muted">{view.upNext ? "You're up first — get ready to draw!" : 'Watch the screen and guess!'}</p>
      </div>
    );
  }

  if (view.phase === 'choose') {
    if (view.role === 'artist') {
      const pick = (index: number) => {
        send('player:action', { type: 'pickWord', index });
        sound.pop();
      };
      return (
        <div className="col grow" style={{ minHeight: 0 }}>
          <div style={{ padding: '10px 16px 0' }}>
            <TimerBar remaining={view.remaining} total={15} />
          </div>
          <div className="col grow center-all gap-md" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 24, textAlign: 'center' }}>Pick your word to draw</h2>
            {view.choices.map((w: string, i: number) => (
              <motion.button
                key={w}
                whileTap={{ scale: 0.97 }}
                className="btn btn-primary btn-lg btn-block"
                style={{ fontSize: 22, padding: 22, textTransform: 'capitalize' }}
                onClick={() => pick(i)}
              >
                {w}
              </motion.button>
            ))}
            <p className="faint t-center">Keep it secret 🤫 — only you can see these.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="col grow center-all gap-md" style={{ padding: 24, textAlign: 'center' }}>
        <Avatar identity={view.artist.identity} size={88} />
        <h2 style={{ fontSize: 24 }}>{view.artist.name} is choosing…</h2>
        <p className="muted">Get your guessing fingers ready! 👀</p>
      </div>
    );
  }

  if (view.phase === 'draw') {
    if (view.role === 'artist') {
      return <DrawPad word={view.word} remaining={view.remaining} solvedCount={view.solvedCount} guessersTotal={view.guessersTotal} />;
    }
    return <GuessPad view={view} />;
  }

  if (view.phase === 'turnReveal') {
    return (
      <div className="col grow center-all gap-md" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}>{view.correct || view.youWereArtist ? '🎉' : '🙈'}</div>
        <div className="tag">The word was</div>
        <h1 style={{ fontSize: 36, textTransform: 'capitalize' }}>{view.word}</h1>
        {view.gained > 0 && <div className="pill mono" style={{ fontSize: 20 }}>+{view.gained} pts</div>}
        <p className="muted">{view.youWereArtist ? 'Nice drawing!' : view.correct ? 'You got it!' : 'Get the next one!'}</p>
      </div>
    );
  }

  return null;
}

// ── Guesser ───────────────────────────────────────────────────────────────
function GuessPad({ view }: { view: any }) {
  const [text, setText] = useState('');
  const guess = () => {
    if (!text.trim()) return;
    send('player:action', { type: 'guess', text: text.trim() });
    setText('');
  };
  if (view.solved) {
    return (
      <div className="col grow center-all gap-md" style={{ padding: 24, textAlign: 'center', background: 'rgba(52,211,153,0.16)' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 84 }}>
          ✅
        </motion.div>
        <h1 style={{ fontSize: 32 }}>You got it!</h1>
        <div className="pill mono" style={{ fontSize: 20 }}>+{view.gained} pts</div>
        <p className="muted">Watch the rest unfold on the screen 👆</p>
      </div>
    );
  }
  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <div style={{ padding: '10px 16px 0' }}>
        <TimerBar remaining={view.remaining} total={80} />
      </div>
      <div className="col grow center-all gap-md" style={{ padding: 20 }}>
        <div className="col center-all gap-xs">
          <span className="faint">{view.artist.name} is drawing</span>
          <span className="roomcode" style={{ fontSize: 28, letterSpacing: '0.15em' }}>
            {view.hint}
          </span>
          <span className="pill">{view.letters} letters</span>
        </div>
        <div style={{ fontSize: 56 }}>👀</div>
        <p className="muted t-center">Look at the big screen and type what you think it is!</p>
        <div className="row gap-sm" style={{ width: '100%' }}>
          <input
            className="input"
            placeholder="Your guess…"
            value={text}
            maxLength={40}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()}
          />
          <button className="btn btn-primary btn-lg" onClick={guess} disabled={!text.trim()}>
            Guess
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Artist drawing pad ──────────────────────────────────────────────────────
function DrawPad({ word, remaining, solvedCount, guessersTotal }: { word: string; remaining: number; solvedCount: number; guessersTotal: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useRef<Stroke[]>([]);
  const dims = useRef({ w: 0, h: 0 });
  const current = useRef<Stroke | null>(null);
  const buffer = useRef<number[]>([]);
  const drawing = useRef(false);

  const [color, setColor] = useState(INK_COLORS[0]);
  const [width, setWidth] = useState(INK_WIDTHS[1]);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  colorRef.current = color;
  widthRef.current = width;

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

  const point = (e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return [x, y];
  };

  const flush = () => {
    if (!current.current || buffer.current.length === 0) return;
    send('player:action', {
      type: 'draw',
      strokeId: current.current.id,
      points: buffer.current,
      color: current.current.color,
      width: current.current.width,
    });
    buffer.current = [];
  };

  // Mount: canvas sizing + flush loop.
  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    const flusher = setInterval(flush, 60);
    return () => {
      ro.disconnect();
      clearInterval(flusher);
    };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const [x, y] = point(e);
    const stroke: Stroke = { id: 'k' + Math.random().toString(36).slice(2, 9), color: colorRef.current, width: widthRef.current, points: [x, y] };
    current.current = stroke;
    model.current.push(stroke);
    buffer.current = [x, y];
    redrawDot(x, y);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !current.current) return;
    const [x, y] = point(e);
    const s = current.current;
    const fromIdx = s.points.length;
    s.points.push(x, y);
    buffer.current.push(x, y);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) drawStroke(ctx, s, Math.max(0, fromIdx - 2), dims.current.w, dims.current.h);
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    flush();
    current.current = null;
  };
  const redrawDot = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !current.current) return;
    drawStroke(ctx, { ...current.current, points: [x, y] }, 0, dims.current.w, dims.current.h);
  };

  const undo = () => {
    model.current.pop();
    redraw();
    send('player:action', { type: 'undo' });
    sound.tap();
  };
  const clear = () => {
    model.current = [];
    redraw();
    send('player:action', { type: 'clearCanvas' });
    sound.tap();
  };

  return (
    <div className="col grow" style={{ minHeight: 0 }}>
      <div className="col gap-xs" style={{ padding: '10px 14px 0' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-xs" style={{ alignItems: 'baseline' }}>
            <span className="faint">Draw:</span>
            <b style={{ fontSize: 20, textTransform: 'capitalize' }}>{word}</b>
          </div>
          <span className="pill">
            ✅ {solvedCount}/{guessersTotal}
          </span>
        </div>
        <TimerBar remaining={remaining} total={80} />
      </div>

      <div
        ref={wrapRef}
        className="grow"
        style={{ margin: 14, marginBottom: 8, borderRadius: 18, overflow: 'hidden', minHeight: 0, touchAction: 'none', boxShadow: 'var(--shadow-pop)' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ display: 'block', touchAction: 'none' }}
        />
      </div>

      {/* Toolbar */}
      <div className="col gap-sm" style={{ padding: '0 14px 14px' }}>
        <div className="row gap-xs wrap" style={{ justifyContent: 'center' }}>
          {INK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                sound.tap();
              }}
              aria-label={`color ${c}`}
              style={{
                width: 30,
                height: 30,
                borderRadius: 99,
                background: c,
                border: c === color ? '3px solid var(--text)' : '2px solid var(--border-strong)',
              }}
            />
          ))}
        </div>
        <div className="row gap-sm center-all">
          {INK_WIDTHS.map((wd, i) => (
            <button
              key={wd}
              onClick={() => setWidth(wd)}
              className="center"
              style={{
                width: 44,
                height: 36,
                borderRadius: 12,
                background: wd === width ? 'var(--surface-strong)' : 'var(--surface)',
                border: `1px solid ${wd === width ? 'var(--text)' : 'var(--border)'}`,
              }}
            >
              <span style={{ width: 6 + i * 7, height: 6 + i * 7, borderRadius: 99, background: color === '#ffffff' ? '#888' : color, display: 'block' }} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={undo} style={{ padding: '8px 14px' }}>
            ↩ Undo
          </button>
          <button className="btn btn-danger" onClick={clear} style={{ padding: '8px 14px' }}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
