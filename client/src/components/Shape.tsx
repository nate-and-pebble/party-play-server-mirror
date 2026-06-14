import type { ShapeKey } from '@partyplay/shared';

/**
 * The redundant, non-color identity cue (A11Y-02). Each player's color is
 * always paired with a distinct shape, so players remain distinguishable
 * without relying on color perception.
 */
export function Shape({ shape, color, size = 48 }: { shape: ShapeKey; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`g-${shape}-${color}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={lighten(color, 0.18)} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <g fill={`url(#g-${shape}-${color})`}>{path(shape)}</g>
    </svg>
  );
}

function path(shape: ShapeKey): JSX.Element {
  switch (shape) {
    case 'circle':
      return <circle cx="50" cy="50" r="44" />;
    case 'square':
      return <rect x="8" y="8" width="84" height="84" rx="18" />;
    case 'triangle':
      return <polygon points="50,6 94,90 6,90" />;
    case 'diamond':
      return <polygon points="50,4 96,50 50,96 4,50" />;
    case 'hexagon':
      return <polygon points="50,5 90,28 90,72 50,95 10,72 10,28" />;
    case 'star':
      return <polygon points="50,4 61,38 97,38 68,59 79,94 50,72 21,94 32,59 3,38 39,38" />;
    case 'heart':
      return (
        <path d="M50 88 C 8 58, 12 18, 38 18 C 48 18, 50 30, 50 30 C 50 30, 52 18, 62 18 C 88 18, 92 58, 50 88 Z" />
      );
    case 'shield':
      return <path d="M50 6 L88 20 V54 C88 78 50 94 50 94 C50 94 12 78 12 54 V20 Z" />;
    case 'cross':
      return <polygon points="38,6 62,6 62,38 94,38 94,62 62,62 62,94 38,94 38,62 6,62 6,38 38,38" />;
    case 'bolt':
      return <polygon points="58,4 22,54 46,54 38,96 80,40 54,40" />;
    case 'moon':
      return <path d="M64 8 A44 44 0 1 0 64 92 A34 34 0 1 1 64 8 Z" />;
    case 'flower':
      return (
        <g>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse key={deg} cx="50" cy="24" rx="15" ry="24" transform={`rotate(${deg} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="14" fillOpacity="0.6" />
        </g>
      );
    default:
      return <circle cx="50" cy="50" r="44" />;
  }
}

function lighten(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const adj = (c: number) => Math.round(c + (255 - c) * amount);
  const r = adj(parseInt(m[1], 16));
  const g = adj(parseInt(m[2], 16));
  const b = adj(parseInt(m[3], 16));
  return `rgb(${r}, ${g}, ${b})`;
}
