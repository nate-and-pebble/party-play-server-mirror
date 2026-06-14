import { AVATAR_POOL as SHARED_AVATAR_POOL, type Identity, type ShapeKey } from '@partyplay/shared';

/**
 * Identity palette. Each slot pairs a vibrant (on dark) color with a UNIQUE
 * shape, so players are always distinguishable without relying on color alone
 * (A11Y-02 / ID-02). Avatars are a default suggestion the player can change.
 */
interface Slot {
  color: string;
  colorName: string;
  shape: ShapeKey;
  avatar: string;
}

export const PALETTE: Slot[] = [
  { color: '#FF6B6B', colorName: 'Coral', shape: 'circle', avatar: '🦊' },
  { color: '#FF9F43', colorName: 'Tangerine', shape: 'square', avatar: '🐯' },
  { color: '#FECA57', colorName: 'Sunflower', shape: 'triangle', avatar: '🐥' },
  { color: '#1DD1A1', colorName: 'Jade', shape: 'diamond', avatar: '🐸' },
  { color: '#48DBFB', colorName: 'Aqua', shape: 'hexagon', avatar: '🐬' },
  { color: '#54A0FF', colorName: 'Sky', shape: 'star', avatar: '🦋' },
  { color: '#5F6CFF', colorName: 'Indigo', shape: 'heart', avatar: '🦄' },
  { color: '#C56CF0', colorName: 'Orchid', shape: 'shield', avatar: '🐙' },
  { color: '#FF6BD6', colorName: 'Bubblegum', shape: 'cross', avatar: '🦩' },
  { color: '#FF5E8A', colorName: 'Rose', shape: 'bolt', avatar: '🐷' },
  { color: '#7BED9F', colorName: 'Mint', shape: 'moon', avatar: '🐢' },
  { color: '#A5B1C2', colorName: 'Slate', shape: 'flower', avatar: '🐺' },
];

/** A wider pool of avatars a player can choose from on their phone. */
export const AVATAR_POOL = SHARED_AVATAR_POOL;

/** Pick the lowest-index palette slot not already in use. Wraps if full. */
export function assignIdentity(usedColors: Set<string>): Identity {
  const slot = PALETTE.find((s) => !usedColors.has(s.color)) ?? PALETTE[usedColors.size % PALETTE.length];
  return {
    color: slot.color,
    colorName: slot.colorName,
    avatar: slot.avatar,
    shape: slot.shape,
  };
}

/** Cycle a player to the next palette color, preferring an unused one. */
export function nextColor(current: string, usedColors: Set<string>): Identity {
  const idx = PALETTE.findIndex((s) => s.color === current);
  for (let step = 1; step <= PALETTE.length; step++) {
    const slot = PALETTE[(idx + step) % PALETTE.length];
    if (!usedColors.has(slot.color) || slot.color === current) {
      return { color: slot.color, colorName: slot.colorName, avatar: slot.avatar, shape: slot.shape };
    }
  }
  const slot = PALETTE[(idx + 1) % PALETTE.length];
  return { color: slot.color, colorName: slot.colorName, avatar: slot.avatar, shape: slot.shape };
}
