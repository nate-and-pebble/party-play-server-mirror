/**
 * Synthesized sound effects via the Web Audio API — no asset files, no network.
 * The AudioContext is created lazily on first use (after a user gesture) so we
 * never trip browser autoplay policies. Subtle by design; mutable.
 */
import { muteStore } from './persist';

let ctx: AudioContext | null = null;
let muted = muteStore.get();

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

type Wave = OscillatorType;

function tone(freq: number, start: number, dur: number, gain = 0.12, type: Wave = 'sine', slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sound = {
  get muted() {
    return muted;
  },
  toggleMute(): boolean {
    muted = !muted;
    muteStore.set(muted);
    if (muted && ctx) ctx.suspend().catch(() => {});
    return muted;
  },
  /** Call on a user gesture to unlock audio on iOS. */
  unlock() {
    ac();
  },
  join() {
    tone(523, 0, 0.12, 0.1, 'triangle');
    tone(784, 0.06, 0.14, 0.1, 'triangle');
  },
  pop() {
    tone(440, 0, 0.08, 0.09, 'square', 880);
  },
  tap() {
    tone(320, 0, 0.05, 0.06, 'sine');
  },
  start() {
    tone(392, 0, 0.1, 0.1, 'sawtooth');
    tone(587, 0.08, 0.12, 0.1, 'sawtooth');
    tone(784, 0.16, 0.2, 0.1, 'sawtooth');
  },
  correct() {
    tone(659, 0, 0.1, 0.12, 'triangle');
    tone(988, 0.08, 0.18, 0.12, 'triangle');
  },
  wrong() {
    tone(220, 0, 0.18, 0.1, 'sawtooth', 120);
  },
  tick() {
    tone(880, 0, 0.03, 0.05, 'square');
  },
  countdown() {
    tone(660, 0, 0.06, 0.08, 'square');
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.22, 0.13, 'triangle'));
  },
  whoosh() {
    tone(180, 0, 0.25, 0.07, 'sine', 720);
  },
  reveal() {
    tone(330, 0, 0.12, 0.09, 'triangle', 660);
  },
};
